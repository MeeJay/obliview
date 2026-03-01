# build-windows.ps1 — Build Obliview.exe and ObliviewSetup.msi for Windows
# Run from the desktop-app/ directory:
#   .\build-windows.ps1
#
# Prerequisites:
#   • Go 1.21+ (with CGO_ENABLED=1 and MinGW/MSVC in PATH)
#   • WiX Toolset v4: dotnet tool install --global wix
#
# Outputs:
#   dist\ObliviewSetup.msi   — Windows installer with Start Menu + optional Desktop shortcut
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$AppName   = 'Obliview'
$ExeName   = 'Obliview.exe'
$MsiName   = 'ObliviewSetup.msi'
$WxsFile   = 'installer.wxs'
$DistDir   = 'dist'

Write-Host "=== Step 1: Checking prerequisites ===" -ForegroundColor Cyan

# Ensure Go is available
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "Go not found in PATH. Install Go 1.21+ and ensure it is in your PATH."
}
Write-Host "  Go: $(go version)"

# Ensure WiX v4 is available
if (-not (Get-Command wix -ErrorAction SilentlyContinue)) {
    Write-Host "  WiX not found — installing via dotnet tool..." -ForegroundColor Yellow
    dotnet tool install --global wix
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install WiX. Ensure .NET SDK is installed: https://dot.net"
    }
}
Write-Host "  WiX: $(wix --version 2>&1 | Select-Object -First 1)"

# Ensure logo.ico exists (needed by both the Go build and the WiX installer)
if (-not (Test-Path 'logo.ico')) {
    Write-Error "logo.ico not found. Run tools\convert_icon to generate it from logo.webp."
}
Write-Host "  logo.ico: OK"

# ── Step 2: Build the Go binary ─────────────────────────────────────────────
Write-Host "`n=== Step 2: Building $ExeName ===" -ForegroundColor Cyan

$env:CGO_ENABLED = '1'
# -H windowsgui suppresses the console window that would otherwise flash on launch
go build -ldflags "-H windowsgui" -o $ExeName .
if ($LASTEXITCODE -ne 0) { Write-Error "go build failed." }

$exeSize = (Get-Item $ExeName).Length / 1MB
Write-Host ("  Built: {0} ({1:F1} MB)" -f $ExeName, $exeSize)

# ── Step 3: Build the MSI with WiX ──────────────────────────────────────────
Write-Host "`n=== Step 3: Building $MsiName ===" -ForegroundColor Cyan

if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir | Out-Null }

$msiPath = Join-Path $DistDir $MsiName
wix build $WxsFile -o $msiPath
if ($LASTEXITCODE -ne 0) { Write-Error "WiX build failed." }

$msiSize = (Get-Item $msiPath).Length / 1MB
Write-Host ("  Built: {0} ({1:F1} MB)" -f $msiPath, $msiSize)

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "  Executable : $ExeName"
Write-Host "  Installer  : $msiPath"
Write-Host ""
Write-Host "To install: double-click $msiPath  (or: msiexec /i $msiPath)"
Write-Host "To test silent install: msiexec /i $msiPath /qn"
