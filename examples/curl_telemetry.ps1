# Send telemetry with PowerShell (Windows).
#   $env:MONITORING_API_KEY = "th_..."
#   .\examples\curl_telemetry.ps1
$ErrorActionPreference = "Stop"

$apiKey = $env:MONITORING_API_KEY
if (-not $apiKey) { throw "Set MONITORING_API_KEY first" }
$endpoint = if ($env:TELEMETRY_ENDPOINT) { $env:TELEMETRY_ENDPOINT } else { "http://localhost:8000" }

$headers = @{ "X-API-Key" = $apiKey; "Content-Type" = "application/json" }

$single = @{
  service    = "payment-api"
  event_type = "log"
  severity   = "ERROR"
  message    = "Database connection timeout (password=hunter2 redacted)"
  region     = "india"
  metadata   = @{ order_id = 42; api_key = "sk_live_secret" }
} | ConvertTo-Json

Invoke-RestMethod -Uri "$endpoint/api/v1/telemetry" -Method Post -Headers $headers -Body $single
Write-Host "Sent single event."
