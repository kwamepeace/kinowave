package com.kwamepeace.kinowave.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Canvas
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.qualityBadge
import com.kwamepeace.kinowave.ui.theme.Display
import com.kwamepeace.kinowave.ui.theme.Kino

/** Portrait channel poster: vivid gradient, logo tile, name, LIVE + quality badges. */
@Composable
fun PosterCard(
    channel: Channel,
    modifier: Modifier = Modifier,
    width: Dp? = 124.dp,
    flag: String? = null,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val colors = seedColors(channel.id)
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .aspectRatio(0.68f)
            .bouncyClick(onLongClick = onLongClick, onClick = onClick)
            .clip(shape)
            .background(Brush.linearGradient(colors))
            .border(1.dp, Color(0x22FFFFFF), shape),
    ) {
        // Soft glow behind the logo tile
        Box(
            Modifier
                .align(Alignment.Center)
                .offset(y = (-14).dp)
                .size(110.dp)
                .background(Brush.radialGradient(listOf(Color(0x55FFFFFF), Color.Transparent)), CircleShape),
        )
        ChannelLogo(
            channel,
            Modifier
                .align(Alignment.Center)
                .offset(y = (-14).dp)
                .fillMaxWidth(0.66f)
                .aspectRatio(1f),
            shape = RoundedCornerShape(18.dp),
        )
        GradientScrim(
            Modifier.fillMaxWidth().height(70.dp).align(Alignment.BottomCenter),
            listOf(Color.Transparent, Color(0xCC000000)),
        )
        Text(
            channel.name,
            style = MaterialTheme.typography.titleSmall,
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 10.dp, vertical = 9.dp),
        )
        Row(
            Modifier.align(Alignment.TopStart).padding(8.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (flag != null) Text(flag, fontSize = 14.sp) else Spacer(Modifier.size(1.dp))
            qualityBadge(channel.bestQuality)?.let { Pill(it) }
        }
    }
}

/** Netflix-style Top 10 card: giant outlined rank number tucked behind the poster. */
@Composable
fun Top10Card(rank: Int, channel: Channel, onLongClick: (() -> Unit)?, onClick: () -> Unit) {
    val measurer = rememberTextMeasurer()
    val numberStyle = TextStyle(fontFamily = Display, fontWeight = FontWeight.ExtraBold, fontSize = 128.sp, letterSpacing = (-10).sp)
    Box(Modifier.width(if (rank >= 10) 206.dp else 176.dp).height(172.dp)) {
        Canvas(Modifier.fillMaxSize()) {
            val layout = measurer.measure(rank.toString(), numberStyle)
            val top = size.height - layout.size.height + 22f
            drawText(layout, color = Color(0xFF07070B), topLeft = androidx.compose.ui.geometry.Offset(0f, top))
            drawText(
                layout,
                brush = Brush.verticalGradient(listOf(Kino.Lime, Kino.Pink)),
                topLeft = androidx.compose.ui.geometry.Offset(0f, top),
                drawStyle = Stroke(width = 5f),
            )
        }
        PosterCard(
            channel,
            Modifier.align(Alignment.CenterEnd),
            width = 117.dp,
            onLongClick = onLongClick,
            onClick = onClick,
        )
    }
}

/** Landscape card for "Continue watching". */
@Composable
fun WideCard(channel: Channel, onLongClick: (() -> Unit)?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    Column(Modifier.width(196.dp)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .bouncyClick(onLongClick = onLongClick, onClick = onClick)
                .clip(shape)
                .background(Brush.linearGradient(seedColors(channel.id)))
                .border(1.dp, Color(0x22FFFFFF), shape),
        ) {
            ChannelLogo(
                channel,
                Modifier.align(Alignment.Center).size(width = 96.dp, height = 64.dp),
                shape = RoundedCornerShape(14.dp),
                padding = 8.dp,
            )
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Color(0xE6FFFFFF)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.PlayArrow, null, tint = Color.Black, modifier = Modifier.size(20.dp))
            }
            LivePill(Modifier.align(Alignment.TopStart).padding(8.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(
            channel.name,
            style = MaterialTheme.typography.titleSmall,
            color = Kino.TextHigh,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

@Composable
fun PosterRow(
    title: String,
    channels: List<Channel>,
    onOpen: (Channel) -> Unit,
    onPlay: (Channel) -> Unit,
    modifier: Modifier = Modifier,
    emoji: String = "",
    subtitle: String? = null,
    flagOf: ((Channel) -> String)? = null,
    onSeeAll: (() -> Unit)? = null,
) {
    Column(modifier) {
        SectionHeader(title, emoji = emoji, subtitle = subtitle, onSeeAll = onSeeAll)
        Spacer(Modifier.height(12.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(channels, key = { it.id }) { ch ->
                PosterCard(ch, flag = flagOf?.invoke(ch), onLongClick = { onPlay(ch) }, onClick = { onOpen(ch) })
            }
        }
    }
}

@Composable
fun Top10Row(
    title: String,
    channels: List<Channel>,
    onOpen: (Channel) -> Unit,
    onPlay: (Channel) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        SectionHeader(title, emoji = "🔥")
        Spacer(Modifier.height(8.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            itemsIndexed(channels.take(10), key = { _, ch -> ch.id }) { i, ch ->
                Top10Card(i + 1, ch, onLongClick = { onPlay(ch) }, onClick = { onOpen(ch) })
            }
        }
    }
}

@Composable
fun WideRow(
    title: String,
    channels: List<Channel>,
    onOpen: (Channel) -> Unit,
    onPlay: (Channel) -> Unit,
    modifier: Modifier = Modifier,
    emoji: String = "",
) {
    Column(modifier) {
        SectionHeader(title, emoji = emoji)
        Spacer(Modifier.height(12.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(channels, key = { it.id }) { ch ->
                WideCard(ch, onLongClick = { onOpen(ch) }, onClick = { onPlay(ch) })
            }
        }
    }
}
