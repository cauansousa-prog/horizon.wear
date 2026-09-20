from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from ...database import Database, get_database

router=APIRouter(tags=['produtos'])
FIELDS='id,nome,slug,descricao,tecido,caimento,preco,preco_promocional,destaque,lancamento,vendas_total,created_at,categories(id,nome,slug,grupo),product_images(id,url,ordem),product_sizes(id,tamanho,estoque)'

@router.get('/products')
async def products(offset:int=Query(0,ge=0),limit:int=Query(100,ge=1,le=100),db:Database=Depends(get_database)):
    return await db.request('/rest/v1/products',params={'select':FIELDS,'ativo':'eq.true','order':'created_at.desc,id','limit':str(limit),'offset':str(offset)})

@router.get('/products/{slug}')
async def product(slug:str,db:Database=Depends(get_database)):
    rows=await db.request('/rest/v1/products',params={'select':FIELDS,'ativo':'eq.true','slug':'eq.'+slug,'limit':'1'})
    if not rows: raise HTTPException(404,'Produto não encontrado ou indisponível.')
    return rows[0]

@router.get('/categories')
async def categories(db:Database=Depends(get_database)):
    return await db.request('/rest/v1/categories',params={'select':'id,nome,slug,grupo,imagem_url,ordem','order':'ordem,nome'})
