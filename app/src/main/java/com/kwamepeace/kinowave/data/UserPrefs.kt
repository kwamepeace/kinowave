package com.kwamepeace.kinowave.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** My List, watch history and settings, persisted in SharedPreferences. */
class UserPrefs(context: Context) {

    private val prefs = context.getSharedPreferences("user", Context.MODE_PRIVATE)

    private val _myList = MutableStateFlow(readList(KEY_MY_LIST))
    val myList: StateFlow<List<String>> = _myList.asStateFlow()

    private val _recents = MutableStateFlow(readList(KEY_RECENTS))
    val recents: StateFlow<List<String>> = _recents.asStateFlow()

    private val _hideUnreliable = MutableStateFlow(prefs.getBoolean(KEY_HIDE_UNRELIABLE, false))
    /** Hide channels whose every stream is geo-blocked or part-time. */
    val hideUnreliable: StateFlow<Boolean> = _hideUnreliable.asStateFlow()

    fun toggleMyList(id: String) {
        val list = _myList.value
        _myList.value = if (id in list) list - id else listOf(id) + list
        writeList(KEY_MY_LIST, _myList.value)
    }

    fun markWatched(id: String) {
        _recents.value = (listOf(id) + _recents.value.filter { it != id }).take(MAX_RECENTS)
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

    private fun readList(key: String): List<String> =
        prefs.getString(key, null)?.split('\n')?.filter { it.isNotBlank() } ?: emptyList()

    private fun writeList(key: String, list: List<String>) {
        prefs.edit().putString(key, list.joinToString("\n")).apply()
    }

    private companion object {
        const val KEY_MY_LIST = "my_list"
        const val KEY_RECENTS = "recents"
        const val KEY_HIDE_UNRELIABLE = "hide_unreliable"
        const val MAX_RECENTS = 30
    }
}
