package com.kwamepeace.kinowave.player

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.annotation.OptIn
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.ui.AspectRatioFrameLayout
import com.kwamepeace.kinowave.CatalogState
import com.kwamepeace.kinowave.KinoApp
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Stream
import com.kwamepeace.kinowave.ui.theme.KinoTheme
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

enum class PlayerPhase { Tuning, Playing, Failed }

/** Observable state the Compose overlay renders. */
class PlayerUiState {
    var channel by mutableStateOf<Channel?>(null)
    var queue by mutableStateOf<List<Channel>>(emptyList())
    var queueIndex by mutableIntStateOf(0)
    var streamIndex by mutableIntStateOf(0)
    var phase by mutableStateOf(PlayerPhase.Tuning)
    var isPlaying by mutableStateOf(false)
    var inPip by mutableStateOf(false)
    var resizeMode by mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT)
    var index by mutableStateOf<CatalogIndex?>(null)
}

@OptIn(UnstableApi::class)
class PlayerActivity : ComponentActivity() {

    private val app get() = application as KinoApp
    private lateinit var player: ExoPlayer
    private val ui = PlayerUiState()

    /** Whether the current stream is being retried with a forced HLS mime type. */
    private var forcedHls = false
    private var watchdog: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goImmersive()

        player = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true)
            .build()
            .apply { addListener(listener) }

        setContent {
            KinoTheme {
                PlayerScreen(
                    player = player,
                    state = ui,
                    onBack = { finish() },
                    onTogglePlay = { if (player.isPlaying) player.pause() else player.play() },
                    onNextChannel = { zap(+1) },
                    onPrevChannel = { zap(-1) },
                    onPickChannel = { i -> tuneQueue(i, 0) },
                    onNextSource = { nextSource(userInitiated = true) },
                    onRetry = { tuneQueue(ui.queueIndex, 0) },
                    onToggleResize = {
                        ui.resizeMode = if (ui.resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) {
                            AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                        } else {
                            AspectRatioFrameLayout.RESIZE_MODE_FIT
                        }
                    },
                    onPip = { enterPip() },
                )
            }
        }

        loadFromIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadFromIntent(intent)
    }

    private fun loadFromIntent(intent: Intent) {
        val channelId = intent.getStringExtra(PlayerLauncher.EXTRA_CHANNEL) ?: return finish()
        val queueIds = intent.getStringArrayListExtra(PlayerLauncher.EXTRA_QUEUE) ?: arrayListOf(channelId)
        val stream = intent.getIntExtra(PlayerLauncher.EXTRA_STREAM, 0)

        app.ensureCatalog()
        lifecycleScope.launch {
            val index = app.catalog.filterIsInstance<CatalogState.Ready>().first().index
            ui.index = index
            val queue = queueIds.mapNotNull(index.byId::get).ifEmpty { listOfNotNull(index.byId[channelId]) }
            if (queue.isEmpty()) return@launch finish()
            ui.queue = queue
            tuneQueue(queue.indexOfFirst { it.id == channelId }.coerceAtLeast(0), stream)
        }
    }

    private fun zap(step: Int) {
        val size = ui.queue.size
        if (size <= 1) return
        tuneQueue(((ui.queueIndex + step) % size + size) % size, 0)
    }

    private fun tuneQueue(queueIndex: Int, streamIndex: Int) {
        val channel = ui.queue.getOrNull(queueIndex) ?: return
        ui.queueIndex = queueIndex
        ui.channel = channel
        app.prefs.markWatched(channel.id)
        playStream(channel, streamIndex.coerceIn(0, (channel.streams.size - 1).coerceAtLeast(0)), forceHls = false)
    }

    private fun playStream(channel: Channel, streamIndex: Int, forceHls: Boolean) {
        val stream = channel.streams.getOrNull(streamIndex) ?: run { ui.phase = PlayerPhase.Failed; return }
        ui.streamIndex = streamIndex
        ui.phase = PlayerPhase.Tuning
        forcedHls = forceHls

        val dataSource = OkHttpDataSource.Factory(app.http)
            .setUserAgent(stream.userAgent ?: DEFAULT_USER_AGENT)
            .setDefaultRequestProperties(headersFor(stream))
        val mediaSourceFactory = DefaultMediaSourceFactory(dataSource)
            .setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(/* minimumLoadableRetryCount = */ 2))

        val item = MediaItem.Builder()
            .setUri(stream.url)
            .apply {
                when {
                    forceHls || stream.url.contains(".m3u8", ignoreCase = true) -> setMimeType(MimeTypes.APPLICATION_M3U8)
                    stream.url.contains(".mpd", ignoreCase = true) -> setMimeType(MimeTypes.APPLICATION_MPD)
                }
            }
            .setMediaMetadata(androidx.media3.common.MediaMetadata.Builder().setTitle(channel.name).build())
            .build()

        player.stop()
        player.setMediaSource(mediaSourceFactory.createMediaSource(item))
        player.prepare()
        player.playWhenReady = true

        // Dead streams sometimes hang instead of erroring; move on if nothing plays in time.
        watchdog?.cancel()
        watchdog = lifecycleScope.launch {
            delay(TUNE_TIMEOUT_MS)
            if (ui.phase == PlayerPhase.Tuning) nextSource(userInitiated = false)
        }
    }

    /** Try the same channel's next source; when none are left, show the error state. */
    private fun nextSource(userInitiated: Boolean) {
        val channel = ui.channel ?: return
        val stream = channel.streams.getOrNull(ui.streamIndex)
        // Extension-less URLs are often HLS anyway: retry once as HLS before giving up on the source
        if (!userInitiated && !forcedHls && stream != null && !stream.url.contains(".m3u8", true) && !stream.url.contains(".mpd", true)) {
            playStream(channel, ui.streamIndex, forceHls = true)
            return
        }
        val next = ui.streamIndex + 1
        when {
            next < channel.streams.size -> playStream(channel, next, forceHls = false)
            userInitiated && channel.streams.size > 1 -> playStream(channel, 0, forceHls = false)
            else -> {
                watchdog?.cancel()
                player.stop()
                ui.phase = PlayerPhase.Failed
            }
        }
    }

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_READY) {
                ui.phase = PlayerPhase.Playing
                watchdog?.cancel()
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            ui.isPlaying = isPlaying
            if (isPlaying) ui.phase = PlayerPhase.Playing
            updatePipParams()
        }

        override fun onPlayerError(error: PlaybackException) {
            if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                player.seekToDefaultPosition()
                player.prepare()
                return
            }
            nextSource(userInitiated = false)
        }
    }

    private fun headersFor(stream: Stream): Map<String, String> {
        val referrer = stream.referrer ?: return emptyMap()
        val origin = runCatching { android.net.Uri.parse(referrer).let { "${it.scheme}://${it.host}" } }.getOrNull()
        return buildMap {
            put("Referer", referrer)
            if (origin != null) put("Origin", origin)
        }
    }

    // ---------------------------------------------------------------- picture-in-picture

    private fun pipParams(): PictureInPictureParams {
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(player.isPlaying)
            builder.setSeamlessResizeEnabled(true)
        }
        return builder.build()
    }

    private fun updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) runCatching { setPictureInPictureParams(pipParams()) }
    }

    private fun enterPip() {
        runCatching { enterPictureInPictureMode(pipParams()) }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Android 12+ auto-enters via the params above
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && player.isPlaying) enterPip()
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        ui.inPip = isInPictureInPictureMode
        // Leaving PiP while stopped means the user dismissed the PiP window
        if (!isInPictureInPictureMode && lifecycle.currentState == Lifecycle.State.CREATED) {
            player.pause()
            finish()
        }
    }

    // ---------------------------------------------------------------- lifecycle

    override fun onStop() {
        super.onStop()
        // Closing the PiP window stops the activity; keep playing only while visible in PiP
        if (!isInPictureInPictureMode) player.pause()
    }

    override fun onDestroy() {
        watchdog?.cancel()
        player.removeListener(listener)
        player.release()
        super.onDestroy()
    }

    private fun goImmersive() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private companion object {
        const val TUNE_TIMEOUT_MS = 15_000L
        const val DEFAULT_USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
    }
}
