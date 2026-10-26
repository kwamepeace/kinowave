package com.kwamepeace.kinowave.player

import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.Dns
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PictureInPictureAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.data.qualityBadge
import androidx.compose.material.icons.rounded.Bedtime
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import com.kwamepeace.kinowave.ui.components.ChannelLogo
import com.kwamepeace.kinowave.ui.components.GradientScrim
import com.kwamepeace.kinowave.ui.components.LivePill
import com.kwamepeace.kinowave.ui.components.Pill
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.components.rememberTick
import com.kwamepeace.kinowave.ui.theme.Kino
import kotlinx.coroutines.delay
import kotlin.math.abs

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    player: ExoPlayer,
    state: PlayerUiState,
    onBack: () -> Unit,
    onTogglePlay: () -> Unit,
    onNextChannel: () -> Unit,
    onPrevChannel: () -> Unit,
    onPickChannel: (Int) -> Unit,
    onNextSource: () -> Unit,
    onRetry: () -> Unit,
    onToggleResize: () -> Unit,
    onPip: () -> Unit,
    onCycleSleep: () -> Unit,
    onCancelAutoNext: () -> Unit,
) {
    var controlsVisible by remember { mutableStateOf(true) }
    var interactionTick by remember { mutableIntStateOf(0) }
    val tick = rememberTick()
    val channel = state.channel
    val movie = state.movie

    // Auto-hide controls a few seconds after the last interaction while playing
    LaunchedEffect(controlsVisible, interactionTick, state.phase) {
        if (controlsVisible && state.phase == PlayerPhase.Playing) {
            delay(3_500)
            controlsVisible = false
        }
    }
    LaunchedEffect(state.queueIndex) { controlsVisible = true; interactionTick++ }

    val poke = { interactionTick++ }
    var dragTotal by remember { mutableFloatStateOf(0f) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { controlsVisible = !controlsVisible; interactionTick++ },
                    onDoubleTap = { onToggleResize() },
                )
            }
            .pointerInput(Unit) {
                // Swipe up for the next channel, down for the previous one
                detectVerticalDragGestures(
                    onDragStart = { dragTotal = 0f },
                    onVerticalDrag = { _, dy -> dragTotal += dy },
                    onDragEnd = {
                        if (abs(dragTotal) > 140f) {
                            tick()
                            if (dragTotal < 0) onNextChannel() else onPrevChannel()
                        }
                    },
                )
            },
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    useController = false
                    keepScreenOn = true
                    setShutterBackgroundColor(android.graphics.Color.BLACK)
                    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    this.player = player
                }
            },
            update = { view -> view.resizeMode = state.resizeMode },
            modifier = Modifier.fillMaxSize(),
        )

        if (state.inPip) return@Box

        // Tuning / failure overlays
        if ((channel != null || movie != null) && state.phase != PlayerPhase.Playing) {
            StatusOverlay(state, onRetry = onRetry, onNextSource = onNextSource, onNextChannel = onNextChannel, onCancelAutoNext = onCancelAutoNext)
        }

        AnimatedVisibility(
            visible = controlsVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize(),
        ) {
            Box(Modifier.fillMaxSize()) {
                GradientScrim(Modifier.fillMaxWidth().height(140.dp).align(Alignment.TopCenter), listOf(Color(0xCC000000), Color.Transparent))
                GradientScrim(Modifier.fillMaxWidth().height(190.dp).align(Alignment.BottomCenter), listOf(Color.Transparent, Color(0xE6000000)))

                // Top bar
                Row(
                    Modifier.fillMaxWidth().safeDrawingPadding().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    GlassButton(Icons.AutoMirrored.Rounded.ArrowBack, "Back") { onBack() }
                    Spacer(Modifier.width(12.dp))
                    if (channel != null) {
                        ChannelLogo(channel, Modifier.size(width = 54.dp, height = 40.dp), shape = RoundedCornerShape(10.dp), padding = 4.dp)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    channel.name,
                                    style = MaterialTheme.typography.titleLarge,
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f, fill = false),
                                )
                                Spacer(Modifier.width(8.dp))
                                LivePill()
                            }
                            val stream = channel.streams.getOrNull(state.streamIndex)
                            val sourceLabel = buildString {
                                append("Server ${state.streamIndex + 1}/${channel.streams.size}")
                                qualityBadge(stream?.quality)?.let { append(" · ").append(it) }
                                state.index?.let { append(" · ").append(it.countryFlag(channel.country)).append(' ').append(it.countryName(channel.country)) }
                            }
                            Text(sourceLabel, style = MaterialTheme.typography.bodySmall, color = Kino.TextMid)
                        }
                    } else if (movie != null) {
                        AsyncImage(
                            model = movie.poster ?: movie.still,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(width = 30.dp, height = 44.dp).clip(RoundedCornerShape(6.dp)),
                        )
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(movie.title, style = MaterialTheme.typography.titleLarge, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                listOfNotNull(movie.year?.toString(), movie.runtimeLabel, "On demand").joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = Kino.TextMid,
                            )
                        }
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                    if (state.dataSaver) {
                        Pill("DATA SAVER", background = Color(0x33C8FF2E), color = Kino.Lime)
                        Spacer(Modifier.width(8.dp))
                    }
                    SleepButton(state.sleepAt) { poke(); onCycleSleep() }
                    Spacer(Modifier.width(8.dp))
                    if (channel != null && channel.streams.size > 1) {
                        GlassButton(Icons.Rounded.Dns, "Switch server") { poke(); onNextSource() }
                        Spacer(Modifier.width(8.dp))
                    }
                    GlassButton(Icons.Rounded.AspectRatio, "Fit or fill") { poke(); onToggleResize() }
                    Spacer(Modifier.width(8.dp))
                    GlassButton(Icons.Rounded.PictureInPictureAlt, "Picture in picture") { onPip() }
                }

                // Center transport (hidden while tuning/failed, the status overlay owns the centre then)
                if (state.phase == PlayerPhase.Playing) Row(
                    Modifier.align(Alignment.Center),
                    horizontalArrangement = Arrangement.spacedBy(28.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (movie != null) GlassButton(Icons.Rounded.Replay10, "Back 10 seconds", size = 52) { poke(); player.seekBack() }
                    else GlassButton(Icons.Rounded.KeyboardArrowUp, "Previous channel", size = 52) { poke(); onPrevChannel() }
                    Box(
                        Modifier
                            .size(76.dp)
                            .bouncyClick(pressedScale = 0.9f) { poke(); onTogglePlay() }
                            .clip(CircleShape)
                            .background(Kino.BrandGradient),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            if (state.isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(40.dp),
                        )
                    }
                    if (movie != null) GlassButton(Icons.Rounded.Forward10, "Forward 10 seconds", size = 52) { poke(); player.seekForward() }
                    else GlassButton(Icons.Rounded.KeyboardArrowDown, "Next channel", size = 52) { poke(); onNextChannel() }
                }

                if (movie != null) {
                    MovieSeekBar(player, Modifier.align(Alignment.BottomCenter), onInteract = { poke() })
                }

                // Channel strip for quick zapping
                if (state.queue.size > 1) {
                    ChannelStrip(state, Modifier.align(Alignment.BottomCenter)) { i -> poke(); onPickChannel(i) }
                }
            }
        }
    }
}

