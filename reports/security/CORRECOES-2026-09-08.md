# Correções de cibersegurança — 08/09/2026

As alterações foram aplicadas localmente, preservando o trabalho preexistente. Não houve deploy, alteração do histórico Git, remoção de dados remotos ou operação em contas reais.

| Achado | Tratamento aplicado | Estado |
|---|---|---|
| SEC-01 | Backup movido para `private-backups/`, fora da pasta pública, e ignorado pelo Git; teste impede backups de estudo em public | Resolvido na árvore local; histórico e hospedagem pendentes |
| SEC-02 | Restauração grava exercícios em uma geração nova e só troca o índice após todas as escritas; falhas removem apenas a geração incompleta | Corrigido; falhas de gravação testadas |
| SEC-03 | Schema de perfil, progresso, código e arquivos extras; rejeição de campos extras e chaves especiais; limite total de 8 MB e leitura de respostas em fluxo limitada | Corrigido; backup antigo e entradas adversariais testados |
| SEC-04 | Identificadores escapados nos atributos; ID real aplicado depois dos campos do documento; schema de regras rejeita campo id | Corrigido localmente; publicação das regras pendente |
| SEC-05 | Novas escritas de estudo no Firestore negadas; leitura e exclusão legada preservadas; comunicados com schema, tipos, limites, autoria e metadados imutáveis | Regras editadas; teste em emulador e deploy pendentes |
| SEC-06 | Opção explícita “Sair e apagar dados deste navegador”, com confirmação e orientação de backup; limpeza usa fronteira exata do UID; logout não indica sucesso quando falha | Mitigado; persistência pessoal continua por escolha funcional |
| SEC-07 | localhost/127.0.0.1/IPv6 loopback usam projeto demo e emuladores tanto no app quanto no admin; analytics desativado localmente | Configurado; execução integrada do emulador pendente |
| SEC-08 | Campo administrativo apresentado como tema, com aviso explícito de leitura por todos os alunos autenticados | Ambiguidade removida; não há promessa de confidencialidade por curso |

## Validação executada

`node reports/security/verify-security.cjs`: oito verificações aprovadas:

1. Rejeição de schemas inválidos, volume excessivo e chaves perigosas sem mutação.
2. Preservação dos dados anteriores em cada falha de escrita de staging/commit.
3. Importação completa, arquivos extras, exportação e edição posterior.
4. Compatibilidade com o backup antigo preservado, sem imprimir dados pessoais.
5. Limpeza local sem atingir UID que apenas compartilha prefixo.
6. Escape de HTML nos identificadores e conteúdo administrativo.
7. Ausência de backups de estudo em public.
8. Leitura de backup remoto com limite de bytes e rejeição de excesso.

Verificações `node --check` aprovadas para api.js, auth.js, admin.js, ide.js, firebase-init.js e pagina-configuracoes.js. Testes usam dados sintéticos, VM e armazenamento em memória; não acessam a rede. O teste de compatibilidade com o backup antigo é condicional à presença da cópia privada e não a publica.

## Mudança para desenvolvimento local

Na pasta public, executar:

```text
firebase emulators:start --project demo-coding-loop --only auth,firestore
```

Depois abrir o Live Server em localhost. É necessário Java compatível com o Firebase CLI. O Java não foi encontrado no PATH deste ambiente, portanto não foi executado teste integrado de regras; os testes de Node não substituem essa validação. Sem emuladores ativos, a aplicação local não conecta silenciosamente ao Firebase real.

## Pendências de publicação e limites

- Publicar somente public. Verificar e retirar cópias antigas do backup da hospedagem, se existirem. O backup continua no histórico Git: revisar exposição e decidir eventual limpeza coordenada do histórico.
- Validar as regras no Emulator Suite com usuários anônimos, dono/outro UID, aluno/admin e campos inválidos; então publicar as regras. As alterações no arquivo não mudam regras já publicadas.
- Conferir compatibilidade de clientes legados: novas gravações de estudo no Firestore deixam de ser permitidas. A aplicação atual usa armazenamento local. Comunicados antigos fora do schema precisam ser migrados antes de sua edição.
- Conferir MFA de administradores, IAM/claims, restrições de API keys, cabeçalhos HTTP/CSP, quotas, App Check, logs e versões de dependências no ambiente real. Não foram adicionados cabeçalhos a um provedor de hospedagem desconhecido nem criada uma configuração de deploy presumida.
- Restauração precisa de espaço para a cópia nova enquanto preserva a anterior; recusa por quota é intencional. Fechar outras abas durante restauração evita edições concorrentes: não há transação entre abas. Uma interrupção abrupta durante staging pode deixar dados órfãos, mas não apaga a geração ativa.
- A limpeza opcional remove dados de estudo e backups em localStorage do usuário atual. Não promete limpar cache OAuth de provedores, permissões de pastas, downloads, outras abas ou outros dispositivos. Para computadores públicos, encerrar também a sessão dos provedores ou usar perfil temporário do navegador.

O relatório original foi mantido como registro anterior às correções e recebeu um aviso apontando para este acompanhamento.
