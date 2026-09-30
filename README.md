# Horizon Wear

Loja existente em HTML, CSS e JavaScript puro, API Python/FastAPI, Supabase PostgreSQL e Mercado Pago Checkout Transparente. Nenhum token privado é enviado ao navegador.

## Execução local

Instale Python 3.13 ou superior e, na raiz do projeto:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8018
```

Abra `http://127.0.0.1:8018/`. O catálogo e a conta exigem as chaves públicas do Supabase no `.env`. Sem a integração de pagamentos completa, o checkout permite pedidos de demonstração sem cobrança ou envio. O arquivo `.env` está excluído do Git e do Docker. Se o `.env` já existir, mantenha suas configurações.

## Banco Supabase existente

Este código usa o esquema português documentado em [supabase/INSPECAO_EXISTENTE.md](supabase/INSPECAO_EXISTENTE.md): `products`, `product_sizes`, `orders`, `payments` e as demais tabelas já presentes. No SQL Editor do projeto, aplique **nessa ordem**:

1. `supabase/migrations/0002_existing_security.sql`: corrige a política recursiva de perfis, impede alterações diretas de papéis e pagamentos, e instala a função de carrinho.
2. `supabase/migrations/0003_checkout_existing.sql`: adiciona reservas, idempotência, confirmação de pagamentos, baixa transacional de estoque e avanço seguro dos pedidos.
3. `supabase/migrations/0004_public_catalog.sql`: permite que visitantes leiam produtos ativos sem consultar perfis privados.

Não aplique `0001_foundation.sql` nesse banco. Esse arquivo é um rascunho anterior para outro esquema e foi mantido como histórico; ele não corresponde à API atual.

Depois, execute as consultas em `supabase/tests/verify_schema.sql` e revise os resultados. A migração de checkout deve ser aplicada antes de ativar as credenciais de pagamento.

## Pagamentos

Configure no `.env`:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=chave-publica
SUPABASE_SERVICE_ROLE_KEY=chave-privada
MERCADOPAGO_ACCESS_TOKEN=token-privado
MERCADOPAGO_PUBLIC_KEY=chave-publica
MERCADOPAGO_WEBHOOK_SECRET=segredo-do-webhook
PUBLIC_BASE_URL=https://seu-dominio.com
```

O Mercado Pago informa quais meios estão disponíveis. A loja oferece Pix, cartão via Card Payment Brick e boleto `bolbradesco` somente quando aparecerem na conta. O backend calcula preços e frete, cria o pedido com chave de idempotência, envia a cobrança para `/v1/payments`, confere o pagamento com o provedor e processa o webhook assinado. A baixa de estoque acontece uma vez, dentro da transação do Supabase. Se um pagamento aprovado encontrar estoque insuficiente, o pedido fica sinalizado para conferência administrativa e o estoque não fica negativo.

Registre no painel do Mercado Pago o webhook `https://seu-dominio.com/api/webhooks/mercadopago` para eventos de pagamento. O painel deve usar o mesmo segredo definido em `MERCADOPAGO_WEBHOOK_SECRET`.

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Os testes automatizados simulam os serviços externos e cobrem catálogo, conta, proteção administrativa, Pix, cartão, boleto, webhook e migrações SQL. Eles não substituem uma compra com credenciais de teste reais do Mercado Pago e o banco Supabase configurado.

Veja [DEPLOY.md](DEPLOY.md) para publicação.
