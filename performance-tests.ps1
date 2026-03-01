###############################################################################
#  ML Task Scheduler - Performance Test Suite (Windows PowerShell)
#  Run: .\performance-tests.ps1
#  Prerequisite: Docker containers must be running (docker-compose up)
###############################################################################

$BACKEND  = "http://localhost:3001"
$ML_SVC   = "http://localhost:5001"
$FRONTEND = "http://localhost:3000"

# ── Helper: pretty section header ──────────────────────────────────────────
function Write-Section($num, $title) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  TEST $num : $title" -ForegroundColor Yellow
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

# ── Helper: measure a single HTTP request ──────────────────────────────────
function Measure-Request {
    param(
        [string]$Method = "GET",
        [string]$Uri,
        [string]$Body = $null,
        [string]$ContentType = "application/json"
    )
    $params = @{ Method = $Method; Uri = $Uri; UseBasicParsing = $true }
    if ($Body) {
        $params.Body = $Body
        $params.ContentType = $ContentType
    }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest @params -ErrorAction Stop
        $sw.Stop()
        return @{ StatusCode = $resp.StatusCode; TimeMs = $sw.Elapsed.TotalMilliseconds; Body = $resp.Content; Error = $null }
    } catch {
        $sw.Stop()
        return @{ StatusCode = $_.Exception.Response.StatusCode.Value__; TimeMs = $sw.Elapsed.TotalMilliseconds; Body = $null; Error = $_.Exception.Message }
    }
}

# ── Helper: run N requests and report stats ────────────────────────────────
function Run-LoadTest {
    param(
        [string]$Label,
        [string]$Method = "GET",
        [string]$Uri,
        [string]$Body = $null,
        [int]$Requests = 50
    )
    $times = @()
    $errors = 0
    for ($i = 1; $i -le $Requests; $i++) {
        $r = Measure-Request -Method $Method -Uri $Uri -Body $Body
        if ($r.Error) { $errors++ } else { $times += $r.TimeMs }
        Write-Progress -Activity $Label -Status "$i / $Requests" -PercentComplete (($i / $Requests) * 100)
    }
    Write-Progress -Activity $Label -Completed

    if ($times.Count -gt 0) {
        $sorted = $times | Sort-Object
        $avg = ($times | Measure-Object -Average).Average
        $min = $sorted[0]
        $max = $sorted[-1]
        $p50 = $sorted[[math]::Floor($sorted.Count * 0.5)]
        $p95 = $sorted[[math]::Floor($sorted.Count * 0.95)]
        $rps = [math]::Round($times.Count / (($times | Measure-Object -Sum).Sum / 1000), 2)

        Write-Host "  Requests     : $Requests  (errors: $errors)" -ForegroundColor White
        Write-Host "  Avg latency  : $([math]::Round($avg, 2)) ms" -ForegroundColor Green
        Write-Host "  Min / Max    : $([math]::Round($min, 2)) ms / $([math]::Round($max, 2)) ms"
        Write-Host "  P50 / P95    : $([math]::Round($p50, 2)) ms / $([math]::Round($p95, 2)) ms"
        Write-Host "  Requests/sec : $rps"
    } else {
        Write-Host "  ALL $Requests requests FAILED" -ForegroundColor Red
    }
}

###############################################################################
# 0. PRE-FLIGHT — check that all services are up
###############################################################################
Write-Section "0" "Service Health Checks"

$services = @(
    @{ Name = "Frontend (Nginx)";  Uri = "$FRONTEND" },
    @{ Name = "Backend (Node.js)"; Uri = "$BACKEND/api/health" },
    @{ Name = "ML Service (Python)"; Uri = "$ML_SVC/api/health" }
)
foreach ($svc in $services) {
    $r = Measure-Request -Uri $svc.Uri
    if ($r.Error) {
        Write-Host "  [FAIL] $($svc.Name) - $($svc.Uri)" -ForegroundColor Red
        Write-Host "         $($r.Error)" -ForegroundColor DarkRed
    } else {
        Write-Host "  [OK]   $($svc.Name) - $($r.TimeMs.ToString('F1')) ms" -ForegroundColor Green
    }
}

