package com.kwamepeace.kinowave.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * One profile's My List, watch history, movie resume points and browsing settings,
 * persisted in SharedPreferences. Movie entries use [Movie.listKey] ("m:<id>").
 */
class UserPrefs(context: Context, profileId: String) {

    // The main profile keeps the original file so data from before profiles existed carries over
    private val prefs = context.getSharedPreferences(
        if (profileId == ProfileStore.MAIN_PROFILE_ID) "user" else "user_$profileId",
        Context.MODE_PRIVATE,
    )

    private val _myList = MutableStateFlow(readList(KEY_MY_LIST))
    val myList: StateFlow<List<String>> = _myList.asStateFlow()

    private val _recents = MutableStateFlow(readList(KEY_RECENTS))
    val recents: StateFlow<List<String>> = _recents.asStateFlow()

    private val _hideUnreliable = MutableStateFlow(prefs.getBoolean(KEY_HIDE_UNRELIABLE, false))
    /** Hide channels whose every stream is geo-blocked or part-time. */
    val hideUnreliable: StateFlow<Boolean> = _hideUnreliable.asStateFlow()

    /** Movie id → (position ms, duration ms), for "Continue watching" progress bars. */
    private val _progress = MutableStateFlow(readProgress())
    val progress: StateFlow<Map<String, Pair<Long, Long>>> = _progress.asStateFlow()

    fun toggleMyList(key: String) {
        val list = _myList.value
        _myList.value = if (key in list) list - key else listOf(key) + list
        writeList(KEY_MY_LIST, _myList.value)
    }

    fun markWatched(key: String) {
        _recents.value = (listOf(key) + _recents.value.filter { it != key }).take(MAX_RECENTS)
        writeList(KEY_RECENTS, _recents.value)
    }

    fun clearRecents() {
        _recents.value = emptyList()
        writeList(KEY_RECENTS, emptyList())
    }

    fun setHideUnreliable(value: Boolean) {
        _hideUnreliable.value = value
        prefs.edit().putBoolean(KEY_HIDE_UNRELIABLE, value).apply()
    }

    fun savePosition(movieId: String, positionMs: Long, durationMs: Long) {
        // Treat the last couple of minutes as "finished"
        val finished = durationMs > 0 && positionMs > durationMs - 120_000
        _progress.value = if (finished || positionMs < 15_000) _progress.value - movieId
        else _progress.value + (movieId to (positionMs to durationMs))
        prefs.edit().putString(KEY_PROGRESS, _progress.value.entries.joinToString("\n") { (id, p) -> "$id|${p.first}|${p.second}" }).apply()
    }

    fun positionOf(movieId: String): Long = _progress.value[movieId]?.first ?: 0L

    private fun readProgress(): Map<String, Pair<Long, Long>> =
        prefs.getString(KEY_PROGRESS, null)?.split('\n')?.mapNotNull { line ->
            val parts = line.split('|')
            if (parts.size != 3) return@mapNotNull null
            val pos = parts[1].toLongOrNull() ?: return@mapNotNull null
            val dur = parts[2].toLongOrNull() ?: return@mapNotNull null
            parts[0] to (pos to dur)
        }?.toMap() ?: emptyMap()

    private fun readList(key: String): List<String> =
        prefs.getString(key, null)?.split('\n')?.filter { it.isNotBlank() } ?: emptyList()

    private fun writeList(key: String, list: List<String>) {
        prefs.edit().putString(key, list.joinToString("\n")).apply()
    }

    private companion object {
        const val KEY_MY_LIST = "my_list"
        const val KEY_RECENTS = "recents"
        const val KEY_HIDE_UNRELIABLE = "hide_unreliable"
        const val KEY_PROGRESS = "movie_progress"
        const val MAX_RECENTS = 30
    }
}
