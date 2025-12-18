# PowerShell script to replace Windows Calculator with custom launcher
# MUST RUN AS ADMINISTRATOR

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Windows Calculator Replacement Setup  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Error: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

$customCalc = "$PSScriptRoot\calc.exe"

# Check if our calc.exe exists
if (-not (Test-Path $customCalc)) {
    Write-Host "Error: calc.exe not found in project directory!" -ForegroundColor Red
    Write-Host "Please run compile-launcher.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Find Windows Calculator locations
$calcLocations = @(
    "C:\Windows\System32\calc.exe",
    "C:\Windows\SysWOW64\calc.exe"
)

Write-Host "Step 1: Taking ownership and backing up original calc.exe files..." -ForegroundColor Yellow
Write-Host ""

foreach ($calcPath in $calcLocations) {
    if (Test-Path $calcPath) {
        Write-Host "Processing: $calcPath"
        
        # Backup original
        $backupPath = "$calcPath.backup"
        if (-not (Test-Path $backupPath)) {
            try {
                # Take ownership
                takeown /f $calcPath 2>&1 | Out-Null
                icacls $calcPath /grant "${env:USERNAME}:F" 2>&1 | Out-Null
                
                # Create backup
                Copy-Item $calcPath $backupPath -Force
                Write-Host "  Backed up to: $backupPath" -ForegroundColor Green
            } catch {
                Write-Host "  Warning: Could not backup: $_" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  Backup already exists: $backupPath" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "Step 2: Replacing calc.exe with custom launcher..." -ForegroundColor Yellow
Write-Host ""

foreach ($calcPath in $calcLocations) {
    if (Test-Path $calcPath) {
        try {
            # Stop any running calculator processes
            Get-Process -Name "CalculatorApp" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Get-Process -Name "win32calc" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            
            # Take ownership and permissions
            takeown /f $calcPath 2>&1 | Out-Null
            icacls $calcPath /grant "${env:USERNAME}:F" 2>&1 | Out-Null
            
            # Replace with our version
            Copy-Item $customCalc $calcPath -Force
            Write-Host "  Replaced: $calcPath" -ForegroundColor Green
        } catch {
            Write-Host "  Error replacing $calcPath : $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!                       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "The Calculator key should now launch your Electron calculator." -ForegroundColor Cyan
Write-Host ""
Write-Host "To restore Windows Calculator, run: .\restore-calc-exe.ps1" -ForegroundColor Yellow
Write-Host ""