@Composable
private fun ChannelStrip(state: PlayerUiState, modifier: Modifier, onPick: (Int) -> Unit) {
    val listState = rememberLazyListState()
    LaunchedEffect(state.queueIndex) {
        listState.animateScrollToItem((state.queueIndex - 2).coerceAtLeast(0))
    }
    Column(modifier.fillMaxWidth().safeDrawingPadding().padding(bottom = 10.dp)) {
        Text(
            "Swipe ↑↓ to zap · ${state.queueIndex + 1} of ${state.queue.size}",
            style = MaterialTheme.typography.labelMedium,
            color = Kino.TextMid,
            modifier = Modifier.padding(start = 20.dp, bottom = 8.dp),
        )
        LazyRow(
            state = listState,
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            itemsIndexed(state.queue, key = { _, ch -> ch.id }) { i, ch ->
                val active = i == state.queueIndex
                val shape = RoundedCornerShape(14.dp)
                Box(
                    Modifier
                        .size(width = 96.dp, height = 64.dp)
                        .bouncyClick { onPick(i) }
                        .graphicsLayer { alpha = if (active) 1f else 0.75f }
                        .then(if (active) Modifier.border(2.dp, Kino.BrandGradientH, shape) else Modifier)
                        .clip(shape),
                ) {
                    ChannelLogo(ch, Modifier.fillMaxSize(), shape = shape, padding = 8.dp)
                }
            }
        }
    }
}

