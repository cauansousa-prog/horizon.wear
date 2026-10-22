"""Regressão da central e isolamento entre as lojas no mesmo Supabase."""
from pathlib import Path
import httpx
from fastapi.testclient import TestClient
from pglast import parse_sql
from backend.app.config import Settings
from backend.app.main import create_app

UID='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
PID='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
KEY='cccccccc-cccc-4ccc-cccc-cccccccccccc'

def setup_client(calls):
    def handle(req):
        calls.append(req)
        assert req.headers['apikey']=='public-test-key'
        assert req.headers['authorization']!='Bearer server-secret'
        if req.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':UID})
        if req.url.path=='/rest/v1/hub_memberships':
            assert req.url.params['user_id']=='eq.'+UID
            allowed=req.url.params['loja_id']=='eq.academia' and req.headers['authorization']=='Bearer manager'
            return httpx.Response(200,json=[{'role':'admin'}] if allowed else [])
        assert req.url.path=='/rest/v1/hub_products'
        assert req.method=='GET'
        items=[{'id':PID,'nome':'Halter','preco':19.95,'estoque':2}] if req.url.params['loja_id']=='eq.academia' else []
        return httpx.Response(200,json=items)
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-test-key',supabase_service_role_key='server-secret')
    return TestClient(create_app(cfg,httpx.MockTransport(handle)))

def test_central_static_and_frames():
    with setup_client([]) as client:
        assert len(client.get('/api/lojas').json())==3
        assert client.get('/central/').headers['x-frame-options']=='DENY'
        for path in ['/Index.html','/lojas/academia/','/lojas/construcao/','/central/admin.html']:
            response=client.get(path)
            assert response.status_code==200,path
            assert response.headers['x-frame-options']=='SAMEORIGIN'
        for path in ['/central/central.js','/shared/lojas-client.js','/shared/loja-modelo.css']:
            assert client.get(path).status_code==200
        for path in ['/lojas/academia/.env','/lojas/construcao/backend.py','/lojas/LEIA-ME.md']:
            assert client.get(path).status_code==404
        assert client.get('/api/lojas/invalida/products').status_code==404

def test_quotes_and_demo_cannot_mix_stores_or_write_stock():
    calls=[]
    body={'items':[{'product_id':PID,'quantity':2}]}
    with setup_client(calls) as client:
        assert client.post('/api/lojas/academia/quote',json=body).json()['total']=='39.90'
        assert client.post('/api/lojas/construcao/quote',json=body).status_code==409
        assert client.post('/api/lojas/academia/quote',json={'items':[{'product_id':PID,'quantity':3}]}).status_code==409
        assert client.post('/api/lojas/academia/quote',json={**body,'total':1}).status_code==422
        for method in ['pix','cartao','boleto']:
            result=client.post('/api/lojas/academia/checkout/simulate',json={**body,'method':method},headers={'Idempotency-Key':KEY})
            assert result.status_code==200
            assert result.json()['simulation'] is True
            assert result.json()['total']=='39.90'
    assert all(r.method=='GET' for r in calls)

def test_admin_requires_membership_for_selected_store():
    with setup_client([]) as client:
        for slug in ['academia','construcao']:
            assert client.get('/api/lojas/'+slug+'/admin/products').status_code==401
            assert client.get('/api/lojas/'+slug+'/admin/products',headers={'Authorization':'Bearer customer'}).status_code==403
        assert client.get('/api/lojas/academia/admin/products',headers={'Authorization':'Bearer manager'}).status_code==200
        assert client.get('/api/lojas/construcao/admin/products',headers={'Authorization':'Bearer manager'}).status_code==403
        body={'slug':'halter','nome':'Halter','preco':'19.95','loja_id':'construcao'}
        assert client.post('/api/lojas/academia/admin/products',json=body,headers={'Authorization':'Bearer manager'}).status_code==422

def test_hub_migration_parses():
    path=Path(__file__).resolve().parents[2]/'supabase/migrations/0007_store_hub.sql'
    assert len(parse_sql(path.read_text(encoding='utf-8')))>40
