# ML Task Scheduler - Docker Run Helper
# This script simplifies the process of building and running the ecosystem.

$ErrorActionPreference = "Stop"

function Write-Header {
    param($Text)
    Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

# 1. Check for .env file
Write-Header "Environment Check"
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
    } else {
        Write-Host "Error: .env file missing and .env.example not found!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ".env file found." -ForegroundColor Green
}

# 2. Build and Run
Write-Header "Docker Build & Run"
Write-Host "Executing: docker compose up --build -d" -ForegroundColor Gray
docker compose up --build -d

# 3. Status Dashboard
Write-Header "System Status"
Write-Host "Waiting for the frontend to become healthy..." -ForegroundColor Gray
$deadline = (Get-Date).AddMinutes(2)
do {
    $frontendStatus = docker compose ps frontend --format json 2>$null | ConvertFrom-Json
    if ($frontendStatus -and $frontendStatus.State -eq "running" -and $frontendStatus.Health -eq "healthy") {
        break
    }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Header "Access URLs"
Write-Host "Frontend:    http://localhost:3000" -ForegroundColor Green
Write-Host "Backend API: http://localhost:3001/api/health" -ForegroundColor Green
Write-Host "Prometheus:  http://localhost:9090" -ForegroundColor Green
Write-Host "Grafana:     http://localhost:3002 (admin/admin)" -ForegroundColor Green
Write-Host "ML Service:  http://localhost:5001/api/health" -ForegroundColor Green

if (-not $frontendStatus -or $frontendStatus.Health -ne "healthy") {
    Write-Host "Frontend is still starting. If the browser shows refused connection, wait a moment and refresh http://localhost:3000." -ForegroundColor Yellow
}

Write-Host "`nUse 'docker compose logs -f' to view real-time logs.`n" -ForegroundColor Gray
