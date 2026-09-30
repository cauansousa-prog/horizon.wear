import json
import httpx
from fastapi.testclient import TestClient
from backend.app.config import Settings
from backend.app.main import create_app
from backend.tests.test_checkout_flow import body,KEY,SIZE,ORDER

def test_demo_accepts_optional_cpf_phone_and_names_bad_address():
    def handle(request):
        assert request.method=='GET' and request.url.path=='/rest/v1/product_sizes'
        return httpx.Response(200,json=[{'id':SIZE,'tamanho':'M','estoque':12,
            'products':{'id':ORDER,'nome':'Camisa','preco':100,'preco_promocional':None}}])
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-key')
    payload=body('pix');payload['customer'].update(cpf='',phone='')
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        assert client.post('/api/checkout/simulate',json=payload,headers={'Idempotency-Key':KEY}).status_code==200
        payload['customer']['address']['cep']='123'
        result=client.post('/api/checkout/simulate',json=payload,headers={'Idempotency-Key':KEY})
        assert result.status_code==422 and result.json()['fields']==['CEP']
        assert 'cliente@example.com' not in result.text

def test_profile_save_trims_and_returns_persisted_values():
    profile={'id':ORDER,'full_name':'Nome anterior','phone':''}
    def handle(request):
        if request.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':ORDER})
        if request.method=='PATCH':
            assert request.url.params['id']=='eq.'+ORDER
            assert request.headers['authorization']=='Bearer customer-session'
            data=json.loads(request.content)
            assert data=={'nome_completo':'Cliente Horizon','telefone':'(85) 99999-9999'}
            profile.update(full_name=data['nome_completo'],phone=data['telefone'])
        return httpx.Response(200,json=[profile])
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-key')
    headers={'Authorization':'Bearer customer-session'}
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        saved=client.patch('/api/users/me',headers=headers,json={'nome_completo':' Cliente Horizon ','telefone':' (85) 99999-9999 '})
        assert saved.status_code==200 and saved.json()['full_name']=='Cliente Horizon'
        fetched=client.get('/api/users/me',headers=headers)
        assert fetched.json()['phone']=='(85) 99999-9999'
