import hashlib
import hmac
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from pglast import parse_sql

from backend.app.config import Settings
from backend.app.main import create_app

ORDER = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
SIZE = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
USER = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'
KEY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
TOKEN = 'guest-checkout-token-with-at-least-32-characters'


def body(method):
    return {
        'customer': {
            'name': 'Cliente Exemplo', 'email': 'cliente@example.com',
            'cpf': '12345678909', 'phone': '85999999999',
            'address': {'destinatario': 'Cliente Exemplo', 'cep': '60000000',
                        'rua': 'Rua Exemplo', 'numero': '10', 'bairro': 'Centro',
                        'cidade': 'Fortaleza', 'estado': 'CE'}},
        'items': [{'size_id': SIZE, 'quantity': 1}],
        'method': method,
        **({'token': 'card-token', 'payment_method_id': 'visa'} if method == 'cartao' else {})
    }


@pytest.mark.parametrize('method,provider_method',
                         [('pix', 'pix'), ('boleto', 'bolbradesco'), ('cartao', 'visa')])
def test_checkout_and_signed_webhook(method, provider_method):
    calls = []
    state = {'payment_id': None, 'review_required': False, 'status': 'pending'}

    def handle(request):
        calls.append(request)
        path = request.url.path
        if path == '/v1/payment_methods':
            assert request.headers['authorization'] == 'Bearer private-payment-token'
            return httpx.Response(200, json=[{'id': 'pix', 'payment_type_id': 'bank_transfer'},
                                             {'id': 'bolbradesco', 'payment_type_id': 'ticket'},
                                             {'id': 'visa', 'payment_type_id': 'credit_card'}])
        if path == '/rest/v1/product_sizes':
            assert request.headers['authorization'] == 'Bearer public-key'
            return httpx.Response(200, json=[{'id': SIZE, 'tamanho': 'M', 'estoque': 2,
                'products': {'id': ORDER, 'nome': 'Peça', 'slug': 'peca', 'preco': 100,
                             'preco_promocional': 90, 'ativo': True, 'product_images': []}}])
        if path == '/rest/v1/rpc/horizon_create_order':
            assert request.headers['authorization'] == 'Bearer server-only-key'
            payload = json.loads(request.content)
            assert payload['p_shipping'] == '0.0'
            assert payload['p_items'] == [{'size_id': SIZE, 'quantity': 1}]
            return httpx.Response(200, json={'id': ORDER, 'codigo': 101, 'total': 90})
        if path == '/v1/payments' and request.method == 'POST':
            assert request.headers['x-idempotency-key'] == KEY
            payload = json.loads(request.content)
            assert payload['transaction_amount'] == 90
            assert payload['payment_method_id'] == provider_method
            assert payload['external_reference'] == ORDER
            assert payload['notification_url'] == 'https://horizon.example/api/webhooks/mercadopago'
            if method == 'cartao':
                assert payload['token'] == 'card-token'
            if method == 'boleto':
                assert payload['payer']['address']['zip_code'] == '60000000'
            state['payment_id'] = '123456'
            return httpx.Response(201, json={
                'id': 123456, 'external_reference': ORDER, 'currency_id': 'BRL',
                'transaction_amount': 90, 'status': 'pending',
                'point_of_interaction': {'transaction_data': {'qr_code': 'pix-code'}}})
        if path == '/v1/payments/123456':
            return httpx.Response(200, json={
                'id': 123456, 'external_reference': ORDER, 'currency_id': 'BRL',
                'transaction_amount': 90, 'status': 'approved'})
        if path == '/rest/v1/rpc/horizon_apply_payment':
            payload = json.loads(request.content)
            state['status'] = payload['p_status']
            return httpx.Response(200, json=None)
        if path == '/rest/v1/rpc/horizon_get_checkout':
            return httpx.Response(200, json={
                'id': ORDER, 'codigo': 101, 'total': 90,
                'payment_id': state['payment_id'],
                'review_required': state['review_required']})
        return httpx.Response(404)

    settings = Settings(_env_file=None, supabase_url='https://example.supabase.co',
        supabase_anon_key='public-key', supabase_service_role_key='server-only-key',
        mercadopago_access_token='private-payment-token',
        mercadopago_public_key='public-payment-key', mercadopago_webhook_secret='webhook-secret',
        public_base_url='https://horizon.example')
    with TestClient(create_app(settings, httpx.MockTransport(handle))) as client:
        config = client.get('/api/checkout/config')
        assert config.status_code == 200
        assert set(config.json()['methods']) == {'pix', 'boleto', 'cartao'}
        assert 'private-payment-token' not in config.text
        result = client.post('/api/checkout', json=body(method),
            headers={'Idempotency-Key': KEY, 'Checkout-Token': TOKEN})
        assert result.status_code == 200, result.text
        assert result.json()['order_id'] == ORDER
        assert result.json()['status'] == 'pending'
        signature = hmac.new(b'webhook-secret', b'id:123456;request-id:request-1;ts:123456789;',
                             hashlib.sha256).hexdigest()
        headers = {'x-request-id': 'request-1', 'x-signature': 'ts=123456789,v1='+signature}
        assert client.post('/api/webhooks/mercadopago?data.id=123456&type=payment',
                           headers={'x-request-id': 'request-1', 'x-signature': 'bad'}).status_code == 401
        assert client.post('/api/webhooks/mercadopago?data.id=123456&type=payment',
                           headers=headers).status_code == 200
        assert state['status'] == 'approved'
        status = client.get('/api/checkout/'+ORDER, headers={'Checkout-Token': TOKEN})
        assert status.status_code == 200
        assert status.json()['payment_status'] == 'approved'
    assert any(request.url.path == '/rest/v1/rpc/horizon_apply_payment' for request in calls)


