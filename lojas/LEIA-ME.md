# Como colocar os três sites juntos

Abra **/central/** no endereço da hospedagem. Os botões carregam cada site dentro da mesma página: o endereço da central permanece igual, sem abrir outra aba ou outro domínio.

## Onde colocar os arquivos

| Loja | Pasta do site | Fonte dos dados |
| --- | --- | --- |
| Horizon Wear | `frontend/` (site atual) | Tabelas atuais da Horizon |
| Academia | `lojas/academia/` | `hub_products`, com `loja_id = academia` |
| Construção | `lojas/construcao/` | `hub_products`, com `loja_id = construcao` |

Cada pasta dos amigos deve conter **index.html**. Copie o conteúdo do site para a pasta correspondente e substitua o modelo. CSS, JavaScript e imagens próprios podem ficar dentro dessa pasta. Use caminhos relativos, como `css/style.css`, `js/app.js` e `img/produto.jpg`. Não use `<base href="/">` nos sites dos amigos; caminhos `/css/...` apontariam para os arquivos da Horizon.

Os três sites são publicados com o mesmo repositório e um único projeto Vercel. O backend é o FastAPI existente. HTML, CSS e JavaScript puro continuam sendo usados.

## Conectar o site ao mesmo banco

Todos usam as mesmas variáveis Supabase configuradas no servidor. Inclua o cliente compartilhado no seu HTML:

```html
<script src="/shared/lojas-client.js"></script>
<script src="js/app.js"></script>
```

Na academia:

```javascript
const loja = HorizonHub.store('academia');
const produtos = await loja.products();
await loja.addToCart(produtos[0].id, 1);
const resumo = await loja.quote();
const demonstracao = await loja.simulate('pix');
```

Na construção, troque apenas `'academia'` por `'construcao'`. As chamadas assíncronas devem ficar dentro de uma função `async` ou de um script `type="module"`.

O cliente também oferece `HorizonHub.login(email, senha)`, `signup(nome, email, senha)`, `profile()` e `saveProfile({nome_completo, telefone})`. A conta do cliente é compartilhada; os carrinhos e históricos de demonstração têm chaves diferentes para cada loja. A Horizon continua usando seu próprio fluxo existente.

As demonstrações não criam pagamentos reais nem pedidos de envio. Os históricos ficam no navegador. `hub_orders` e `hub_order_items` estão preparados para uma futura integração real de pedidos; `loja.orders()` lê os pedidos do cliente autenticado. Não declare um pagamento aprovado no frontend.

Copiar um site HTML já permite abrir a página na central. Para seus produtos e formulários usarem o Supabase, conecte-os a esse cliente compartilhado. Um site com outro backend ou outro esquema de banco precisa dessa adaptação.

## Administração dos amigos

O painel compartilhado está em **/central/admin.html**. A Horizon mantém **/admin.html**.

Cada amigo cria uma conta pelo cadastro existente da Horizon. Depois, o proprietário do Supabase atribui a loja à conta pelo SQL Editor, substituindo o e-mail no exemplo:

```sql
insert into public.hub_memberships(loja_id,user_id,role)
select 'academia',id,'admin' from auth.users where email='email-do-amigo'
on conflict(loja_id,user_id) do update set role=excluded.role;
```

Para o outro amigo, use `'construcao'`. A atribuição não é permitida pelo navegador. O administrador de uma loja não ganha permissão para alterar a outra.

## Banco e publicação

A migração incremental é `supabase/migrations/0007_store_hub.sql`. Ela adiciona tabelas próprias para os novos sites, no mesmo Supabase, e mantém os registros atuais da Horizon. O catálogo da academia não aparece no catálogo de construção, e as relações de pedidos impedem misturar produtos de lojas diferentes.

As pastas, o cliente e a API são publicados juntos pelo Vercel. Mantenha tokens, senhas de banco e chaves privadas somente nas variáveis do servidor; não copie `.env`, arquivos Python, dependências ou credenciais para as pastas dos sites.
