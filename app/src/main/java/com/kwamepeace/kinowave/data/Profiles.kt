package com.kwamepeace.kinowave.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.util.UUID

/** A "Who's watching?" profile, stored on the device. */
@Serializable
data class Profile(
    val id: String,
    val name: String,
    val avatar: String,
    /** Index into [PROFILE_COLORS]. */
    val color: Int = 0,
    val kids: Boolean = false,
    /** Optional 4-digit lock. */
    val pin: String? = null,
) {
    val locked: Boolean get() = !pin.isNullOrEmpty()
}

/** Gradient pairs for profile tiles (ARGB). */
val PROFILE_COLORS: List<Pair<Long, Long>> = listOf(
    0xFFFF2D6F to 0xFF8B5CF6,
    0xFF00C9FF to 0xFF7F00FF,
    0xFFF7971E to 0xFFE52E71,
    0xFF11998E to 0xFFC8FF2E,
    0xFFFDC830 to 0xFFF37335,
    0xFF614385 to 0xFF516395,
)

val PROFILE_AVATARS = listOf("😎", "🦊", "🐼", "👾", "🦄", "🐸", "🤖", "🐯", "🍕", "🌸", "🎧", "🧸", "🚀", "⚽", "🎮", "💜")

class ProfileStore(context: Context) {

    private val prefs = context.getSharedPreferences("profiles", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(Profile.serializer())

    private val _profiles = MutableStateFlow(load())
    val profiles: StateFlow<List<Profile>> = _profiles.asStateFlow()

    private val _active = MutableStateFlow<Profile?>(null)
    /** Null until someone picks a profile on the "Who's watching?" screen. */
    val active: StateFlow<Profile?> = _active.asStateFlow()

    fun select(profile: Profile) {
        _active.value = profile
    }

    fun clearActive() {
        _active.value = null
    }

    fun save(profile: Profile) {
        val list = _profiles.value
        _profiles.value = if (list.any { it.id == profile.id }) list.map { if (it.id == profile.id) profile else it } else list + profile
        persist()
        if (_active.value?.id == profile.id) _active.value = profile
    }

    fun delete(profile: Profile) {
        if (_profiles.value.size <= 1) return
        _profiles.value = _profiles.value.filter { it.id != profile.id }
        persist()
        if (_active.value?.id == profile.id) _active.value = null
    }

    fun newProfile(kids: Boolean = false): Profile = Profile(
        id = UUID.randomUUID().toString().take(8),
        name = if (kids) "Kids" else "",
        avatar = if (kids) "🧸" else PROFILE_AVATARS.random(),
        color = PROFILE_COLORS.indices.random(),
        kids = kids,
    )

    private fun load(): List<Profile> {
        val raw = prefs.getString(KEY, null)
        val stored = raw?.let { runCatching { json.decodeFromString(serializer, it) }.getOrNull() }
        if (!stored.isNullOrEmpty()) return stored
        // First launch: the main profile keeps the id that maps to the pre-profiles data file
        return listOf(
            Profile(id = MAIN_PROFILE_ID, name = "You", avatar = "😎", color = 0),
            Profile(id = "kids", name = "Kids", avatar = "🧸", color = 4, kids = true),
        ).also { prefs.edit().putString(KEY, json.encodeToString(serializer, it)).apply() }
    }

    private fun persist() {
        prefs.edit().putString(KEY, json.encodeToString(serializer, _profiles.value)).apply()
    }

    companion object {
        const val MAIN_PROFILE_ID = "main"
        private const val KEY = "profiles"
    }
}
