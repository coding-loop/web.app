# Diretriz de Organização: Arquivos de Instrução e Documentação

- **Localização Obrigatória**: Todos os arquivos de instrução, documentação técnica, mapas de código (`Code-Map.md`, `CodeMapa.md`), memória/status de projeto (`Contexto.md`), guias de agentes e IA (`AGENTS.md`, `GEMINI.md`), e manuais operacionais devem ser salvos e mantidos **estritamente na pasta `Instruções/`**.
- **Raiz do Projeto Limpa**: **Nenhum** arquivo de instrução ou documentação deve ser criado ou mantido na raiz do projeto (`Edition-Coding-Loop/`). A raiz fica reservada apenas para configurações de ambiente, repositório e infraestrutura (`firebase.json`, `.firebaserc`, `.gitignore`, `deploy-firebase.ps1`, etc.).
- **Consultas de Contexto**: Qualquer referência a contexto, arquitetura, catálogo ou procedimentos deve buscar os arquivos correspondentes dentro de `Instruções/`.
