<#
.SYNOPSIS
    Publica as regras e os índices do Firestore do projeto Coding Loop.
.DESCRIPTION
    Este script NÃO publica Hosting (isso é feito pelo GitHub Pages) e NÃO
    requer credencial de administrador nem Java. Ele apenas roda:
        firebase deploy --only firestore:rules,firestore:indexes
    no projeto configurado em .firebaserc (coding-loop).
    Execute a partir da raiz do repositório (Edition-Coding-Loop), fora de "public".
.NOTES
    Pré-requisito: já ter rodado "firebase login" nesta máquina antes de chamar
    este script (conforme README).
#>

$ErrorActionPreference = 'Stop'

function Fail($mensagem) {
    Write-Host "ERRO: $mensagem" -ForegroundColor Red
    exit 1
}

Write-Host "== Deploy Firebase (Coding Loop) - regras e indices do Firestore ==" -ForegroundColor Cyan

# 1. Confere se o script esta rodando na raiz correta do projeto
if (-not (Test-Path ".\firebase.json") -or -not (Test-Path ".\.firebaserc")) {
    Fail "Rode este script na raiz do projeto (onde ficam firebase.json e .firebaserc), nao dentro de 'public'."
}

# 2. Confere se os arquivos que serao publicados realmente existem
$rulesPath   = "public\firestore.rules"
$indexesPath = "firestore.indexes.json"

if (-not (Test-Path $rulesPath)) {
    Fail "Nao encontrei $rulesPath. O deploy das regras nao pode continuar."
}
if (-not (Test-Path $indexesPath)) {
    Fail "Nao encontrei $indexesPath. O deploy dos indices nao pode continuar."
}

# 2b. Confere se o firebase.json nao foi sobrescrito por um "firebase init" novo.
#     Este projeto usa GitHub Pages para hospedagem (nao Firebase Hosting) e nao
#     gerencia auth por aqui. Blocos "hosting" ou "auth" no firebase.json sao
#     sinal de que o arquivo foi regenerado sem querer.
try {
    $firebaseJson = Get-Content ".\firebase.json" -Raw | ConvertFrom-Json
} catch {
    Fail "firebase.json nao e um JSON valido."
}
if ($firebaseJson.PSObject.Properties.Name -contains 'hosting') {
    Fail "firebase.json contem um bloco 'hosting'. Este projeto usa GitHub Pages para hospedagem, nao Firebase Hosting. Remova o bloco 'hosting' (provavel resultado de rodar 'firebase init' de novo) antes de publicar."
}
if ($firebaseJson.PSObject.Properties.Name -contains 'auth') {
    Fail "firebase.json contem um bloco 'auth'. Isso normalmente aparece apos rodar 'firebase init' de novo. Confirme se isso foi intencional antes de publicar."
}

# 3. Confere se o Firebase CLI esta instalado
$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCmd) {
    Fail "Firebase CLI nao encontrado no PATH. Instale com: npm install -g firebase-tools"
}

# 4. Confere se ha uma sessao logada (o login em si deve ter sido feito antes,
#    via 'firebase login', conforme o README)
Write-Host "Verificando login no Firebase CLI..."
$loginList = firebase login:list 2>&1
if ($LASTEXITCODE -ne 0 -or $loginList -match "No authorized accounts") {
    Fail "Nenhuma conta autenticada. Rode 'firebase login' antes de executar este script."
}
Write-Host $loginList

# 5. Confirma o projeto alvo antes de publicar
$projeto = "coding-loop"
Write-Host "Projeto alvo: $projeto"
$confirmacao = Read-Host "Confirma o deploy de regras e indices do Firestore para '$projeto'? (s/N)"
if ($confirmacao -ne 's' -and $confirmacao -ne 'S') {
    Write-Host "Deploy cancelado." -ForegroundColor Yellow
    exit 0
}

# 6. Deploy - somente regras e indices do Firestore, nunca Hosting.
#    Sem --force: se o Firebase pedir confirmacao para excluir um indice remoto
#    que nao existe mais na configuracao local, essa confirmacao deve ser
#    manual (ver README: nao confirmar exclusao sem checar uso por outros clientes).
Write-Host "Publicando regras e indices..." -ForegroundColor Cyan
firebase deploy --only firestore:rules,firestore:indexes --project $projeto

if ($LASTEXITCODE -ne 0) {
    Fail "O deploy falhou. Veja a mensagem do Firebase CLI acima."
}

Write-Host "Deploy concluido com sucesso." -ForegroundColor Green
Write-Host "Lembrete: um indice novo pode levar alguns minutos para ficar disponivel." -ForegroundColor Yellow
