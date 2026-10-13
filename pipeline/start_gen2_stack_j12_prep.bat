@echo off
setlocal EnableExtensions
title Risk Desk V10 - J12 PREP Live Stack

echo ============================================================
echo Risk Desk V10 - J12 PREP
echo J11 Feature Builder + GEN2 Prospective Publisher
echo ============================================================
echo.
echo Nao envia ordens. Nao altera Laranjinha. Nao retreina GEN2.
echo.

set "J11DIR=%~dp0"
set "BUILDER=%J11DIR%riskdesk_gen2_feature_builder_j11.py"
set "PUBLISHER=%J11DIR%riskdesk_gen2_shadow_j12_publisher.py"
set "ENGINE=%USERPROFILE%\Documents\NinjaTrader 8\LaranjinhaML\HistoricoML_V7\NASDAQ_GEN2_SHADOW_V10_0_0J10_FINAL\RiskDesk_Nasdaq_GEN2_Shadow_Inference.py"

if not exist "%BUILDER%" (
    echo [ERRO] Builder J11 nao encontrado:
    echo %BUILDER%
    echo.
    pause
    exit /b 1
)

if not exist "%PUBLISHER%" (
    echo [ERRO] Publisher J12 nao encontrado:
    echo %PUBLISHER%
    echo.
    pause
    exit /b 1
)

if not exist "%ENGINE%" (
    echo [ERRO] Engine congelado J10 nao encontrado:
    echo %ENGINE%
    echo.
    pause
    exit /b 1
)

set "PYTHON="
if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"

if not defined PYTHON (
    for /f "delims=" %%I in ('where python.exe 2^>nul') do (
        if not defined PYTHON set "PYTHON=%%I"
    )
)

if not defined PYTHON (
    for /f "delims=" %%I in ('where py.exe 2^>nul') do (
        if not defined PYTHON set "PYTHON=%%I"
    )
)

if not defined PYTHON (
    echo [ERRO] Python nao encontrado.
    pause
    exit /b 1
)

echo Python:
echo %PYTHON%
echo.
echo Builder:
echo %BUILDER%
echo.
echo Publisher:
echo %PUBLISHER%
echo.
echo Engine J10:
echo %ENGINE%
echo.

if "%RISKDESK_SUPABASE_URL%"=="" (
    echo [ERRO] RISKDESK_SUPABASE_URL nao esta definida nesta sessao.
    echo.
    pause
    exit /b 1
)

if "%RISKDESK_SUPABASE_SECRET_KEY%"=="" (
    echo [ERRO] RISKDESK_SUPABASE_SECRET_KEY nao esta definida nesta sessao.
    echo.
    pause
    exit /b 1
)

echo Validando sintaxe...
"%PYTHON%" -m py_compile "%BUILDER%" "%PUBLISHER%"
if errorlevel 1 (
    echo.
    echo [ERRO] Falha na validacao de sintaxe.
    pause
    exit /b 1
)

echo Validando dependencias...
"%PYTHON%" -c "import pandas,numpy,supabase,joblib,sklearn; print('Dependencias OK | sklearn', sklearn.__version__)"
if errorlevel 1 (
    echo.
    echo [ERRO] Dependencia Python ausente.
    pause
    exit /b 1
)

echo.
echo Preflight OK.
echo.

echo Abrindo J11 Feature Builder...
start "J11 Feature Builder" cmd.exe /k ""%PYTHON%" "%BUILDER%""

timeout /t 2 /nobreak >nul

echo Abrindo J12 Prospective Publisher...
start "J12 Prospective Publisher" cmd.exe /k ""%PYTHON%" "%PUBLISHER%""

echo.
echo ============================================================
echo Devem ficar abertas duas janelas:
echo   1. J11 Feature Builder
echo   2. J12 Prospective Publisher
echo.
echo O antigo GEN2 Shadow Uploader J10 nao precisa ser aberto
echo ao mesmo tempo que este publisher.
echo ============================================================
echo.
pause
