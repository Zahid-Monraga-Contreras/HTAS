# HTAS — Script de Build (PowerShell)
# Ejecutar con: .\build.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  HTAS — Build Script v1.0.0" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Verificar Node.js ---
Write-Host "[1/5] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  OK: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js no encontrado. Instala desde https://nodejs.org" -ForegroundColor Red
    exit 1
}

# --- Verificar Python ---
Write-Host "[2/5] Verificando Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version
    Write-Host "  OK: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python no encontrado. Instala desde https://python.org" -ForegroundColor Red
    exit 1
}

# --- Instalar dependencias Backend Node.js ---
Write-Host "[3/5] Instalando dependencias Backend (Node.js)..." -ForegroundColor Yellow
Push-Location "Arquitectura\Backend"
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Fallo al instalar dependencias del Backend" -ForegroundColor Red
    Pop-Location; exit 1
}
Write-Host "  OK: Dependencias Backend instaladas" -ForegroundColor Green
Pop-Location

# --- Instalar dependencias Python ---
Write-Host "[4/5] Instalando dependencias Python (FastAPI)..." -ForegroundColor Yellow
Push-Location "Arquitectura\Backend\python\algorithm"
pip install -r requirements.txt --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Fallo al instalar dependencias Python" -ForegroundColor Red
    Pop-Location; exit 1
}
Write-Host "  OK: Dependencias Python instaladas" -ForegroundColor Green
Pop-Location

# --- Instalar y compilar Frontend Angular ---
Write-Host "[5/5] Compilando Frontend (Angular)..." -ForegroundColor Yellow
Push-Location "Arquitectura\FrontEnd"
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Fallo al instalar dependencias del Frontend" -ForegroundColor Red
    Pop-Location; exit 1
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Fallo al compilar el Frontend Angular" -ForegroundColor Red
    Pop-Location; exit 1
}
Write-Host "  OK: Frontend compilado" -ForegroundColor Green
Pop-Location

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Build completado exitosamente!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Artefactos generados:" -ForegroundColor Cyan
Write-Host "  - Frontend: Arquitectura\FrontEnd\dist\" -ForegroundColor White
Write-Host ""
Write-Host "Para ejecutar en modo desarrollo:" -ForegroundColor Cyan
Write-Host "  Terminal 1 (FastAPI) : cd Arquitectura\Backend\python\algorithm; uvicorn hipertension_analyzer:app --reload --port 8000" -ForegroundColor White
Write-Host "  Terminal 2 (Backend) : cd Arquitectura\Backend; npm run dev" -ForegroundColor White
Write-Host "  Terminal 3 (Frontend): cd Arquitectura\FrontEnd; npm start" -ForegroundColor White
Write-Host ""
