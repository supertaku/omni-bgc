param(
  [string]$JavaHome = 'C:/Program Files/Android/Android Studio/jbr',
  [string]$SdkRoot = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Android/Sdk'),
  [switch]$SkipPrebuild
)
$ErrorActionPreference='Stop'
$mobileRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repositoryRoot=[IO.Path]::GetFullPath((Join-Path $mobileRoot '../..'))
$cache=Join-Path $repositoryRoot '.g'
$artifacts=Join-Path $mobileRoot 'artifacts'
if(-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))){throw 'Java runtime missing; pass -JavaHome.'}
if(-not (Test-Path -LiteralPath $SdkRoot)){throw 'Existing Android SDK missing; pass -SdkRoot.'}
if(-not (Test-Path -LiteralPath (Join-Path $mobileRoot 'assets/generated/omni/manifest.json'))){throw 'Build the exact reviewed internal pilot first; see pipelines/map-pack/README.md.'}
if(-not (Test-Path -LiteralPath (Join-Path $mobileRoot 'assets/generated/directory/places.json'))){throw 'Build the local directory with pipelines/etl/place-intake/build_ui_directory.py first.'}
if(-not (Test-Path -LiteralPath (Join-Path $mobileRoot 'assets/fonts/NunitoSans-Regular.ttf'))){throw 'Build the retained OFL fonts with pipelines/etl/place-intake/build_ui_fonts.py first.'}
$directoryManifest=Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'data/manifests/ui-directory.json') | ConvertFrom-Json
if((Get-FileHash -LiteralPath (Join-Path $mobileRoot 'assets/generated/directory/places.json') -Algorithm SHA256).Hash.ToLower() -ne $directoryManifest.output_sha256){throw 'Bundled directory checksum mismatch.'}
$fontRoot=Join-Path $mobileRoot 'assets/fonts'
$fontManifest=Get-Content -Raw -LiteralPath (Join-Path $fontRoot 'manifest.json') | ConvertFrom-Json
foreach($fontEntry in $fontManifest.files){
  if($fontEntry.path -match '[/\\]' -or $fontEntry.path -in @('.','..')){throw 'Invalid font inventory path.'}
  $fontFile=Join-Path $fontRoot $fontEntry.path
  if((Get-Item -LiteralPath $fontFile).Length -ne $fontEntry.bytes -or (Get-FileHash -LiteralPath $fontFile -Algorithm SHA256).Hash.ToLower() -ne $fontEntry.sha256){throw 'Bundled font/license checksum mismatch.'}
}
if(-not $cache.StartsWith($repositoryRoot+[IO.Path]::DirectorySeparatorChar)){throw 'Gradle cache outside repository'}
$previous=@{}
foreach($key in @('JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','NODE_OPTIONS','NODE_ENV','EXPO_PUBLIC_NATIVE_QA')){$previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
Push-Location $mobileRoot
try {
  $env:JAVA_HOME=$JavaHome;$env:ANDROID_HOME=$SdkRoot;$env:ANDROID_SDK_ROOT=$SdkRoot
  $env:NODE_OPTIONS='--dns-result-order=ipv4first';$env:NODE_ENV='production';$env:EXPO_PUBLIC_NATIVE_QA='0'
  New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
  if($SkipPrebuild){
    $nativeInventory=Join-Path $mobileRoot 'android/app/src/main/assets/omni/manifest.json'
    if(-not (Test-Path -LiteralPath $nativeInventory) -or (Get-FileHash -LiteralPath $nativeInventory -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $mobileRoot 'assets/generated/omni/manifest.json') -Algorithm SHA256).Hash){throw 'Prebuild cannot be skipped when native resources differ.'}
  }else{
    & node node_modules/expo/bin/cli prebuild --platform android --no-install 2>&1 | Tee-Object -FilePath (Join-Path $artifacts 'preview-prebuild.log')
    if($LASTEXITCODE -ne 0){throw 'Prebuild failed; see preview-prebuild.log'}
  }
  & ./android/gradlew.bat -p android :app:assembleRelease --gradle-user-home $cache --max-workers 2 -PreactNativeArchitectures=arm64-v8a 2>&1 | Tee-Object -FilePath (Join-Path $artifacts 'preview-build.log')
  if($LASTEXITCODE -ne 0){throw 'Build failed; see preview-build.log'}
  $source=Join-Path $mobileRoot 'android/app/build/outputs/apk/release/app-release.apk'
  $target=Join-Path $artifacts 'Omni-BGC-preview-arm64.apk'
  if(Test-Path -LiteralPath $target){$oldHash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower();Copy-Item -LiteralPath $target -Destination (Join-Path $artifacts ('preview-'+$oldHash+'.apk'))}
  Copy-Item -LiteralPath $source -Destination $target
  Get-FileHash -LiteralPath $target -Algorithm SHA256
  Write-Output 'Internal development-key-signed preview only. Build success does not establish device or production acceptance.'
} finally {
  Pop-Location
  foreach($key in $previous.Keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}
}
