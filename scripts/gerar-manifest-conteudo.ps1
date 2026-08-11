param(
  [string]$ContentRoot = "$PSScriptRoot\..\public\assets\content"
)

$contentRootPath = (Resolve-Path $ContentRoot).Path
$manifestPath = Join-Path $contentRootPath 'catalogo-automatico.js'

$files = Get-ChildItem -Path $contentRootPath -Recurse -File -Filter '*.js' |
  Where-Object { $_.Name -notin @('catalogo-automatico.js', 'catalogo-manual.js', 'modo.js', 'modo-automatico.js', 'modo-manual.js') } |
  Sort-Object FullName |
  ForEach-Object {
    $_.FullName.Substring((Resolve-Path "$PSScriptRoot\..\public").Path.Length + 1).Replace('\', '/')
  }

$body = @(
  '/* Arquivo gerado por scripts/gerar-manifest-conteudo.ps1. Não edite manualmente. */'
  'window.CL_CONTEUDO_MANIFEST_AUTOMATICO = ['
) + ($files | ForEach-Object { "  '$_'," }) + @(
  '];'
)

Set-Content -Path $manifestPath -Value $body -Encoding utf8
Write-Host "Manifesto atualizado com $($files.Count) arquivo(s): $manifestPath"
