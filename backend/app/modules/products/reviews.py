from uuid import UUID
from pydantic import BaseModel,Field,ConfigDict
from fastapi import APIRouter,Depends
from ...auth import User,current_user
from ...database import Database,get_database
router=APIRouter(prefix='/reviews',tags=['avaliações'])
class StoreReview(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    nota:int=Field(ge=1,le=5,strict=True)
    comentario:str=Field(default='',max_length=2000)

class Review(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    order_item_id:UUID
    nota:int=Field(ge=1,le=5,strict=True)
    comentario:str=Field(min_length=1,max_length=3000)
@router.get('/store')
async def my_store_review(user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/store_reviews',token=user.token,params={
        'select':'id,nota,comentario,approved,created_at',
        'user_id':'eq.'+user.id,'limit':'1'})
    eligible=await db.request('/rest/v1/orders',token=user.token,params={
        'select':'id','user_id':'eq.'+user.id,'status':'eq.recebido','limit':'1'})
    return {'review':rows[0] if rows else None,'eligible':bool(eligible)}

@router.post('/store',status_code=201)
async def add_store_review(body:StoreReview,user:User=Depends(current_user),db:Database=Depends(get_database)):
    eligible=await db.request('/rest/v1/orders',token=user.token,params={
        'select':'id','user_id':'eq.'+user.id,'status':'eq.recebido','limit':'1'})
    if not eligible:
        from fastapi import HTTPException
        raise HTTPException(403,'Você poderá avaliar a loja depois de confirmar o recebimento de um pedido.')
    rows=await db.request('/rest/v1/store_reviews',method='POST',token=user.token,
        json={**body.model_dump(),'user_id':user.id},explain_data_errors=True)
    return rows[0] if isinstance(rows,list) and rows else {'saved':True}

@router.patch('/store')
async def update_store_review(body:StoreReview,user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/store_reviews',method='PATCH',token=user.token,
        params={'user_id':'eq.'+user.id,'approved':'eq.false','select':'id,nota,comentario,approved,created_at'},
        json=body.model_dump(),explain_data_errors=True)
    if not rows:
        from fastapi import HTTPException
        raise HTTPException(409,'A avaliação já foi publicada ou não está disponível para edição.')
    return rows[0]

@router.get('/{product_id}')
async def reviews(product_id:UUID,db:Database=Depends(get_database)):
    return await db.request('/rest/v1/reviews',params={'select':'id,nota,comentario,created_at','product_id':'eq.'+str(product_id),'order':'created_at.desc','limit':'100'})
@router.post('',status_code=201)
async def add_review(body:Review,user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/reviews',method='POST',token=user.token,json={**body.model_dump(mode='json'),'user_id':user.id})
