package com.kwamepeace.kinowave.data

import android.content.Context
import android.net.ConnectivityManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Device-wide playback settings shared by every profile. */
class AppSettings(private val context: Context) {

    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    private val _dataSaver = MutableStateFlow(prefs.getBoolean(KEY_DATA_SAVER, false))
    /** Cap video at ~480p, use lighter movie files and skip heavy extras. */
    val dataSaver: StateFlow<Boolean> = _dataSaver.asStateFlow()

    private val _saverOnMobileOnly = MutableStateFlow(prefs.getBoolean(KEY_SAVER_MOBILE_ONLY, true))
    /** Only apply data saver on metered connections (mobile data), full quality on Wi-Fi. */
    val saverOnMobileOnly: StateFlow<Boolean> = _saverOnMobileOnly.asStateFlow()

    private val _autoplayNext = MutableStateFlow(prefs.getBoolean(KEY_AUTOPLAY, true))
    /** Jump to the next channel automatically when every source of the current one fails. */
    val autoplayNext: StateFlow<Boolean> = _autoplayNext.asStateFlow()

    fun setDataSaver(value: Boolean) = put(KEY_DATA_SAVER, value) { _dataSaver.value = it }
    fun setSaverOnMobileOnly(value: Boolean) = put(KEY_SAVER_MOBILE_ONLY, value) { _saverOnMobileOnly.value = it }
    fun setAutoplayNext(value: Boolean) = put(KEY_AUTOPLAY, value) { _autoplayNext.value = it }

    /** Whether data saver applies right now, given the current connection. */
    fun savingData(): Boolean {
        if (!_dataSaver.value) return false
        if (!_saverOnMobileOnly.value) return true
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return true
        return cm.isActiveNetworkMetered
    }

    private fun put(key: String, value: Boolean, apply: (Boolean) -> Unit) {
        apply(value)
        prefs.edit().putBoolean(key, value).apply()
    }

    private companion object {
        const val KEY_DATA_SAVER = "data_saver"
        const val KEY_SAVER_MOBILE_ONLY = "data_saver_mobile_only"
        const val KEY_AUTOPLAY = "autoplay_next"
    }
}