###############################################################################
# 1. API CRUD LATENCY — GET /api/health (100 requests, < 200 ms target)
###############################################################################
Write-Section "1" "API Health Endpoint Latency (100 requests, target < 200 ms)"
Run-LoadTest -Label "Health API" -Uri "$BACKEND/api/health" -Requests 100

###############################################################################
# 2. AUTHENTICATION LATENCY — POST /api/v1/auth/login (demo user)
###############################################################################
Write-Section "2" "Authentication Latency (50 requests, target < 200 ms)"

$loginBody = '{"email":"demo@example.com","password":"password123"}'
Run-LoadTest -Label "Auth Login" -Method "POST" -Uri "$BACKEND/api/v1/auth/login" -Body $loginBody -Requests 50

###############################################################################
# 3. ML PREDICTION LATENCY (< 500 ms target)
###############################################################################
Write-Section "3" "ML Prediction Latency (30 requests, target < 500 ms)"

$predictBody = '{"taskSize":2,"taskType":1,"priority":3,"resourceLoad":60}'
Run-LoadTest -Label "ML Predict" -Method "POST" -Uri "$ML_SVC/api/predict" -Body $predictBody -Requests 30

# Pause to let ML service rate limit window (60 req/min) reset before batch test
Write-Host "  Waiting 10s for ML rate-limit window to clear..." -ForegroundColor DarkGray
Start-Sleep -Seconds 10

###############################################################################
# 4. ML BATCH PREDICTION (10 tasks per request)
###############################################################################
Write-Section "4" "ML Batch Prediction — 10 tasks (20 requests)"

$batchBody = @'
{"tasks":[{"taskSize":1,"taskType":1,"priority":1,"resourceLoad":20},{"taskSize":2,"taskType":2,"priority":3,"resourceLoad":40},{"taskSize":3,"taskType":3,"priority":5,"resourceLoad":80},{"taskSize":1,"taskType":2,"priority":2,"resourceLoad":30},{"taskSize":2,"taskType":1,"priority":4,"resourceLoad":50},{"taskSize":3,"taskType":2,"priority":1,"resourceLoad":70},{"taskSize":1,"taskType":3,"priority":3,"resourceLoad":10},{"taskSize":2,"taskType":1,"priority":5,"resourceLoad":90},{"taskSize":3,"taskType":3,"priority":2,"resourceLoad":60},{"taskSize":1,"taskType":1,"priority":4,"resourceLoad":45}]}
'@
Run-LoadTest -Label "ML Batch" -Method "POST" -Uri "$ML_SVC/api/predict/batch" -Body $batchBody -Requests 20

###############################################################################
# 5. FRONTEND STATIC ASSET LATENCY
###############################################################################
Write-Section "5" "Frontend Static Asset Latency (50 requests)"
Run-LoadTest -Label "Frontend" -Uri "$FRONTEND" -Requests 50

###############################################################################
# 6. SINGLE SCHEDULING (Authenticated)
###############################################################################
Write-Section "6" "Scheduling Endpoint — Single Request (authenticated)"

# Obtain JWT token + session cookies
Write-Host "  Authenticating as demo user..." -ForegroundColor DarkGray
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $authRaw = Invoke-WebRequest -Method POST -Uri "$BACKEND/api/v1/auth/login" `
        -ContentType "application/json" -Body $loginBody `
        -WebSession $session -UseBasicParsing -ErrorAction Stop
    $parsed = $authRaw.Content | ConvertFrom-Json
    $token = $null
    if ($parsed.data -and $parsed.data.accessToken) { $token = $parsed.data.accessToken }
    elseif ($parsed.accessToken) { $token = $parsed.accessToken }
    # Also extract CSRF token from cookies if present
    $csrfCookie = $session.Cookies.GetCookies("$BACKEND") | Where-Object { $_.Name -eq 'csrf-token' }
    $csrfToken = if ($csrfCookie) { $csrfCookie.Value } else { '' }
} catch {
    $token = $null
    $csrfToken = ''
}

