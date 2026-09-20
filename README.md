# Horizon Wear

Loja de moda masculina com frontend em HTML, CSS e JavaScript puro, API em Python/FastAPI e dados no Supabase PostgreSQL.

## Entregue

- Catálogo carregado da API, categorias, busca, filtros e página individual da peça.
- Controle de tamanho e estoque no carrinho; preços e disponibilidade são confirmados pelo servidor.
- Carrinho local para visitante e sincronização com a conta após login.
- Cadastro, login, recuperação de senha, perfil, endereços e histórico de pedidos via Supabase Auth.
- Área administrativa protegida para catálogo, estoque, pedidos, pagamentos, cupons e avaliações.
- Checkout preparado para Pix, boleto e cartão com idempotência, reserva de estoque, webhook assinado e atualização de pedido no servidor.
- Páginas de privacidade, contato, trocas e devoluções e rastreio pelo histórico de pedidos.

## Executar localmente

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8018 --reload
```

Abra `http://127.0.0.1:8018/`. No VS Code, use a tarefa **Iniciar Horizon Wear**.

## Variáveis de ambiente

Copie `.env.example` para `.env`. As credenciais ficam somente no servidor e o arquivo `.env` não deve ser enviado ao Git.

Para catálogo, conta, carrinho e administração:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua-chave-publica
```

Para pagamentos reais, configure também:

```text
SUPABASE_SERVICE_ROLE_KEY=chave-privada-do-servidor
MERCADOPAGO_ACCESS_TOKEN=token-privado-do-mercado-pago
MERCADOPAGO_PUBLIC_KEY=chave-publica-do-mercado-pago
MERCADOPAGO_WEBHOOK_SECRET=segredo-do-webhook
PUBLIC_BASE_URL=https://seu-dominio.com
```

O checkout permanece bloqueado até que essas cinco variáveis estejam configuradas. Isso evita criar pedidos ou cobranças sem uma confirmação segura do Mercado Pago. A chave `SUPABASE_SERVICE_ROLE_KEY` e o token de acesso do Mercado Pago nunca podem aparecer no HTML, JavaScript ou repositório.

## Banco de dados

- `supabase/migrations/0001_foundation.sql` serve para um banco de desenvolvimento novo.
- `supabase/migrations/0003_checkout_existing.sql` adapta o esquema já existente para checkout, reserva de estoque e idempotência.
- Antes de usar checkout real, aplique a migração compatível no SQL Editor do Supabase e execute os scripts em `supabase/tests/`.

## Validação

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Os testes cobrem rotas estáticas, autenticação, RLS encaminhado pelo JWT, catálogo, carrinho, validação de estoque, administração, webhook e a sintaxe das migrações.

## Publicação

Publique a API FastAPI em uma hospedagem com HTTPS e configure `PUBLIC_BASE_URL` com o domínio final. O endpoint de webhook será `https://seu-dominio.com/api/webhooks/mercadopago`; registre esse endereço no painel do Mercado Pago depois de publicar.

O projeto inclui um `Dockerfile` pronto para hospedagem. Consulte [DEPLOY.md](DEPLOY.md) antes de publicar.
