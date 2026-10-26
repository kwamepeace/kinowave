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
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.data.MovieRow
import com.kwamepeace.kinowave.data.Profile
import com.kwamepeace.kinowave.data.ProfileStore
import com.kwamepeace.kinowave.data.Recommender
import com.kwamepeace.kinowave.data.UserPrefs
import com.kwamepeace.kinowave.player.PlayerLauncher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Locale

enum class HomeFilter(val label: String) { All("For You"), Movies("Movies"), Tv("TV & Live") }

/** One card in the hero carousel: a live channel or an on-demand film. */
data class HeroItem(
    val key: String,
    val title: String,
    val pill: String,
    val colors: List<String>,
    val channel: Channel? = null,
    val movie: Movie? = null,
)

/** A row on Home. */
sealed interface HomeRow {
    val key: String

    data class Channels(val collection: Collection, val channels: List<Channel>) : HomeRow {
        override val key get() = "c-${collection.id}"
    }

    data class Movies(val row: MovieRow, val movies: List<Movie>) : HomeRow {
        override val key get() = "m-${row.id}"
    }
}

data class HomeContent(
    val hero: List<HeroItem> = emptyList(),
    val top10: List<Channel> = emptyList(),
    val regionCode: String? = null,
    val rows: List<HomeRow> = emptyList(),
)

