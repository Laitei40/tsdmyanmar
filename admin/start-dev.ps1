# Start Wrangler Pages dev server for admin
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
& npx wrangler pages dev dist --port 8788
