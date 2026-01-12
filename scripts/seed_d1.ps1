# Seed the D1 database using Wrangler D1 execute
# Usage: ./scripts/seed_d1.ps1 [-DbName <cloudflare-db-name>] [-UseRemote]
# Example: ./scripts/seed_d1.ps1 -DbName tsd_updates -UseRemote
# Requires: wrangler installed and authenticated

Param(
  [string]$DbName = 'tsd_updates',
  [switch]$UseRemote
)

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)){
  Write-Error "wrangler CLI not found. Install @cloudflare/wrangler and authenticate first."
  exit 1
}

$seedFile = Join-Path -Path $PSScriptRoot -ChildPath "seed_updates.sql"
if (-not (Test-Path $seedFile)){
  Write-Error "Seed file not found: $seedFile"
  exit 1
}

# Try a local binding first (named UPDATES_DB) unless user requested remote explicitly
$useRemote = $UseRemote.IsPresent
try{
  if (-not $useRemote){
    Write-Output "Attempting to seed using local binding 'UPDATES_DB'..."
    & wrangler d1 execute UPDATES_DB --file $seedFile
    if ($LASTEXITCODE -eq 0){ Write-Output "Seeding completed via local binding 'UPDATES_DB'."; exit 0 }
    Write-Warning "Local binding 'UPDATES_DB' failed or not configured. Will try remote database name '$DbName'."
  }

  Write-Output "Seeding remote D1 database '$DbName' via: wrangler d1 execute $DbName --file $seedFile --remote"
  & wrangler d1 execute $DbName --file $seedFile --remote
  if ($LASTEXITCODE -ne 0){ throw "wrangler d1 execute returned exit $LASTEXITCODE" }
  Write-Output "Seeding completed (remote)."
}catch{
  Write-Error "Seeding failed: $_"
  exit 1
}