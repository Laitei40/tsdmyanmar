param(
    [string]$Url = 'http://127.0.0.1:8788/'
)

function Test-Server {
    param($u)
    try {
        $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        return $r
    } catch {
        Write-Error "Failed to reach $u : $_"
        return $null
    }
}

Write-Host "Checking site at $Url"
$resp = Test-Server -u $Url
if (-not $resp) { exit 2 }

$html = $resp.Content

# Extract the static logo src from HTML
$re = '<img[^>]*class="[^"]*brand-logo[^"]*"[^>]*src="([^"]+)"'
$m = [regex]::Match($html, $re, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if ($m.Success) {
    $staticLogo = $m.Groups[1].Value
    Write-Host "Static logo src in HTML: $staticLogo"
} else {
    Write-Warning "Could not find static logo element in HTML."
}

# Check language-specific logo assets
$langs = @('en','my','mrh')
$base = $Url.TrimEnd('/')
$allFound = $true
foreach ($lang in $langs) {
    $path = "/assets/images/logo/logo_$lang.svg"
    $uri = $base + $path
    try {
        $head = Invoke-WebRequest -Uri $uri -Method Head -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        $ct = $head.Headers['Content-Type'] -join ', '
        Write-Host "Found $path -> $ct"
    } catch {
        Write-Warning "Missing $path (HTTP request failed)"
        $allFound = $false
    }
}

if ($allFound) {
    Write-Host "All language-specific logo files are present."
    exit 0
} else {
    Write-Error "One or more language logo files missing. Open the site in a browser and change language to verify runtime swap." 
    exit 2
}
