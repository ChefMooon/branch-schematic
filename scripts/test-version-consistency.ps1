$ErrorActionPreference = 'Stop'

$rootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$checkScript = Join-Path $PSScriptRoot 'check-version-consistency.ps1'
$fixturePath = Join-Path ([System.IO.Path]::GetTempPath()) "branch-schematic-version-$([guid]::NewGuid().ToString('N'))"

function Assert-Pass([string]$Tag) {
  & $checkScript -RootPath $fixturePath -Tag $Tag | Out-Null
}

function Assert-Fail([string]$Tag, [string]$Name) {
  try {
    & $checkScript -RootPath $fixturePath -Tag $Tag | Out-Null
    throw "$Name should have failed for '$Tag'."
  } catch {
    if ($_.Exception.Message -like "$Name should have failed*") { throw }
  }
}

try {
  New-Item -ItemType Directory -Path (Join-Path $fixturePath 'src-tauri') -Force | Out-Null
  Copy-Item (Join-Path $rootPath 'package.json') (Join-Path $fixturePath 'package.json')
  Copy-Item (Join-Path $rootPath 'package-lock.json') (Join-Path $fixturePath 'package-lock.json')
  Copy-Item (Join-Path $rootPath 'src-tauri/tauri.conf.json') (Join-Path $fixturePath 'src-tauri/tauri.conf.json')
  Copy-Item (Join-Path $rootPath 'src-tauri/Cargo.toml') (Join-Path $fixturePath 'src-tauri/Cargo.toml')
  Copy-Item (Join-Path $rootPath 'src-tauri/Cargo.lock') (Join-Path $fixturePath 'src-tauri/Cargo.lock')

  Assert-Pass 'v0.1.1'

  $packagePath = Join-Path $fixturePath 'package.json'
  $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
  $package.version = '0.1.2'
  $package | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $packagePath
  Assert-Fail 'v0.1.1' 'mismatched package version'

  $package.version = '0.1.1'
  $package | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $packagePath
  Assert-Fail 'v0.1.0-beta.1' 'prerelease tag'
  Assert-Fail '0.1.0' 'unprefixed tag'
  Assert-Fail 'v0.1' 'malformed tag'

  Write-Output 'Version consistency tests passed (matching, mismatch, prerelease, malformed, and v-prefix cases).'
} finally {
  Remove-Item -LiteralPath $fixturePath -Recurse -Force -ErrorAction SilentlyContinue
}