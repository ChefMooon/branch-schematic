param(
  [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$Tag = $env:GITHUB_REF_NAME,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Tag)) {
  throw 'A vX.Y.Z release tag is required.'
}

$tagMatch = [regex]::Match($Tag, '^v((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$')
if (-not $tagMatch.Success) {
  throw "Tag '$Tag' must match vX.Y.Z."
}

$version = $tagMatch.Groups[1].Value
$changelogPath = Join-Path $RootPath 'CHANGELOG.md'
if (-not (Test-Path -LiteralPath $changelogPath)) {
  throw 'CHANGELOG.md is required for release notes.'
}

$lines = @(Get-Content -LiteralPath $changelogPath)
$headingPattern = "^## \[$([regex]::Escape($version))\](?:\s+-.*)?$"
$start = -1
for ($index = 0; $index -lt $lines.Count; $index++) {
  if ($lines[$index] -match $headingPattern) {
    $start = $index
    break
  }
}

if ($start -lt 0) {
  throw "CHANGELOG.md is missing a release entry for [$version]."
}

$end = $lines.Count
for ($index = $start + 1; $index -lt $lines.Count; $index++) {
  if ($lines[$index] -match '^## \[') {
    $end = $index
    break
  }
}

$releaseNotes = ($lines[$start..($end - 1)] -join "`n").Trim()
if ([string]::IsNullOrWhiteSpace($releaseNotes) -or $releaseNotes -notmatch '(?m)^-\s+\S') {
  throw "CHANGELOG.md release entry for [$version] has no bullet-point notes."
}

$outputDirectory = Split-Path -Parent (Resolve-Path -LiteralPath $OutputPath -ErrorAction SilentlyContinue)
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}
Set-Content -LiteralPath $OutputPath -Value $releaseNotes -NoNewline
Write-Output "Release notes extracted for [$version]."
