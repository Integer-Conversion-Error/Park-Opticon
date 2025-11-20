# Set Android SDK environment variables
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "Checking emulator status..." -ForegroundColor Cyan
$emulatorRunning = Get-Process | Where-Object {$_.ProcessName -eq "qemu-system-x86_64"}

if (-not $emulatorRunning) {
    Write-Host "Starting Android emulator..." -ForegroundColor Yellow
    Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList "-avd", "Pixel_7_Pro_API_28"
    Write-Host "Waiting for emulator to boot (this may take 1-2 minutes)..." -ForegroundColor Yellow
    
    # Wait for emulator to be online
    $timeout = 120
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 5
        $elapsed += 5
        $devices = & "$env:ANDROID_HOME\platform-tools\adb.exe" devices
        if ($devices -match "device$") {
            Write-Host "Emulator is online!" -ForegroundColor Green
            break
        }
        Write-Host "Still waiting... ($elapsed seconds)" -ForegroundColor Gray
    }
} else {
    Write-Host "Emulator is already running!" -ForegroundColor Green
}

Write-Host "`nStarting Expo..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\parkopticon"
npx expo start
