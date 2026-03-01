$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$lr = Invoke-WebRequest "http://localhost:3001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@example.com","password":"password123"}' -WebSession $session -UseBasicParsing
$token = ($lr.Content | ConvertFrom-Json).data.accessToken
$csrf = ($session.Cookies.GetCookies("http://localhost:3001") | Where-Object { $_.Name -eq "csrf-token" }).Value
$H = @{ "Authorization"="Bearer $token"; "x-csrf-token"=$csrf }

$resources = @(
  '{"name":"Fog Node F1 - Assembly Line","capacity":100}',
  '{"name":"Fog Node F2 - CNC Processing","capacity":85}',
  '{"name":"Fog Node F3 - Quality Inspection","capacity":120}',
  '{"name":"Fog Node F4 - Welding Station","capacity":75}',
  '{"name":"Fog Node F5 - Packaging Unit","capacity":90}',
  '{"name":"Fog Node F6 - Material Handling","capacity":60}',
  '{"name":"Fog Node F7 - Paint Shop","capacity":110}',
  '{"name":"Fog Node F8 - Inventory Storage","capacity":95}',
  '{"name":"Fog Node F9 - Testing Lab","capacity":130}',
  '{"name":"Fog Node F10 - Dispatch Center","capacity":80}'
)

foreach ($r in $resources) {
  try {
    $resp = Invoke-WebRequest "http://localhost:3001/api/v1/resources" -Method POST -ContentType "application/json" -Headers $H -Body $r -UseBasicParsing
    $name = ($resp.Content | ConvertFrom-Json).data.name
    Write-Host "  Created: $name" -ForegroundColor Green
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400 -or $code -eq 409) {
      Write-Host "  Already exists (skipped)" -ForegroundColor Yellow
    } else {
      Write-Host "  FAIL ($code)" -ForegroundColor Red
    }
  }
}

$res = (Invoke-WebRequest "http://localhost:3001/api/v1/resources" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "`nTotal resources: $($res.data.Count)" -ForegroundColor Cyan
foreach ($r in $res.data) {
  Write-Host "  $($r.name) | capacity=$($r.capacity) | load=$($r.currentLoad)% | status=$($r.status)"
}
