param(
  [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$Tag = $env:GITHUB_REF_NAME
)

$ErrorActionPreference = 'Stop'

function Read-StrictVersion([string]$Value, [string]$Name) {
  if ($Value -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
    throw "$Name must be a stable semantic version in X.Y.Z form; received '$Value'."
  }
  return $Value
}

if ([string]::IsNullOrWhiteSpace($Tag)) {
  throw 'A stable vX.Y.Z tag is required. Pass -Tag or set GITHUB_REF_NAME.'
}

$tagMatch = [regex]::Match($Tag, '^v((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$')
if (-not $tagMatch.Success) {
  throw "Tag '$Tag' must match vX.Y.Z and must not contain a prerelease or build suffix."
}

$tagVersion = Read-StrictVersion $tagMatch.Groups[1].Value 'Tag version'
$tauriPath = Join-Path $RootPath 'src-tauri/tauri.conf.json'
$packagePath = Join-Path $RootPath 'package.json'
$cargoPath = Join-Path $RootPath 'src-tauri/Cargo.toml'

$tauriVersion = Read-StrictVersion ((Get-Content -LiteralPath $tauriPath -Raw | ConvertFrom-Json).version) 'src-tauri/tauri.conf.json version'
$packageVersion = Read-StrictVersion ((Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version) 'package.json version'
$cargoContent = Get-Content -LiteralPath $cargoPath -Raw
$cargoMatch = [regex]::Match($cargoContent, '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"\s*$')
if (-not $cargoMatch.Success) {
  throw 'src-tauri/Cargo.toml is missing a [package] version.'
}
$cargoVersion = Read-StrictVersion $cargoMatch.Groups[1].Value 'src-tauri/Cargo.toml version'

$versions = [ordered]@{
  'src-tauri/tauri.conf.json' = $tauriVersion
  'package.json' = $packageVersion
  'src-tauri/Cargo.toml' = $cargoVersion
  tag = $tagVersion
}
$mismatches = @($versions.GetEnumerator() | Where-Object { $_.Value -ne $tagVersion })
if ($mismatches.Count -gt 0) {
  $details = ($versions.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '
  throw "Version mismatch for tag '$Tag': $details"
}

Write-Output "Version consistency check passed for $Tag ($tagVersion)."