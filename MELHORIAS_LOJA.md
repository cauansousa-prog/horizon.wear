# Melhorias da loja — 08/10/2026

Versão anterior preservada em `backup/antes-melhorias-loja-2026-10-08`, commit `78d2d968ffffc7d1fe4cd3db9a3927ee0fbb5c65`.

## Escopo

Interface pública, categorias compartilháveis, filtros, galeria com ampliação, combinações, ajuda, metadados de produtos, sitemap e robots. A camada visual adicional está em `frontend/css/atelier.css`. Sem migrações, exclusão de arquivos ou mudanças na lógica de cobrança, estoque, autenticação e permissões administrativas.

## Informações que precisam ser confirmadas

Composição, caimento, medidas, cuidados, fotos adicionais, origem, apresentação do perfume, endereço de expedição, horário de atendimento e prazo de entrega dependem de dados reais da loja. Não foram inventados depoimentos, certificados ou prazos. Os campos existentes de tecido, caimento e imagens continuam sendo usados. A página reconhece fotos adicionais já cadastradas.

Medidas e informações complementares podem ser publicadas em `frontend/data/product-details.json`, usando o slug do produto como chave em `products`. Campos opcionais: `composition`, `model`, `origin`, `presentation`, `care`, `measurements` (lista de objetos com `size` e `details`, medidas em centímetros). Somente preencha valores conferidos. O arquivo é público: não coloque dados privados. Sem informações cadastradas, o site apresenta a ausência de medidas e um contato específico para a peça.

O frete exibido utiliza `/api/checkout/config`, a mesma configuração do checkout. A central de ajuda exibe os métodos retornados por esse endpoint. Nenhuma configuração financeira é alterada.

## Referências de projeto

- COS: https://www.cos.com/es-es/men — fotografia e categorias.
- Aramis: https://www.aramis.com.br/new-in — coleções e organização.
- Insider: https://loja.insiderstore.com.br/products/tech-t-shirt — informação do produto e medidas.

## Retorno ao visual anterior

Prefira reverter o commit destas melhorias com `git revert <commit-das-melhorias>` e publicar o novo commit. Isso preserva o histórico e outras alterações posteriores. A branch de backup também mantém integralmente os arquivos da versão antiga. Não use reset forçado na main nem altere o banco de dados para reverter esta atualização.

## Limites de validação

Testes automatizados utilizam dados de teste; não são comprovação de liquidação financeira real. Antes de anunciar novos métodos ou prazos, confirme a operação comercial. Eventos de publicidade e ferramentas de análise externas não foram ativados: precisam da definição da conta e da configuração de privacidade apropriada.

## Validação executada

Teste de DOM com dados simulados: home, categorias, busca, preservação de filtros, ações por produto, tamanhos sem estoque, galeria, ausência de medidas, seleção de opção única, carrinho, resumo do checkout e ajuda. Testes Python de rotas públicas e metadados adicionados. A comparação com o commit anterior reproduziu sete falhas existentes nos testes de permissões/exportações administrativas, cotação, autorização e recuperação de login; esta atualização não altera esses módulos. Um parêntese ausente em um teste existente foi corrigido para permitir a execução da suíte.
