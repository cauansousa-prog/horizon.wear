# Publicar a Horizon Wear

## Antes de publicar

1. Aplique no Supabase as migrações `0002_existing_security.sql`, `0003_checkout_existing.sql` e `0004_public_catalog.sql` nessa ordem.
2. Crie as variáveis de ambiente no projeto Vercel existente. Nunca copie o arquivo `.env` para o repositório.
3. Publique a branch `main` do repositório GitHub conectado ao Vercel. O arquivo `app.py` é a entrada FastAPI.
4. Configure `PUBLIC_BASE_URL` com a origem HTTPS de produção, sem barra final.

## Variáveis obrigatórias

```text
SUPABASE_URL
SUPABASE_ANON_KEY
CORS_ORIGINS=["https://horizonwear.vercel.app"]
```

## Variáveis para receber pagamentos

```text
SUPABASE_SERVICE_ROLE_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_PUBLIC_KEY
MERCADOPAGO_WEBHOOK_SECRET
PUBLIC_BASE_URL=https://horizonwear.vercel.app
```

Cadastre `https://horizonwear.vercel.app/api/webhooks/mercadopago` no painel da integração Mercado Pago. O segredo gerado deve ser salvo apenas como variável de ambiente no Vercel. O checkout só ficará disponível depois que as credenciais do Mercado Pago, o segredo do webhook e a chave privada de serviço do Supabase estiverem configurados.

## Verificação depois da publicação

Abra `https://seu-dominio.com/api/health` e `https://seu-dominio.com/api/health/ready`. Os dois devem responder com status 200 antes do teste de compra.
