from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from pglast import parse_sql
from backend.app.config import Settings
from backend.app.main import create_app

ROOT = Path(__file__).resolve().parents[2]
UID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'


def settings(**kw):
    return Settings(_env_file=None, **kw)


def test_static_files_and_private_files():
    with TestClient(create_app(settings())) as client:
        for path in ['/', '/Index.html', '/css/style.css', '/js/app.js', '/js/api.js', '/img/hero.png']:
            assert client.get(path).status_code == 200, path
        assert client.get('/produto/camiseta-slim-fit-preta').status_code == 200
        for path in ['/.env', '/backend/app/config.py', '/sistema_login.py', '/supabase/migrations/0001_foundation.sql', '/api/nonexistent']:
            assert client.get(path).status_code == 404, path
        assert client.get('/api/health').json() == {'status':'ok'}
        headers=client.get('/api/health').headers
        assert headers['x-content-type-options']=='nosniff'
        assert headers['x-frame-options']=='DENY'
        assert headers['referrer-policy']=='strict-origin-when-cross-origin'
        assert client.get('/api/health/ready').status_code == 503
        assert client.get('/api/users/me').status_code == 401


def test_auth_and_rls_identity_forwarding():
    requests=[]
    def handle(request):
        requests.append(request)
        assert request.headers['apikey'] == 'public-test-key'
        assert request.headers['authorization'] == 'Bearer user-session'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200,json={'id':UID})
        assert request.url.params['id'] == 'eq.'+UID
        assert request.url.params['select'] == 'id,full_name:nome_completo,phone:telefone,role,created_at,updated_at'
        return httpx.Response(200,json=[{'id':UID,'full_name':'Teste'}])
    cfg=settings(supabase_url='https://example.supabase.co',supabase_anon_key='public-test-key',supabase_service_role_key='never-forward')
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        response=client.get('/api/users/me',headers={'Authorization':'Bearer user-session'})
        assert response.status_code==200
        assert response.json()['id']==UID
    assert len(requests)==2


@pytest.mark.parametrize('code',[401,403,500])
def test_supabase_errors_are_not_exposed(code):
    cfg=settings(supabase_url='https://example.supabase.co',supabase_anon_key='public-test-key')
    transport=httpx.MockTransport(lambda request:httpx.Response(code,text='PRIVATE INTERNAL DETAILS'))
    with TestClient(create_app(cfg,transport)) as client:
        response=client.get('/api/users/me',headers={'Authorization':'Bearer bad'})
        assert response.status_code==(code if code in (401,403) else 503)
        assert 'PRIVATE' not in response.text


def test_readiness_really_calls_database():
    calls=[]
    def handle(request):
        calls.append(request)
        assert request.url.path=='/rest/v1/categories'
        assert request.url.params['limit']=='0'
        return httpx.Response(200,json=[])
    cfg=settings(supabase_url='https://example.supabase.co',supabase_anon_key='public-test-key')
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        assert client.get('/api/health/ready').status_code==200
    assert len(calls)==1


def test_signup_confirms_account_and_auth_links_return_to_current_site():
    captured=[]
    def handle(request):
        captured.append(request)
        if request.url.path == '/auth/v1/token':
            return httpx.Response(200,json={'access_token':'session-token','refresh_token':'refresh-token'})
        return httpx.Response(200,json={})
    cfg=settings(supabase_url='https://example.supabase.co',supabase_anon_key='public-test-key',supabase_service_role_key='server-only-key')
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        signup=client.post('/api/auth/signup',json={'nome_completo':'Teste','email':'teste@example.com','password':'senha-segura'})
        client.post('/api/auth/recover',json={'email':'teste@example.com'})
        client.post('/api/auth/resend-confirmation',json={'email':'teste@example.com'})
    assert signup.status_code == 200
    assert signup.json()['access_token'] == 'session-token'
    assert captured[0].url.path == '/auth/v1/admin/users'
    assert captured[0].headers['authorization'] == 'Bearer server-only-key'
    assert captured[0].headers['apikey'] == 'server-only-key'
    signup_payload=json.loads(captured[0].content)
    assert signup_payload['email_confirm'] is True
    assert signup_payload['user_metadata']['nome_completo'] == 'Teste'
    assert captured[1].url.path == '/auth/v1/token'
    payloads=[json.loads(request.content) for request in captured[2:]]
    assert payloads[0]['redirect_to']=='http://testserver/#conta'
    assert payloads[1]['options']['email_redirect_to']=='http://testserver/#conta'


def test_sql_parses():
    sql=(ROOT/'supabase/migrations/0001_foundation.sql').read_text(encoding='utf-8')
    assert len(parse_sql(sql))>90


def test_html_local_assets():
    class Parser(HTMLParser):
        def handle_starttag(self,tag,attrs):
            attrs=dict(attrs)
            value=attrs.get('src') if tag in ('img','script') else attrs.get('href') if tag=='link' else None
            if value and not value.startswith(('http:', 'https:', '//')):
                path=urlsplit(value).path
                assert (ROOT/'frontend'/path).is_file(),value
    Parser().feed((ROOT/'frontend/index.html').read_text(encoding='utf-8'))
