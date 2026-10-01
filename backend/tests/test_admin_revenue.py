import httpx
from fastapi.testclient import TestClient
from backend.app.config import Settings
from backend.app.main import create_app

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
