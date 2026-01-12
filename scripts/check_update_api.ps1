Param(
  [string]$Id = '7',
  [string]$Lang = 'en',
  [string]$Base = 'http://localhost:8787'
)

$uri = "$Base/api/updates?id=$Id&lang=$Lang"
try{
  Write-Output "Requesting: $uri"
  $r = Invoke-RestMethod -Uri $uri -Method Get -UseBasicParsing -ErrorAction Stop
  Write-Output "Response:"
  $r | ConvertTo-Json -Depth 5
}catch{
  Write-Error "Request failed: $_"
}