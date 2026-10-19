$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $root

$monolithPath = Join-Path $repoRoot 'game.js'
$parts = @(
    Join-Path $PSScriptRoot '01-state-storage-profile.js'
    Join-Path $PSScriptRoot '02-core-world-bots.js'
    Join-Path $PSScriptRoot '03-rendering-and-objectives.js'
    Join-Path $PSScriptRoot '04-combat-loop-and-supers.js'
    Join-Path $PSScriptRoot '05-gadgets-companions.js'
    Join-Path $PSScriptRoot '06-ui-init-and-modes.js'
)

if (-not (Test-Path $monolithPath)) {
    Write-Error "Missing monolith file: $monolithPath"
    exit 2
}

foreach ($part in $parts) {
    if (-not (Test-Path $part)) {
        Write-Error "Missing split file: $part"
        exit 2
    }
}

$monolith = Get-Content $monolithPath
$combined = @()
foreach ($part in $parts) {
    $combined += Get-Content $part
}

if ($monolith.Length -ne $combined.Length) {
    Write-Error "Line count mismatch. monolith=$($monolith.Length) split=$($combined.Length)"
    exit 1
}

for ($i = 0; $i -lt $monolith.Length; $i++) {
    if ($monolith[$i] -ne $combined[$i]) {
        $lineNo = $i + 1
        Write-Error "Content mismatch at line $lineNo`nmonolith: $($monolith[$i])`nsplit:    $($combined[$i])"
        exit 1
    }
}

Write-Host "Split validation OK. Files are identical to game.js content/order."
exit 0
