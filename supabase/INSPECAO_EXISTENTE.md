# Inspeção do Supabase autenticado

Inspeção somente de leitura pelo SQL Editor do projeto bzpanboiidrurjwuswlv. Nenhuma tabela ou registro remoto alterado.

## Causa confirmada
A política SELECT "Admin vê todos os perfis" em public.profiles usa EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.role='admin'), gerando recursão. As políticas de outras tabelas também consultam profiles para autorização administrativa.

Políticas de profiles:
- Admin vê todos os perfis: SELECT, consulta recursiva acima.
- Usuário atualiza o próprio perfil: UPDATE, auth.uid()=id.
- Usuário vê e edita o próprio perfil: SELECT, auth.uid()=id.

anon e authenticated possuem grants de tabela SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER. É necessário restringir especialmente UPDATE(role); a política de proprietário atual não restringe colunas.

## Esquema existente a preservar
- profiles: id, nome_completo, telefone, role, created_at, updated_at.
- categories: id, nome, slug, grupo, imagem_url, ordem.
- products: id, categoria_id, nome, slug, descricao, tecido, caimento, preco, preco_promocional, ativo, destaque, lancamento, vendas_total, created_at, updated_at.
- product_sizes: id, product_id, tamanho, estoque. ESTA é a estrutura existente de estoque; não criar product_variants duplicada.
- product_images: id, product_id, url, ordem.
- cart: id, user_id, created_at.
- cart_items: id, cart_id, product_id, product_size_id, quantidade, created_at.
- addresses: id, user_id, destinatario, cep, rua, numero, complemento, bairro, cidade, estado, referencia, telefone, padrao, created_at.
- orders: id, codigo, user_id, status, nome_cliente, email_cliente, cpf_cliente, telefone_cliente, endereco, subtotal, frete, desconto, total, cupom_codigo, rastreio, created_at, updated_at.
- order_items: id, order_id, product_id, nome_produto, tamanho, preco_unitario, quantidade.
- payments: id, order_id, metodo, status, valor, mercadopago_payment_id, qr_code, qr_code_base64, linha_digitavel, boleto_url, parcelas, criado_em, aprovado_em.
- coupons: id, codigo, tipo, valor, ativo, validade, uso_maximo, uso_atual.
- reviews: id, product_id, user_id, order_item_id, nota, comentario, created_at.

## Continuação
Preparar migração incremental para a recursão e os grants de profiles. Inspecionar funções, constraints e triggers antes de aplicar. Adaptar a consulta /api/users/me para alias full_name:nome_completo e phone:telefone. Validar isolamento com transação/rollback. Não aplicar 0001_foundation.sql neste banco. Depois continuar catálogo e carrinho sobre products/product_sizes/cart_items existentes.
