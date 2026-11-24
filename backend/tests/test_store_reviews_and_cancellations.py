import json
from pathlib import Path

import httpx
from fastapi.testclient import TestClient
from pglast import parse_sql

from backend.app.config import Settings
from backend.app.main import create_app

USER = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
ORDER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
PRODUCT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'


def make_client(handler):
    settings = Settings(
        _env_file=None,
        supabase_url='https://example.supabase.co',
        supabase_anon_key='public-test-key',
    )
    return TestClient(create_app(settings, httpx.MockTransport(handler)))


def test_customer_cancellation_uses_authenticated_rpc_and_reason():
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200, json={'id': USER})
        if request.url.path == '/rest/v1/rpc/horizon_cancel_my_order':
            assert request.method == 'POST'
            assert request.headers['authorization'] == 'Bearer customer-session'
            assert json.loads(request.content) == {
                'p_order': ORDER,
                'p_reason': 'Solicitado pelo cliente',
            }
            return httpx.Response(200, json={'id': ORDER, 'status': 'cancelado'})
        return httpx.Response(404, json={'message': 'not found'})

    with make_client(handler) as client:
        response = client.post(
            f'/api/orders/{ORDER}/cancel',
            headers={'Authorization': 'Bearer customer-session'},
            json={'motivo': 'Solicitado pelo cliente'},
        )
    assert response.status_code == 200
    assert response.json()['status'] == 'cancelado'
    assert [r.url.path for r in calls].count('/rest/v1/rpc/horizon_cancel_my_order') == 1


def test_customer_can_submit_store_review_only_after_receiving_order():
    saved = {}

    def handler(request):
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200, json={'id': USER})
        if request.url.path == '/rest/v1/orders':
            assert request.url.params['status'] == 'eq.recebido'
            return httpx.Response(200, json=[{'id': ORDER}])
        if request.url.path == '/rest/v1/store_reviews' and request.method == 'POST':
            saved.update(json.loads(request.content))
            return httpx.Response(201, json=[{
                'id': PRODUCT, 'nota': 5, 'comentario': 'Ótima experiência',
                'approved': False, 'created_at': '2026-11-24T12:00:00Z'
            }])
        return httpx.Response(404, json={'message': 'not found'})

    with make_client(handler) as client:
        response = client.post(
            '/api/reviews/store',
            headers={'Authorization': 'Bearer customer-session'},
            json={'nota': 5, 'comentario': 'Ótima experiência'},
        )
    assert response.status_code == 201
    assert saved == {
        'nota': 5, 'comentario': 'Ótima experiência', 'user_id': USER
    }
    assert response.json()['approved'] is False


def test_customer_without_received_order_cannot_submit_store_review():
    writes = []

    def handler(request):
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200, json={'id': USER})
        if request.url.path == '/rest/v1/orders':
            return httpx.Response(200, json=[])
        if request.url.path == '/rest/v1/store_reviews':
            writes.append(request)
        return httpx.Response(404, json={'message': 'not found'})

    with make_client(handler) as client:
        response = client.post(
            '/api/reviews/store',
            headers={'Authorization': 'Bearer customer-session'},
            json={'nota': 4, 'comentario': 'Bom atendimento'},
        )
    assert response.status_code == 403
    assert writes == []


def test_admin_analytics_uses_real_payment_statuses_and_paid_order_items():
    orders = [
        {
            'id': ORDER, 'user_id': USER, 'codigo': 'HW-2026-000001',
            'nome_cliente': 'Cliente', 'status': 'pagamento_aprovado',
            'review_required': False, 'total': '100.00',
            'created_at': '2026-11-20T12:00:00Z',
            'order_items': [{
                'nome_produto': 'Camisa', 'quantidade': 2,
                'preco_unitario': '50.00'
            }],
            'payments': [{
                'order_id': ORDER, 'metodo': 'pix', 'status': 'approved',
                'valor': '100.00', 'aprovado_em': '2026-11-20T12:05:00Z'
            }]
        },
        {
            'id': PRODUCT, 'user_id': USER, 'codigo': 'HW-2026-000002',
            'nome_cliente': 'Cliente', 'status': 'cancelado',
            'review_required': False, 'total': '20.00',
            'created_at': '2026-11-21T12:00:00Z',
            'order_items': [{
                'nome_produto': 'Boné', 'quantidade': 1,
                'preco_unitario': '20.00'
            }],
            'payments': [{
                'order_id': PRODUCT, 'metodo': 'pix', 'status': 'cancelled',
                'valor': '20.00', 'aprovado_em': None
            }]
        }
    ]

    def handler(request):
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200, json={'id': USER})
        if request.url.path == '/rest/v1/profiles':
            return httpx.Response(200, json=[{'role': 'admin'}])
        if request.url.path == '/rest/v1/orders':
            return httpx.Response(200, json=orders)
        return httpx.Response(404, json={'message': 'not found'})

    with make_client(handler) as client:
        response = client.get(
            '/api/admin/analytics',
            headers={'Authorization': 'Bearer admin-session'},
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['orders_total'] == 2
    assert data['cancelled_orders'] == 1
    assert data['approved_payments'] == 1
    assert data['cancelled_payments'] == 1
    assert data['gross_received'] == '100.00'
    assert data['top_products'] == [{
        'produto': 'Camisa', 'quantidade': 2, 'faturamento': '100.00'
    }]


def test_new_store_review_and_cancellation_migration_parses():
    root = Path(__file__).resolve().parents[2]
    migrations = [
        '0015_store_reviews_customer_cancellation.sql',
        '0016_store_reviews_policy_and_cancel_index.sql',
        '0017_store_reviews_authenticated_read.sql',
    ]
    for name in migrations:
        sql = (root / 'supabase/migrations' / name).read_text(encoding='utf-8')
        assert parse_sql(sql)
    assert 'horizon_cancel_my_order' in (root / 'supabase/migrations' / migrations[0]).read_text(encoding='utf-8')
