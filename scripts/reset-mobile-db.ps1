param(
  [string]$DeviceSerial = "",
  [string]$AppId = "com.healthsync.alert",
  [string]$DatabaseName = "healthsync_local.db"
)

$ErrorActionPreference = "Stop"

$script:AdbExecutable = $null

function Get-LocalPropertiesSdkPath {
  $localPropertiesPath = Join-Path $PSScriptRoot "..\mobile-app\android\local.properties"

  if (-not (Test-Path $localPropertiesPath)) {
    return $null
  }

  $content = Get-Content $localPropertiesPath

  foreach ($line in $content) {
    if ($line -notmatch "^sdk\.dir=(.+)$") {
      continue
    }

    $rawPath = $Matches[1].Trim()
    return $rawPath -replace "\\:", ":" -replace "\\\\", "\"
  }

  return $null
}

function Resolve-AdbExecutable {
  $adbFromPath = Get-Command adb -ErrorAction SilentlyContinue
  if ($adbFromPath) {
    return $adbFromPath.Source
  }

  $candidatePaths = @()

  $sdkPathFromLocalProperties = Get-LocalPropertiesSdkPath
  if (-not [string]::IsNullOrWhiteSpace($sdkPathFromLocalProperties)) {
    $candidatePaths += (Join-Path $sdkPathFromLocalProperties "platform-tools\adb.exe")
  }

  if (-not [string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
    $candidatePaths += (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe")
  }

  if (-not [string]::IsNullOrWhiteSpace($env:ANDROID_SDK_ROOT)) {
    $candidatePaths += (Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe")
  }

  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $candidatePaths += (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe")
  }

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Invoke-Adb {
  param(
    [string[]]$Arguments
  )

  if (-not $script:AdbExecutable) {
    throw "adb executable has not been resolved."
  }

  $adbArguments = @()

  if (-not [string]::IsNullOrWhiteSpace($DeviceSerial)) {
    $adbArguments += @("-s", $DeviceSerial)
  }

  $adbArguments += $Arguments

  & $script:AdbExecutable @adbArguments
  return $LASTEXITCODE
}

Write-Host "Resetting mobile SQLite database..."
Write-Host "App ID: $AppId"
Write-Host "Database: $DatabaseName"

$script:AdbExecutable = Resolve-AdbExecutable
if (-not $script:AdbExecutable) {
  throw "adb not found. Install Android platform-tools or configure mobile-app/android/local.properties with a valid sdk.dir."
}

Write-Host "Using adb: $script:AdbExecutable"

$devicesOutput = & $script:AdbExecutable devices
$onlineDevices = @($devicesOutput | Where-Object { $_ -match "\tdevice$" })
if ($onlineDevices.Count -eq 0) {
  throw "No Android device or emulator is connected. Start an emulator or connect a debug device, then run the reset again."
}

$databaseListing = & $script:AdbExecutable shell run-as $AppId ls databases
if ($LASTEXITCODE -ne 0) {
  throw "Unable to access app sandbox with run-as. Make sure the app is installed in debug mode and the device is connected."
}

Invoke-Adb -Arguments @("shell", "am", "force-stop", $AppId) | Out-Null

$databaseBaseName = [System.IO.Path]::GetFileNameWithoutExtension($DatabaseName)
$databaseFiles = @(
  $databaseListing |
    Where-Object {
      $_ -like "$DatabaseName*" -or
      $_ -like "$databaseBaseName*" -or
      $_ -like "*$databaseBaseName*.db*"
    } |
    ForEach-Object { "databases/$_" }
)

if ($databaseFiles.Count -eq 0) {
  throw "No matching database files were found under the app sandbox. Available files: $($databaseListing -join ', ')"
}

foreach ($file in $databaseFiles) {
  $exitCode = Invoke-Adb -Arguments @("shell", "run-as", $AppId, "rm", "-f", $file)
  if ($exitCode -ne 0) {
    throw "Failed to remove $file from device."
  }
}

Write-Host "Database reset complete. Restart the app to trigger table recreation."
