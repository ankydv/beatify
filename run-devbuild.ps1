$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
$env:ANDROID_HOME = 'C:\Android\android-sdk'
$env:ANDROID_SDK_ROOT = 'C:\Android\android-sdk'
$env:Path = "$env:JAVA_HOME\bin;C:\Android\android-sdk\platform-tools;" + $env:Path
$ErrorActionPreference = 'Continue'
Set-Location 'c:\Users\ankit\Documents\Projects\beatify'
$log = "$env:TEMP\expo-android.log"
"=== BUILD START $(Get-Date) ===" | Tee-Object -FilePath $log
Write-Host "Step 1/3: Building debug APK with Gradle..."
cd android
.\gradlew.bat assembleDebug --console=plain 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { Write-Host "GRADLE BUILD FAILED with code $LASTEXITCODE. See $log" ; pause; exit 1 }
cd ..
$apk = 'c:\Users\ankit\Documents\Projects\beatify\android\app\build\outputs\apk\debug\app-debug.apk'

$devices = adb devices | Select-String -Pattern "\b(device)\b" | ForEach-Object { ($_ -split "\s+")[0] }
foreach ($dev in $devices) {
    Write-Host "Step 2/3: Installing APK to $dev..."
    adb -s $dev install -r $apk 2>&1 | Tee-Object -FilePath $log -Append
    Write-Host "Step 3/3: Setting up reverse proxy for $dev..."
    adb -s $dev reverse tcp:8081 tcp:8081 2>&1 | Tee-Object -FilePath $log -Append
    adb -s $dev reverse tcp:19000 tcp:19000 2>&1 | Tee-Object -FilePath $log -Append
    adb -s $dev reverse tcp:9001 tcp:9001 2>&1 | Tee-Object -FilePath $log -Append
    adb -s $dev shell am start -n com.ankydv.beatify.dev/.MainActivity 2>&1 | Tee-Object -FilePath $log -Append
}

Write-Host "Starting Expo dev server (leave this window open)..."
npx expo start --dev-client 2>&1 | Tee-Object -FilePath $log -Append
