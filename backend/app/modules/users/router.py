from fastapi import APIRouter, Depends, HTTPException
from ...auth import User, current_user
from ...database import Database, get_database

router = APIRouter(prefix='/users', tags=['usuários'])


@router.get('/me')
async def profile(user: User = Depends(current_user), database: Database = Depends(get_database)):
    rows = await database.request('/rest/v1/profiles', token=user.token,
                                  params={'select': 'id,full_name:nome_completo,phone:telefone,role,created_at,updated_at', 'id': f'eq.{user.id}', 'limit': '1'})
    if not isinstance(rows, list) or not rows:
        raise HTTPException(404, 'Perfil não encontrado. Confira a migração do banco.')
    return rows[0]
