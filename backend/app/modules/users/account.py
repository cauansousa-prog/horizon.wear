from uuid import UUID
from pydantic import BaseModel,Field,ConfigDict
from fastapi import APIRouter,Depends,HTTPException
from ...auth import User,current_user
from ...database import Database,get_database

router=APIRouter(tags=['conta'])
class Profile(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    nome_completo:str=Field(min_length=2,max_length=120)
    telefone:str=Field(default='',max_length=25)
class Address(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    destinatario:str=Field(min_length=2,max_length=120)
    cep:str=Field(pattern=r'^\d{8}$')
    rua:str=Field(min_length=2,max_length=200)
    numero:str=Field(min_length=1,max_length=20)
    complemento:str=Field(default='',max_length=100)
    bairro:str=Field(min_length=2,max_length=100)
    cidade:str=Field(min_length=2,max_length=100)
    estado:str=Field(pattern=r'^[A-Z]{2}$')
    referencia:str=Field(default='',max_length=200)
    telefone:str=Field(default='',max_length=25)
    padrao:bool=False

@router.patch('/users/me')
async def update_profile(body:Profile,user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/profiles',method='PATCH',token=user.token,
        params={'id':'eq.'+user.id,'select':'id,full_name:nome_completo,phone:telefone'},json=body.model_dump())
    if not rows:raise HTTPException(409,'Seus dados não foram salvos. Atualize a página e tente novamente.')
    return rows[0]

@router.get('/addresses')
async def addresses(user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/addresses',token=user.token,params={'user_id':'eq.'+user.id,'order':'created_at.desc'})

@router.post('/addresses',status_code=201)
async def add_address(body:Address,user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/addresses',method='POST',token=user.token,json={**body.model_dump(),'user_id':user.id})

@router.patch('/addresses/{address_id}')
async def edit_address(address_id:UUID,body:Address,user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id},json=body.model_dump())

@router.delete('/addresses/{address_id}')
async def delete_address(address_id:UUID,user:User=Depends(current_user),db:Database=Depends(get_database)):
    await db.request('/rest/v1/addresses',method='DELETE',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id})
    return {'deleted':True}

@router.get('/orders')
async def orders(user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/orders',token=user.token,params={'select':'id,codigo,status,review_required,total,subtotal,frete,desconto,rastreio,created_at,order_items(nome_produto,tamanho,preco_unitario,quantidade),payments(metodo,status,valor,mercadopago_payment_id)','user_id':'eq.'+user.id,'order':'created_at.desc','limit':'100'})
