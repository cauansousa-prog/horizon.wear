# Catálogo e identidade visual — setembro de 2026

38 produtos: 6 já existentes no Supabase, 12 recuperados do catálogo anterior em `frontend/js/app.js` e 20 novos cadastros.

Os nomes foram ajustados aos elementos visíveis nas fotografias: cor, tipo de peça, estampa e acabamento. As fotografias são referências de catálogo provenientes do Unsplash, revisadas visualmente e armazenadas em `frontend/img/catalog/`; as fontes estão em `supabase/catalog/image-sources.json`. A correspondência visual não confirma composição, autenticidade, fornecedor ou disponibilidade física. Esses dados devem ser confirmados pela loja antes de disponibilizar os novos produtos para venda.

A migração `0005_catalog_restore_expand.sql` é incremental e pode ser executada novamente. Preserva os IDs, preços já cadastrados e estoques existentes; cria os tamanhos novos com estoque zero. Os preços dos 12 itens recuperados foram mantidos do catálogo anterior; os 20 novos receberam preços de catálogo editáveis na administração. Não são cotações de fornecedor. A migração aborta se detectar alteração de um preço ou estoque anterior.

O frontend permanece em HTML, CSS e JavaScript puro, e o servidor permanece em Python/FastAPI. O arquivo `frontend/css/horizon.css` aplica a identidade azul e laranja e os ajustes para telas pequenas. A vitrine pública não depende de renovar o login; erros de carregamento oferecem uma tentativa explícita. Categorias direcionam para a categoria específica, e o filtro de disponibilidade usa as quantidades reais do banco.

Não há alteração das credenciais, do webhook ou da configuração de pagamentos nesta atualização. Checkout continua dependendo da configuração completa do Mercado Pago.
