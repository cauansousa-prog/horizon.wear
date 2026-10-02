from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel,Field
from fastapi import APIRouter,Depends,HTTPException
from ...auth import User,current_user
from ...database import Database,get_database

router=APIRouter(prefix='/cart',tags=['carrinho'])
class Item(BaseModel):
    size_id:UUID
    quantity:int=Field(ge=0,le=99,strict=True)
class CartInput(BaseModel):
    items:list[Item]=Field(max_length=100)

async def quote_items(items,db):
    ids=[str(i.size_id) for i in items if i.quantity]
    if len(ids)!=len(set(ids)): raise HTTPException(422,'Tamanho repetido no carrinho.')
    if not ids: return {'items':[],'subtotal':'0.00'}

    size_rows=await db.request('/rest/v1/product_sizes',params={
        'select':'id,product_id,tamanho,estoque',
        'id':'in.('+','.join(ids)+')'
    })
    sizes={str(row['id']):row for row in (size_rows or [])}
    product_ids=list(dict.fromkeys(str(row.get('product_id')) for row in sizes.values() if row.get('product_id')))
    if not product_ids:
        raise HTTPException(409,'Um item está indisponível ou a quantidade excede o estoque.')

    product_rows=await db.request('/rest/v1/products',params={
        'select':'id,nome,slug,preco,preco_promocional,ativo',
        'id':'in.('+','.join(product_ids)+')',
        'ativo':'eq.true'
    })
    products={str(row['id']):row for row in (product_rows or [])}
    image_rows=await db.request('/rest/v1/product_images',params={
        'select':'product_id,url,ordem',
        'product_id':'in.('+','.join(product_ids)+')',
        'order':'ordem.asc'
    })
    images={}
    for image in image_rows or []:
        images.setdefault(str(image.get('product_id')),[]).append({'url':image.get('url'),'ordem':image.get('ordem')})

    result=[];total=Decimal('0')
    for item in items:
        if not item.quantity: continue
        size=sizes.get(str(item.size_id))
        if not size or item.quantity>int(size.get('estoque') or 0):
            raise HTTPException(409,'Um item está indisponível ou a quantidade excede o estoque.')
        product=products.get(str(size.get('product_id')))
        if not product:
            raise HTTPException(409,'Um produto do carrinho não está mais disponível.')
        product={**product,'product_images':images.get(str(product['id']),[])}
        price=Decimal(str(product['preco_promocional'] if product.get('preco_promocional') is not None else product['preco']))
        subtotal=price*item.quantity;total+=subtotal
        result.append({'size_id':size['id'],'quantity':item.quantity,'size':size['tamanho'],'stock':size['estoque'],
                       'product':product,'unit_price':str(price),'subtotal':str(subtotal)})
    return {'items':result,'subtotal':str(total.quantize(Decimal('.01')))}

@router.post('/quote')
async def quote(body:CartInput,db:Database=Depends(get_database)):
    return await quote_items(body.items,db)

@router.get('')
async def read_cart(user:User=Depends(current_user),db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/cart',token=user.token,params={'select':'id,cart_items(product_size_id,quantidade)','user_id':'eq.'+user.id,'limit':'1'})
    return [{'size_id':i['product_size_id'],'quantity':i['quantidade']} for i in (rows[0]['cart_items'] if rows else [])]

@router.put('/items/{size_id}')
async def set_item(size_id:UUID,body:Item,user:User=Depends(current_user),db:Database=Depends(get_database)):
    if size_id!=body.size_id: raise HTTPException(422,'Item inválido.')
    await db.request('/rest/v1/rpc/horizon_set_cart_item',method='POST',token=user.token,json={'p_size_id':str(size_id),'p_quantity':body.quantity})
    return {'saved':True}
