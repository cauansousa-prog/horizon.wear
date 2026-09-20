# Publicar a Horizon Wear

## Antes de publicar

1. Aplique no Supabase a migração compatível com o banco em uso.
2. Crie as variáveis de ambiente na hospedagem. Nunca copie o arquivo `.env` para o repositório.
3. Publique usando o `Dockerfile` na raiz do projeto.
4. Escolha o domínio HTTPS e use esse endereço como `PUBLIC_BASE_URL`.

## Variáveis obrigatórias

```text
SUPABASE_URL
SUPABASE_ANON_KEY
CORS_ORIGINS=["https://seu-dominio.com"]
```

## Variáveis para receber pagamentos

```text
SUPABASE_SERVICE_ROLE_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_PUBLIC_KEY
MERCADOPAGO_WEBHOOK_SECRET
PUBLIC_BASE_URL=https://seu-dominio.com
```

Depois de o site estar no domínio final, cadastre `https://seu-dominio.com/api/webhooks/mercadopago` no painel do Mercado Pago. Só então o checkout ficará disponível.

## Verificação depois da publicação

Abra `https://seu-dominio.com/api/health` e `https://seu-dominio.com/api/health/ready`. Os dois devem responder com status 200 antes do teste de compra.


## Vercel

O projeto `horizon-wear` usa a raiz do repositório e o preset FastAPI, definido em `vercel.json`. `app.py` importa a aplicação existente; `requirements.txt` reutiliza as dependências do backend. A aplicação serve o frontend em `frontend/`, a API em `/api` e as páginas de produtos em `/produto/{slug}`. Os arquivos antigos da raiz são excluídos pela `.vercelignore`.

Configure no ambiente Production: `SUPABASE_URL` (URL base sem `/rest/v1`), `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `PUBLIC_BASE_URL=https://horizonwear.vercel.app`. As chaves ficam somente no ambiente do servidor. No Supabase Auth, inclua `https://horizonwear.vercel.app/#conta` entre os redirects permitidos.

Após o deploy, valide `/api/health`, `/api/health/ready`, o catálogo, o login e uma página `/produto/`. Pagamentos continuam dependentes das credenciais do Mercado Pago.
