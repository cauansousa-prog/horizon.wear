import io
import zipfile

import httpx
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.modules.admin import router as admin_router

USER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

def make_client(permissions):
    def handle(request):
        path=request.url.path
        if path=='/auth/v1/user':
            return httpx.Response(200,json={'id':USER})
        if path=='/rest/v1/profiles':
            return httpx.Response(200,json=[{'role':'admin'}])
        if path=='/auth/v1/admin/users/'+USER:
            return httpx.Response(200,json={'id':USER,'email':'admin@example.com','app_metadata':{'admin_permissions':permissions}})
        if path=='/rest/v1/products':
            return httpx.Response(200,json=[{
                'id':'p1','nome':'Camiseta','slug':'camiseta','preco':'99.90',
                'preco_promocional':None,'ativo':True,'vendas_total':3,'created_at':'2026-10-01T12:00:00Z'
            }])
        return httpx.Response(404,json={'message':'not found'})
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',
                 supabase_anon_key='public-key',supabase_service_role_key='server-only-key')
    return TestClient(create_app(cfg,httpx.MockTransport(handle)))

def test_catalog_permission_does_not_grant_dashboard():
    with make_client(['catalog']) as client:
        headers={'Authorization':'Bearer session'}
        assert client.get('/api/admin/products',headers=headers).status_code==200
        denied=client.get('/api/admin/dashboard',headers=headers)
        assert denied.status_code==403

def test_export_requires_export_and_resource_permissions():
    with make_client(['catalog','exports']) as client:
        response=client.get('/api/admin/export/products?format=csv',
                            headers={'Authorization':'Bearer session'})
        assert response.status_code==200
        assert response.headers['content-type'].startswith('text/csv')
        assert 'Camiseta' in response.text
        assert response.text.startswith('\ufeff')
    with make_client(['catalog']) as client:
        denied=client.get('/api/admin/export/products?format=csv',
                          headers={'Authorization':'Bearer session'})
        assert denied.status_code==403

def test_xlsx_writer_creates_valid_openxml_package():
    payload=admin_router._xlsx_document(['Nome','Valor'],[['Produto','10.00']],'Dados')
    assert payload.startswith(b'PK')
    with zipfile.ZipFile(io.BytesIO(payload)) as book:
        names=set(book.namelist())
        assert '[Content_Types].xml' in names
        assert 'xl/workbook.xml' in names
        assert 'xl/worksheets/sheet1.xml' in names
        sheet=book.read('xl/worksheets/sheet1.xml').decode('utf-8')
        assert 'Produto' in sheet and '10.00' in sheet


def test_existing_admin_keeps_full_access_if_auth_admin_lookup_fails():
    def handle(request):
        path=request.url.path
        if path=='/auth/v1/user':
            return httpx.Response(200,json={'id':USER})
        if path=='/rest/v1/profiles':
            return httpx.Response(200,json=[{'role':'admin'}])
        if path=='/auth/v1/admin/users/'+USER:
            return httpx.Response(503,json={'message':'temporarily unavailable'})
        if path=='/rest/v1/products':
            return httpx.Response(200,json=[])
        return httpx.Response(404,json={'message':'not found'})
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',
                 supabase_anon_key='public-key',supabase_service_role_key='server-only-key')
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        headers={'Authorization':'Bearer session'}
        me=client.get('/api/admin/me',headers=headers)
        assert me.status_code==200
        assert me.json()['owner'] is True
        assert 'dashboard' in me.json()['permissions']
