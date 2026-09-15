# Relatório de avaliação de cibersegurança — Coding Loop

> Registro da avaliação anterior às correções. Consulte [o acompanhamento das correções](CORRECOES-2026-09-08.md) para o estado atualizado. O script complementar agora verifica as proteções implementadas; a seção de reprodução abaixo registra a execução original.

Data: 08/09/2026. Modalidade: auditoria estática do código local com testes isolados de funções. Referência Git: `809d7e55e98f86c45734d5db2bd7a84135125f6c`, incluindo as alterações locais existentes na data da análise.

## Parecer executivo

O projeto possui controles adequados em pontos importantes: autenticação delegada ao Firebase, autorização administrativa por custom claim, regras de isolamento por UID e execução dos exercícios em iframe com sandbox. Entretanto, há problemas concretos de proteção de dados, integridade de backups e renderização administrativa que precisam ser corrigidos antes de considerar a aplicação pronta para uma publicação com dados reais.

A prioridade imediata é retirar do conjunto publicável o backup que contém campos pessoais e exercícios. Em seguida, corrigir a importação destrutiva de backups e a renderização de identificadores no painel administrativo. Não foi demonstrado acesso de um aluno aos dados de outro pelo Firestore, nem comprometimento do ambiente de produção.

Avaliação qualitativa: **segurança parcialmente implementada, com pendências relevantes para publicação**. A gravidade considera impacto e condições de exploração; não representa pontuação CVSS nem certificação. Não se atribui uma nota numérica porque controles essenciais de infraestrutura não foram inspecionados.

## Escopo, método e limitações

Foram examinados autenticação, autorização, regras do Firestore, armazenamento local, backup e restauração, integrações Google Drive/OneDrive, execução de código na IDE, renderização de dados, dependências externas, configuração de publicação e documentação de privacidade. A leitura concentrou-se em `public/assets/js`, páginas HTML, `public/firestore.rules`, `public/firebase.json`, README e inventário de arquivos.

Foram executados três testes de regressão demonstrativos em Node.js, com `vm`, dados fictícios e armazenamento em memória. Não houve autenticação em contas reais, chamadas de escrita ao Firebase, tentativa de exploração remota ou alteração do código da aplicação. A pesquisa de padrões de credenciais não retornou correspondências para os formatos limitados examinados; isso não equivale a uma varredura completa de segredos ou do histórico Git. Não se reproduzem valores pessoais do backup neste relatório.

Não foram verificados: regras efetivamente publicadas; cabeçalhos HTTP reais; TLS; IAM e administradores; políticas de senha e proteção contra enumeração no Console; MFA; App Check enforcement; quotas e alertas; OAuth consent screen; permissões efetivas do bucket; logs ou histórico de incidentes. As fontes técnicas externas serviram para conferir a interpretação dos controles, não para inspecionar a aplicação publicada. Não foi realizada análise exaustiva de CVEs das bibliotecas.

## Arquitetura e fronteiras de confiança

A aplicação é estática e executa a maior parte da lógica no navegador. O Firebase Authentication mantém a identidade; o Firestore é utilizado ativamente para comunicados. Perfil, progresso e exercícios são atualmente mantidos em localStorage por UID (`api.js:114–149`), com exportação para JSON e backups opcionais. As regras ainda permitem gravações de perfil, progresso e exercícios no Firestore mesmo que a interface atual não faça uso regular delas.

Separar chaves por UID previne mistura acidental pela interface, mas não oferece confidencialidade contra scripts da mesma origem ou pessoas que usam o mesmo perfil do navegador. O aluno controla seu próprio navegador e pode alterar progresso local; portanto, esse progresso não deve ser usado como evidência confiável de certificação, pagamento ou elegibilidade sem validação independente.

## Resumo dos achados

| ID | Gravidade | Achado | Estado da evidência |
|---|---|---|---|
| SEC-01 | Alta, se publicado | Backup com dados de perfil na pasta pública e no Git | Presença confirmada; publicação não verificada |
| SEC-02 | Média | Restauração pode perder exercícios ao falhar | Reproduzido com falha simulada de armazenamento |
| SEC-03 | Média | Validação incompleta de backups | Aceitação de estrutura inválida reproduzida |
| SEC-04 | Média | HTML sem escape nos identificadores do painel admin | Geração de HTML injetado reproduzida; requer escritor admin |
| SEC-05 | Média | Escritas Firestore sem schema e limites de aplicação | Confirmado nas regras locais |
| SEC-06 | Média, contextual | Dados locais persistem após logout | Confirmado pelo fluxo local |
| SEC-07 | Média, operacional | Preview local usa o projeto Firebase real | Confirmado na configuração |
| SEC-08 | Baixa | Público dos comunicados não restringe leitura | Confirmado na consulta e nas regras |

