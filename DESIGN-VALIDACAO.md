# Revisão do design — 19/09/2026

Alterações aplicadas ao frontend servido pelo FastAPI em http://127.0.0.1:8018/.

- Banner com a imagem original preservada em `frontend/img/hero.png`, em largura total e com composição própria para celular.
- Navegação horizontal no computador e tablet; menu compacto no celular, com fechamento por clique externo ou Escape.
- Login em `/#conta` e cadastro em `/#cadastro`, com formulários separados.
- Checkout dividido em dados, entrega e pagamento; resumo com imagens, subtotal, frete e total.
- Administração com menu de gestão, indicadores reais, busca local nas tabelas, etiquetas de situação e formulários de edição.
- Ajustes de espaçamento, contraste, preenchimento automático, foco e carrinho fechado inacessível ao teclado.

## Verificações realizadas

- 21 testes de backend aprovados; avisos de descontinuação das dependências e aviso de permissão do cache do pytest, sem falhas.
- Inspeção visual em larguras de 390, 820 e 1440 pixels.
- Banner visível nos três tamanhos; menu móvel compacto e navegação horizontal no tablet.
- Login e cadastro exibidos separadamente; login real validado e conta administrativa reconhecida. Nenhuma nova conta foi criada para o teste de layout.
- Catálogo carregado do Supabase, detalhe do produto, seleção de tamanho, adição e remoção no carrinho verificadas.
- Checkout bloqueou avanço com campos obrigatórios vazios; avançou pelas três etapas; voltar preservou o endereço preenchido.
- Teste de checkout usou dados fictícios sem gerar pedido ou pagamento. Item de teste removido; carrinho anterior da conta preservado.
- Dashboard administrativo carregou dados reais; busca filtrou a tabela; edição abriu e fechou sem salvar; estoque e estado vazio de pedidos conferidos.
- Painel móvel sem transbordamento horizontal da página. Tabelas extensas têm rolagem interna.
- Nenhum erro JavaScript observado nos fluxos verificados.

## Limites

O endereço publicado informado não respondeu durante a comparação anterior; o banner foi recuperado dos arquivos originais locais. Esta entrega modifica o projeto local e não publica na Vercel.

Pagamento real continua indisponível até a configuração do Mercado Pago e do endereço HTTPS público. A etapa final informa essa condição e mantém a confirmação desabilitada. Processamento de pagamentos não foi validado neste trabalho de design.
