# Auditoria Horizon Wear — 22/10/2026

Base: 693f3dc37789b08395c85591167ede674db221ab.
Status: correções de código verificadas; operação completa em produção BLOQUEADA pelo Supabase. Não há certificação de ausência total de erros.

## Correções

- E-mail é normalizado antes da validação, inclusive no cadastro. O login não tenta outra identidade ao detectar erro de digitação.
- Renovação de sessão preserva o login durante indisponibilidade temporária; credenciais inválidas continuam encerrando a sessão.
- API administrativa respeita `admin_permissions` de `app_metadata` retornado pelo Auth verificado. Metadados editáveis pelo cliente não concedem acesso. Administradores legados sem esse campo mantêm o papel existente.
- Endpoints de identidade administrativa e exportação CSV/XLSX; exportação exige permissão de recurso e de exportação, com paginação e limite de volume.
- XLSX escapa aspas nos nomes de planilha e remove caracteres de controle inválidos.
- Testes de carrinho atualizados para o contrato de consultas separadas; validação de sessão inválida espera 401. Asserção antiga que exigia login em outro endereço foi substituída por uma regressão que proíbe isso.
- HTML, CSS, imagens e estrutura visual preservados.

## Revisões e evidências

1. Histórico e isolamento: checkout do commit restaurado, sem integração Aurel.
2. API e inicialização: suíte de infraestrutura e compilação Python.
3. Login: normalização, senha incorreta e ausência de tentativa em outro endereço.
4. Sessão frontend: 503 preserva sessão, 401 encerra; catálogo público não envia bearer.
5. Autorização: cliente não acessa administração; lista restrita não recebe dashboard.
6. Exportação: permissões de recurso + exportação; estrutura ZIP/XML e fórmulas neutralizadas.
7. Carrinho: preço calculado no servidor, quantidade, estoque e duplicidade.
8. Checkout: identidade, endereço e dados obrigatórios; testes com provedores simulados.
9. Pagamento: cenários de idempotência/conciliação da suíte existente, sem cobranças reais.
10. Webhook: validação de assinatura e configuração ausente.
11. Perfil: campos autorizados, persistência simulada e proibição de alteração de papel.
12. Rotas públicas/SEO: coleções, ajuda, sitemap e metadados de produtos com escaping.
13. Central: testes de autorização/isolamento existentes em test_hub.py.
14. Sintaxe: arquivos JavaScript e migrations SQL analisados, sem aplicar migrations.
15. Produção: 15 URLs consultadas. Páginas públicas retornam 200; endpoints privados sem sessão retornam 401; health retorna 200.
16. Navegador: coleção exibe erro real; carrinho vazio abre/fecha; pesquisa abre com foco no campo.
17. Preservação visual: nenhuma alteração em HTML/CSS/imagens.
18. Revisão do diff: sem espaços inválidos; testes de regressão executados após mudanças.

Resultados locais: 54 testes Python + 3 testes Node aprovados. Há um aviso de depreciação do adaptador httpx do TestClient; não é erro de execução da aplicação.

## Bloqueios que impedem encerrar a auditoria

- `/api/health/ready`, `/api/products` e `/api/categories`: HTTP 503, `Supabase indisponível.`
- O projeto `bzpanboiidrurjwuswlv`, identificado em `supabase/INSPECAO_EXISTENTE.md`, recusa acesso com a conexão Supabase atual.
- Vercel `horizon-wear`, equipe `cauansousa-progs-projects`: acesso conectado retorna 403. Variáveis e logs não foram inspecionados.
- As restrições administrativas adicionadas protegem a API. As políticas RLS e acesso direto ao Supabase precisam de inspeção no projeto correto; não é possível certificar isolamento de banco com testes simulados.
- Cadastro/login reais, pedidos persistidos, estoque transacional, e-mail de recuperação e pagamento ponta a ponta continuam sem validação em produção. Não foram criados usuários, pedidos ou cobranças reais.
- Responsividade móvel e acessibilidade completa não estão certificadas pelo teste de navegador desktop.

Para continuar: conectar Vercel da equipe indicada e Supabase do projeto Horizon; consultar logs/estado e variáveis sem expor segredos; restaurar conectividade; inspecionar políticas e migrations aplicadas; executar fluxos reais em ambiente de teste autorizado e conferir publicação final.
