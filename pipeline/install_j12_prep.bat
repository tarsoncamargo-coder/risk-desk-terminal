@echo off
setlocal EnableExtensions
title Instalar Risk Desk J12 PREP

echo ============================================================
echo Risk Desk V10 - Instalador J12 PREP
echo ============================================================
echo.

set "SRC=%~dp0"
set "TARGET=%USERPROFILE%\Documents\NinjaTrader 8\LaranjinhaML\J11"
set "BUILDER=%TARGET%\riskdesk_gen2_feature_builder_j11.py"

if not exist "%TARGET%" (
    echo [ERRO] Pasta J11 nao encontrada:
    echo %TARGET%
    echo.
    pause
    exit /b 1
)

if not exist "%BUILDER%" (
    echo [ERRO] Builder J11 existente nao encontrado:
    echo %BUILDER%
    echo.
    echo O instalador nao vai recriar nem substituir o builder.
    pause
    exit /b 1
)

echo Instalando apenas os arquivos novos do J12 PREP...
echo.

copy /Y "%SRC%riskdesk_gen2_shadow_j12_publisher.py" "%TARGET%\" >nul
if errorlevel 1 goto :copy_error

copy /Y "%SRC%start_gen2_stack_j12_prep.bat" "%TARGET%\" >nul
if errorlevel 1 goto :copy_error

copy /Y "%SRC%PASSOS_J12_PREP_PUBLISHER.txt" "%TARGET%\" >nul
if errorlevel 1 goto :copy_error

echo [OK] Publisher:
echo %TARGET%\riskdesk_gen2_shadow_j12_publisher.py
echo.
echo [OK] Launcher:
echo %TARGET%\start_gen2_stack_j12_prep.bat
echo.
echo [OK] Instrucoes:
echo %TARGET%\PASSOS_J12_PREP_PUBLISHER.txt
echo.

echo Nao foram alterados:
echo - riskdesk_gen2_feature_builder_j11.py
echo - riskdesk_gen2_shadow_j10.py
echo - modelos GEN2
echo - Laranjinha
echo.

echo IMPORTANTE:
echo Ao usar o J12 PREP, nao abra o antigo uploader J10 ao mesmo tempo.
echo.

choice /M "Deseja iniciar o stack J12 PREP agora"
if errorlevel 2 goto :done

start "" "%TARGET%\start_gen2_stack_j12_prep.bat"
goto :done

:copy_error
echo.
echo [ERRO] Falha ao copiar arquivos.
pause
exit /b 1

:done
echo.
echo Instalacao concluida.
pause
