from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel,Field,ConfigDict,model_validator
from fastapi import APIRouter,Depends,HTTPException,Query
from ...auth import User,current_user
from ...database import Database,get_database

router=APIRouter(prefix='/admin',tags=['administração'])
async def admin(user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/profiles',token=user.token,params={'select':'role','id':'eq.'+user.id,'limit':'1'})
    if not rows or rows[0]['role']!='admin':raise HTTPException(403,'Acesso exclusivo da administração.')
    return user

class Product(BaseModel):
    model_config=ConfigDict(extra='forbid')
    nome:str=Field(min_length=2,max_length=160)
    slug:str=Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$',max_length=180)
    categoria_id:UUID
    descricao:str=Field(default='',max_length=5000)
    tecido:str=Field(default='',max_length=200)
    caimento:str=Field(default='',max_length=200)
    preco:Decimal=Field(gt=0,max_digits=12,decimal_places=2)
    preco_promocional:Decimal|None=Field(default=None,gt=0,max_digits=12,decimal_places=2)
    ativo:bool=False
    destaque:bool=False
    lancamento:bool=False
    @model_validator(mode='after')
    def promotion(self):
        if self.preco_promocional is not None and self.preco_promocional>=self.preco:raise ValueError('Promoção deve ser menor que o preço.')
        return self
class Size(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    tamanho:str=Field(min_length=1,max_length=20)
    estoque:int=Field(ge=0,le=100000,strict=True)
class Image(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    url:str=Field(pattern=r'^https://',max_length=2048)
    ordem:int=Field(default=0,ge=0,le=100)
class Category(BaseModel):
    model_config=ConfigDict(extra='forbid')
    nome:str=Field(min_length=2,max_length=80)
    slug:str=Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$',max_length=100)
    grupo:str=Field(pattern=r'^(roupas|calcados|relogios|acessorios)$')
    imagem_url:str=Field(pattern=r'^https://',max_length=2048)
    ordem:int=Field(default=0,ge=0)

@router.get('/dashboard')
async def dashboard(user:User=Depends(admin),db:Database=Depends(get_database)):
    orders=[];offset=0
    while True:
        page=await db.request('/rest/v1/orders',token=user.token,params={'select':'id,status,total,created_at','order':'id','offset':str(offset),'limit':'1000'})
        orders.extend(page)
        if len(page)<1000:break
        offset+=1000
    statuses={}
    for o in orders:statuses[o['status']]=statuses.get(o['status'],0)+1
    paid=[o for o in orders if o['status'] in ('pagamento_aprovado','preparando','enviado','entregue')]
    return {'orders':len(orders),'paid_orders':len(paid),'revenue':str(sum((Decimal(str(o['total'])) for o in paid),Decimal(0))),'statuses':statuses}

@router.get('/{resource}')
async def listing(resource:str,offset:int=Query(0,ge=0),user:User=Depends(admin),db:Database=Depends(get_database)):
    if resource not in {'products','categories','product_sizes','product_images','orders','profiles','payments','coupons','reviews'}:raise HTTPException(404)
    return await db.request('/rest/v1/'+resource,token=user.token,params={'select':'*','order':'id','limit':'100','offset':str(offset)})

@router.post('/products',status_code=201)
async def create_product(body:Product,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.put('/products/{product_id}')
async def update_product(product_id:UUID,body:Product,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',method='PATCH',token=user.token,params={'id':'eq.'+str(product_id)},json=body.model_dump(mode='json'))
@router.delete('/products/{product_id}')
async def deactivate_product(product_id:UUID,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',method='PATCH',token=user.token,params={'id':'eq.'+str(product_id)},json={'ativo':False})
@router.post('/sizes',status_code=201)
async def create_size(body:Size,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/product_sizes',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.put('/sizes/{size_id}')
async def update_size(size_id:UUID,body:Size,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/product_sizes',method='PATCH',token=user.token,params={'id':'eq.'+str(size_id),'product_id':'eq.'+str(body.product_id)},json={'estoque':body.estoque,'tamanho':body.tamanho})
@router.post('/images',status_code=201)
async def add_image(body:Image,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/product_images',method='POST',token=user.token,json=body.model_dump(mode='json'))
@router.post('/categories',status_code=201)
async def add_category(body:Category,user:User=Depends(admin),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/categories',method='POST',token=user.token,json=body.model_dump())
