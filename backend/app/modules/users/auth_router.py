from pydantic import BaseModel,Field,ConfigDict,field_validator
from fastapi import APIRouter,Depends,HTTPException,Request
from ...database import Database,get_database
from ...auth import User,current_user

router=APIRouter(prefix='/auth',tags=['autenticação'])
class Credentials(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    email:str=Field(min_length=5,max_length=254,pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+
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
    payload=body.model_dump()
    try:
        return await db.request('/auth/v1/token',method='POST',params={'grant_type':'password'},json=payload)
    except HTTPException as exc:
        # Corrige o erro de digitação comum gmaol.com somente depois que o login exato falhar.
        # A senha continua sendo obrigatória e validada normalmente pelo Supabase.
        if exc.status_code==401 and payload['email'].endswith('@gmaol.com'):
            payload['email']=payload['email'][:-10]+'@gmail.com'
            return await db.request('/auth/v1/token',method='POST',params={'grant_type':'password'},json=payload)
        raise
@router.post('/signup')
async def signup(body:Signup,db:Database=Depends(get_database)):
    """Cria uma conta já confirmada e inicia a sessão imediatamente."""
    await db.admin_request('/auth/v1/admin/users',method='POST',json={
        'email':body.email,
        'password':body.password,
        'email_confirm':True,
        'user_metadata':{'nome_completo':body.nome_completo},
    })
    return await db.request('/auth/v1/token',method='POST',params={'grant_type':'password'},
                            json={'email':body.email,'password':body.password})
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
)
    password:str=Field(min_length=8,max_length=128)
    @field_validator('email')
    @classmethod
    def normalize_email(cls,value):
        return value.strip().lower()
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
async def signup(body:Signup,db:Database=Depends(get_database)):
    """Cria uma conta já confirmada e inicia a sessão imediatamente."""
    await db.admin_request('/auth/v1/admin/users',method='POST',json={
        'email':body.email,
        'password':body.password,
        'email_confirm':True,
        'user_metadata':{'nome_completo':body.nome_completo},
    })
    return await db.request('/auth/v1/token',method='POST',params={'grant_type':'password'},
                            json={'email':body.email,'password':body.password})
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
