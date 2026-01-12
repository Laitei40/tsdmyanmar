# Seed the D1 database using Wrangler D1 execute
# Usage: ./scripts/seed_d1.ps1
# Requires: wrangler installed and authenticated; D1 binding named UPDATES_DB

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)){
  Write-Error "wrangler CLI not found. Install @cloudflare/wrangler and authenticate first."
  exit 1
}

$seedFile = Join-Path -Path $PSScriptRoot -ChildPath "seed_updates.sql"
if (-not (Test-Path $seedFile)){
  Write-Error "Seed file not found: $seedFile"
  exit 1
}

try{
  Write-Output "Seeding D1 via wrangler d1 execute --binding UPDATES_DB --file $seedFile"
  & wrangler d1 execute --binding UPDATES_DB --file $seedFile
  if ($LASTEXITCODE -ne 0){ throw "wrangler d1 execute returned exit $LASTEXITCODE" }
  Write-Output "Seeding completed."
}catch{
  Write-Error "Seeding failed: $_"
  exit 1
}