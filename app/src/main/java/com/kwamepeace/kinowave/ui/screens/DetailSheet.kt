package com.kwamepeace.kinowave.ui.screens

import android.content.Intent
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.categoryLabel
import com.kwamepeace.kinowave.data.qualityBadge
import com.kwamepeace.kinowave.ui.components.ChannelLogo
import com.kwamepeace.kinowave.ui.components.GradientScrim
import com.kwamepeace.kinowave.ui.components.Pill
import com.kwamepeace.kinowave.ui.components.PosterCard
import com.kwamepeace.kinowave.ui.components.SectionHeader
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.components.seedColors
import com.kwamepeace.kinowave.ui.theme.Kino

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DetailSheet(
    channel: Channel,
    index: CatalogIndex,
    saved: Boolean,
    onDismiss: () -> Unit,
    onPlay: (Channel, Int) -> Unit,
    onToggleList: () -> Unit,
    onOpenOther: (Channel) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val similar = remember(channel, index) { index.similarTo(channel) }
    val context = LocalContext.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Kino.Ink,
        shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
        dragHandle = null,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(bottom = 24.dp),
        ) {
            // Banner
            Box(Modifier.fillMaxWidth().aspectRatio(1.5f).background(Brush.linearGradient(seedColors(channel.id)))) {
                if (channel.logo != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    AsyncImage(
                        model = channel.logo,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().graphicsLayer { alpha = 0.5f }.blur(56.dp),
                    )
                }
                Box(
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 12.dp)
                        .size(width = 40.dp, height = 5.dp)
                        .clip(CircleShape)
                        .background(Color(0x66FFFFFF)),
                )
                ChannelLogo(
                    channel,
                    Modifier.align(Alignment.Center).fillMaxWidth(0.36f).aspectRatio(1f),
                    shape = RoundedCornerShape(28.dp),
                    padding = 16.dp,
                )
                GradientScrim(
                    Modifier.fillMaxWidth().height(90.dp).align(Alignment.BottomCenter),
                    listOf(Color.Transparent, Kino.Ink),
                )
            }

            Column(Modifier.padding(horizontal = 20.dp)) {
                Text(channel.name, style = MaterialTheme.typography.displayMedium, color = Kino.TextHigh)
                Spacer(Modifier.height(8.dp))
                val meta = buildList {
                    add("${index.countryFlag(channel.country)} ${index.countryName(channel.country)}")
                    channel.languages.take(2).forEach { add(index.languageName(it)) }
                    channel.network?.let(::add)
                }
                Text(meta.joinToString("  •  "), style = MaterialTheme.typography.bodyMedium, color = Kino.TextMid)
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill("● LIVE", background = Kino.Lime, color = Color(0xFF0B0B0B))
                    qualityBadge(channel.bestQuality)?.let { Pill(it, background = Color(0x1FFFFFFF)) }
                    channel.categories.forEach { Pill(categoryLabel(it), background = Color(0x1FFFFFFF)) }
                    if (channel.isGeoBlocked) Pill("GEO-LOCKED", background = Color(0x33FFB020), color = Color(0xFFFFC857))
                    if (channel.isPartTime) Pill("NOT 24/7", background = Color(0x333DDCFF), color = Kino.Cyan)
                }

                Spacer(Modifier.height(20.dp))
                Row(
                    Modifier
                        .fillMaxWidth()
                        .bouncyClick(pressedScale = 0.97f) { onPlay(channel, 0) }
                        .clip(RoundedCornerShape(50))
                        .background(Color.White)
                        .padding(vertical = 15.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.PlayArrow, null, tint = Color.Black)
                    Spacer(Modifier.width(6.dp))
                    Text("Watch live", style = MaterialTheme.typography.labelLarge, color = Color.Black)
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SheetAction(if (saved) Icons.Rounded.Check else Icons.Rounded.Add, if (saved) "In My List" else "My List", Modifier.weight(1f), onToggleList)
                    SheetAction(Icons.Rounded.Share, "Share", Modifier.weight(1f)) {
                        val send = Intent(Intent.ACTION_SEND)
                            .setType("text/plain")
                            .putExtra(Intent.EXTRA_TEXT, "Watching ${channel.name} live on KinoWave 📺✨")
                        context.startActivity(Intent.createChooser(send, "Share ${channel.name}"))
                    }
                }

                if (channel.streams.size > 1) {
                    Spacer(Modifier.height(22.dp))
                    Text("Sources", style = MaterialTheme.typography.headlineSmall, color = Kino.TextHigh)
                    Text(
                        "If one doesn't load, try another.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Kino.TextLow,
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }

            if (channel.streams.size > 1) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    itemsIndexed(channel.streams) { i, s ->
                        val label = buildString {
                            append("Server ${i + 1}")
                            qualityBadge(s.quality)?.let { append(" · ").append(it) }
                            if (s.geoBlocked) append(" · 🔒")
                        }
                        Text(
                            label,
                            style = MaterialTheme.typography.labelLarge,
                            color = Kino.TextHigh,
                            modifier = Modifier
                                .bouncyClick { onPlay(channel, i) }
                                .clip(RoundedCornerShape(50))
                                .background(Kino.Surface)
                                .border(1.dp, Kino.Stroke, RoundedCornerShape(50))
                                .padding(horizontal = 14.dp, vertical = 9.dp),
                        )
                    }
                }
            }

            if (similar.isNotEmpty()) {
                Spacer(Modifier.height(26.dp))
                SectionHeader("More like this", emoji = "✨")
                Spacer(Modifier.height(12.dp))
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(similar, key = { it.id }) { ch ->
                        PosterCard(ch, width = 112.dp, flag = index.countryFlag(ch.country)) { onOpenOther(ch) }
                    }
                }
            }
        }
    }
}

@Composable
private fun SheetAction(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .bouncyClick(onClick = onClick)
            .clip(RoundedCornerShape(50))
            .background(Kino.Surface)
            .border(1.dp, Kino.Stroke, RoundedCornerShape(50))
            .padding(vertical = 13.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = Kino.TextHigh, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelLarge, color = Kino.TextHigh)
    }
}
