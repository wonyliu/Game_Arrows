$ErrorActionPreference = 'Stop'

$url = 'http://127.0.0.1:4173/index.html'
$args = @(
    '--autoplay-policy=no-user-gesture-required'
    '--new-window'
    $url
)

$candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $browser) {
    throw 'Chrome/Edge not found. Install one of them and retry.'
}

Start-Process -FilePath $browser -ArgumentList $args | Out-Null
Write-Host "Launched browser with autoplay policy: $browser"
Write-Host "URL: $url"
