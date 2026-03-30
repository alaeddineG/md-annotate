$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BridgeDir = Join-Path $env:USERPROFILE ".mcp_servers\md-annotate"
$BridgeDest = Join-Path $BridgeDir "mcp-bridge.js"

Write-Host "==> Stopping daemon..."
try { node "$RepoDir\bin\cli.js" stop 2>$null } catch {}

Write-Host "==> Killing anything on port 4242..."
$procs = Get-NetTCPConnection -LocalPort 4242 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $procs) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

Write-Host "==> Removing node_modules..."
if (Test-Path "$RepoDir\node_modules") {
    Remove-Item -Recurse -Force "$RepoDir\node_modules"
}

Write-Host "==> Installing dependencies..."
Push-Location $RepoDir
npm install

Write-Host "==> Building UI..."
npm run build

Write-Host "==> Building MCP bridge..."
npm run build:mcp

Write-Host "==> Copying bridge to $BridgeDest..."
New-Item -ItemType Directory -Force -Path $BridgeDir | Out-Null
Copy-Item "$RepoDir\mcp-bridge.js" $BridgeDest

Write-Host "==> Starting daemon..."
node "$RepoDir\bin\cli.js" start

Pop-Location

Write-Host ""
Write-Host "Done. UI running at http://localhost:4242"
