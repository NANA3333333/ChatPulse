param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$launchRoot = Split-Path -Parent $PSScriptRoot
$launchRuntime = Join-Path $launchRoot '.runtime'
$launchLogDir = Join-Path $launchRoot 'logs\startup'
$launchNode = Join-Path $launchRuntime 'node20\node.exe'
$launchVite = Join-Path $launchRoot 'client\node_modules\vite\bin\vite.js'
$launchStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$launchServices = @()
New-Item -ItemType Directory -Force -Path $launchRuntime, $launchLogDir | Out-Null

# Serialize repeated double-clicks for this checkout.
$launchHash = [System.Security.Cryptography.SHA256]::Create()
$launchKey = [BitConverter]::ToString($launchHash.ComputeHash([Text.Encoding]::UTF8.GetBytes($launchRoot.ToLowerInvariant()))).Replace('-', '').Substring(0, 20)
$launchHash.Dispose()
$launchMutex = New-Object System.Threading.Mutex($false, "Local\ChatPulse-Startup-$launchKey")
$launchOwnsMutex = $false

function Get-Listener($port) {
    return Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-HttpReady($url, $headers = @{}) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch { return $false }
}

function Wait-HttpReady($url, $seconds, $headers = @{}, $startedProcess = $null) {
    $deadline = (Get-Date).AddSeconds($seconds)
    do {
        if (Test-HttpReady $url $headers) { return $true }
        if ($startedProcess -and $startedProcess.HasExited) { return $false }
        Start-Sleep -Milliseconds 400
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Start-ServiceProcess($name, $executable, $arguments, $directory) {
    $stdout = Join-Path $launchLogDir "$launchStamp-$name.out.log"
    $stderr = Join-Path $launchLogDir "$launchStamp-$name.err.log"
    # Each service has a separate hidden process and keeps running after this launcher closes.
    $service = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $directory `
        -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Set-Content -LiteralPath (Join-Path $launchRuntime "$name.pid") -Value $service.Id
    Write-Host "[starting] $name (PID $($service.Id))"
    return $service
}

function Ensure-NodeService($name, $port, $url, $arguments, $directory, $commandPattern) {
    $listener = Get-Listener $port
    if ($listener) {
        $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
        if (-not $existing -or $existing.ExecutablePath -ne $launchNode -or $existing.CommandLine -notmatch $commandPattern) {
            throw "Port $port is occupied by another process (PID $($listener.OwningProcess)). Close that application and try again."
        }
        if (-not (Wait-HttpReady $url 8)) {
            throw "$name is running but not responding. Use the Stop ChatPulse shortcut, then launch again."
        }
        Set-Content -LiteralPath (Join-Path $launchRuntime "$name.pid") -Value $existing.ProcessId
        Write-Host "[ready] $name already running (PID $($existing.ProcessId))"
        return [pscustomobject]@{name=$name; pid=$existing.ProcessId; reused=$true; url=$url}
    }
    $service = Start-ServiceProcess $name $launchNode $arguments $directory
    if (-not (Wait-HttpReady $url 45 @{} $service)) {
        throw "$name failed to start. See $launchLogDir\$launchStamp-$name.err.log"
    }
    Write-Host "[ready] $name"
    return [pscustomobject]@{name=$name; pid=$service.Id; reused=$false; url=$url}
}

try {
    try { $launchOwnsMutex = $launchMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $launchOwnsMutex = $true }
    if (-not $launchOwnsMutex) {
        Write-Host 'ChatPulse startup is already in progress. Please wait for the first launcher.'
        exit 0
    }
    Write-Host 'Starting ChatPulse...'
    if (-not (Test-Path -LiteralPath $launchNode)) { throw "Bundled Node is missing: $launchNode" }
    if (-not (Test-Path -LiteralPath $launchVite)) { throw 'Frontend dependencies are missing. Run npm run setup in the project folder.' }

    # Match the backend's Qdrant settings without displaying API keys.
    $envFile = Join-Path $launchRoot 'server\.env'
    if (Test-Path -LiteralPath $envFile) {
        foreach ($line in (Get-Content -LiteralPath $envFile)) {
            if ($line -match '^\s*(QDRANT_URL|QDRANT_ENABLED|QDRANT_API_KEY)\s*=\s*(.*?)\s*$') {
                $settingName = $Matches[1]
                $settingValue = $Matches[2].Trim()
                if ($settingValue -match '^"(.*)"$|^''(.*)''$') {
                    $settingValue = $settingValue.Substring(1, $settingValue.Length - 2)
                } else { $settingValue = ($settingValue -split '\s+#', 2)[0].Trim() }
                if ($null -eq [Environment]::GetEnvironmentVariable($settingName, 'Process')) {
                    [Environment]::SetEnvironmentVariable($settingName, $settingValue, 'Process')
                }
            }
        }
    }
    if ($env:QDRANT_ENABLED -ne '0') {
        $qdrantUrl = if ($env:QDRANT_URL) { $env:QDRANT_URL.TrimEnd('/') } else { 'http://127.0.0.1:6333' }
        $qdrantHeaders = @{}
        if ($env:QDRANT_API_KEY) { $qdrantHeaders['api-key'] = $env:QDRANT_API_KEY }
        if (Test-HttpReady "$qdrantUrl/collections" $qdrantHeaders) {
            Write-Host '[ready] memory service already running'
        } else {
            $qdrantUri = [Uri]$qdrantUrl
            if ($qdrantUri.Host -notin @('127.0.0.1', 'localhost') -or $qdrantUri.Port -ne 6333) {
                throw 'Configured Qdrant service is unavailable. Check the Qdrant server address and connection.'
            }
            if (Get-Listener 6333) { throw 'Port 6333 is occupied, but Qdrant is not responding. Check the memory service logs.' }
            $qdrantExe = Join-Path $launchRoot 'tools\qdrant\current\qdrant.exe'
            $qdrantConfig = Join-Path $launchRoot 'config\qdrant.yaml'
            if (-not (Test-Path -LiteralPath $qdrantExe)) { throw "Qdrant is missing: $qdrantExe" }
            $qdrantProcess = Start-ServiceProcess 'qdrant' $qdrantExe @('--config-path', ('"{0}"' -f $qdrantConfig)) $launchRoot
            if (-not (Wait-HttpReady "$qdrantUrl/collections" 30 $qdrantHeaders $qdrantProcess)) {
                throw "Memory service failed to start. See $launchLogDir\$launchStamp-qdrant.err.log"
            }
            Write-Host '[ready] memory service'
        }
    }

    $launchServices += Ensure-NodeService 'server' 8000 'http://127.0.0.1:8000/' @('index.js') `
        (Join-Path $launchRoot 'server') '\bindex\.js\b'
    $launchServices += Ensure-NodeService 'client' 5173 'http://127.0.0.1:5173/' `
        @(('"{0}"' -f $launchVite), '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
        (Join-Path $launchRoot 'client') ([regex]::Escape($launchVite))

    [pscustomobject]@{success=$true; time=(Get-Date).ToString('o'); services=$launchServices; logs=$launchLogDir} |
        ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $launchRuntime 'last-startup.json') -Encoding UTF8
    Write-Host 'ChatPulse is ready: http://127.0.0.1:5173'
    Write-Host 'You can close this launcher. The services run in the background.'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
} catch {
    $failure = $_.Exception.Message
    if ($launchOwnsMutex) {
        [pscustomobject]@{success=$false; time=(Get-Date).ToString('o'); error=$failure; logs=$launchLogDir} |
            ConvertTo-Json | Set-Content -LiteralPath (Join-Path $launchRuntime 'last-startup.json') -Encoding UTF8
    }
    Write-Host "[failed] $failure" -ForegroundColor Red
    exit 1
} finally {
    if ($launchOwnsMutex) { $launchMutex.ReleaseMutex() }
    $launchMutex.Dispose()
}
