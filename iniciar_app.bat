@echo off
TITLE Whatsapp Sender Launcher
color 0A

echo =====================================================
echo      INICIADOR DE WHATSAPP SENDER
echo =====================================================
echo.

REM 1. Verificar si Node.js esta instalado
echo [1/3] Verificando Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Node.js no esta instalado en este sistema.
    echo Por favor, descarga e instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit
)
echo Node.js detectado correctamente.
echo.

REM 2. Instalar dependencias si es necesario
echo [2/3] Verificando e instalando dependencias...
echo Esto puede tardar unos minutos la primera vez...
echo.
call npm install
call npm run install-all
echo.
echo Dependencias listas.
echo.

REM 3. Iniciar la aplicacion
echo [3/3] Iniciando la aplicacion...
echo Se abrira una ventana del navegador automaticamente.
echo Por favor, no cierres esta ventana negra mientras uses la aplicacion.
echo.

npm run dev

pause
