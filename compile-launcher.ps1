# PowerShell script to compile the calculator launcher
# Requires .NET Framework (usually pre-installed on Windows)

$sourceFile = "$PSScriptRoot\calc-launcher.cs"
$outputExe = "$PSScriptRoot\calc.exe"
$iconFile = "$PSScriptRoot\calculator.ico"

Write-Host "Compiling calculator launcher..." -ForegroundColor Cyan
Write-Host "Source: $sourceFile"
Write-Host "Output: $outputExe"
Write-Host ""

# Find C# compiler
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $cscPath)) {
    Write-Host "Error: C# compiler not found!" -ForegroundColor Red
    Write-Host "Please install .NET Framework 4.x" -ForegroundColor Yellow
    exit 1
}

# Compile with optimization and Windows subsystem (no console)
$compileArgs = @(
    "/target:winexe",
    "/out:$outputExe",
    "/optimize+",
    "/platform:anycpu",
    $sourceFile
)

# Add icon if exists
if (Test-Path $iconFile) {
    $compileArgs += "/win32icon:$iconFile"
}

Write-Host "Running compiler..." -ForegroundColor Yellow
& $cscPath $compileArgs

if ($LASTEXITCODE -eq 0 -and (Test-Path $outputExe)) {
    Write-Host ""
    Write-Host "Compilation successful!" -ForegroundColor Green
    Write-Host "Created: $outputExe"
    
    $fileInfo = Get-Item $outputExe
    Write-Host "Size: $($fileInfo.Length) bytes"
} else {
    Write-Host ""
    Write-Host "Compilation failed!" -ForegroundColor Red
    exit 1
}
