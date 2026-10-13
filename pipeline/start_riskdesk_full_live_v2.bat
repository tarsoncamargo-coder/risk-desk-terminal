@echo off
setlocal EnableExtensions
title Risk Desk V10 - Full Live Stack V2

echo ============================================================
echo Risk Desk V10 - FULL LIVE STACK V2
echo NQ/ZQ/ZT/ZN + DXY/VIX/VXN + Market State + J11 + J12
echo ============================================================
echo.
echo Contexto / pesquisa apenas.
echo Nao envia ordens. Nao altera Laranjinha. Nao retreina GEN2.
echo.

set "ROOT=%~dp0"
set "LIVE=%USERPROFILE%\Documents\NinjaTrader 8\LaranjinhaML\Live"
set "CSV=%LIVE%\RiskDeskLiveBridge_J7A.csv"
set "ENGINE=%USERPROFILE%\Documents\NinjaTrader 8\LaranjinhaML\HistoricoML_V7\NASDAQ_GEN2_SHADOW_V10_0_0J10_FINAL\RiskDesk_Nasdaq_GEN2_Shadow_Inference.py"

set "UPLOADER=%ROOT%riskdesk_live_uploader_j7a.py"
set "AUX=%ROOT%riskdesk_aux_market_adapter_v2.py"
set "MARKET=%ROOT%riskdesk_market_state_live_v2.py"
set "BUILDER=%ROOT%riskdesk_gen2_feature_builder_j11.py"
set "PUBLISHER=%ROOT%riskdesk_gen2_shadow_j12_publisher.py"
set "DIAG=%ROOT%riskdesk_live_diagnostic_v2.py"

set "PYTHON="
if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"
if not defined PYTHON for /f "delims=" %%I in ('where python.exe 2^>nul') do if not defined PYTHON set "PYTHON=%%I"
if not defined PYTHON for /f "delims=" %%I in ('where py.exe 2^>nul') do if not defined PYTHON set "PYTHON=%%I"

if not defined PYTHON (
  echo [ERRO] Python nao encontrado.
  pause
  exit /b 1
)

if "%RISKDESK_SUPABASE_URL%"=="" (
  echo [ERRO] RISKDESK_SUPABASE_URL nao esta definida.
  pause
  exit /b 1
)
if "%RISKDESK_SUPABASE_SECRET_KEY%"=="" (
  echo [ERRO] RISKDESK_SUPABASE_SECRET_KEY nao esta definida.
  pause
  exit /b 1
)

for %%F in ("%UPLOADER%" "%AUX%" "%MARKET%" "%BUILDER%" "%PUBLISHER%" "%DIAG%" "%ENGINE%") do (
  if not exist "%%~F" (
    echo [ERRO] Arquivo obrigatorio nao encontrado:
    echo %%~F
    pause
    exit /b 1
  )
)

echo Python:
echo %PYTHON%
echo.

echo Validando sintaxe dos modulos...
"%PYTHON%" -m py_compile "%UPLOADER%" "%AUX%" "%MARKET%" "%BUILDER%" "%PUBLISHER%" "%DIAG%"
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

if not exist "%CSV%" (
  echo.
  echo [ATENCAO] CSV do NinjaTrader ainda nao existe:
  echo %CSV%
  echo.
  echo O stack pode abrir, mas NQ/ZQ/ZT/ZN ficarao indisponiveis
  echo ate o indicador RiskDeskLiveBridgeJ7A estar ativo no NinjaTrader.
  echo.
)

echo ============================================================
echo PREFLIGHT OK
echo ============================================================
echo.

echo 1/5 Abrindo uploader NinjaTrader...
start "Risk Desk - NQ ZQ ZT ZN Uploader" cmd.exe /k ""%PYTHON%" "%UPLOADER%""
timeout /t 1 /nobreak >nul

echo 2/5 Abrindo DXY/VIX/VXN adapter...
start "Risk Desk - DXY VIX VXN" cmd.exe /k ""%PYTHON%" "%AUX%""
timeout /t 1 /nobreak >nul

echo 3/5 Abrindo Market State V2...
start "Risk Desk - Market State V2" cmd.exe /k ""%PYTHON%" "%MARKET%""
timeout /t 1 /nobreak >nul

echo 4/5 Abrindo J11 Feature Builder...
start "Risk Desk - J11 Feature Builder" cmd.exe /k ""%PYTHON%" "%BUILDER%""
timeout /t 1 /nobreak >nul

echo 5/5 Abrindo J12 Prospective Publisher...
start "Risk Desk - J12 Publisher" cmd.exe /k ""%PYTHON%" "%PUBLISHER%""

echo.
echo ============================================================
echo STACK ABERTO
echo ============================================================
echo Devem ficar abertas cinco janelas.
echo.
echo IMPORTANTE:
echo - NinjaTrader precisa estar aberto com RiskDeskLiveBridgeJ7A ativo
echo   para alimentar NQ/ZQ/ZT/ZN.
echo - DXY/VIX/VXN usam fonte best-effort com staleness guard.
echo - Nao abra o antigo uploader GEN2 J10 em paralelo.
echo.
echo O diagnostico inicial sera executado automaticamente.
echo ============================================================
echo.
echo Aguardando 25 segundos para os componentes publicarem...
timeout /t 25 /nobreak >nul
echo.
"%PYTHON%" "%DIAG%"
echo.
echo Copie somente o bloco RESUMO PARA CHATGPT e envie no chat.
echo.
pause
