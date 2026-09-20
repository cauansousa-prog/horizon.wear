from decimal import Decimal
import hashlib,hmac
import httpx,pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app.config import Settings
from backend.app.modules.payments.gateway import verify_signature
from pglast import parse_sql
from pathlib import Path

UID='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
SID='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
def config(**kw):return Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-key',**kw)
def transport(request):
    if request.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':UID})
    if request.url.path=='/rest/v1/profiles':return httpx.Response(200,json=[{'id':UID,'role':'customer'}])
    if request.url.path=='/rest/v1/product_sizes':return httpx.Response(200,json=[{'id':SID,'tamanho':'M','estoque':2,'products':{'id':UID,'nome':'Peça teste','slug':'peca','preco':100,'preco_promocional':90,'ativo':True,'product_images':[]}}])
    return httpx.Response(200,json=[])

@pytest.fixture
def client():
    with TestClient(create_app(config(),httpx.MockTransport(transport))) as c:yield c

def test_quote_server_prices(client):
    r=client.post('/api/cart/quote',json={'items':[{'size_id':SID,'quantity':2}]})
    assert r.status_code==200
    assert Decimal(r.json()['subtotal'])==Decimal('180')

@pytest.mark.parametrize('quantity',[3,100,-1,1.5])
def test_invalid_quantity(client,quantity):
    assert client.post('/api/cart/quote',json={'items':[{'size_id':SID,'quantity':quantity}]}).status_code in (409,422)

def test_duplicate_size_rejected(client):
    assert client.post('/api/cart/quote',json={'items':[{'size_id':SID,'quantity':1}]*2}).status_code==422

def test_admin_denied_for_customer(client):
    assert client.get('/api/admin/dashboard',headers={'Authorization':'Bearer customer'}).status_code==403
    assert client.post('/api/admin/products',headers={'Authorization':'Bearer customer'},json={}).status_code==403

def test_role_cannot_be_posted(client):
    assert client.patch('/api/users/me',headers={'Authorization':'Bearer customer'},json={'nome_completo':'Cliente','role':'admin'}).status_code==422

def test_checkout_not_faked(client):
    assert client.get('/api/checkout/config').json()['available'] is False
    assert client.post('/api/webhooks/mercadopago?data.id=123').status_code==503

def test_hmac_signature():
    signature=hmac.new(b'secret',b'id:123;request-id:request;ts:123456;',hashlib.sha256).hexdigest()
    assert verify_signature('secret','ts=123456,v1='+signature,'request','123')
    assert not verify_signature('secret','ts=123456,v1='+signature,'request','124')
    assert not verify_signature('secret','bad','request','123')
    assert not verify_signature('secret','ts=123456,v1='+signature,'','123')

def test_missing_auth_rejected(client):
    for path in ['/api/cart','/api/addresses','/api/orders','/api/admin/products']:
        assert client.get(path).status_code==401

def test_checkout_sql_parses():
    sql=Path(__file__).resolve().parents[2]/'supabase/migrations/0003_checkout_existing.sql'
    assert len(parse_sql(sql.read_text(encoding='utf-8')))>10
