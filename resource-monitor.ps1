###############################################################################
#  ML Task Scheduler - Resource Usage Monitor (Windows PowerShell)
#  Run: .\resource-monitor.ps1
#  Prerequisite: Docker containers must be running
###############################################################################

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  ML TASK SCHEDULER — RESOURCE USAGE SNAPSHOT" -ForegroundColor Yellow
Write-Host "  Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host ("=" * 70) -ForegroundColor Cyan

###############################################################################
# 1. DOCKER CONTAINER STATS (CPU & Memory per service)
###############################################################################
Write-Host ""
Write-Host "--- Per-Service Resource Usage (Docker) ---" -ForegroundColor Cyan
Write-Host ""

# Get a one-shot stats snapshot
$stats = docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" 2>$null

if (-not $stats) {
    Write-Host "  Docker is not running or no containers found." -ForegroundColor Red
    Write-Host "  Start containers with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# Pretty table header
Write-Host ("{0,-30} {1,10} {2,25} {3,8} {4,20} {5,20}" -f "CONTAINER", "CPU %", "MEM USAGE / LIMIT", "MEM %", "NET I/O", "BLOCK I/O") -ForegroundColor White
Write-Host ("-" * 120)

$totalCpu = 0.0
$totalMemMB = 0.0

foreach ($line in $stats) {
    $parts = $line -split "`t"
    if ($parts.Count -ge 6) {
        $name   = $parts[0]
        $cpu    = $parts[1]
        $mem    = $parts[2]
        $memPct = $parts[3]
        $net    = $parts[4]
        $block  = $parts[5]

        # Color code by service type
        $color = "Gray"
        if ($name -match "frontend")  { $color = "Blue" }
        if ($name -match "backend")   { $color = "Green" }
        if ($name -match "ml")        { $color = "Magenta" }
        if ($name -match "db|postgres") { $color = "Yellow" }
        if ($name -match "redis")     { $color = "Red" }

        Write-Host ("{0,-30} {1,10} {2,25} {3,8} {4,20} {5,20}" -f $name, $cpu, $mem, $memPct, $net, $block) -ForegroundColor $color

        # Accumulate totals
        $cpuNum = [double]($cpu -replace '%','')
        $totalCpu += $cpuNum

        # Extract memory in MiB from strings like "180MiB / 512MiB" or "15.2MiB / 256MiB"
        if ($mem -match '([\d.]+)\s*(MiB|GiB)') {
            $memVal = [double]$Matches[1]
            if ($Matches[2] -eq 'GiB') { $memVal *= 1024 }
            $totalMemMB += $memVal
        }
    }
}

Write-Host ("-" * 120)
Write-Host ("{0,-30} {1,10} {2,25}" -f "TOTAL", "$([math]::Round($totalCpu,2))%", "$([math]::Round($totalMemMB,1)) MiB") -ForegroundColor White

###############################################################################
# 2. EXPECTED VS ACTUAL COMPARISON TABLE
###############################################################################
Write-Host ""
Write-Host "--- Expected vs Actual Resource Usage ---" -ForegroundColor Cyan
Write-Host ""

$expectations = @(
    @{ Service = "Frontend (Nginx)";   ExpCPU = "0.1-0.5%";    ExpMem = "15-32 MB"  },
    @{ Service = "Backend (Node.js)";  ExpCPU = "2-5%";        ExpMem = "180-220 MB" },
    @{ Service = "ML Service (Python)";ExpCPU = "1-3% / 12-25%"; ExpMem = "250-320 MB" },
    @{ Service = "PostgreSQL";         ExpCPU = "1-2%";        ExpMem = "200-280 MB" },
    @{ Service = "Redis";              ExpCPU = "0.5-1%";      ExpMem = "20-35 MB"   }
)

Write-Host ("{0,-25} {1,18} {2,18}" -f "SERVICE", "EXPECTED CPU", "EXPECTED MEM") -ForegroundColor White
Write-Host ("-" * 65)
foreach ($e in $expectations) {
    Write-Host ("{0,-25} {1,18} {2,18}" -f $e.Service, $e.ExpCPU, $e.ExpMem)
}
Write-Host ("-" * 65)
Write-Host ("{0,-25} {1,18} {2,18}" -f "TOTAL SYSTEM", "~5-11%", "~665-887 MB") -ForegroundColor White

###############################################################################
# 3. HOST SYSTEM RESOURCE USAGE
###############################################################################
Write-Host ""
Write-Host "--- Host System Resources ---" -ForegroundColor Cyan
Write-Host ""

# CPU info
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cpuLoad = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
Write-Host "  CPU        : $($cpu.Name)"
Write-Host "  CPU Cores  : $($cpu.NumberOfLogicalProcessors)"
Write-Host "  CPU Load   : $cpuLoad %" -ForegroundColor $(if ($cpuLoad -lt 50) { "Green" } else { "Yellow" })

# Memory info
$os = Get-CimInstance Win32_OperatingSystem
$totalMem  = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
$freeMem   = [math]::Round($os.FreePhysicalMemory / 1024, 0)
$usedMem   = $totalMem - $freeMem
$usedPct   = [math]::Round(($usedMem / $totalMem) * 100, 1)
Write-Host "  Total RAM  : $totalMem MB"
Write-Host "  Used RAM   : $usedMem MB ($usedPct %)" -ForegroundColor $(if ($usedPct -lt 80) { "Green" } else { "Red" })
Write-Host "  Free RAM   : $freeMem MB"

###############################################################################
# 4. DOCKER DISK USAGE
###############################################################################
Write-Host ""
Write-Host "--- Docker Disk Usage ---" -ForegroundColor Cyan
docker system df 2>$null

###############################################################################
# SUMMARY
###############################################################################
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  RESOURCE SNAPSHOT COMPLETE" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tip: Run this script during load testing to capture peak usage." -ForegroundColor DarkGray
Write-Host "  Tip: Use 'docker stats' in a separate terminal for live monitoring." -ForegroundColor DarkGray
Write-Host ""
