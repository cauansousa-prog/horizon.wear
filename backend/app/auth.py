"""Validação remota no Supabase Auth; não decodifica JWT sem verificar assinatura."""
from dataclasses import dataclass
from uuid import UUID
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .database import Database, get_database

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    id: str
    token: str


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                       database: Database = Depends(get_database)):
    if credentials is None:
        raise HTTPException(401, 'Autenticação necessária.', headers={'WWW-Authenticate': 'Bearer'})
    result = await database.request('/auth/v1/user', token=credentials.credentials)
    try:
        user_id = str(UUID(result['id']))
    except (KeyError, TypeError, ValueError):
        raise HTTPException(401, 'Sessão inválida.') from None
    return User(user_id, credentials.credentials)
