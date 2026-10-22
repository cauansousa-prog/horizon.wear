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
    admin_permissions: tuple[str, ...] | None = None


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                       database: Database = Depends(get_database)):
    if credentials is None:
        raise HTTPException(401, 'Autenticação necessária.', headers={'WWW-Authenticate': 'Bearer'})
    result = await database.request('/auth/v1/user', token=credentials.credentials)
    try:
        user_id = str(UUID(result['id']))
    except (KeyError, TypeError, ValueError):
        raise HTTPException(401, 'Sessão inválida.') from None
    # app_metadata is supplied by verified Auth, never by editable user_metadata.
    metadata = result.get('app_metadata') or {}
    permissions = metadata.get('admin_permissions') if isinstance(metadata, dict) else []
    if permissions is not None:
        permissions = tuple(p for p in permissions if isinstance(p, str)) if isinstance(permissions, list) else ()
    return User(user_id, credentials.credentials, permissions)
