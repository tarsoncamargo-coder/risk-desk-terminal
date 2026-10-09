$ErrorActionPreference = "Stop"
Write-Host "Risk Desk V10 J7A - Live uploader" -ForegroundColor Cyan
if (-not $env:RISKDESK_SUPABASE_URL) { Write-Host "Falta RISKDESK_SUPABASE_URL." -ForegroundColor Yellow; exit 1 }
if (-not $env:RISKDESK_SUPABASE_SECRET_KEY) { Write-Host "Falta RISKDESK_SUPABASE_SECRET_KEY." -ForegroundColor Yellow; exit 1 }
py -m pip install --quiet --upgrade supabase
py (Join-Path $PSScriptRoot "riskdesk_live_uploader_j7a.py")
