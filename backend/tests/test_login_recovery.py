import json
import httpx
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app


def make_settings():
    return Settings(_env_file=None,supabase_url='https://example.supabase.co',
                    supabase_anon_key='public-key')


def test_login_recovers_common_gmail_typo():
    seen=[]
    def handle(request):
        if request.url.path=='/auth/v1/token':
            payload=json.loads(request.content)
            seen.append(payload['email'])
            if payload['email'].endswith('@gmaol.com'):
                return httpx.Response(401,json={'error':'invalid_grant'})
            if payload['email'].endswith('@gmail.com'):
                return httpx.Response(200,json={
                    'access_token':'access','refresh_token':'refresh',
                    'expires_in':3600,'expires_at':9999999999,'token_type':'bearer'
                })
        return httpx.Response(404)
    with TestClient(create_app(make_settings(),httpx.MockTransport(handle))) as client:
        response=client.post('/api/auth/login',json={
            'email':' Usuario@GMAOL.com ','password':'senha-segura'
        })
    assert response.status_code==200,response.text
    assert seen==['usuario@gmaol.com','usuario@gmail.com']


def test_wrong_login_returns_clear_message():
    def handle(request):
        if request.url.path=='/auth/v1/token':
            return httpx.Response(401,json={'error':'invalid_grant'})
        return httpx.Response(404)
    with TestClient(create_app(make_settings(),httpx.MockTransport(handle))) as client:
        response=client.post('/api/auth/login',json={
            'email':'usuario@example.com','password':'senha-segura'
        })
    assert response.status_code==401
    assert response.json()['detail']=='E-mail ou senha incorretos.'
