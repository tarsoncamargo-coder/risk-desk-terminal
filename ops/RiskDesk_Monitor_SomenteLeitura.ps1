#Requires -Version 5.1
<#
 Risk Desk V10 - diagnóstico SOMENTE LEITURA, J14A/J14C/J14E/J14G.
 Não altera Agendador, não reinicia processos, não inicia outro Risk Desk,
 não acessa credenciais DPAPI nem modifica NinjaTrader/MT5/Laranjinha.
 Use em paralelo ao inicializador UNICO ja instalado: iniciar_riskdesk_live_unico.ps1.
 EXEMPLO LOCAL OPCIONAL: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RiskDesk_Monitor_SomenteLeitura.ps1
 Para observacao continua, usar -Loop. Ativar essa rotina no Windows exige configuracao local.
#>
[CmdletBinding()]
param(
    [switch]$Loop,
    [ValidateRange(60,3600)][int]$IntervalSeconds = 120,
    [string]$LogDirectory = "$env:LOCALAPPDATA\RiskDesk\Health"
)
$ErrorActionPreference = 'Stop'
$urls = [ordered]@{
    fontes = 'https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14a-health-panel'
    contexto = 'https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14c-continuous-context'
    politica = 'https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14e-zq-calendar-weighted'
    publicacoes = 'https://pkmjknlbsptqhanejddm.supabase.co/functions/v1/riskdesk-j14g-official-macro-releases'
}
function Get-EndpointState {
    param([string]$Name,[string]$Url)
    $result = [ordered]@{name=$Name;status='UNAVAILABLE';age_minutes=$null;code=$null}
    try {
        $json = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 14 -Headers @{'Accept'='application/json'}
        if ($null -eq $json) { throw 'EMPTY_RESPONSE' }
        $result.status = [string]$json.status
        if ($Name -eq 'contexto' -and $null -ne $json.context) {
            $result.code = [string]$json.context.reason_code
            $result.age_minutes = $json.age_minutes
        }
        if ($Name -eq 'fontes') {
            $result.age_minutes = $json.snapshot_age_minutes
            $result.code = 'source_rows=' + [string]$json.row_count
        }
        if ($Name -eq 'politica') {
            $result.code = 'zq_weighted_month_rows=' + [string]$json.rows.Count
        }
        if ($Name -eq 'publicacoes') {
            $result.code = 'captured_official_releases=' + [string]$json.events.Count
        }
    }
    catch {
        $result.status = 'FETCH_FAILED'
        $result.code = ([string]$_.Exception.Message).Substring(0,[Math]::Min(150,([string]$_.Exception.Message).Length))
    }
    return $result
}
function Get-LocalTaskState {
    $items = @()
    try {
        $tasks = @(Get-ScheduledTask -ErrorAction Stop |
            Where-Object { $_.TaskName -like 'RiskDesk*' -or $_.TaskName -like '*ActivTrades*' })
        foreach ($t in $tasks) {
            $run = $null
            try { $run = Get-ScheduledTaskInfo -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction Stop } catch {}
            $items += [ordered]@{
                task=$t.TaskName
                state=[string]$t.State
                last_run=if($run){$run.LastRunTime.ToString('o')}else{$null}
                result=if($run){$run.LastTaskResult}else{$null}
            }
        }
    }
    catch {
        $items += [ordered]@{task='TASK_ENUMERATION';state='NO_ACCESS';last_run=$null;result=$null}
    }
    return ,$items
}
if (-not(Test-Path -LiteralPath $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}
do {
    $statuses = @()
    foreach ($name in $urls.Keys) {
        $statuses += Get-EndpointState -Name $name -Url $urls[$name]
    }
    $entry=[ordered]@{
        checked_at_utc=[DateTime]::UtcNow.ToString('o')
        mode='DIAGNOSTIC_READ_ONLY_NO_RESTART'
        endpoints=$statuses
        windows_tasks=@(Get-LocalTaskState)
        action='NONE'
    }
    $line=$entry | ConvertTo-Json -Depth 8 -Compress
    $log=Join-Path $LogDirectory ('riskdesk-health-'+(Get-Date -Format 'yyyyMMdd')+'.jsonl')
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
    Write-Output $line
    if ($Loop) { Start-Sleep -Seconds $IntervalSeconds }
} while ($Loop)