/** Scrubber with elapsed / remaining time for on-demand films. */
@Composable
private fun MovieSeekBar(player: ExoPlayer, modifier: Modifier, onInteract: () -> Unit) {
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    var scrubbing by remember { mutableStateOf<Float?>(null) }
    LaunchedEffect(player) {
        while (true) {
            if (scrubbing == null) position = player.currentPosition
            duration = player.duration.coerceAtLeast(0L)
            delay(500)
        }
    }
    val fraction = scrubbing ?: if (duration > 0) position.toFloat() / duration else 0f
    Column(modifier.fillMaxWidth().safeDrawingPadding().padding(horizontal = 24.dp, vertical = 12.dp)) {
        Slider(
            value = fraction.coerceIn(0f, 1f),
            onValueChange = { scrubbing = it; onInteract() },
            onValueChangeFinished = {
                scrubbing?.let { player.seekTo((it * duration).toLong()) }
                scrubbing = null
            },
            colors = SliderDefaults.colors(
                thumbColor = Color.White,
                activeTrackColor = Kino.Pink,
                inactiveTrackColor = Color(0x40FFFFFF),
            ),
        )
        Row(Modifier.fillMaxWidth()) {
            Text(formatTime((fraction * duration).toLong()), style = MaterialTheme.typography.labelMedium, color = Color.White)
            Spacer(Modifier.weight(1f))
            Text("-" + formatTime((duration - fraction * duration).toLong().coerceAtLeast(0L)), style = MaterialTheme.typography.labelMedium, color = Kino.TextMid)
        }
    }
}

private fun formatTime(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/** Moon button that cycles the sleep timer and shows the minutes left. */
@Composable
private fun SleepButton(sleepAt: Long, onClick: () -> Unit) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(sleepAt) {
        while (sleepAt > 0) {
            now = System.currentTimeMillis()
            delay(15_000)
        }
    }
    if (sleepAt == 0L) {
        GlassButton(Icons.Rounded.Bedtime, "Sleep timer", onClick = onClick)
    } else {
        val minutes = ((sleepAt - now) / 60_000 + 1).coerceAtLeast(1)
        Row(
            Modifier
                .height(44.dp)
                .bouncyClick(onClick = onClick)
                .clip(CircleShape)
                .background(Kino.BrandGradientH)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.Bedtime, "Sleep timer", tint = Color.White, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(6.dp))
            Text("${minutes}m", style = MaterialTheme.typography.labelLarge, color = Color.White)
        }
    }
}

