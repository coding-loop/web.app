Todas as ações atuais que usam Firebase:
Ação	Firebase usado	Operação
Entrar/criar conta com email e senha	Firebase Authentication	autenticação
Entrar com Google, Facebook, GitHub ou Microsoft	Firebase Authentication	autenticação
Sair da conta	Firebase Authentication	encerra sessão
Redefinir senha	Firebase Authentication	envia email
Verificar sessão ao abrir páginas	Firebase Authentication	consulta estado de login
Persistir sessão no navegador	Firebase Authentication	mantém login local
Criar/sincronizar perfil no login	Firestore users/{uid}	1 leitura + 1 escrita
Ler perfil e posição na IDE	Firestore users/{uid}	leitura
Salvar posição atual na IDE	Firestore users/{uid}	escrita
Carregar todo o progresso das etapas	Firestore users/{uid}/progress	leitura de coleção
Ler uma etapa específica	Firestore users/{uid}/progress/{id}	leitura
Concluir uma etapa / salvar percentual	Firestore users/{uid}/progress/{id}	escrita
Refazer etapa ou módulo	Firestore progress/{id}	exclusão
Escutar progresso em tempo real	Firestore progress	leitura inicial + leituras a cada mudança
Carregar códigos salvos da IDE	Firestore users/{uid}/exercises	leitura de coleção
Ler código de uma etapa	Firestore users/{uid}/exercises/{id}	leitura
Salvar HTML, CSS e JavaScript	Firestore users/{uid}/exercises/{id}	escrita
Apagar código ao refazer etapa/módulo	Firestore exercises/{id}	exclusão