@OptIn(ExperimentalCoroutinesApi::class)
class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as KinoApp
    val profiles = app.profiles
    val settings = app.settings

    /** The active profile's lists and settings. Screens are keyed by profile, so reading this is safe. */
    val prefs: UserPrefs get() = app.prefs

    val catalog: StateFlow<CatalogState> = app.catalog
    val activeProfile: StateFlow<Profile?> = profiles.active
    val homeFilter = MutableStateFlow(HomeFilter.All)

    /** The viewer's country from the phone's locale, e.g. "GH" for en-GH. */
    val regionCode: String = Locale.getDefault().country.uppercase().let { if (it == "GB") "UK" else it }

    private val _refreshing = MutableStateFlow(false)
    val refreshing = _refreshing.asStateFlow()

    init {
        app.ensureCatalog()
    }

    private var kidsCache: Pair<CatalogIndex, CatalogIndex>? = null

    /** The catalog as the active profile sees it: kids-only content for Kids profiles. */
    val profileIndex: StateFlow<CatalogIndex?> =
        combine(catalog, activeProfile) { state, profile ->
            val index = (state as? CatalogState.Ready)?.index ?: return@combine null
            if (profile?.kids != true) return@combine index
            kidsCache?.takeIf { it.first === index }?.second
                ?: index.forKids().also { kidsCache = index to it }
        }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** The phone's language as an iptv-org code ("eng", "hin", "fra"...), a cold-start hint for For You. */
    private val languageCode: String = Recommender.languageCode(Locale.getDefault())

    val home: StateFlow<HomeContent> =
        activeProfile.flatMapLatest { profile ->
            val prefs = app.prefsFor(profile?.id ?: ProfileStore.MAIN_PROFILE_ID)
            combine(profileIndex, homeFilter, prefs.hideUnreliable, prefs.stats, prefs.myList) { index, filter, hide, stats, saved ->
                if (index == null) HomeContent()
                else buildHome(index, filter, hide, Recommender(index, stats, saved, regionCode, languageCode), profile?.name)
            }
        }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeContent())

    fun visible(list: List<Channel>): List<Channel> =
        if (prefs.hideUnreliable.value) list.filterNot { it.isGeoBlocked || it.isPartTime } else list

    private fun buildHome(index: CatalogIndex, filter: HomeFilter, hide: Boolean, rec: Recommender, name: String?): HomeContent {
        fun unreliable(ch: Channel) = ch.isGeoBlocked || ch.isPartTime
        fun clean(list: List<Channel>) = if (hide) list.filterNot(::unreliable) else list

        // Curated rows, each re-ranked for this profile, and the rows themselves ordered by taste
        val channelRows = index.rows
            .filter { (col, _) ->
                when (filter) {
                    HomeFilter.All -> col.id != "faith"
                    HomeFilter.Movies -> col.tab == "movies" || col.tab == "all"
                    HomeFilter.Tv -> col.tab == "tv" || col.tab == "all"
                }
            }
            .map { (col, list) -> col to clean(list) }
            .filter { it.second.size >= 4 }
            .map { (col, list) -> HomeRow.Channels(col, list.sortedByDescending { rec.score(it) }.take(40)) to rec.rowScore(col.id, list) }
            .sortedByDescending { it.second }
            .map { it.first }
        val movieRows = index.movieRows
            .map { (row, list) -> HomeRow.Movies(row, list.sortedByDescending { rec.score(it) }) to rec.movieRowScore(row.id, list) }
            .sortedByDescending { it.second }
            .map { it.first }

        // Personal rows: top picks, "because you watched", and films picked for you
        val personal = mutableListOf<HomeRow>()
        val picks = rec.topChannels(20, hide = { hide && unreliable(it) })
        val moviePicks = if (filter == HomeFilter.Tv) emptyList() else rec.topMovies(20)
        if (filter == HomeFilter.All) {
            val who = name?.takeIf { it.isNotBlank() && rec.hasHistory }
            if (picks.size >= 6) {
                personal += HomeRow.Channels(
                    Collection(id = "fy-picks", title = if (who != null) "Top picks for $who" else "Picked for you", emoji = "✨", colors = listOf("#FF2D6F", "#8B5CF6")),
                    picks,
                )
            }
            rec.seed()?.let { seed ->
                if (seed.startsWith(Movie.MOVIE_PREFIX)) {
                    val m = index.movieById[seed.removePrefix(Movie.MOVIE_PREFIX)]
                    val similar = m?.let { index.similarMovies(it, 20).sortedByDescending { x -> rec.score(x) } }.orEmpty()
                    if (m != null && similar.size >= 4) {
                        personal += HomeRow.Movies(MovieRow(id = "fy-because", title = "Because you watched ${m.title}", emoji = "👀"), similar)
                    }
                } else {
                    val ch = index.byId[seed]
                    val similar = ch?.let { clean(index.similarTo(it, 30)).sortedByDescending { x -> rec.score(x) }.take(20) }.orEmpty()
                    if (ch != null && similar.size >= 4) {
                        personal += HomeRow.Channels(
                            Collection(id = "fy-because", title = "Because you watched ${ch.name}", emoji = "👀", colors = listOf("#00C9FF", "#7F00FF")),
                            similar,
                        )
                    }
                }
            }
            if (moviePicks.size >= 6) {
                personal += HomeRow.Movies(MovieRow(id = "fy-movies", title = "Movies picked for you", emoji = "🍿"), moviePicks)
            }
        }

        val rows: List<HomeRow> = when (filter) {
            HomeFilter.Movies -> movieRows + channelRows
            HomeFilter.Tv -> channelRows
            // Personal rows first, then the best-matching rows with a film row woven in every two
            HomeFilter.All -> buildList {
                addAll(personal)
                val films = movieRows.iterator()
                channelRows.forEachIndexed { i, row ->
                    add(row)
                    if (i % 2 == 1 && films.hasNext()) add(films.next())
                }
                films.forEach { add(it) }
            }
        }

        // Hero: personal picks once there's history, otherwise the leaders of the best-matching rows
        val used = HashSet<String>()
        val pickPill = if (rec.hasHistory) "✨ Picked for you" else null
        val channelSource: List<Pair<String, Channel>> =
            if (rec.hasHistory && filter != HomeFilter.Movies) picks.map { "fy" to it }
            else channelRows.mapNotNull { row -> row.channels.firstOrNull { it.logo != null }?.let { row.collection.id to it } }
        val channelHeroes = channelSource.take(if (filter == HomeFilter.Movies) 3 else 6).mapNotNull { (colId, ch) ->
            if (!used.add(ch.id)) return@mapNotNull null
            val col = index.collectionById[colId]?.first
            HeroItem(
                "c-${ch.id}", ch.name,
                pickPill ?: "${col?.emoji.orEmpty()} ${col?.title.orEmpty()}".trim(),
                col?.colors ?: listOf("#FF2D6F", "#8B5CF6"),
                channel = ch,
            )
        }
        val movieSource: List<Pair<MovieRow?, Movie>> =
            if (rec.hasHistory) moviePicks.map { null to it }
            else movieRows.mapNotNull { r -> r.movies.firstOrNull()?.let { r.row to it } }
        val movieHeroes = if (filter == HomeFilter.Tv) emptyList() else movieSource.take(4).mapNotNull { (row, m) ->
            if (!used.add(m.id)) return@mapNotNull null
            HeroItem("m-${m.id}", m.title, pickPill ?: "${row?.emoji.orEmpty()} Free movie".trim(), row?.colors.orEmpty(), movie = m)
        }
        val hero = if (filter == HomeFilter.Movies) movieHeroes + channelHeroes
        else channelHeroes.zip(movieHeroes) { a, b -> listOf(a, b) }.flatten() +
            channelHeroes.drop(movieHeroes.size) + movieHeroes.drop(channelHeroes.size)

        val region = regionCode.takeIf { code -> !index.isKids && index.channels.count { it.country == code } >= 10 }
        val regional = region?.let { code ->
            clean(index.byCountry(code)).filterNot { "religious" in it.categories || "shop" in it.categories }
        }
        val top10 = (regional ?: clean(index.rows.firstOrNull()?.second ?: emptyList()))
            .filter { it.logo != null }
            .take(10)

        return HomeContent(hero = hero, top10 = top10, regionCode = region, rows = rows)
    }

    fun toggleMyList(channel: Channel) = prefs.toggleMyList(channel.id)
    fun toggleMyList(movie: Movie) = prefs.toggleMyList(movie.listKey)

    fun play(context: Context, channel: Channel, queue: List<Channel> = emptyList(), streamIndex: Int = 0) {
        prefs.markWatched(channel.id)
        PlayerLauncher.play(context, channel, queue, streamIndex)
    }

    fun playMovie(context: Context, movie: Movie, fromStart: Boolean = false) {
        prefs.markWatched(movie.listKey)
        PlayerLauncher.playMovie(context, movie, fromStart)
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