@Composable
private fun StatusOverlay(
    state: PlayerUiState,
    onRetry: () -> Unit,
    onNextSource: () -> Unit,
    onNextChannel: () -> Unit,
    onCancelAutoNext: () -> Unit,
) {
    val movie = state.movie
    if (movie != null) {
        MovieStatus(movie, state.phase, onRetry)
        return
    }
    val channel = state.channel ?: return
    Box(
        Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF1A1030), Color.Black))),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(contentAlignment = Alignment.Center) {
                if (state.phase == PlayerPhase.Tuning) SpinnerRing()
                ChannelLogo(channel, Modifier.size(84.dp), shape = CircleShape, padding = 14.dp)
            }
            Spacer(Modifier.height(18.dp))
            if (state.phase == PlayerPhase.Tuning) {
                Text("Tuning in to ${channel.name}…", style = MaterialTheme.typography.titleLarge, color = Color.White, textAlign = TextAlign.Center)
                Text(
                    "Server ${state.streamIndex + 1} of ${channel.streams.size}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Kino.TextLow,
                )
            } else {
                Text("This channel isn't responding", style = MaterialTheme.typography.titleLarge, color = Color.White)
                Text(
                    if (channel.isGeoBlocked) "It may only work in ${state.index?.countryName(channel.country) ?: "its home country"}."
                    else "Free streams come and go. Try again or hop to the next one.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Kino.TextLow,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 32.dp),
                )
                if (state.autoNextIn > 0) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Next channel in ${state.autoNextIn}… tap to stay",
                        style = MaterialTheme.typography.labelLarge,
                        color = Kino.Lime,
                        modifier = Modifier.bouncyClick(onClick = onCancelAutoNext).padding(6.dp),
                    )
                }
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("Try again", Icons.Rounded.Refresh, filled = false, onClick = onRetry)
                    if (channel.streams.size > 1) PillButton("Other server", Icons.Rounded.Dns, filled = false, onClick = onNextSource)
                    PillButton("Next channel", Icons.Rounded.SkipNext, filled = true, onClick = onNextChannel)
                }
            }
        }
    }
}

@Composable
private fun MovieStatus(movie: Movie, phase: PlayerPhase, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        AsyncImage(
            model = movie.still ?: movie.poster,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().graphicsLayer { alpha = 0.35f },
        )
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(contentAlignment = Alignment.Center) {
                if (phase == PlayerPhase.Tuning) SpinnerRing()
                AsyncImage(
                    model = movie.poster ?: movie.still,
                    contentDescription = movie.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(width = 64.dp, height = 94.dp).clip(RoundedCornerShape(12.dp)),
                )
            }
            Spacer(Modifier.height(18.dp))
            if (phase == PlayerPhase.Tuning) {
                Text("Loading ${movie.title}…", style = MaterialTheme.typography.titleLarge, color = Color.White, textAlign = TextAlign.Center)
            } else {
                Text("This movie didn't load", style = MaterialTheme.typography.titleLarge, color = Color.White)
                Text("Check your connection and try again.", style = MaterialTheme.typography.bodySmall, color = Kino.TextLow)
                Spacer(Modifier.height(16.dp))
                PillButton("Try again", Icons.Rounded.Refresh, filled = true, onClick = onRetry)
            }
        }
    }
}

@Composable
private fun SpinnerRing() {
    val spin = rememberInfiniteTransition(label = "spin")
    val angle by spin.animateFloat(0f, 360f, infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart), label = "angle")
    Box(
        Modifier
            .size(112.dp)
            .rotate(angle)
            .border(3.dp, Brush.sweepGradient(listOf(Color.Transparent, Kino.Pink, Kino.Violet, Kino.Lime)), CircleShape),
    )
}

@Composable
private fun GlassButton(icon: ImageVector, description: String, size: Int = 44, onClick: () -> Unit) {
    Box(
        Modifier
            .size(size.dp)
            .bouncyClick(pressedScale = 0.88f, onClick = onClick)
            .clip(CircleShape)
            .background(Color(0x40FFFFFF))
            .border(1.dp, Color(0x33FFFFFF), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, description, tint = Color.White, modifier = Modifier.size((size * 0.5f).dp))
    }
}

@Composable
private fun PillButton(label: String, icon: ImageVector, filled: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .bouncyClick(onClick = onClick)
            .clip(RoundedCornerShape(50))
            .then(if (filled) Modifier.background(Kino.BrandGradientH) else Modifier.background(Color(0x26FFFFFF)))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelLarge, color = Color.White)
    }
}
