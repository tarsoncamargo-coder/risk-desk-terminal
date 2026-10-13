@echo off
setlocal EnableExtensions
title Risk Desk V1 - Preview local

set "ROOT=%~dp0.."
cd /d "%ROOT%"

set "PYTHON="
if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"
if not defined PYTHON (
  for /f "delims=" %%I in ('where python.exe 2^>nul') do if not defined PYTHON set "PYTHON=%%I"
)
if not defined PYTHON (
  echo [ERRO] Python nao encontrado.
  pause
  exit /b 1
)

echo ============================================================
echo Risk Desk - preview local da branch atual
echo ============================================================
echo.
echo URL: http://127.0.0.1:8008/
echo Para encerrar, pressione Ctrl+C nesta janela.
echo.
start "" "http://127.0.0.1:8008/"
"%PYTHON%" -m http.server 8008 --bind 127.0.0.1
pause
