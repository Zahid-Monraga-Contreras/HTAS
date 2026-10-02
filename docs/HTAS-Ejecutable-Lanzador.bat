@echo off
TITLE HTAS - Lanzador de Sistema Integral
COLOR 0A
echo ========================================================
echo   HTAS - Health Tracking & Assistance System
echo   Iniciando microservicios y servidor de aplicaciones...
echo ========================================================
echo.

set ROOT_DIR=%~dp0..

echo [1/3] Lanzando Microservicio de IA (FastAPI - Puerto 8000)...
start "HTAS - FastAPI IA (8000)" cmd /k "cd /d %ROOT_DIR%\Arquitectura\Backend\python\algorithm && uvicorn hipertension_analyzer:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/3] Lanzando Backend REST API (Node.js - Puerto 3000)...
start "HTAS - Node Backend (3000)" cmd /k "cd /d %ROOT_DIR%\Arquitectura\Backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Lanzando Frontend Web (Angular - Puerto 4200)...
start "HTAS - Angular Frontend (4200)" cmd /k "cd /d %ROOT_DIR%\Arquitectura\FrontEnd && npm start"

echo.
echo ========================================================
echo   Todos los servicios han sido lanzados.
echo   Abriendo navegador web en http://localhost:4200 ...
echo ========================================================
timeout /t 5 /nobreak >nul
start http://localhost:4200
