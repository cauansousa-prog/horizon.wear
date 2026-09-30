from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .modules.webhooks.router import router as webhooks_router
from .modules.payments.router import router as payments_router
from .modules.products.reviews import router as reviews_router
from .modules.admin.router import router as admin_router
from .modules.users.auth_router import router as auth_router
from .modules.users.account import router as account_router
from .modules.cart.router import router as cart_router
from .modules.products.router import router as products_router
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import PurePosixPath
from .config import ROOT, get_settings
from .database import Database, get_database
from .modules.users.router import router as users_router
from .modules.hub.router import router as hub_router

class StoreFiles(StaticFiles):
    async def get_response(self,path,scope):
        item=PurePosixPath(path)
        allowed={'.html','.css','.js','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico',
                 '.woff','.woff2','.ttf','.otf','.mp4','.webm','.mp3','.wav','.pdf'}
        if any(p.startswith('.') for p in item.parts) or (item.suffix and item.suffix.lower() not in allowed):
            raise HTTPException(404,'Arquivo não encontrado.')
        return await super().get_response(path,scope)


def create_app(settings=None, transport=None):
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        async with httpx.AsyncClient(timeout=10, transport=transport, follow_redirects=False) as client:
            app.state.http = client
            yield

    app = FastAPI(title='Horizon Wear API', version='0.1.0', lifespan=lifespan)
    app.state.settings = settings

    @app.middleware('http')
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        # Somente páginas das lojas podem ser incorporadas pela central no mesmo domínio.
        path=request.url.path
        embeddable=path in ('/','/Index.html','/index.html','/admin.html','/central/admin.html') or path.startswith(('/lojas/','/produto/'))
        response.headers.setdefault('X-Frame-Options','SAMEORIGIN' if embeddable else 'DENY')
        response.headers.setdefault('Content-Security-Policy',"frame-ancestors 'self'" if embeddable else "frame-ancestors 'none'")
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        if request.url.scheme == 'https':
            response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        # Não devolver senhas, tokens ou CPF nas mensagens de validação.
        labels={'name':'Nome completo','nome_completo':'Nome','email':'E-mail','cpf':'CPF',
                'phone':'Telefone','telefone':'Telefone','cep':'CEP','estado':'Estado (UF)',
                'rua':'Rua','numero':'Número','bairro':'Bairro','cidade':'Cidade',
                'destinatario':'Destinatário','complemento':'Complemento','password':'Senha'}
        fields=[labels.get(str(e['loc'][-1])) for e in exc.errors() if e.get('loc')]
        fields=list(dict.fromkeys(f for f in fields if f))
        detail='Corrija: '+', '.join(fields)+'.' if fields else 'Não foi possível validar o pedido. Atualize a página e tente novamente.'
        return JSONResponse(status_code=422, content={'detail':detail,'fields':fields})

    if settings.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                           allow_methods=['GET','POST','PUT','PATCH','DELETE'], allow_headers=['Authorization', 'Content-Type'])

    @app.get('/api/health', tags=['infraestrutura'])
    async def health():
        return {'status': 'ok'}

    @app.get('/api/health/ready', tags=['infraestrutura'])
    async def ready(database: Database = Depends(get_database)):
        await database.readiness()
        return {'status': 'ok', 'supabase': 'reachable'}

    app.include_router(products_router, prefix='/api')
    app.include_router(cart_router, prefix='/api')
    app.include_router(account_router, prefix='/api')
    app.include_router(auth_router, prefix='/api')
    app.include_router(admin_router, prefix='/api')
    app.include_router(reviews_router, prefix='/api')
    app.include_router(payments_router, prefix='/api')
    app.include_router(webhooks_router, prefix='/api')
    app.include_router(users_router, prefix='/api')
    app.include_router(hub_router,prefix='/api')

    # Mantém endpoints futuros fora do servidor de arquivos estáticos.
    @app.api_route('/api/{path:path}', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    async def missing_api(path: str):
        raise HTTPException(404, 'Endpoint não implementado nesta sessão.')

    @app.get('/Index.html', include_in_schema=False)
    async def legacy_index():
        return FileResponse(ROOT / 'frontend' / 'index.html')

    @app.get('/produto/{slug}', include_in_schema=False)
    async def product_page(slug: str):
        return FileResponse(ROOT / 'frontend' / 'index.html')

    for store in ('academia','construcao'):
        app.mount('/lojas/'+store,StoreFiles(directory=ROOT/'lojas'/store,html=True),name='loja-'+store)
    app.mount('/', StaticFiles(directory=ROOT / 'frontend', html=True), name='frontend')
    return app


app = create_app()
