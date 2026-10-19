# LiteRT 0.18.0 AAR ships JNI callbacks/data classes without consumer rules.
# Preserve their JVM names, members and signatures used from the native library.
-keep class com.google.ai.edge.litertlm.** { *; }
-keep class expo.modules.omnilocalai.OmniLocalAiModule { *; }
