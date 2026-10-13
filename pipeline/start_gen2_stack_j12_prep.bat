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
