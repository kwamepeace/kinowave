package com.kwamepeace.kinowave.player

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import com.kwamepeace.kinowave.CatalogState
import com.kwamepeace.kinowave.KinoApp
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.theme.Kino
import com.kwamepeace.kinowave.ui.theme.KinoTheme
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.PlayerConstants
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.YouTubePlayer
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.listeners.AbstractYouTubePlayerListener
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.options.IFramePlayerOptions
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.views.YouTubePlayerView
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Plays a studio's free film inside YouTube's official embedded player (as YouTube's terms require:
 * YouTube's own controls and ads stay intact). Resume points and watch time work like other films.
 */
class YouTubePlayerActivity : ComponentActivity() {

    private val app get() = application as KinoApp
    private lateinit var playerView: YouTubePlayerView

    private var movie by mutableStateOf<Movie?>(null)
    private var ready by mutableStateOf(false)
    private var failed by mutableStateOf(false)
    private var playing = false
    private var currentSecond = 0f
    private var durationSeconds = 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        playerView = YouTubePlayerView(this).apply {
            enableAutomaticInitialization = false
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        lifecycle.addObserver(playerView)

        setContent {
            KinoTheme {
                var chromeVisible by androidx.compose.runtime.remember { mutableStateOf(true) }
                LaunchedEffect(ready) {
                    if (ready) {
                        delay(4_000)
                        chromeVisible = false
                    }
                }
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    AndroidView(factory = { playerView }, modifier = Modifier.fillMaxSize())

                    if (!ready && !failed) {
                        CircularProgressIndicator(Modifier.align(Alignment.Center), color = Kino.Pink)
                    }

                    // Brief title bar; YouTube's own controls take over once playback starts
                    AnimatedVisibility(visible = chromeVisible && !failed, enter = fadeIn(), exit = fadeOut()) {
                        Row(
                            Modifier.safeDrawingPadding().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier
                                    .size(44.dp)
                                    .bouncyClick { finish() }
                                    .clip(CircleShape)
                                    .background(Color(0x66000000))
                                    .border(1.dp, Color(0x33FFFFFF), CircleShape),
                                contentAlignment = Alignment.Center,
                            ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White) }
                            Spacer(Modifier.width(12.dp))
                            movie?.let { m ->
                                Column {
                                    Text(m.title, style = MaterialTheme.typography.titleLarge, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(m.sourceLabel, style = MaterialTheme.typography.bodySmall, color = Kino.TextMid)
                                }
                            }
                        }
                    }

                    if (failed) {
                        // Opaque, so YouTube's own error page underneath doesn't show through
                        Box(Modifier.fillMaxSize().background(Kino.Ink))
                        Column(
                            Modifier.align(Alignment.Center).padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text("This movie can't play inside KinoWave", style = MaterialTheme.typography.titleLarge, color = Color.White, textAlign = TextAlign.Center)
                            Text(
                                "YouTube won't play this one here. You can still watch it in the YouTube app.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Kino.TextLow,
                            )
                            Spacer(Modifier.height(18.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(
                                    "Back",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = Color.White,
                                    modifier = Modifier
                                        .bouncyClick { finish() }
                                        .clip(RoundedCornerShape(50))
                                        .background(Color(0x26FFFFFF))
                                        .padding(horizontal = 20.dp, vertical = 11.dp),
                                )
                                Text(
                                    "Open in YouTube",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = Color.White,
                                    modifier = Modifier
                                        .bouncyClick { openInYouTube() }
                                        .clip(RoundedCornerShape(50))
                                        .background(Kino.BrandGradientH)
                                        .padding(horizontal = 20.dp, vertical = 11.dp),
                                )
                            }
                        }
                    }
                }
            }
        }

        val movieId = intent.getStringExtra(PlayerLauncher.EXTRA_MOVIE) ?: return finish()
        val fromStart = intent.getBooleanExtra(PlayerLauncher.EXTRA_FROM_START, false)
        app.ensureCatalog()
        lifecycleScope.launch {
            val index = app.catalog.filterIsInstance<CatalogState.Ready>().first().index
            val m = index.movieById[movieId]
            val videoId = m?.youtubeId ?: return@launch finish()
            movie = m
            app.prefs.markWatched(m.listKey)
            val startAt = if (fromStart) 0f else app.prefs.positionOf(m.id) / 1000f
            start(videoId, startAt)
        }

        // Watch-time signal for For You, and periodic resume points
        lifecycleScope.launch {
            while (isActive) {
                delay(15_000)
                val m = movie ?: continue
                if (playing) app.prefs.addWatchTime(m.listKey, 15)
                saveProgress()
            }
        }
    }

    private fun start(videoId: String, startSeconds: Float) {
        // The context makes the player send the app id as its origin/referer, which YouTube now requires
        // for embedded playback (otherwise every video fails with error 152)
        val options = IFramePlayerOptions.Builder(this)
            .controls(1)
            .rel(0)
            .ivLoadPolicy(3)
            .ccLoadPolicy(1)
            .build()
        playerView.initialize(object : AbstractYouTubePlayerListener() {
            override fun onReady(youTubePlayer: YouTubePlayer) {
                ready = true
                youTubePlayer.loadVideo(videoId, startSeconds)
            }

            override fun onCurrentSecond(youTubePlayer: YouTubePlayer, second: Float) {
                currentSecond = second
            }

            override fun onVideoDuration(youTubePlayer: YouTubePlayer, duration: Float) {
                durationSeconds = duration
            }

            override fun onStateChange(youTubePlayer: YouTubePlayer, state: PlayerConstants.PlayerState) {
                playing = state == PlayerConstants.PlayerState.PLAYING
                // Keep the screen awake while the film plays or buffers
                val awake = playing || state == PlayerConstants.PlayerState.BUFFERING
                if (awake) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                if (state == PlayerConstants.PlayerState.ENDED) {
                    saveProgress()
                    finish()
                }
            }

            override fun onError(youTubePlayer: YouTubePlayer, error: PlayerConstants.PlayerError) {
                failed = true
            }
        }, options)
    }

    private fun saveProgress() {
        val m = movie ?: return
        if (durationSeconds > 0) app.prefs.savePosition(m.id, (currentSecond * 1000).toLong(), (durationSeconds * 1000).toLong())
    }

    private fun openInYouTube() {
        val id = movie?.youtubeId ?: return
        val url = "https://www.youtube.com/watch?v=$id&t=${currentSecond.toInt()}s"
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        finish()
    }

    override fun onStop() {
        super.onStop()
        saveProgress()
    }

    override fun onDestroy() {
        saveProgress()
        playerView.release()
        super.onDestroy()
    }
}
