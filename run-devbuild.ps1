$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
$env:ANDROID_HOME = 'C:\Android\android-sdk'
$env:ANDROID_SDK_ROOT = 'C:\Android\android-sdk'
$env:Path = "$env:JAVA_HOME\bin;C:\Android\android-sdk\platform-tools;" + $env:Path
$ErrorActionPreference = 'Continue'
Set-Location 'c:\Users\ankit\Documents\Projects\beatify'
$log = "$env:TEMP\expo-android.log"
"=== BUILD START $(Get-Date) ===" | Tee-Object -FilePath $log
Write-Host "Step 1/3: Building debug APK with Gradle (this takes a while on first run)..."
cd android
.\gradlew.bat assembleDebug --console=plain 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { Write-Host "GRADLE BUILD FAILED with code $LASTEXITCODE. See $log" ; pause; exit 1 }
cd ..
$apk = 'c:\Users\ankit\Documents\Projects\beatify\android\app\build\outputs\apk\debug\app-debug.apk'
Write-Host "Step 2/3: Installing APK to emulator-5554..."
adb -s emulator-5554 install -r $apk 2>&1 | Tee-Object -FilePath $log -Append
Write-Host "Step 3/3: Setting up reverse proxy + starting Metro for live reload..."
adb -s emulator-5554 reverse tcp:8081 tcp:8081 2>&1 | Tee-Object -FilePath $log -Append
adb -s emulator-5554 reverse tcp:19000 tcp:19000 2>&1 | Tee-Object -FilePath $log -Append
adb -s emulator-5554 shell am start -n com.ankydv.beatify/com.ankydv.beatify.MainActivity 2>&1 | Tee-Object -FilePath $log -Append
Write-Host "Starting Expo dev server (leave this window open)..."
npx expo start --dev-client 2>&1 | Tee-Object -FilePath $log -Append

