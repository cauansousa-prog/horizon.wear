"""Public page metadata and discoverable storefront routes; no write operations."""
import html
import json
from urllib.parse import quote
from xml.sax.saxutils import escape
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response, PlainTextResponse
from .config import ROOT
from .database import Database, get_database
from .modules.products.router import FIELDS

router = APIRouter()
COLLECTIONS={'roupas':'Roupas masculinas','calcados':'Calçados masculinos','acessorios':'Acessórios',
             'relogios':'Relógios','novidades':'Novidades','camisetas':'Camisetas masculinas',
             'calcas':'Calças masculinas','moletons':'Moletons','camisas':'Camisas masculinas','jaquetas':'Jaquetas'}
PAGES={'sobre':'Sobre a Horizon Wear','ajuda':'Entrega, pagamento e medidas','contato':'Contato',
       'privacidade':'Política de privacidade','trocas':'Trocas e devoluções'}

def origin(db):
    return db.settings.public_base_url or 'https://horizonwear.vercel.app'

def page_response(db,path,title,description,product=None):
    text=(ROOT/'frontend/index.html').read_text(encoding='utf-8')
    base=origin(db)
    text=text.replace('<title>HORIZON WEAR — Moda Masculina Premium</title>', '<title>'+html.escape(title)+'</title>')
    text=text.replace('content="Conheça a coleção Horizon Wear. Moda masculina, peças urbanas e detalhes que fazem parte do seu estilo."','content="'+html.escape(description,quote=True)+'"')
    text=text.replace('content="Horizon Wear | Coleção masculina"','content="'+html.escape(title,quote=True)+'"')
    text=text.replace('content="Vista seu próximo horizonte."','content="'+html.escape(description,quote=True)+'"')
    text=text.replace('href="https://horizonwear.vercel.app/"','href="'+html.escape(base+path,quote=True)+'"')
    text=text.replace('content="https://horizonwear.vercel.app/img/hero.png"','content="'+html.escape(base+'/img/hero.png',quote=True)+'"')
    if product:
        images=sorted(product.get('product_images') or [],key=lambda i:i.get('ordem',0))
        image=images[0]['url'] if images else '/img/logo-icone.png'
        if image.startswith('/'):
            image=base+image
        text=text.replace('content="'+html.escape(base+'/img/hero.png',quote=True)+'"','content="'+html.escape(image,quote=True)+'"')
        available=any(s.get('estoque',0)>0 for s in product.get('product_sizes') or [])
        data={'@context':'https://schema.org','@type':'Product','name':product['nome'],
              'description':description,'image':image,'url':base+path,
              'offers':{'@type':'Offer','url':base+path,'priceCurrency':'BRL',
                        'price':str(product.get('preco_promocional') if product.get('preco_promocional') is not None else product['preco']),
                        'availability':'https://schema.org/'+('InStock' if available else 'OutOfStock')}}
        encoded=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
        text=text.replace('</head>','<script type="application/ld+json" id="productStructuredData">'+encoded+'</script>\n</head>')
    return HTMLResponse(text)

@router.get('/colecao',include_in_schema=False)
@router.get('/colecao/{category}',include_in_schema=False)
async def collection(category:str='',db:Database=Depends(get_database)):
    title=COLLECTIONS.get(category,'Coleção')
    return page_response(db,'/colecao'+('/'+quote(category,safe='') if category else ''),title+' | Horizon Wear',title+'. Explore as peças disponíveis na Horizon Wear.')

for slug,title in PAGES.items():
    def make_page(slug,title):
        async def page(db:Database=Depends(get_database)):
            return page_response(db,'/'+slug,title+' | Horizon Wear',title+'. Informações e atendimento da Horizon Wear.')
        return page
    router.add_api_route('/'+slug,make_page(slug,title),methods=['GET'],include_in_schema=False)

@router.get('/produto/{slug}',include_in_schema=False)
async def product_page(slug:str,db:Database=Depends(get_database)):
    product=None
    if db.settings.database_configured:
        try:
            rows=await db.request('/rest/v1/products',params={'select':FIELDS,'ativo':'eq.true','slug':'eq.'+slug,'limit':'1'})
            if rows:product=rows[0]
        except HTTPException:
            pass  # Keep the existing client-side retry/error flow during a data outage.
    return page_response(db,'/produto/'+quote(slug,safe=''),
                         (product['nome'] if product else 'Produto')+' | Horizon Wear',
                         product.get('descricao') or product['nome'] if product else 'Conheça os detalhes desta peça na Horizon Wear.',product)

@router.get('/robots.txt',include_in_schema=False)
async def robots(db:Database=Depends(get_database)):
    return PlainTextResponse('User-agent: *\nDisallow: /api/\nDisallow: /admin.html\nDisallow: /central/admin.html\nSitemap: '+origin(db)+'/sitemap.xml\n')

@router.get('/sitemap.xml',include_in_schema=False)
async def sitemap(db:Database=Depends(get_database)):
    paths=['/','/colecao']+['/'+p for p in PAGES]+['/colecao/'+p for p in COLLECTIONS]
    if db.settings.database_configured:
        offset=0
        try:
            while True:
                rows=await db.request('/rest/v1/products',params={'select':'slug','ativo':'eq.true','order':'slug','limit':'100','offset':str(offset)})
                paths.extend('/produto/'+quote(p['slug'],safe='') for p in rows)
                if len(rows)<100:break
                offset+=100
        except HTTPException:
            pass
    body='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+escape(origin(db)+p)+'</loc></url>' for p in dict.fromkeys(paths))+'</urlset>'
    return Response(body,media_type='application/xml')