## SEC-01 — Backup no conjunto publicável

**Evidência:** `public/assets/images/Coding Loop Backups/coding-loop-progresso-2026-08-15-2329.json:1`. Arquivo rastreado pelo Git. Contém `index.profile` com campos `name`, `email`, `avatar`, `provider` e `idePosition`, além de sete exercícios. Não se verificou a identidade ou autenticidade dos dados.

**Cenário e impacto:** se a pasta public for publicada integralmente, o JSON poderá ser recuperado diretamente, sem passar pelo login ou pelas regras do Firestore. A confidencialidade passa a depender do acesso ao arquivo estático e ao repositório. Regras de banco não protegem arquivos do site.

**Correção:** mover backups para fora da raiz publicável, excluir artefatos pessoais do processo de build/deploy e adicionar prevenção de inclusão no Git. Verificar, pelo responsável pela hospedagem, se o caminho foi publicado. Caso tenha sido, remover a cópia servida e caches pertinentes; avaliar exposição também no histórico e em clones. Um `.gitignore` não remove um arquivo já rastreado ou publicado.

**Aceite:** artefato ausente do pacote de deploy; URL antes utilizada retorna 404/403; revisão do histórico e do público do repositório concluída. Nenhuma remoção foi feita nesta auditoria.

## SEC-02 — Importação não atômica e perda de exercícios

**Evidência:** `public/assets/js/api.js:293–311`: `importStudyData` apaga os exercícios atuais antes de gravar os novos e persistir o índice. `public/assets/js/ide.js:1244–1256` permite criar uma cópia anterior, mas isso é condicional e não torna a importação atômica.

**Reprodução:** o teste isolado criou um exercício fictício, simulou erro de quota na próxima escrita e executou a importação. A função lançou erro depois de remover o exercício original. O índice antigo também pode ficar apontando para conteúdo que já não existe.

**Impacto:** perda ou restauração parcial de trabalho. Pode ocorrer por falta de espaço, independentemente de um atacante. Um backup excessivo pode desencadear a mesma condição se for aceito pelo usuário.

**Correção:** validar primeiro, gravar uma nova geração de dados e somente depois trocar o índice ativo; usar transação em IndexedDB ou mecanismo equivalente com rollback e limpeza posterior. Preservar a geração anterior até confirmar a operação completa.

**Aceite:** falhas de escrita em cada etapa mantêm os dados anteriores íntegros; sucesso troca o conjunto completo sem referências quebradas.

## SEC-03 — Estrutura e volume do backup insuficientemente validados

**Evidência:** `public/assets/js/api.js:282–290`. A validação limita quantidade de exercícios e tamanho de partes do código, mas não valida o schema de `index.profile`, `index.progress`, metadados, tipos de cada progresso ou tamanho total. Arrays também satisfazem alguns testes de `typeof === 'object'`. A leitura da pasta em `ide.js:899` faz parse do arquivo inteiro.

**Reprodução:** um backup com `progress: null` e `profile: []` foi aceito. A validação também não limita todo o conteúdo do índice; os limites individuais dos exercícios permitem volume agregado muito superior ao armazenamento local típico.

**Impacto:** indisponibilidade de funções, inconsistência e amplificação de SEC-02. Importação depende da ação do usuário; não foi demonstrada execução de código no contexto da página por esse caminho.

**Correção:** definir schema estrito, rejeitar arrays onde se exige objeto, validar IDs e campos permitidos, limitar bytes totais antes do parse quando possível e antes da gravação, validar tipos e quantidades de progresso e metadados. Rejeitar propriedades especiais como `__proto__`, `constructor` e `prototype` em mapas de entrada como defesa adicional; não foi comprovada poluição global de protótipo.

**Aceite:** entradas malformadas, volumosas e com chaves inesperadas são rejeitadas sem alterar dados existentes.

## SEC-04 — Injeção de HTML em identificadores administrativos

**Evidência:** `public/assets/js/admin.js:11–12`. `renderList` escapa título e mensagem, mas concatena `n.id` em atributos `data-edit` e `data-delete`. `Object.assign({id:d.id}, d.data())` permite que um campo `id` do documento substitua o identificador real. As regras não restringem os campos dos comunicados.

**Reprodução:** um documento sintético com campo `id` contendo fechamento de atributo e uma tag produziu HTML não escapado no resultado de `renderList`. O teste confirma o caminho até `innerHTML`; não executou JavaScript em navegador real.

**Condição de exploração:** pelas regras locais, gravar esse documento exige custom claim admin. Não há caminho demonstrado para um aluno comum explorar a falha. Integrações futuras que escrevam comunicados também precisariam ser consideradas.

**Impacto:** possibilidade de XSS persistente contra administradores que renderizem o documento, com ações na sessão da vítima. A exigência de escrita privilegiada reduz a probabilidade e justifica a classificação média.

