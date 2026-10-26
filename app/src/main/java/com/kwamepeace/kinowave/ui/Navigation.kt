package com.kwamepeace.kinowave.ui

import androidx.compose.runtime.Stable
import com.kwamepeace.kinowave.data.Channel

enum class Tab { Home, Discover, Live, MyList }

/** Screens pushed on top of the tabs. */
sealed interface Route {
    data class CollectionRoute(val id: String) : Route
    data class CountryRoute(val code: String) : Route
    data class LanguageRoute(val code: String) : Route
    data class CategoryRoute(val id: String) : Route
}

/** Everything a screen can ask the shell to do. */
@Stable
class Actions(
    /** Open the detail sheet. */
    val open: (Channel) -> Unit,
    /** Start playback, with the list the channel came from as the zapping queue. */
    val play: (Channel, List<Channel>) -> Unit,
    val push: (Route) -> Unit,
    val toggleList: (Channel) -> Unit,
)
