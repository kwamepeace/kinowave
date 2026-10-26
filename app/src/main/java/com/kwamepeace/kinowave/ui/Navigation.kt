package com.kwamepeace.kinowave.ui

import androidx.compose.runtime.Stable
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.ui.components.Watchable

enum class Tab { Home, Discover, Live, MyList }

/** Screens pushed on top of the tabs. */
sealed interface Route {
    data class CollectionRoute(val id: String) : Route
    data class CountryRoute(val code: String) : Route
    data class LanguageRoute(val code: String) : Route
    data class CategoryRoute(val id: String) : Route
    data class MovieRowRoute(val id: String) : Route
}

/** Everything a screen can ask the shell to do. */
@Stable
class Actions(
    /** Open the channel detail sheet. */
    val open: (Channel) -> Unit,
    /** Start playback, with the list the channel came from as the zapping queue. */
    val play: (Channel, List<Channel>) -> Unit,
    val push: (Route) -> Unit,
    val toggleList: (Channel) -> Unit,
    /** Open the film detail sheet. */
    val openMovie: (Movie) -> Unit,
    val playMovie: (Movie) -> Unit,
) {
    fun openItem(item: Watchable) = when (item) {
        is Watchable.Live -> open(item.channel)
        is Watchable.Film -> openMovie(item.movie)
    }

    fun playItem(item: Watchable, queue: List<Watchable>) = when (item) {
        is Watchable.Live -> play(item.channel, queue.filterIsInstance<Watchable.Live>().map { it.channel })
        is Watchable.Film -> playMovie(item.movie)
    }
}

/** Turns My List / history keys back into channels and films ("m:" keys are films). */
fun CatalogIndex.resolve(keys: List<String>, progress: Map<String, Pair<Long, Long>> = emptyMap()): List<Watchable> =
    keys.mapNotNull { key ->
        if (key.startsWith(Movie.MOVIE_PREFIX)) {
            val id = key.removePrefix(Movie.MOVIE_PREFIX)
            movieById[id]?.let { m -> Watchable.Film(m, progress[id]?.let { (pos, dur) -> if (dur > 0) pos.toFloat() / dur else null }) }
        } else {
            byId[key]?.let { Watchable.Live(it) }
        }
    }
