param(
    [int]$ByteLength = 48
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ByteLength -lt 16) {
    $ByteLength = 16
}
if ($ByteLength -gt 256) {
    $ByteLength = 256
}

function New-RandomBytes([int]$Count) {
    $buffer = New-Object byte[] $Count
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($buffer)
    } finally {
        $rng.Dispose()
    }
    return $buffer
}

function Convert-ToBase64Url([byte[]]$Bytes) {
    $text = [Convert]::ToBase64String($Bytes)
    return $text.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$bytes = New-RandomBytes -Count $ByteLength
$adminApiKey = Convert-ToBase64Url -Bytes $bytes

$now = Get-Date
$timestamp = $now.ToString('yyyyMMdd-HHmmss')
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot '.local-data\admin-api-keys'
$outputPath = Join-Path $outputDir ("ADMIN_API_KEY_{0}.txt" -f $timestamp)

Write-Host ''
Write-Host '================ ADMIN_API_KEY Generator ================' -ForegroundColor Cyan
Write-Host ("Generated At: {0}" -f $now.ToString('yyyy-MM-dd HH:mm:ss'))
Write-Host ("Key Length  : {0} chars" -f $adminApiKey.Length)
Write-Host '--------------------------------------------------------' -ForegroundColor DarkGray
Write-Host $adminApiKey -ForegroundColor Yellow
Write-Host '--------------------------------------------------------' -ForegroundColor DarkGray

if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    $adminApiKey | Set-Clipboard
    Write-Host 'Copied to clipboard.' -ForegroundColor Green
} else {
    Write-Host 'Set-Clipboard is unavailable. Please copy manually.' -ForegroundColor DarkYellow
}

Write-Host ''
$saveAnswer = Read-Host "Save to file? (Y/N, default: Y)"
if ([string]::IsNullOrWhiteSpace($saveAnswer) -or $saveAnswer.Trim().ToUpperInvariant() -eq 'Y') {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    @(
        "# ADMIN_API_KEY"
        "# GeneratedAt: $($now.ToString('o'))"
        "ADMIN_API_KEY=$adminApiKey"
        "ADMIN_REQUIRE_KEY=1"
    ) | Set-Content -Path $outputPath -Encoding UTF8
    Write-Host ("Saved: {0}" -f $outputPath) -ForegroundColor Green
}

Write-Host ''
Write-Host 'PowerShell env example:' -ForegroundColor Cyan
Write-Host ('$env:ADMIN_API_KEY="{0}"' -f $adminApiKey)
Write-Host '$env:ADMIN_REQUIRE_KEY="1"'
Write-Host ''
Write-Host 'Press Enter to exit...'
Read-Host | Out-Null
