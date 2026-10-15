# Risk Desk Gold J15: start only the data uploader, NOT NinjaTrader or Laranjinha.
# Requires the existing LOCAL Risk Desk Supabase environment variables.
# Does not schedule a task, replace a Windows startup item, or install packages.
$ErrorActionPreference = "Stop"
$uploader = Join-Path $PSScriptRoot "riskdesk_gold_uploader_j15.py"
if (-not (Test-Path -LiteralPath $uploader)) { throw "MGC uploader file missing in this folder: $uploader" }
if (-not $env:RISKDESK_SUPABASE_URL) {
    throw "The existing Risk Desk Supabase URL was not inherited by this shell. Run using the existing secure startup environment."
}
if (-not $env:RISKDESK_SUPABASE_SECRET_KEY) {
    throw "The existing Risk Desk local secret was not inherited. Do not paste it into this script."
}
$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) { throw "Python launcher 'py' not found" }
& py -3 -c "import supabase"
if ($LASTEXITCODE -ne 0) { throw "Python supabase package not available in this runtime" }
Write-Host "Risk Desk J15 Gold MGC data uploader (NO TRADING)" -ForegroundColor Cyan
Write-Host "Only MGC completed M1 bars are uploaded; existing NQ/J7A and NinjaTrader tasks are unchanged."
& py -3 $uploader
exit $LASTEXITCODE
