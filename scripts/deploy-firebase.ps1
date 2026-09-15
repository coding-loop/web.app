$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    # Destino e configuração explícitos: funciona mesmo iniciado de outra pasta.
    & node scripts/verify-deploy.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Verificação local falhou; publicação cancelada.' }
    & firebase deploy --project coding-loop --config firebase.json --only 'firestore:rules,firestore:indexes'
    if ($LASTEXITCODE -ne 0) { throw 'O Firebase retornou uma falha. Confira a saída antes de tentar novamente.' }
    Write-Host 'Regras e índices publicados no Firebase. O site é publicado pelo GitHub Pages.'
} finally {
    Pop-Location
}
