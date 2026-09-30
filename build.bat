@echo off
REM =============================================================
REM  HTAS — Script de Build y Verificación
REM  Para Windows (PowerShell/CMD)
REM =============================================================

echo.
echo ============================================
echo   HTAS — Build Script v1.0.0
echo ============================================
echo.

REM --- Verificar Node.js ---
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no encontrado. Instala desde https://nodejs.org
    exit /b 1
)
echo   OK: Node.js instalado

REM --- Verificar Python ---
echo [2/5] Verificando Python...
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no encontrado. Instala desde https://python.org
    exit /b 1
)
echo   OK: Python instalado

REM --- Instalar dependencias Backend Node.js ---
echo [3/5] Instalando dependencias Backend (Node.js)...
cd Arquitectura\Backend
call npm install --silent
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo al instalar dependencias del Backend
    exit /b 1
)
echo   OK: Dependencias Backend instaladas
cd ..\..

REM --- Instalar dependencias Python ---
echo [4/5] Instalando dependencias Python (FastAPI)...
cd Arquitectura\Backend\python\algorithm
pip install -r requirements.txt --quiet
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo al instalar dependencias Python
    exit /b 1
)
echo   OK: Dependencias Python instaladas
cd ..\..\..\..

REM --- Instalar y compilar Frontend Angular ---
echo [5/5] Instalando y compilando Frontend (Angular)...
cd Arquitectura\FrontEnd
call npm install --silent
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo al instalar dependencias del Frontend
    exit /b 1
)
call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo al compilar el Frontend Angular
    exit /b 1
)
echo   OK: Frontend compilado en Arquitectura/FrontEnd/dist/
cd ..\..

echo.
echo ============================================
echo   Build completado exitosamente!
echo ============================================
echo.
echo Artefactos generados:
echo   - Frontend: Arquitectura\FrontEnd\dist\
echo.
echo Para ejecutar en desarrollo, abre 3 terminales:
echo   Terminal 1 (FastAPI): cd Arquitectura\Backend\python\algorithm ^&^& uvicorn hipertension_analyzer:app --reload --port 8000
echo   Terminal 2 (Backend): cd Arquitectura\Backend ^&^& npm run dev
echo   Terminal 3 (Frontend): cd Arquitectura\FrontEnd ^&^& npm start
echo.
