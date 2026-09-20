"""Supabase Data API. Cada requisição mantém o JWT do usuário e suas políticas RLS."""
import httpx
from fastapi import HTTPException, Request
from .config import Settings

TABLES = ('profiles', 'addresses', 'products', 'product_images', 'categories',
          'cart', 'cart_items', 'orders', 'order_items', 'payments', 'coupons', 'reviews')


class Database:
    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings

    async def request(self, path, *, token=None, params=None, method="GET", json=None):
        if not self.settings.database_configured:
            raise HTTPException(503, 'Configure SUPABASE_URL e SUPABASE_ANON_KEY no servidor.')
        headers = {'apikey': self.settings.supabase_anon_key.get_secret_value(), 'Prefer':'return=representation'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        try:
            response = await self.client.request(method, self.settings.supabase_url + path, headers=headers, params=params, json=json)
        except httpx.RequestError:
            raise HTTPException(503, 'Supabase indisponível.') from None
        if response.status_code in (401, 403):
            raise HTTPException(response.status_code, 'Acesso não autorizado.')
        if response.status_code in (400, 409, 422, 429):
            raise HTTPException(response.status_code, 'Não foi possível concluir. Confira os dados, sua sessão e o estoque disponível.')
        if response.is_error:
            raise HTTPException(503, 'Falha ao consultar Supabase. Confira configuração e migração.')
        if response.status_code == 204 or not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            raise HTTPException(503, 'Resposta inválida do Supabase.') from None

    async def readiness(self):
        # Consulta real da estrutura pública, sem coletar dados de clientes.
        await self.request('/rest/v1/categories', params={'select': 'id', 'limit': '0'})


def get_database(request: Request):
    return Database(request.app.state.http, request.app.state.settings)
