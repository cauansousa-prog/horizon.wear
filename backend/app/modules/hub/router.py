"""Central de lojas: uma aplicação, um Supabase e autorização por loja."""
from decimal import Decimal
from typing import Literal
from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException,Header,Query
from pydantic import BaseModel,ConfigDict,Field
from ...auth import User,current_user
from ...database import Database,get_database

router=APIRouter(prefix='/lojas',tags=['central de lojas'])
STORES={
    'horizon':{'slug':'horizon','name':'Horizon Wear','description':'Moda masculina','url':'/Index.html'},
    'academia':{'slug':'academia','name':'Academia','description':'Treino, movimento e bem-estar','url':'/lojas/academia/'},
    'construcao':{'slug':'construcao','name':'Construção','description':'Materiais para construir e transformar','url':'/lojas/construcao/'},
}

def future_store(slug):
    if slug not in ('academia','construcao'):raise HTTPException(404,'Loja não encontrada.')
    return slug

@router.get('')
async def stores():return list(STORES.values())

PRODUCT_FIELDS='id,loja_id,slug,nome,descricao,preco,imagem_url,estoque,ativo,created_at'

@router.get('/{slug}/products')
async def products(slug:str,limit:int=Query(100,ge=1,le=100),db:Database=Depends(get_database)):
    future_store(slug)
    return await db.request('/rest/v1/hub_products',params={
        'select':PRODUCT_FIELDS,'loja_id':'eq.'+slug,'ativo':'eq.true',
        'order':'created_at.desc,id','limit':str(limit)})

class Product(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    slug:str=Field(min_length=1,max_length=100,pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    nome:str=Field(min_length=2,max_length=120)
    descricao:str=Field(default='',max_length=2000)
    preco:Decimal=Field(gt=0,max_digits=10,decimal_places=2)
    imagem_url:str=Field(default='',max_length=2048)
    estoque:int=Field(default=0,ge=0,le=100000,strict=True)
    ativo:bool=True

async def store_manager(slug,user,db):
    future_store(slug)
    rows=await db.request('/rest/v1/hub_memberships',token=user.token,
        params={'select':'role','loja_id':'eq.'+slug,'user_id':'eq.'+user.id,'limit':'1'})
    if not rows or rows[0]['role'] not in ('admin','editor'):
        raise HTTPException(403,'Você não administra esta loja.')

@router.get('/{slug}/admin/products')
async def admin_products(slug:str,user:User=Depends(current_user),db:Database=Depends(get_database)):
    await store_manager(slug,user,db)
    return await db.request('/rest/v1/hub_products',token=user.token,
        params={'select':PRODUCT_FIELDS,'loja_id':'eq.'+slug,'order':'created_at.desc,id','limit':'100'})

@router.post('/{slug}/admin/products',status_code=201)
async def add_product(slug:str,body:Product,user:User=Depends(current_user),db:Database=Depends(get_database)):
    await store_manager(slug,user,db)
    return await db.request('/rest/v1/hub_products',token=user.token,method='POST',
        json={**body.model_dump(mode='json'),'loja_id':slug})

@router.patch('/{slug}/admin/products/{product_id}')
async def edit_product(slug:str,product_id:UUID,body:Product,user:User=Depends(current_user),db:Database=Depends(get_database)):
    await store_manager(slug,user,db)
    rows=await db.request('/rest/v1/hub_products',token=user.token,method='PATCH',
        params={'loja_id':'eq.'+slug,'id':'eq.'+str(product_id)},json=body.model_dump(mode='json'))
    if not rows:raise HTTPException(404,'Produto não encontrado nesta loja.')
    return rows[0]

class CartItem(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    quantity:int=Field(ge=1,le=99,strict=True)
class Cart(BaseModel):
    model_config=ConfigDict(extra='forbid')
    items:list[CartItem]=Field(min_length=1,max_length=100)

async def quote_items(slug,body,db):
    future_store(slug)
    ids=[str(i.product_id) for i in body.items]
    if len(ids)!=len(set(ids)):raise HTTPException(422,'Produto repetido no carrinho.')
    rows=await db.request('/rest/v1/hub_products',params={'select':PRODUCT_FIELDS,
        'loja_id':'eq.'+slug,'ativo':'eq.true','id':'in.('+','.join(ids)+')'})
    indexed={r['id']:r for r in rows};items=[];total=Decimal('0')
    for item in body.items:
        product=indexed.get(str(item.product_id))
        if not product or product['estoque']<item.quantity:
            raise HTTPException(409,'Produto indisponível nesta loja ou quantidade acima do estoque.')
        subtotal=Decimal(str(product['preco']))*item.quantity;total+=subtotal
        items.append({'product_id':str(item.product_id),'name':product['nome'],
                      'quantity':item.quantity,'subtotal':str(subtotal.quantize(Decimal('.01')))})
    return {'store':slug,'items':items,'total':str(total.quantize(Decimal('.01')))}

@router.post('/{slug}/quote')
async def quote(slug:str,body:Cart,db:Database=Depends(get_database)):
    return await quote_items(slug,body,db)

class Demonstration(Cart):
    method:Literal['pix','cartao','boleto']='pix'

@router.post('/{slug}/checkout/simulate')
async def simulate(slug:str,body:Demonstration,idempotency_key:UUID=Header(),db:Database=Depends(get_database)):
    result=await quote_items(slug,body,db)
    return {**result,'order_id':str(idempotency_key),'code':'DEMO-'+str(idempotency_key)[:8].upper(),
            'status':'simulated','simulation':True,'method':body.method}

@router.get('/{slug}/orders')
async def orders(slug:str,user:User=Depends(current_user),db:Database=Depends(get_database)):
    future_store(slug)
    return await db.request('/rest/v1/hub_orders',token=user.token,params={
        'select':'id,codigo,status,total,created_at,hub_order_items(nome_produto,quantidade,preco_unitario)',
        'loja_id':'eq.'+slug,'user_id':'eq.'+user.id,'order':'created_at.desc','limit':'100'})
