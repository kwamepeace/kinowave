package com.kwamepeace.kinowave.data

import android.content.Context
import com.kwamepeace.kinowave.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.InputStream
import java.util.concurrent.TimeUnit

/**
 * Loads the channel catalog: the cached copy from the last online refresh if there is one,
 * otherwise the copy bundled in the APK at build time. [refresh] pulls the latest catalog that the
 * GitHub Pages workflow publishes every day.
 */
class CatalogRepository(private val context: Context, private val http: OkHttpClient) {

    private val json = Json { ignoreUnknownKeys = true }
    private val cacheFile get() = File(context.filesDir, "catalog.json")
    private val prefs = context.getSharedPreferences("catalog", Context.MODE_PRIVATE)

    suspend fun loadLocal(): Catalog = withContext(Dispatchers.IO) {
        val cached = cacheFile
        if (cached.exists()) {
            runCatching { cached.inputStream().use(::decode) }.getOrNull()?.let { return@withContext it }
            cached.delete()
        }
        context.assets.open("catalog.json").use(::decode)
    }

    /** Returns a fresher catalog, or null when there is nothing newer (or no network). */
    suspend fun refresh(force: Boolean = false): Catalog? = withContext(Dispatchers.IO) {
        val url = BuildConfig.CATALOG_URL
        if (url.isBlank()) return@withContext null
        val last = prefs.getLong(KEY_LAST_REFRESH, 0L)
        if (!force && System.currentTimeMillis() - last < REFRESH_INTERVAL_MS) return@withContext null

        runCatching {
            val request = Request.Builder().url(url).build()
            http.newBuilder().callTimeout(45, TimeUnit.SECONDS).build().newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@runCatching null
                val tmp = File(context.cacheDir, "catalog.download")
                response.body?.byteStream()?.use { input -> tmp.outputStream().use { input.copyTo(it) } }
                val catalog = tmp.inputStream().use(::decode)
                if (catalog.channels.isEmpty()) return@runCatching null
                tmp.copyTo(cacheFile, overwrite = true)
                tmp.delete()
                prefs.edit().putLong(KEY_LAST_REFRESH, System.currentTimeMillis()).apply()
                catalog
            }
        }.getOrNull()
    }

    @OptIn(ExperimentalSerializationApi::class)
    private fun decode(input: InputStream): Catalog = json.decodeFromStream(Catalog.serializer(), input.buffered())

    private companion object {
        const val KEY_LAST_REFRESH = "last_refresh"
        const val REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000L
    }
}
