from pydantic import BaseModel,Field,ConfigDict
from fastapi import APIRouter,Depends,HTTPException,Request
from ...database import Database,get_database
from ...auth import User,current_user

router=APIRouter(prefix='/auth',tags=['autenticação'])
class Credentials(BaseModel):
    model_config=ConfigDict(extra='forbid')
    email:str=Field(min_length=5,max_length=254,pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password:str=Field(min_length=8,max_length=128)
class Signup(Credentials):
    nome_completo:str=Field(min_length=2,max_length=120)
class Refresh(BaseModel):
    refresh_token:str=Field(min_length=1,max_length=4096)
class Recovery(BaseModel):
    email:str=Field(min_length=5,max_length=254)
class Password(BaseModel):
    password:str=Field(min_length=8,max_length=128)

def redirect_url(request:Request,db:Database):
    base=db.settings.public_base_url.rstrip('/') if db.settings.public_base_url.startswith('https://') else str(request.base_url).rstrip('/')
    return base+'/#conta'

@router.post('/login')
async def login(body:Credentials,db:Database=Depends(get_database)):
    return await db.request('/auth/v1/token',method='POST',params={'grant_type':'password'},json=body.model_dump())
@router.post('/signup')
async def signup(request:Request,body:Signup,db:Database=Depends(get_database)):
    return await db.request('/auth/v1/signup',method='POST',json={'email':body.email,'password':body.password,'data':{'nome_completo':body.nome_completo},'options':{'email_redirect_to':redirect_url(request,db)}})
@router.post('/refresh')
async def refresh(body:Refresh,db:Database=Depends(get_database)):
    return await db.request('/auth/v1/token',method='POST',params={'grant_type':'refresh_token'},json=body.model_dump())
@router.post('/recover')
async def recover(request:Request,body:Recovery,db:Database=Depends(get_database)):
    await db.request('/auth/v1/recover',method='POST',json={**body.model_dump(),'redirect_to':redirect_url(request,db)})
    return {'message':'Se o endereço estiver cadastrado, você receberá um link para redefinir a senha.'}
@router.post('/resend-confirmation')
async def resend_confirmation(request:Request,body:Recovery,db:Database=Depends(get_database)):
    await db.request('/auth/v1/resend',method='POST',json={'type':'signup','email':body.email,'options':{'email_redirect_to':redirect_url(request,db)}})
    return {'message':'Se o cadastro estiver pendente, um novo link de confirmação foi enviado.'}
@router.post('/password')
async def password(body:Password,user:User=Depends(current_user),db:Database=Depends(get_database)):
    await db.request('/auth/v1/user',method='PUT',token=user.token,json=body.model_dump())
    return {'updated':True}
@router.post('/logout')
async def logout(user:User=Depends(current_user),db:Database=Depends(get_database)):
    await db.request('/auth/v1/logout',method='POST',token=user.token)
    return {'logged_out':True}
