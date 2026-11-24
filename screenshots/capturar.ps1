# Captures screenshots of the live OmniConvert site with headless Edge (DevTools protocol).
# Usage:  powershell -ExecutionPolicy Bypass -File screenshots\capturar.ps1 -Saida antes
param(
  [string]$Saida = 'antes',
  [string]$Url = 'https://bragaty.github.io/omniconvert/'
)

$ErrorActionPreference = 'Stop'
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
$outDir = Join-Path $PSScriptRoot $Saida
New-Item -ItemType Directory -Force $outDir | Out-Null

$port = 9333
$profile = Join-Path $env:TEMP "omniconvert-shots-$([guid]::NewGuid().ToString('N'))"
$proc = Start-Process $edge -ArgumentList "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--remote-debugging-port=$port", "--user-data-dir=$profile", "about:blank" -PassThru

try {
  $target = $null
  for ($i = 0; $i -lt 40 -and -not $target; $i++) {
    Start-Sleep -Milliseconds 250
    try { $target = (Invoke-RestMethod "http://127.0.0.1:$port/json/list") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch {}
  }
  if (-not $target) { throw 'Edge DevTools não respondeu.' }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
  $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $script:msgId = 0

  function Send-Cdp([string]$method, $params = @{}) {
    $script:msgId++
    $id = $script:msgId
    $json = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, [Threading.CancellationToken]::None).Wait()
    $buffer = New-Object byte[] 1048576
    while ($true) {
      $sb = New-Object System.Text.StringBuilder
      do {
        $res = $ws.ReceiveAsync([ArraySegment[byte]]$buffer, [Threading.CancellationToken]::None).Result
        [void]$sb.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $res.Count))
      } while (-not $res.EndOfMessage)
      $msg = $sb.ToString() | ConvertFrom-Json
      if ($msg.id -eq $id) {
        if ($msg.error) { throw "$method falhou: $($msg.error.message)" }
        return $msg.result
      }
    }
  }

  function Set-Viewport([int]$w, [int]$h, [bool]$mobile) {
    Send-Cdp 'Emulation.setDeviceMetricsOverride' @{ width = $w; height = $h; deviceScaleFactor = 1; mobile = $mobile } | Out-Null
  }

  function Open-Page {
    Send-Cdp 'Page.navigate' @{ url = $Url } | Out-Null
    Start-Sleep -Seconds 5   # page + fonts + first animation frame
  }

  function Click-Tab([string]$text) {
    $js = "(() => { const b = [...document.querySelectorAll('header button')].find(x => x.textContent.includes('$text')); if (b) { b.click(); return true } return false })()"
    $r = Send-Cdp 'Runtime.evaluate' @{ expression = $js; returnByValue = $true }
    Start-Sleep -Seconds 2
    return $r.result.value
  }

  function Save-Shot([string]$name, [bool]$fullPage) {
    $params = @{ format = 'png' }
    if ($fullPage) {
      $m = Send-Cdp 'Page.getLayoutMetrics'
      $h = [Math]::Min([int][Math]::Ceiling($m.cssContentSize.height), 12000)
      $w = [int][Math]::Ceiling($m.cssLayoutViewport.clientWidth)
      $params.captureBeyondViewport = $true
      $params.clip = @{ x = 0; y = 0; width = $w; height = $h; scale = 1 }
    }
    $r = Send-Cdp 'Page.captureScreenshot' $params
    $file = Join-Path $outDir "$name.png"
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($r.data))
    Write-Output "salvo: $file"
  }

  Send-Cdp 'Page.enable' | Out-Null
  Send-Cdp 'Runtime.enable' | Out-Null

  # Desktop
  Set-Viewport 1440 900 $false
  Open-Page
  Save-Shot '01-desktop-topo' $false
  Save-Shot '02-desktop-pagina-inteira' $true
  if (Click-Tab 'PDF') { Save-Shot '03-desktop-ferramentas-pdf' $true }
  Open-Page
  if (Click-Tab 'udio') { Save-Shot '04-desktop-video-audio' $true }

  # Mobile
  Set-Viewport 390 844 $true
  Open-Page
  Save-Shot '05-mobile-topo' $false
  Save-Shot '06-mobile-pagina-inteira' $true

  $ws.Dispose()
}
finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -ge $proc.StartTime } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
}
