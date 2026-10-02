import asyncio
from types import SimpleNamespace
import httpx
from fastapi.testclient import TestClient
from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.modules.admin import router as admin_router

UID='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
ORDER1='11111111-1111-4111-8111-111111111111'
ORDER2='22222222-2222-4222-8222-222222222222'
ORDER3='33333333-3333-4333-8333-333333333333'

ORDERS=[
    {
        'id':ORDER2,'codigo':'HW-2026-000002','nome_cliente':'Cliente Dois','status':'preparando',
        'review_required':False,'total':'200.00','created_at':'2026-02-10T15:00:00Z',
        'order_items':[{'nome_produto':'Calça','tamanho':'M','quantidade':1}],
        'payments':[{'order_id':ORDER2,'metodo':'cartao','status':'approved','valor':'200.00','aprovado_em':'2026-02-10T15:05:00Z'}]
    },
    {
        'id':ORDER1,'codigo':'HW-2026-000001','nome_cliente':'Cliente Um','status':'pagamento_aprovado',
        'review_required':False,'total':'100.00','created_at':'2026-01-05T12:00:00Z',
        'order_items':[{'nome_produto':'Camisa','tamanho':'G','quantidade':1}],
        'payments':[{'order_id':ORDER1,'metodo':'pix','status':'approved','valor':'100.00','aprovado_em':'2026-01-05T12:01:00Z'}]
    },
    {
        'id':ORDER3,'codigo':'HW-2026-000003','nome_cliente':'Cliente Três','status':'cancelado',
        'review_required':False,'total':'300.00','created_at':'2026-03-03T12:00:00Z',
        'order_items':[{'nome_produto':'Tênis','tamanho':'41','quantidade':1}],
        'payments':[{'order_id':ORDER3,'metodo':'pix','status':'refunded','valor':'300.00','aprovado_em':'2026-03-03T12:02:00Z'}]
    }
]

def handler(request):
    if request.url.path=='/auth/v1/user':
        return httpx.Response(200,json={'id':UID})
    if request.url.path=='/rest/v1/profiles':
        return httpx.Response(200,json=[{'role':'admin'}])
    if request.url.path=='/rest/v1/orders':
        return httpx.Response(200,json=ORDERS)
    return httpx.Response(404,json={'message':'not found'})

def client():
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-key')
    return TestClient(create_app(cfg,httpx.MockTransport(handler)))

def test_dashboard_uses_only_confirmed_sales_for_revenue():
    with client() as c:
        response=c.get('/api/admin/dashboard',headers={'Authorization':'Bearer admin-session'})
        assert response.status_code==200
        data=response.json()
        assert data['orders']==3
        assert data['paid_orders']==2
        assert data['revenue']=='300.00'
        assert [p['codigo'] for p in data['recent_purchases']]==['HW-2026-000002','HW-2026-000001']
        assert data['recent_purchases'][0]['metodo']=='cartao'

def test_annual_revenue_plotly_groups_sales_by_month():
    with client() as c:
        response=c.get('/api/admin/revenue/annual?year=2026',headers={'Authorization':'Bearer admin-session'})
        assert response.status_code==200
        data=response.json()
        assert data['year']==2026
        assert data['total']=='300.00'
        assert data['months'][0]=={'month':'Jan','revenue':'100.00','orders':1}
        assert data['months'][1]=={'month':'Fev','revenue':'200.00','orders':1}
        assert data['months'][2]=={'month':'Mar','revenue':'0.00','orders':0}
        assert data['figure']['data'][0]['type']=='bar'
        assert data['figure']['data'][0]['y'][:3]==[100.0,200.0,0.0]


def test_admin_reconciles_pending_payment_with_provider(monkeypatch):
    class Token:
        def get_secret_value(self):return 'mp-token'
    class FakeDB:
        settings=SimpleNamespace(mercadopago_access_token=Token())
        client=None
        async def request(self,path,**kwargs):
            if path=='/rest/v1/payments':
                return [{'mercadopago_payment_id':'987654321','status':'pending'}]
            if path=='/rest/v1/orders':
                return []
            raise AssertionError(path)
    applied=[]
    async def fake_request(self,path,**kwargs):
        assert path=='/v1/payments/987654321'
        return {'id':987654321,'status':'approved'}
    async def fake_apply(db,payment):
        applied.append(payment)
    monkeypatch.setattr(admin_router.MercadoPago,'request',fake_request)
    monkeypatch.setattr(admin_router,'apply_payment',fake_apply)
    updated=asyncio.run(admin_router._reconcile_open_payments(FakeDB(),SimpleNamespace(token='admin')))
    assert updated==1
    assert applied[0]['status']=='approved'

def test_admin_recovers_payment_missing_from_supabase_using_order_reference(monkeypatch):
    class Token:
        def get_secret_value(self):return 'mp-token'
    class FakeDB:
        settings=SimpleNamespace(mercadopago_access_token=Token())
        client=None
        async def request(self,path,**kwargs):
            if path=='/rest/v1/payments':
                return []
            if path=='/rest/v1/orders':
                return [{'id':ORDER1,'status':'recebido','created_at':'2026-10-01T10:00:00Z','payments':[]}]
            raise AssertionError(path)
    applied=[]
    async def fake_request(self,path,**kwargs):
        assert path.startswith('/v1/payments/search?external_reference=')
        return {'results':[{'id':123456789,'status':'approved','external_reference':ORDER1,'date_last_updated':'2026-10-01T10:05:00Z'}]}
    async def fake_apply(db,payment):
        applied.append(payment)
    monkeypatch.setattr(admin_router.MercadoPago,'request',fake_request)
    monkeypatch.setattr(admin_router,'apply_payment',fake_apply)
    updated=asyncio.run(admin_router._reconcile_open_payments(FakeDB(),SimpleNamespace(token='admin')))
    assert updated==1
    assert applied==[{'id':123456789,'status':'approved','external_reference':ORDER1,'date_last_updated':'2026-10-01T10:05:00Z'}]

def test_revenue_chart_supports_day_week_month_and_year():
    with client() as c:
        headers={'Authorization':'Bearer admin-session'}
        for period in ('day','week','month','year'):
            response=c.get('/api/admin/revenue/chart?period='+period,headers=headers)
            assert response.status_code==200
            data=response.json()
            assert data['period']==period
            assert data['figure']['data'][0]['type']=='bar'
            assert isinstance(data['points'],list) and data['points']


def test_revenue_chart_exports_csv_and_xlsx():
    with client() as c:
        headers={'Authorization':'Bearer admin-session'}
        csv_response=c.get('/api/admin/revenue/export?period=year&format=csv',headers=headers)
        assert csv_response.status_code==200
        assert csv_response.headers['content-type'].startswith('text/csv')
        assert 'Período' in csv_response.text
        assert 'Faturamento (R$)' in csv_response.text
        xlsx_response=c.get('/api/admin/revenue/export?period=year&format=xlsx',headers=headers)
        assert xlsx_response.status_code==200
        assert xlsx_response.content.startswith(b'PK')
        assert xlsx_response.headers['content-type'].startswith('application/vnd.openxmlformats')
