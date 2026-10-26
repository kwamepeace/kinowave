package com.kwamepeace.kinowave.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.ui.theme.Display
import com.kwamepeace.kinowave.ui.theme.Kino
import kotlin.math.abs

/** Two vivid colors derived from a string, so every channel gets its own stable poster gradient. */
fun seedColors(seed: String): List<Color> {
    val hue = (abs(seed.hashCode()) % 360).toFloat()
    return listOf(
        Color.hsl(hue, 0.78f, 0.52f),
        Color.hsl((hue + 48f) % 360f, 0.72f, 0.26f),
    )
}

fun parseHex(hex: String): Color =
    runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Kino.Violet)

fun collectionColors(hex: List<String>, fallbackSeed: String): List<Color> =
    if (hex.size >= 2) hex.map(::parseHex) else seedColors(fallbackSeed)

/** Light tap haptic. */
@Composable
fun rememberTick(): () -> Unit {
    val haptics = LocalHapticFeedback.current
    return remember(haptics) { { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) } }
}

/** Springy press-to-shrink click, with optional long press. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Modifier.bouncyClick(
    pressedScale: Float = 0.94f,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
): Modifier {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "press",
    )
    val tick = rememberTick()
    val haptics = LocalHapticFeedback.current
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .combinedClickable(
            interactionSource = interaction,
            indication = null,
            onLongClick = onLongClick?.let { long -> { haptics.performHapticFeedback(HapticFeedbackType.LongPress); long() } },
            onClick = { tick(); onClick() },
        )
}

/**
 * Channel logo on a soft light tile (most iptv-org logos are drawn for light backgrounds),
 * falling back to a monogram when there is no logo or it fails to load.
 */
@Composable
fun ChannelLogo(
    channel: Channel,
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(18.dp),
    padding: Dp = 10.dp,
) {
    var failed by remember(channel.logo) { mutableStateOf(channel.logo == null) }
    Box(
        modifier
            .clip(shape)
            .background(if (failed) Brush.linearGradient(seedColors(channel.id)) else Brush.linearGradient(listOf(Color(0xFFF7F7FB), Color(0xFFE4E4EE)))),
        contentAlignment = Alignment.Center,
    ) {
        if (failed) {
            Text(
                monogram(channel.name),
                fontFamily = Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
        } else {
            AsyncImage(
                model = channel.logo,
                contentDescription = channel.name,
                contentScale = ContentScale.Fit,
                onError = { failed = true },
                modifier = Modifier.fillMaxSize().padding(padding),
            )
        }
    }
}

private fun monogram(name: String): String =
    name.split(' ', '-', '.').filter { it.isNotBlank() && it.first().isLetterOrDigit() }
        .take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "TV" }

@Composable
fun Pill(
    text: String,
    modifier: Modifier = Modifier,
    background: Color = Color(0x99000000),
    color: Color = Color.White,
) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(background)
            .padding(horizontal = 7.dp, vertical = 3.dp),
    )
}

@Composable
fun LivePill(modifier: Modifier = Modifier) {
    val pulse = rememberInfiniteTransition(label = "live")
    val alpha by pulse.animateFloat(
        initialValue = 1f,
        targetValue = 0.25f,
        animationSpec = infiniteRepeatable(tween(850), RepeatMode.Reverse),
        label = "dot",
    )
    Row(
        modifier
            .clip(RoundedCornerShape(50))
            .background(Kino.Lime)
            .padding(horizontal = 7.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(6.dp).graphicsLayer { this.alpha = alpha }.clip(CircleShape).background(Color(0xFF0B0B0B)))
        Text("LIVE", style = MaterialTheme.typography.labelSmall, color = Color(0xFF0B0B0B))
    }
}

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    emoji: String = "",
    subtitle: String? = null,
    onSeeAll: (() -> Unit)? = null,
) {
    Row(
        modifier.padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            androidx.compose.foundation.layout.Column {
                Text(
                    if (emoji.isNotEmpty()) "$emoji  $title" else title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = Kino.TextHigh,
                )
                if (subtitle != null) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Kino.TextLow)
                }
            }
        }
        if (onSeeAll != null) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .bouncyClick(onClick = onSeeAll)
                    .background(Color(0x14FFFFFF))
                    .padding(start = 12.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("See all", style = MaterialTheme.typography.labelMedium, color = Kino.TextMid)
                Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = Kino.TextMid, modifier = Modifier.size(18.dp))
            }
        }
    }
}

/** Gradient-filled selectable chip used for filters across the app. */
@Composable
fun FilterChipK(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    leading: String? = null,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(50)
    Row(
        modifier
            .bouncyClick(onClick = onClick)
            .clip(shape)
            .then(
                if (selected) Modifier.background(Kino.BrandGradientH)
                else Modifier.background(Color(0x12FFFFFF)).border(1.dp, Kino.Stroke, shape),
            )
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            Text(leading, fontSize = 14.sp)
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) Color.White else Kino.TextMid,
        )
    }
}

@Composable
fun GradientScrim(modifier: Modifier = Modifier, colors: List<Color>) {
    Box(modifier.background(Brush.verticalGradient(colors)))
}

/** Small helper so cards can share the "pressed" scale without a click (e.g. pager pages). */
@Composable
fun Modifier.softScale(target: Float): Modifier {
    val s by animateFloatAsState(target, spring(stiffness = Spring.StiffnessLow), label = "softScale")
    return this.scale(s)
}

/** Lets a grid/list item span edge to edge, ignoring the container's horizontal [padding]. */
fun Modifier.bleed(padding: Dp): Modifier = this.layout { measurable, constraints ->
    val extra = padding.roundToPx() * 2
    val width = constraints.maxWidth + extra
    val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}
