Foi feito o seguinte para corrigir o erro `ERR_CONNECTION_REFUSED`:

1. Verificamos a porta do Live Server (`5500`).
2. Confirmamos que o Live Server estava funcionando.
3. Testamos:
   - `http://localhost:5500/public/index.html`
   - `assets/js/curso-data.js`
4. Identificamos que o login local tentava acessar o Firebase Auth Emulator em `localhost:9099`.
5. Confirmamos que a porta `9099` estava fechada.
6. Verificamos a configuração do Firebase:
   - Auth: `9099`
   - Firestore: `8080`
7. Iniciamos os emuladores com:
   ```powershell
   firebase emulators:start --only auth,firestore
   ```
8. O Firestore iniciou na porta `8080`.
9. O Auth demorou alguns instantes para concluir a inicialização.
10. Confirmamos que o Auth Emulator passou a responder:
    ```text
    http://localhost:9099/
    ```
11. A resposta retornou:
    ```json
    {
      "authEmulator": {
        "ready": true
      }
    }
    ```

**Para uma futura correção**

Sempre iniciar os serviços nesta ordem:

```powershell
firebase emulators:start --only auth,firestore
```

Depois verificar:

```powershell
Invoke-WebRequest http://localhost:9099/
Invoke-WebRequest http://localhost:8080/
```

O Auth deve responder com `"ready": true`.

Em outra sessão, abrir:

```text
http://localhost:5500/public/index.html
```

Se aparecer novamente `ERR_CONNECTION_REFUSED` em `9099`, o problema será o Auth Emulator parado ou ainda inicializando, não o código da aplicação nem o Live Server.