def test_existing_migrations_parse():
    root = Path(__file__).resolve().parents[2]
    for name in ('0002_existing_security.sql', '0003_checkout_existing.sql'):
        assert len(parse_sql((root/'supabase/migrations'/name).read_text(encoding='utf-8'))) > 5


def test_admin_cannot_ship_unpaid_order():
    calls = []
    def handle(request):
        calls.append(request.url.path)
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200, json={'id': USER})
        if request.url.path == '/rest/v1/profiles':
            return httpx.Response(200, json=[{'role': 'admin'}])
        if request.url.path == '/rest/v1/orders':
            return httpx.Response(200, json=[{'id': ORDER, 'status': 'recebido',
                                              'review_required': False}])
        return httpx.Response(404)
    settings = Settings(_env_file=None, supabase_url='https://example.supabase.co',
                        supabase_anon_key='public-key')
    with TestClient(create_app(settings, httpx.MockTransport(handle))) as client:
        result = client.patch('/api/admin/orders/'+ORDER+'/fulfillment',
            headers={'Authorization': 'Bearer admin-session'},
            json={'status': 'enviado', 'rastreio': 'BR123'})
        assert result.status_code == 409
    assert '/rest/v1/rpc/horizon_advance_order' not in calls

@pytest.mark.parametrize('method',['pix','cartao','boleto'])
def test_simulated_purchase_never_charges_or_changes_stock(method):
    def handle(request):
        assert request.method=='GET'
        assert request.url.host=='example.supabase.co'
        assert request.url.path=='/rest/v1/product_sizes'
        return httpx.Response(200,json=[{'id':SIZE,'tamanho':'M','estoque':12,
            'products':{'id':ORDER,'nome':'Camiseta preta','slug':'camiseta-preta',
                        'preco':100,'preco_promocional':90,'ativo':True,'product_images':[]}}])
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-key')
    payload=body(method)
    payload.pop('token',None)
    payload.pop('payment_method_id',None)
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        config=client.get('/api/checkout/config').json()
        assert config['simulation_available'] is True
        assert config['available'] is False
        result=client.post('/api/checkout/simulate',json=payload,headers={'Idempotency-Key':KEY})
        assert result.status_code==200,result.text
        data=result.json()
        assert data['status']=='simulated' and data['simulation'] is True
        assert data['total']=='90.00'
        assert data['code'].startswith('DEMO-')
        assert 'customer' not in data
        payload['items'][0]['quantity']=13
        assert client.post('/api/checkout/simulate',json=payload,headers={'Idempotency-Key':KEY}).status_code==409


def test_provider_error_explains_invalid_buyer_seller_accounts():
    def handle(request):
        if request.url.path == '/v1/payment_methods':
            return httpx.Response(200, json=[{'id':'pix','payment_type_id':'bank_transfer'}])
        if request.url.path == '/rest/v1/product_sizes':
            return httpx.Response(200, json=[{'id': SIZE, 'tamanho':'M', 'estoque':2,
                'products': {'id':ORDER,'nome':'Peça','slug':'peca','preco':100,
                             'preco_promocional':90,'ativo':True,'product_images':[]}}])
        if request.url.path == '/rest/v1/rpc/horizon_create_order':
            return httpx.Response(200, json={'id':ORDER,'codigo':101,'total':90})
        if request.url.path == '/v1/payments' and request.method == 'POST':
            return httpx.Response(400, json={'message':'invalid users involved',
                                             'cause':[{'code':145,'description':'Invalid users involved'}]})
        return httpx.Response(404)
    settings=Settings(_env_file=None,supabase_url='https://example.supabase.co',
        supabase_anon_key='public-key',supabase_service_role_key='server-only-key',
        mercadopago_access_token='private-payment-token')
    with TestClient(create_app(settings,httpx.MockTransport(handle))) as client:
        response=client.post('/api/checkout',json=body('pix'),
            headers={'Idempotency-Key':KEY,'Checkout-Token':TOKEN})
        assert response.status_code==502
        assert 'Comprador diferente da conta Vendedor' in response.json()['detail']
        assert 'private-payment-token' not in response.text