**Correção:** montar botões por APIs DOM e atribuir `dataset` como texto; preservar o identificador real após os dados (`Object.assign({}, d.data(), {id:d.id})`); restringir schema nas regras. A ordem do assign sozinha não substitui renderização segura.

**Aceite:** strings adversariais continuam sendo texto/atributo, nenhum elemento adicional é criado e o ID efetivo é sempre o do documento.

## SEC-05 — Firestore permite campos e volume não controlados pela aplicação

**Evidência:** `public/firestore.rules:12–36`: escrita administrativa de comunicados e escrita do próprio usuário sem validação de chaves, tipos, tamanhos ou transições. O cliente pode chamar o SDK diretamente, fora dos formulários.

**Impacto:** um usuário autenticado pode criar documentos arbitrários nas suas coleções permitidas, sujeitos aos limites do serviço, mesmo que a interface seja local. Isso abre espaço para consumo indevido e inconsistência. Não permite escrever em outro UID nem obter claim admin por adicionar um campo ao perfil.

**Correção:** negar operações legadas sem uso após verificar compatibilidade; onde necessárias, adotar `keys().hasOnly`, checagem de tipos/tamanhos, campos imutáveis e timestamps. Complementar com App Check conforme a arquitetura, monitoramento e alertas de consumo; App Check não substitui autorização nem garante ausência de abuso por clientes legítimos.

**Aceite:** testes no Emulator Suite rejeitam usuário anônimo, outro UID, aluno escrevendo comunicados, campos extras e tamanhos inválidos; permitem somente operações previstas. As regras publicadas devem corresponder à versão validada.

## SEC-06 — Persistência local e logout

**Evidência:** `public/assets/js/api.js:114–149,272–279`; `public/assets/js/auth.js:292–304`; persistência Firebase LOCAL em `firebase-init.js`. O logout encerra a autenticação, mas não remove os dados de estudo e backups locais, que são JSON sem criptografia adicional da aplicação.

**Impacto:** outra pessoa com acesso ao mesmo perfil do navegador pode inspecionar dados residuais; scripts da mesma origem também podem lê-los. Isso não representa acesso remoto automático por outro usuário Firebase. Manter os estudos é uma escolha funcional, mas exige tratamento específico para dispositivos compartilhados.

**Correção:** oferecer modo de dispositivo compartilhado e opção explícita de apagar dados locais com oportunidade de backup. Considerar persistência de sessão nesse modo. Não apagar automaticamente a única cópia do estudo. Criptografia cuja chave fique acessível ao mesmo JavaScript não resolve XSS.

**Aceite:** modo compartilhado encerra sessão e limpa os dados definidos, enquanto o modo pessoal preserva estudos conforme a escolha informada.

## SEC-07 — Ambiente local conectado ao Firebase real

**Evidência:** `public/assets/js/firebase-init.js:30–47,113–129`; `public/firebase.json` não configura emuladores. O próprio comentário declara que preview local fala com o projeto real.

**Impacto:** testes de cadastro, comunicados e exclusão podem atingir contas e dados reais. A página administrativa compartilha o projeto. Isso aumenta risco operacional, sem constituir por si só uma vulnerabilidade remotamente explorável.

**Correção:** separar desenvolvimento e produção, configurar emuladores e tornar o ambiente explícito. Executar testes de segurança apenas contra recursos de teste. Não confiar só no hostname como autorização de acesso.

**Aceite:** execução local de teste conecta ao emulador ou projeto de desenvolvimento; nenhuma credencial administrativa de produção é necessária.

## SEC-08 — Campo de público é apenas metadado

**Evidência:** `public/admin.html:32` oferece segmentação por curso; `api.js:21–27` busca todos os publicados; `firestore.rules:13` permite sua leitura por qualquer autenticado. `pagina-dashboard.js:23–35` não filtra audiência.

**Impacto:** alunos recebem avisos destinados a outros cursos. A gravidade é baixa porque não há requisito comprovado de confidencialidade por matrícula. Se comunicados contiverem informação restrita, a gravidade deverá ser revista.

**Correção:** esclarecer se o campo é segmentação visual ou restrição de acesso. Para confidencialidade, implementar autorização no banco baseada em vínculo confiável; filtro apenas no navegador não protege os dados.

## Controles positivos e riscos residuais

