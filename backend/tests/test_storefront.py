import json
import re
import httpx
from fastapi.testclient import TestClient
from backend.app.config import Settings
from backend.app.main import create_app


def test_collection_and_help_routes_are_directly_accessible():
    cfg=Settings(_env_file=None)
    with TestClient(create_app(cfg,httpx.MockTransport(lambda request:httpx.Response(500)))) as client:
        for path in ['/colecao','/colecao/calcas','/ajuda','/sobre','/privacidade','/trocas']:
            response=client.get(path)
            assert response.status_code==200
            assert 'css/atelier.css' in response.text
            assert 'href="https://horizonwear.vercel.app'+path+'"' in response.text
        assert '/sitemap.xml' in client.get('/robots.txt').text
        sitemap=client.get('/sitemap.xml')
        assert sitemap.status_code==200 and '/colecao/calcas' in sitemap.text


def test_product_metadata_uses_actual_price_stock_and_escapes_content():
    product={'id':'a','nome':'Camiseta <especial>','slug':'camiseta-especial',
             'descricao':'Detalhe </script><script>alert(1)</script>',
             'preco':119.90,'preco_promocional':99.90,
             'product_images':[{'url':'/img/catalog/white-tee.jpg','ordem':0}],
             'product_sizes':[{'estoque':0}]}
    def handle(request):
        assert request.url.params['ativo']=='eq.true'
        return httpx.Response(200,json=[product])
    cfg=Settings(_env_file=None,supabase_url='https://example.supabase.co',supabase_anon_key='public-key')
    with TestClient(create_app(cfg,httpx.MockTransport(handle))) as client:
        response=client.get('/produto/camiseta-especial')
        assert response.status_code==200
        assert '<title>Camiseta &lt;especial&gt; | Horizon Wear</title>' in response.text
        encoded=re.search(r'id="productStructuredData">(.*?)</script>',response.text).group(1)
        data=json.loads(encoded)
        assert data['offers']['price']=='99.9'
        assert data['offers']['availability'].endswith('OutOfStock')
        assert '<script>alert(1)</script>' not in response.text
        assert 'aggregateRating' not in data
