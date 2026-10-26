<#
.SYNOPSIS
  Prepara o ambiente de DESENVOLVIMENTO do LuzoCast no Windows.
  (Usuário final não precisa disto: o instalador já traz tudo.)

.DESCRIPTION
  Resolve de uma vez os problemas que apareceram no primeiro setup:
   1. Node >= 22 e pnpm instalados
   2. ELECTRON_SKIP_BINARY_DOWNLOAD definido no sistema (impede baixar o Electron)
   3. Binário do Electron incompleto (extração interrompida)
   4. cloudflared ausente ou com hash errado
  Depois roda os testes para confirmar.

.EXAMPLE
  pnpm run setup:dev
  # ou
  powershell -ExecutionPolicy Bypass -File scripts\setup-dev.ps1
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "    XX  $msg" -ForegroundColor Red; exit 1 }

Step 'Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js não encontrado. Instale com:  winget install OpenJS.NodeJS.LTS' }
$major = [int]((node -v).TrimStart('v').Split('.')[0])
if ($major -lt 22) { Fail "Node $(node -v) é antigo; precisa >= 22.  winget upgrade OpenJS.NodeJS.LTS" }
Ok "Node $(node -v)"

Step 'pnpm'
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Warn 'pnpm não encontrado; instalando via npm...'
  npm install -g pnpm
}
Ok "pnpm $(pnpm -v)"

Step 'Variáveis que bloqueiam o download do Electron'
foreach ($scope in 'User', 'Machine') {
  $v = [Environment]::GetEnvironmentVariable('ELECTRON_SKIP_BINARY_DOWNLOAD', $scope)
  if ($v) { Warn "ELECTRON_SKIP_BINARY_DOWNLOAD=$v definido no escopo $scope. Remova em 'Variáveis de ambiente' do Windows." }
}
Remove-Item Env:ELECTRON_SKIP_BINARY_DOWNLOAD -ErrorAction SilentlyContinue
Ok 'Ignorado nesta sessão'

Step 'Dependências (pnpm install)'
pnpm install
if ($LASTEXITCODE -ne 0) { Fail 'pnpm install falhou (veja a mensagem acima).' }
Ok 'Instaladas'

Step 'Binário do Electron'
$electronPkg = Resolve-Path 'apps\host\node_modules\electron'
$exe = Join-Path $electronPkg 'dist\electron.exe'
if (-not (Test-Path $exe)) {
  Warn 'electron.exe ausente; baixando de novo...'
  $dist = Join-Path $electronPkg 'dist'
  if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
  Remove-Item (Join-Path $electronPkg 'path.txt') -ErrorAction SilentlyContinue
  node (Join-Path $electronPkg 'install.js')
  if (-not (Test-Path $exe)) { Fail 'Não foi possível baixar o Electron. Tente: $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; pnpm run setup:dev' }
}
Ok 'electron.exe presente'

Step 'cloudflared (túnel para o modo Internet)'
pnpm --filter @luzocast/host exec node scripts/fetch-cloudflared.mjs --if-missing
if ($LASTEXITCODE -ne 0) { Warn 'cloudflared não instalado: só o modo rede local vai funcionar.' } else { Ok 'cloudflared verificado' }

Step 'Testes'
pnpm test
if ($LASTEXITCODE -ne 0) { Fail 'Testes falharam.' }

Write-Host "`nTudo pronto! Rode:  pnpm dev:host`n" -ForegroundColor Green