if ($token) {
    Write-Host "  Token received. Testing schedule endpoint..." -ForegroundColor Green
    $headers = @{ "Authorization" = "Bearer $token" }
    if ($csrfToken) { $headers["x-csrf-token"] = $csrfToken }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $schedResp = Invoke-WebRequest -Method POST -Uri "$BACKEND/api/v1/schedule" `
            -ContentType "application/json" `
            -Headers $headers -WebSession $session `
            -Body '{}' -UseBasicParsing -ErrorAction Stop
        $sw.Stop()
        Write-Host "  Status     : $($schedResp.StatusCode)" -ForegroundColor Green
        Write-Host "  Latency    : $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms" -ForegroundColor Green
    } catch {
        $sw.Stop()
        Write-Host "  Status     : $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Yellow
        Write-Host "  Latency    : $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms"
        Write-Host "  Note       : Schedule may require existing tasks. Latency is still valid." -ForegroundColor DarkGray
    }
} else {
    Write-Host "  Could not obtain auth token. Skipping authenticated schedule test." -ForegroundColor Yellow
    Write-Host "  (This is expected if demo mode is disabled in production.)" -ForegroundColor DarkGray
}

###############################################################################
# 7. FOG COMPUTING — Algorithm Comparison
###############################################################################
Write-Section "7" "Fog Computing Info Endpoint"

if ($token) {
    $headers = @{ "Authorization" = "Bearer $token" }
    if ($csrfToken) { $headers["x-csrf-token"] = $csrfToken }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $fogResp = Invoke-WebRequest -Method GET -Uri "$BACKEND/api/v1/fog/info" `
            -Headers $headers -WebSession $session `
            -UseBasicParsing -ErrorAction Stop
        $sw.Stop()
        Write-Host "  Status     : $($fogResp.StatusCode)" -ForegroundColor Green
        Write-Host "  Latency    : $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms" -ForegroundColor Green
    } catch {
        $sw.Stop()
        Write-Host "  Latency    : $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms"
    }
} else {
    Write-Host "  Skipped — no auth token." -ForegroundColor Yellow
}

###############################################################################
# 8. PDF REPORT GENERATION
###############################################################################
Write-Section "8" "PDF Report Generation"

if ($token) {
    $headers = @{ "Authorization" = "Bearer $token" }
    if ($csrfToken) { $headers["x-csrf-token"] = $csrfToken }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $pdfResp = Invoke-WebRequest -Method GET -Uri "$BACKEND/api/v1/reports/pdf/tasks" `
            -Headers $headers -WebSession $session `
            -OutFile ".\test-report-output.pdf" -UseBasicParsing -ErrorAction Stop
        $sw.Stop()
        $pdfSize = (Get-Item ".\test-report-output.pdf" -ErrorAction SilentlyContinue).Length
        Write-Host "  Status     : 200 OK" -ForegroundColor Green
        Write-Host "  Latency    : $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms" -ForegroundColor Green
        Write-Host "  File size  : $([math]::Round($pdfSize / 1024, 1)) KB"
        Remove-Item ".\test-report-output.pdf" -ErrorAction SilentlyContinue
    } catch {
        $sw.Stop()
        Write-Host "  Latency    : $([math]::Round($sw.Elapsed.TotalMilliseconds, 2)) ms"
        Write-Host "  Note       : PDF may need data in DB to generate." -ForegroundColor DarkGray
    }
} else {
    Write-Host "  Skipped — no auth token." -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  PERFORMANCE TESTS COMPLETE" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""
