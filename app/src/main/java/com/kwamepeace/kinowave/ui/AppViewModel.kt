package com.kwamepeace.kinowave.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kwamepeace.kinowave.CatalogState
import com.kwamepeace.kinowave.KinoApp
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Collection
import com.kwamepeace.kinowave.player.PlayerLauncher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Locale

enum class HomeFilter(val label: String) { All("For You"), Movies("Movies"), Tv("TV & Live") }

data class HomeContent(
    val hero: List<Pair<Collection, Channel>> = emptyList(),
    val top10: List<Channel> = emptyList(),
    val regionCode: String? = null,
    val rows: List<Pair<Collection, List<Channel>>> = emptyList(),
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as KinoApp
    val prefs = app.prefs

    val catalog: StateFlow<CatalogState> = app.catalog
    val homeFilter = MutableStateFlow(HomeFilter.All)

    /** The viewer's country from the phone's locale, e.g. "GH" for en-GH. */
    val regionCode: String = Locale.getDefault().country.uppercase().let { if (it == "GB") "UK" else it }

    private val _refreshing = MutableStateFlow(false)
    val refreshing = _refreshing.asStateFlow()

    init {
        app.ensureCatalog()
    }

    val home: StateFlow<HomeContent> =
        combine(catalog, homeFilter, prefs.hideUnreliable) { state, filter, hide ->
            val index = (state as? CatalogState.Ready)?.index ?: return@combine HomeContent()
            buildHome(index, filter, hide)
        }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeContent())

    fun visible(list: List<Channel>): List<Channel> =
        if (prefs.hideUnreliable.value) list.filterNot { it.isGeoBlocked || it.isPartTime } else list

    private fun buildHome(index: CatalogIndex, filter: HomeFilter, hide: Boolean): HomeContent {
        fun clean(list: List<Channel>) = if (hide) list.filterNot { it.isGeoBlocked || it.isPartTime } else list

        val rows = index.rows
            .filter { (col, _) ->
                when (filter) {
                    HomeFilter.All -> col.id != "faith"
                    HomeFilter.Movies -> col.tab == "movies" || col.tab == "all"
                    HomeFilter.Tv -> col.tab == "tv" || col.tab == "all"
                }
            }
            .map { (col, list) -> col to clean(list).take(40) }
            .filter { it.second.size >= 4 }

        // Hero: the best channel with a logo from each of the leading rows
        val used = HashSet<String>()
        val hero = rows.take(8).mapNotNull { (col, list) ->
            list.firstOrNull { it.logo != null && it.id !in used }?.also { used += it.id }?.let { col to it }
        }

        val region = regionCode.takeIf { code -> index.channels.count { it.country == code } >= 10 }
        val regional = region?.let { code ->
            clean(index.byCountry(code)).filterNot { "religious" in it.categories || "shop" in it.categories }
        }
        val top10 = (regional ?: clean(index.rows.firstOrNull { it.first.id == "hollywood" }?.second ?: emptyList()))
            .filter { it.logo != null }
            .take(10)

        return HomeContent(hero = hero, top10 = top10, regionCode = region, rows = rows)
    }

    fun toggleMyList(channel: Channel) = prefs.toggleMyList(channel.id)

    fun play(context: Context, channel: Channel, queue: List<Channel> = emptyList(), streamIndex: Int = 0) {
        prefs.markWatched(channel.id)
        PlayerLauncher.play(context, channel, queue, streamIndex)
    }

    fun refreshCatalog(onDone: (Boolean) -> Unit) {
        if (_refreshing.value) return
        _refreshing.value = true
        viewModelScope.launch {
            val updated = app.refreshCatalog()
            _refreshing.value = false
            onDone(updated)
        }
    }

    fun retryLoad() = app.ensureCatalog()
}
