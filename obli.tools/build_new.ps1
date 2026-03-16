$env:CGO_ENABLED = '1'
$env:CGO_CXXFLAGS = '-IC:/oblitools-winrt'
if (-not (Test-Path 'C:\oblitools-winrt')) { New-Item -ItemType Directory -Path 'C:\oblitools-winrt' | Out-Null }
Set-Content 'C:\oblitools-winrt\EventToken.h' "#pragma once`ntypedef struct EventRegistrationToken { __int64 value; } EventRegistrationToken;" -Encoding ASCII
go build -ldflags "-H windowsgui -s -w -X main.appVersion=1.0.59" -o dist\ObliTools_new.exe .
Write-Host "Exit code: $LASTEXITCODE"
