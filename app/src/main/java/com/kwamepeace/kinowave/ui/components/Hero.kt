package com.kwamepeace.kinowave.ui.components

import android.os.Build
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.coerceIn
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import coil3.compose.AsyncImage
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Collection
import com.kwamepeace.kinowave.data.categoryLabel
import com.kwamepeace.kinowave.data.qualityBadge
import com.kwamepeace.kinowave.ui.theme.Kino
import kotlinx.coroutines.delay
import kotlin.math.absoluteValue

/** Big swipeable spotlight carousel at the top of Home. */
@Composable
fun HeroCarousel(
    items: List<Pair<Collection, Channel>>,
    inMyList: (Channel) -> Boolean,
    flagOf: (Channel) -> String,
    onPlay: (Channel) -> Unit,
    onOpen: (Channel) -> Unit,
    onToggleList: (Channel) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return
    val pager = rememberPagerState { items.size }
    val dragged by pager.interactionSource.collectIsDraggedAsState()

    // Gentle auto-advance; pauses while the user is swiping
    LaunchedEffect(pager, dragged, items.size) {
        if (dragged) return@LaunchedEffect
        while (true) {
            delay(6_000)
            pager.animateScrollToPage((pager.currentPage + 1) % items.size)
        }
    }

    BoxWithConstraints(modifier) {
        // Phones get a tall poster card; tablets and landscape get a wide, height-capped banner
        val wide = maxWidth >= 600.dp
        val cardHeight = if (wide) (maxWidth * 0.4f).coerceIn(280.dp, 420.dp) else null
        Column {
            HorizontalPager(
                state = pager,
                contentPadding = PaddingValues(horizontal = if (wide) 48.dp else 28.dp),
                pageSpacing = 14.dp,
                key = { items[it].second.id },
            ) { page ->
                val (col, ch) = items[page]
                HeroCard(
                    collection = col,
                    channel = ch,
                    flag = flagOf(ch),
                    saved = inMyList(ch),
                    pager = pager,
                    page = page,
                    wideHeight = cardHeight,
                    onPlay = { onPlay(ch) },
                    onOpen = { onOpen(ch) },
                    onToggleList = { onToggleList(ch) },
                )
            }
            Spacer(Modifier.height(14.dp))
            PagerDots(items.size, pager.currentPage, Modifier.align(Alignment.CenterHorizontally))
        }
    }
}

@Composable
private fun HeroCard(
    collection: Collection,
    channel: Channel,
    flag: String,
    saved: Boolean,
    pager: PagerState,
    page: Int,
    wideHeight: Dp?,
    onPlay: () -> Unit,
    onOpen: () -> Unit,
    onToggleList: () -> Unit,
) {
    val wide = wideHeight != null
    val colors = collectionColors(collection.colors, channel.id)
    val shape = RoundedCornerShape(30.dp)
    val offset = ((pager.currentPage - page) + pager.currentPageOffsetFraction).absoluteValue.coerceIn(0f, 1f)

    Box(
        Modifier
            .fillMaxWidth()
            .then(if (wideHeight != null) Modifier.height(wideHeight) else Modifier.aspectRatio(0.74f))
            .graphicsLayer {
                val s = lerp(1f, 0.9f, offset)
                scaleX = s
                scaleY = s
                alpha = lerp(1f, 0.55f, offset)
            }
            .bouncyClick(pressedScale = 0.97f, onClick = onOpen)
            .clip(shape)
            .background(Brush.linearGradient(colors))
            .border(1.dp, Color(0x33FFFFFF), shape),
    ) {
        // Blurred logo wash for depth (blur needs Android 12+, older phones just get the gradient)
        if (channel.logo != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AsyncImage(
                model = channel.logo,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer { alpha = 0.45f; translationX = offset * 60f }
                    .blur(48.dp),
            )
        }
        ChannelLogo(
            channel,
            Modifier
                .then(
                    if (wideHeight != null) Modifier.align(Alignment.CenterEnd).padding(end = 56.dp).size(wideHeight * 0.58f)
                    else Modifier.align(Alignment.TopCenter).padding(top = 64.dp).fillMaxWidth(0.5f).aspectRatio(1f),
                )
                .graphicsLayer { translationX = (pager.currentPage - page + pager.currentPageOffsetFraction) * -90f },
            shape = RoundedCornerShape(30.dp),
            padding = 18.dp,
        )
        if (wide) {
            // Darken the left side where the text sits, keep the logo side bright
            Box(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(listOf(Color(0xF207070B), Color(0xB3000000), Color.Transparent)),
                ),
            )
        } else {
            GradientScrim(
                Modifier.fillMaxWidth().fillMaxHeight(0.62f).align(Alignment.BottomCenter),
                listOf(Color.Transparent, Color(0xB3000000), Color(0xF207070B)),
            )
        }
        Row(
            Modifier.align(Alignment.TopStart).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LivePill()
            Pill("${collection.emoji} ${collection.title}", background = Color(0x66000000))
        }

        Column(
            Modifier
                .align(Alignment.BottomStart)
                .then(if (wide) Modifier.fillMaxWidth(0.55f).padding(28.dp) else Modifier.padding(20.dp)),
        ) {
            Text(
                channel.name,
                style = MaterialTheme.typography.displayMedium,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(6.dp))
            val tags = buildList {
                add(flag)
                addAll(channel.categories.take(2).map(::categoryLabel))
                qualityBadge(channel.bestQuality)?.let(::add)
            }
            Text(tags.joinToString("  •  "), style = MaterialTheme.typography.bodyMedium, color = Kino.TextMid)
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier
                        .weight(1f)
                        .bouncyClick(onClick = onPlay)
                        .clip(RoundedCornerShape(50))
                        .background(Color.White)
                        .padding(vertical = 13.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.PlayArrow, null, tint = Color.Black)
                    Spacer(Modifier.width(4.dp))
                    Text("Watch now", style = MaterialTheme.typography.labelLarge, color = Color.Black)
                }
                Box(
                    Modifier
                        .size(48.dp)
                        .bouncyClick(onClick = onToggleList)
                        .clip(CircleShape)
                        .background(Color(0x33FFFFFF))
                        .border(1.dp, Color(0x40FFFFFF), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(if (saved) Icons.Rounded.Check else Icons.Rounded.Add, "My List", tint = Color.White)
                }
            }
        }
    }
}

@Composable
private fun PagerDots(count: Int, current: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(count) { i ->
            val active = i == current
            val width by animateDpAsState(if (active) 22.dp else 6.dp, label = "dot")
            Box(
                Modifier
                    .height(6.dp)
                    .width(width)
                    .clip(CircleShape)
                    .background(if (active) Kino.BrandGradientH else Brush.linearGradient(listOf(Color(0x40FFFFFF), Color(0x40FFFFFF)))),
            )
        }
    }
}
