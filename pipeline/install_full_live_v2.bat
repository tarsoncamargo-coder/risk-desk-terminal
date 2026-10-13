@echo off
setlocal EnableExtensions
title Instalar Risk Desk Full Live V2

echo ============================================================
echo Risk Desk V10 - Instalador FULL LIVE V2
echo ============================================================
echo.

set "SRC=%~dp0"
set "TARGET=%USERPROFILE%\Documents\NinjaTrader 8\LaranjinhaML\J11"
set "BUILDER=%TARGET%\riskdesk_gen2_feature_builder_j11.py"

if not exist "%TARGET%" (
  echo [ERRO] Pasta J11 nao encontrada:
  echo %TARGET%
  pause
  exit /b 1
)

if not exist "%BUILDER%" (
  echo [ERRO] Builder J11 existente nao encontrado:
  echo %BUILDER%
  echo O instalador nao recria nem substitui o builder original.
  pause
  exit /b 1
)

echo Copiando componentes live...
copy /Y "%SRC%riskdesk_live_uploader_j7a.py" "%TARGET%\" >nul || goto :copy_error
copy /Y "%SRC%riskdesk_aux_market_adapter_v2.py" "%TARGET%\" >nul || goto :copy_error
copy /Y "%SRC%riskdesk_market_state_live_v2.py" "%TARGET%\" >nul || goto :copy_error
copy /Y "%SRC%riskdesk_live_diagnostic_v2.py" "%TARGET%\" >nul || goto :copy_error
copy /Y "%SRC%riskdesk_gen2_shadow_j12_publisher.py" "%TARGET%\" >nul || goto :copy_error
copy /Y "%SRC%start_riskdesk_full_live_v2.bat" "%TARGET%\" >nul || goto :copy_error

echo.
echo [OK] Instalacao concluida em:
echo %TARGET%
echo.
echo Preservados:
echo - riskdesk_gen2_feature_builder_j11.py
echo - engine/modelos GEN2 J10
echo - Laranjinha
echo - regras operacionais do robo
echo.
echo Novos componentes:
echo - DXY/VIX/VXN best-effort adapter V2
echo - Market State live V2
echo - diagnostico compacto
echo - launcher unificado
echo.

choice /M "Deseja iniciar o FULL LIVE V2 agora"
if errorlevel 2 goto :done
start "" "%TARGET%\start_riskdesk_full_live_v2.bat"
goto :done

:copy_error
echo.
echo [ERRO] Falha ao copiar arquivos.
pause
exit /b 1

:done
echo.
echo Finalizado.
pause