- `firestore.rules:6–7`: claim administrativa verificada no servidor de regras; conhecer `admin.html` não concede acesso.
- `firestore.rules:23–43`: isolamento por UID e negação de caminhos não previstos. A existência dessas regras no Git não comprova seu deploy.
- `ide.js:3230`: sandbox usa somente `allow-scripts`, sem `allow-same-origin`. `ide.js:3285–3288` verifica a janela emissora das mensagens. Não classificar o `postMessage('*')` isoladamente como vazamento de sessão: o conteúdo observado é diagnóstico, com verificação de origem da janela receptora.
- Sandbox não impede toda comunicação de rede nem consumo excessivo de CPU. Avaliar restrições de recursos externos, opção de parar execução e política própria de preview conforme os objetivos didáticos. HTML exportado, ao ser aberto fora da IDE, não herda o sandbox.
- `pagina-dashboard.js:8–10,33`: textos dos avisos escapados; tipo visual selecionado de lista permitida.
- `auth.js:341–349`: reautenticação antes de exclusão. A exclusão segue múltiplas operações e pode ficar parcial em falhas; planejar retomada e feedback de estado. Não alegar atomicidade.
- `ide.js:716,770,774`: Drive solicita `drive.appdata`; OneDrive solicita `Files.ReadWrite.AppFolder` e `User.Read`; cache MSAL em sessionStorage. Conferir no Console os escopos efetivos e o comportamento de desconexão entre contas compartilhadas.

## Lacunas de evidência para a publicação

**Cabeçalhos e dependências:** não foram encontrados CSP, SRI ou configuração de cabeçalhos no material examinado. `public/firebase.json` contém apenas configuração de regras. Isso não prova ausência de cabeçalhos no servidor. `ide.html:18–23` carrega Firebase 10.13.0, Google Identity e MSAL 2.35.0; `ide.js:1526–1528` usa Monaco 0.52.0 via três CDNs. Scripts externos executam no contexto da aplicação. Não se declara qualquer dessas versões vulnerável sem verificar advisories específicos.

Antes de publicar, medir respostas HTTPS reais e avaliar CSP, `frame-ancestors`, HSTS, `X-Content-Type-Options` e Referrer-Policy. Construir CSP compatível com Monaco, workers, OAuth e preview; testar inicialmente em Report-Only. Usar SRI quando o recurso for estável e compatível, ou hospedar dependências versionadas; scripts dinâmicos exigem tratamento próprio. Manter inventário e revisão de atualizações/advisories.

**Identidade e operação:** verificar MFA dos administradores, processo restrito de concessão/revogação de claims, política de senha, proteção contra enumeração, domínios autorizados, restrições das API keys, quotas, alertas e logs. A apiKey pública do Firebase não é automaticamente um segredo vazado; conferir restrições a APIs apropriadas, especialmente se o projeto habilitar outros serviços.

**Documentação:** README descreve progresso no Firestore, enquanto a implementação atual o mantém localmente. Corrigir essa divergência e revisar a política para refletir retenção, exclusão e os limites dos backups. Esta auditoria não avalia conformidade jurídica com LGPD.

## Plano de ação e critérios de conclusão

1. **Antes da próxima publicação:** tratar SEC-01, revisar o pacote publicável e confirmar quais regras e cabeçalhos estão ativos.
2. **Próximo ciclo de correção:** resolver SEC-02, SEC-03 e SEC-04; executar testes de falha, validação e renderização segura.
3. **Antes de ampliar usuários:** endurecer regras com testes em emuladores; separar ambientes; verificar administração, consumo e dependências.
4. **Melhoria contínua:** modo compartilhado, revisão da segmentação, documentação fiel, alertas e rotina de recuperação de backups.

Considerar os achados encerrados somente após verificar seus critérios de aceite. Não basta ocultar botões ou alterar validações HTML para proteger operações do Firestore.

## Evidências reproduzíveis

Arquivo complementar: `reports/security/verify-security.cjs`.

Executar na raiz: `node reports/security/verify-security.cjs`.

Resultado nesta auditoria: **3/3 verificações confirmaram o comportamento relatado**: índice malformado aceito; remoção de exercício antes de erro de escrita; geração de HTML injetado via identificador do comunicado. São demonstrações dos problemas atuais, portanto passar nesses testes significa reproduzir os achados, não aprovar a segurança. Nenhum teste acessa a rede ou o armazenamento real do navegador.

Não foi executado teste de regras com emulador, teste de XSS em navegador ou pentest em produção. O código funcional e as alterações preexistentes foram preservados; somente o relatório e seu script demonstrativo foram acrescentados.

## Referências técnicas

- [Firebase — controle de campos e validação nas regras](https://firebase.google.com/docs/firestore/security/rules-fields): schema, tipos e campos permitidos.
- [Firebase — API keys](https://firebase.google.com/docs/projects/api-keys): natureza pública da configuração e necessidade de restrições adequadas.
- [MDN — iframe e sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe): isolamento e implicações de combinar permissões.

As conclusões sobre o projeto derivam dos arquivos e testes locais identificados acima. As referências fundamentam a interpretação técnica dos controles.
