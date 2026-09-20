from uuid import UUID
from pydantic import BaseModel,Field,ConfigDict
from fastapi import APIRouter,Depends
from ...auth import User,current_user
from ...database import Database,get_database
router=APIRouter(prefix='/reviews',tags=['avaliações'])
class Review(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id:UUID
    order_item_id:UUID
    nota:int=Field(ge=1,le=5,strict=True)
    comentario:str=Field(min_length=1,max_length=3000)
@router.get('/{product_id}')
async def reviews(product_id:UUID,db:Database=Depends(get_database)):
    return await db.request('/rest/v1/reviews',params={'select':'id,nota,comentario,created_at','product_id':'eq.'+str(product_id),'order':'created_at.desc','limit':'100'})
@router.post('',status_code=201)
async def add_review(body:Review,user:User=Depends(current_user),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/reviews',method='POST',token=user.token,json={**body.model_dump(mode='json'),'user_id':user.id})
