# PowerShell script to restore original Windows Calculator
# MUST RUN AS ADMINISTRATOR

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restore Windows Calculator            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Error: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

$calcLocations = @(
    "C:\Windows\System32\calc.exe",
    "C:\Windows\SysWOW64\calc.exe"
)

Write-Host "Restoring original calc.exe files..." -ForegroundColor Yellow
Write-Host ""

foreach ($calcPath in $calcLocations) {
    $backupPath = "$calcPath.backup"
    
    if (Test-Path $backupPath) {
        try {
            # Stop calculator processes
            Get-Process -Name "CalculatorApp" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Get-Process -Name "win32calc" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            
            # Take ownership
            takeown /f $calcPath 2>&1 | Out-Null
            icacls $calcPath /grant "${env:USERNAME}:F" 2>&1 | Out-Null
            
            # Restore backup
            Copy-Item $backupPath $calcPath -Force
            Write-Host "Restored: $calcPath" -ForegroundColor Green
        } catch {
            Write-Host "Error restoring $calcPath : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "No backup found for: $calcPath" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Windows Calculator restored!" -ForegroundColor Green
Write-Host ""
