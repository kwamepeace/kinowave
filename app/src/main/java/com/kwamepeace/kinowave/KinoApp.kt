package com.kwamepeace.kinowave

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.request.crossfade
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.CatalogRepository
import com.kwamepeace.kinowave.data.UserPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

sealed interface CatalogState {
    data object Loading : CatalogState
    data class Ready(val index: CatalogIndex) : CatalogState
    data class Failed(val message: String) : CatalogState
}

class KinoApp : Application(), SingletonImageLoader.Factory {

    val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }
    val catalogRepository by lazy { CatalogRepository(this, http) }
    val prefs by lazy { UserPrefs(this) }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val _catalog = MutableStateFlow<CatalogState>(CatalogState.Loading)
    /** Shared by the browse UI and the player so both see the same channels. */
    val catalog: StateFlow<CatalogState> = _catalog.asStateFlow()
    private var loadJob: Job? = null

    fun ensureCatalog() {
        if (loadJob != null && _catalog.value !is CatalogState.Failed) return
        _catalog.value = CatalogState.Loading
        loadJob = scope.launch {
            runCatching { CatalogIndex(catalogRepository.loadLocal()) }
                .onSuccess { _catalog.value = CatalogState.Ready(it) }
                .onFailure { _catalog.value = CatalogState.Failed(it.message ?: "Couldn't load channels") }
            catalogRepository.refresh()?.let { _catalog.value = CatalogState.Ready(CatalogIndex(it)) }
        }
    }

    /** Pull the latest catalog now. Returns true when a newer catalog was applied. */
    suspend fun refreshCatalog(): Boolean = withContext(Dispatchers.Default) {
        val fresh = catalogRepository.refresh(force = true) ?: return@withContext false
        _catalog.value = CatalogState.Ready(CatalogIndex(fresh))
        true
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context).crossfade(true).build()
}
