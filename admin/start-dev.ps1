# Start Wrangler Pages dev server for admin
# Uses --persist-to so admin and public site share the same local D1 database
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootState  = Join-Path $scriptPath "..\.wrangler\state"
Set-Location $scriptPath
& npx wrangler pages dev public --port 9000 --d1 UPDATES_DB=bb376db4-497c-4ac3-9761-675b8a537422 --persist-to $rootState
