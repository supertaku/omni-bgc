$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $env:USERPROFILE '.gradle/caches/modules-2/files-2.1'
function CachedJar([string]$coordinate, [string]$version) {
  $jar = Get-ChildItem (Join-Path $cacheRoot "$coordinate/$version") -Recurse -Filter '*.jar' | Select-Object -First 1 -ExpandProperty FullName
  if (!$jar) { throw "Required cached JAR unavailable: $coordinate/$version" }
  return $jar
}
$java = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr/bin/java.exe'
$compiler = CachedJar 'org.jetbrains.kotlin/kotlin-compiler-embeddable' '2.3.20'
$stdlib = CachedJar 'org.jetbrains.kotlin/kotlin-stdlib' '2.3.20'
$reflect = CachedJar 'org.jetbrains.kotlin/kotlin-reflect' '2.3.20'
$scriptRuntime = CachedJar 'org.jetbrains.kotlin/kotlin-script-runtime' '2.3.20'
$annotations = CachedJar 'org.jetbrains/annotations' '23.0.0'
$coroutines = CachedJar 'org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm' '1.9.0'
$gson = CachedJar 'com.google.code.gson/gson' '2.8.9'
$sdk = Get-ChildItem (Join-Path $env:USERPROFILE '.gradle/caches/9.3.1/transforms') -Recurse -Filter 'classes.jar' | Where-Object FullName -like '*litertlm-android-0.18.0*' | Select-Object -First 1 -ExpandProperty FullName
if (!$sdk) { throw 'Cached LiteRT-LM 0.18.0 classes.jar unavailable; build Android first.' }
$output = Join-Path $projectRoot 'artifacts/check-native-message-codec'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$dependencies = "$sdk;$gson;$stdlib;$annotations"
& $java -cp "$compiler;$stdlib;$reflect;$scriptRuntime;$coroutines;$annotations" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath $dependencies -d $output (Join-Path $projectRoot 'modules/omni-local-ai/android/src/main/java/expo/modules/omnilocalai/NativeMessages.kt') (Join-Path $PSScriptRoot 'fixtures/NativeMessagesCheck.kt')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $java -cp "$output;$dependencies" expo.modules.omnilocalai.NativeMessagesCheckKt
exit $LASTEXITCODE
