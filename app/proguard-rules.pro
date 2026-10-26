# kotlinx.serialization ships its own rules; keep our @Serializable model classes intact.
-keep,includedescriptorclasses class com.kwamepeace.kinowave.data.**$$serializer { *; }
-keepclassmembers class com.kwamepeace.kinowave.data.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
