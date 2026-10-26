package com.kwamepeace.kinowave.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.categoryLabel
import com.kwamepeace.kinowave.data.qualityBadge
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.components.ChannelLogo
import com.kwamepeace.kinowave.ui.components.FilterChipK
import com.kwamepeace.kinowave.ui.components.Pill
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.theme.Kino

private val LIVE_CATEGORIES = listOf(
    null, "news", "sports", "movies", "entertainment", "music", "kids", "documentary", "series", "general", "religious",
)

/** Channel guide: pick a country and a category, tap to zap straight into the player. */
@Composable
fun LiveScreen(
    index: CatalogIndex,
    actions: Actions,
    regionCode: String,
    visible: (List<Channel>) -> List<Channel>,
) {
    val countries = remember(index, regionCode) {
        val codes = index.countryCounts.map { it.first }
        listOf("ALL") + (if (regionCode in codes) listOf(regionCode) + (codes - regionCode) else codes).take(80)
    }
    var country by rememberSaveable { mutableStateOf(if (regionCode in countries) regionCode else "ALL") }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    val list = remember(index, country, category) {
        val base = if (country == "ALL") index.channels else index.byCountry(country)
        visible(category?.let { c -> base.filter { c in it.categories } } ?: base)
    }
    val listState = rememberLazyListState()
    LaunchedEffect(country, category) { listState.scrollToItem(0) }

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.statusBarsPadding()) {
            Spacer(Modifier.height(12.dp))
            Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.Bottom) {
                Text("Live TV", style = MaterialTheme.typography.headlineLarge, color = Kino.TextHigh, modifier = Modifier.weight(1f))
                Text("${list.size} channels", style = MaterialTheme.typography.labelMedium, color = Kino.TextLow)
            }
            Spacer(Modifier.height(12.dp))
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(countries) { code ->
                    if (code == "ALL") FilterChipK("Worldwide", selected = country == code, leading = "🌍") { country = code }
                    else FilterChipK(index.countryName(code), selected = country == code, leading = index.countryFlag(code)) { country = code }
                }
            }
            Spacer(Modifier.height(8.dp))
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(LIVE_CATEGORIES) { c ->
                    FilterChipK(c?.let(::categoryLabel) ?: "Everything", selected = category == c) { category = c }
                }
            }
            Spacer(Modifier.height(6.dp))
        }

        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 130.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(list, key = { it.id }) { ch ->
                ChannelListItem(
                    ch,
                    subtitle = "${index.countryFlag(ch.country)}  ${ch.categories.take(2).joinToString(" · ") { categoryLabel(it) }.ifEmpty { index.countryName(ch.country) }}",
                    modifier = Modifier.animateItem(),
                    onLongClick = { actions.open(ch) },
                    onClick = { actions.play(ch, list) },
                )
            }
        }
    }
}

@Composable
fun ChannelListItem(
    channel: Channel,
    subtitle: String,
    modifier: Modifier = Modifier,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(20.dp)
    Row(
        modifier
            .fillMaxWidth()
            .bouncyClick(pressedScale = 0.97f, onLongClick = onLongClick, onClick = onClick)
            .clip(shape)
            .background(Kino.Surface)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ChannelLogo(channel, Modifier.size(width = 76.dp, height = 56.dp), shape = RoundedCornerShape(14.dp), padding = 7.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(channel.name, style = MaterialTheme.typography.titleMedium, color = Kino.TextHigh, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Kino.TextLow, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (channel.isGeoBlocked || channel.isPartTime) {
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (channel.isGeoBlocked) Pill("GEO-LOCKED", background = Color(0x33FFB020), color = Color(0xFFFFC857))
                    if (channel.isPartTime) Pill("PART-TIME", background = Color(0x333DDCFF), color = Kino.Cyan)
                }
            }
        }
        qualityBadge(channel.bestQuality)?.let {
            Pill(it, background = Color(0x1AFFFFFF), color = Kino.TextMid)
            Spacer(Modifier.width(8.dp))
        }
        Box(
            Modifier.size(38.dp).clip(CircleShape).background(Kino.BrandGradient),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.PlayArrow, "Play", tint = Color.White, modifier = Modifier.size(22.dp))
        }
    }
}
