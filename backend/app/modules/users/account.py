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
class OrderCancellation(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    motivo:str=Field(default='',max_length=500)

class Favorite(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID

@router.patch('/users/me')
async def update_profile(body:Profile,user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/profiles',method='PATCH',token=user.token,
        params={'id':'eq.'+user.id,'select':'id,full_name:nome_completo,phone:telefone'},json=body.model_dump())
    if not rows:raise HTTPException(409,'Seus dados não foram salvos. Atualize a página e tente novamente.')
    return rows[0]

@router.post('/orders/{order_id}/cancel')
async def cancel_order(order_id:UUID,body:OrderCancellation,user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/rpc/horizon_cancel_my_order',method='POST',
        token=user.token,json={'p_order':str(order_id),'p_reason':body.motivo},explain_data_errors=True)

@router.get('/addresses')
async def addresses(user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/addresses',token=user.token,params={'user_id':'eq.'+user.id,'order':'padrao.desc,created_at.desc'})

@router.post('/addresses',status_code=201)
async def add_address(body:Address,user:User=Depends(current_user),db:Database=Depends(get_database)):
    existing=await db.request('/rest/v1/addresses',token=user.token,params={'user_id':'eq.'+user.id,'select':'id','limit':'1'})
    make_default=body.padrao or not existing
    if make_default:
        await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'user_id':'eq.'+user.id},json={'padrao':False})
    rows=await db.request('/rest/v1/addresses',method='POST',token=user.token,json={**body.model_dump(),'padrao':make_default,'user_id':user.id})
    return rows[0] if isinstance(rows,list) and rows else {'saved':True}

@router.patch('/addresses/{address_id}/default')
async def default_address(address_id:UUID,user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/addresses',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id,'select':'id','limit':'1'})
    if not rows:raise HTTPException(404,'Endereço não encontrado.')
    await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'user_id':'eq.'+user.id},json={'padrao':False})
    await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id},json={'padrao':True})
    return {'saved':True}

@router.patch('/addresses/{address_id}')
async def edit_address(address_id:UUID,body:Address,user:User=Depends(current_user),db:Database=Depends(get_database)):
    if body.padrao:
        await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'user_id':'eq.'+user.id},json={'padrao':False})
    rows=await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id},json=body.model_dump())
    if not rows:raise HTTPException(404,'Endereço não encontrado.')
    return rows[0]

@router.delete('/addresses/{address_id}')
async def delete_address(address_id:UUID,user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/addresses',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id,'select':'id,padrao','limit':'1'})
    if not rows:raise HTTPException(404,'Endereço não encontrado.')
    await db.request('/rest/v1/addresses',method='DELETE',token=user.token,params={'id':'eq.'+str(address_id),'user_id':'eq.'+user.id})
    if rows[0].get('padrao'):
        remaining=await db.request('/rest/v1/addresses',token=user.token,params={'user_id':'eq.'+user.id,'select':'id','order':'created_at.desc','limit':'1'})
        if remaining:
            await db.request('/rest/v1/addresses',method='PATCH',token=user.token,params={'id':'eq.'+str(remaining[0]['id']),'user_id':'eq.'+user.id},json={'padrao':True})
    return {'deleted':True}

@router.get('/favorites')
async def favorites(user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/favorites',token=user.token,params={'user_id':'eq.'+user.id,'select':'product_id,created_at','order':'created_at.desc'})
    return rows or []

@router.post('/favorites',status_code=201)
async def add_favorite(body:Favorite,user:User=Depends(current_user),db:Database=Depends(get_database)):
    product=await db.request('/rest/v1/products',params={'id':'eq.'+str(body.product_id),'ativo':'eq.true','select':'id','limit':'1'})
    if not product:raise HTTPException(404,'Produto indisponível.')
    await db.request('/rest/v1/favorites',method='POST',token=user.token,
        params={'on_conflict':'user_id,product_id'},
        json={'user_id':user.id,'product_id':str(body.product_id)},
        prefer='resolution=ignore-duplicates,return=minimal')
    return {'saved':True}

@router.delete('/favorites/{product_id}')
async def remove_favorite(product_id:UUID,user:User=Depends(current_user),db:Database=Depends(get_database)):
    await db.request('/rest/v1/favorites',method='DELETE',token=user.token,params={'user_id':'eq.'+user.id,'product_id':'eq.'+str(product_id)})
    return {'deleted':True}

@router.get('/orders')
async def orders(user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/orders',token=user.token,params={'select':'id,codigo,status,review_required,total,subtotal,frete,desconto,rastreio,created_at,order_items(nome_produto,tamanho,preco_unitario,quantidade),payments(metodo,status,valor,mercadopago_payment_id)','user_id':'eq.'+user.id,'order':'created_at.desc','limit':'100'})
