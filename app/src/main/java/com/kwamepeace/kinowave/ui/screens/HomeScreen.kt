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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.AppViewModel
import com.kwamepeace.kinowave.ui.HomeFilter
import com.kwamepeace.kinowave.ui.Route
import com.kwamepeace.kinowave.ui.components.FilterChipK
import com.kwamepeace.kinowave.ui.components.HeroCarousel
import com.kwamepeace.kinowave.ui.components.PosterRow
import com.kwamepeace.kinowave.ui.components.Top10Row
import com.kwamepeace.kinowave.ui.components.WideRow
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.theme.Display
import com.kwamepeace.kinowave.ui.theme.Kino

@Composable
fun HomeScreen(
    vm: AppViewModel,
    index: CatalogIndex,
    actions: Actions,
    onSearch: () -> Unit,
    onCategories: () -> Unit,
) {
    val home by vm.home.collectAsStateWithLifecycle()
    val filter by vm.homeFilter.collectAsStateWithLifecycle()
    val myList by vm.prefs.myList.collectAsStateWithLifecycle()
    val recents by vm.prefs.recents.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val barAlpha by remember {
        derivedStateOf {
            if (listState.firstVisibleItemIndex > 0) 1f
            else (listState.firstVisibleItemScrollOffset / 300f).coerceIn(0f, 1f)
        }
    }
    val flagOf = { ch: com.kwamepeace.kinowave.data.Channel -> index.countryFlag(ch.country) }

    Box(Modifier.fillMaxSize()) {
        LaunchedEffect(filter) { listState.scrollToItem(0) }
        LazyColumn(
                state = listState,
                contentPadding = PaddingValues(bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                item(key = "top-space") {
                    Spacer(Modifier.statusBarsPadding().height(112.dp))
                }
                item(key = "hero") {
                    HeroCarousel(
                        items = home.hero,
                        inMyList = { it.id in myList },
                        flagOf = flagOf,
                        onPlay = { ch -> actions.play(ch, home.hero.map { it.second }) },
                        onOpen = actions.open,
                        onToggleList = actions.toggleList,
                    )
                }
                val recentChannels = recents.mapNotNull(index.byId::get)
                if (recentChannels.isNotEmpty() && filter == HomeFilter.All) {
                    item(key = "recents") {
                        WideRow(
                            "Continue watching",
                            recentChannels,
                            emoji = "⏯️",
                            onOpen = actions.open,
                            onPlay = { actions.play(it, recentChannels) },
                        )
                    }
                }
                if (home.top10.size >= 5) {
                    item(key = "top10") {
                        val region = home.regionCode
                        Top10Row(
                            if (region != null) "Top 10 in ${index.countryName(region)} ${index.countryFlag(region)}" else "Top 10 Movie Channels",
                            home.top10,
                            onOpen = actions.open,
                            onPlay = { actions.play(it, home.top10) },
                        )
                    }
                }
                val saved = myList.mapNotNull(index.byId::get)
                if (saved.isNotEmpty() && filter == HomeFilter.All) {
                    item(key = "mylist") {
                        PosterRow(
                            "My List",
                            saved,
                            emoji = "💜",
                            flagOf = flagOf,
                            onOpen = actions.open,
                            onPlay = { actions.play(it, saved) },
                        )
                    }
                }
                items(home.rows, key = { it.first.id }) { (col, list) ->
                    PosterRow(
                        modifier = Modifier.animateItem(),
                        title = col.title,
                        channels = list,
                        emoji = col.emoji,
                        subtitle = col.subtitle,
                        flagOf = flagOf,
                        onOpen = actions.open,
                        onPlay = { actions.play(it, list) },
                        onSeeAll = { actions.push(Route.CollectionRoute(col.id)) },
                    )
                }
                item(key = "footer") {
                    Text(
                        "Streams from the open-source iptv-org project.\nKinoWave doesn't host any video.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Kino.TextLow,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    )
                }
            }

        HomeTopBar(
            filter = filter,
            backgroundAlpha = barAlpha,
            onFilter = { vm.homeFilter.value = it },
            onSearch = onSearch,
            onCategories = onCategories,
        )
    }
}

@Composable
private fun HomeTopBar(
    filter: HomeFilter,
    backgroundAlpha: Float,
    onFilter: (HomeFilter) -> Unit,
    onSearch: () -> Unit,
    onCategories: () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth()) {
            Box(
                Modifier
                    .matchParentSize()
                    .graphicsLayer { alpha = backgroundAlpha }
                    .background(Color(0xF207070B)),
            )
            Column(Modifier.statusBarsPadding()) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "KinoWave",
                        style = TextStyle(
                            brush = Kino.BrandGradientH,
                            fontFamily = Display,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 28.sp,
                            letterSpacing = (-1).sp,
                        ),
                        modifier = Modifier.weight(1f),
                    )
                    Box(
                        Modifier
                            .size(44.dp)
                            .bouncyClick(onClick = onSearch)
                            .clip(CircleShape)
                            .background(Color(0x14FFFFFF)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Rounded.Search, "Search", tint = Color.White)
                    }
                }
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(HomeFilter.entries) { f ->
                        FilterChipK(f.label, selected = f == filter) { onFilter(f) }
                    }
                    item {
                        Row(
                            Modifier
                                .bouncyClick(onClick = onCategories)
                                .clip(CircleShape)
                                .background(Color(0x12FFFFFF))
                                .padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Categories", style = MaterialTheme.typography.labelLarge, color = Kino.TextMid)
                            Icon(Icons.Rounded.KeyboardArrowDown, null, tint = Kino.TextMid, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}
