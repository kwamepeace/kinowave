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
import com.kwamepeace.kinowave.ui.HomeRow
import com.kwamepeace.kinowave.ui.resolve
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.data.Profile
import androidx.compose.foundation.layout.width
import com.kwamepeace.kinowave.ui.Route
import com.kwamepeace.kinowave.ui.components.FilterChipK
import com.kwamepeace.kinowave.ui.components.HeroCarousel
import com.kwamepeace.kinowave.ui.components.PosterRow
import com.kwamepeace.kinowave.ui.components.Top10Row
import com.kwamepeace.kinowave.ui.components.ContinueWatchingRow
import com.kwamepeace.kinowave.ui.components.MoviePoster
import com.kwamepeace.kinowave.ui.components.MoviePosterRow
import com.kwamepeace.kinowave.ui.components.PosterCard
import com.kwamepeace.kinowave.ui.components.SectionHeader
import com.kwamepeace.kinowave.ui.components.Watchable
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.screens.ProfileAvatar
import com.kwamepeace.kinowave.ui.theme.Display
import com.kwamepeace.kinowave.ui.theme.Kino

@Composable
fun HomeScreen(
    vm: AppViewModel,
    index: CatalogIndex,
    actions: Actions,
    onSearch: () -> Unit,
    onCategories: () -> Unit,
    onProfile: () -> Unit,
) {
    val profile by vm.activeProfile.collectAsStateWithLifecycle()
    val home by vm.home.collectAsStateWithLifecycle()
    val filter by vm.homeFilter.collectAsStateWithLifecycle()
    val myList by vm.prefs.myList.collectAsStateWithLifecycle()
    val recents by vm.prefs.recents.collectAsStateWithLifecycle()
    val progress by vm.prefs.progress.collectAsStateWithLifecycle()
    val dataSaver by vm.settings.dataSaver.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val barAlpha by remember {
        derivedStateOf {
            if (listState.firstVisibleItemIndex > 0) 1f
            else (listState.firstVisibleItemScrollOffset / 300f).coerceIn(0f, 1f)
        }
    }
    val flagOf = { ch: Channel -> index.countryFlag(ch.country) }
    val progressOf = { m: Movie -> progress[m.id]?.let { (pos, dur) -> if (dur > 0) pos.toFloat() / dur else null } }

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
                    saved = { item -> (item.movie?.listKey ?: item.channel?.id) in myList },
                    flagOf = index::countryFlag,
                    lightweight = dataSaver,
                    onPlay = { item ->
                        item.movie?.let(actions.playMovie)
                            ?: item.channel?.let { ch -> actions.play(ch, home.hero.mapNotNull { it.channel }) }
                    },
                    onOpen = { item -> item.movie?.let(actions.openMovie) ?: item.channel?.let(actions.open) },
                    onToggleList = { item ->
                        item.movie?.let { vm.toggleMyList(it) } ?: item.channel?.let(actions.toggleList)
                    },
                )
            }
            val continueItems = index.resolve(recents, progress)
            if (continueItems.isNotEmpty() && filter != HomeFilter.Tv) {
                item(key = "recents") {
                    ContinueWatchingRow(
                        continueItems,
                        onOpen = actions::openItem,
                        onPlay = { actions.playItem(it, continueItems) },
                    )
                }
            }
            if (home.top10.size >= 5) {
                item(key = "top10") {
                    val region = home.regionCode
                    Top10Row(
                        if (region != null) "Top 10 in ${index.countryName(region)} ${index.countryFlag(region)}" else "Top 10 Today",
                        home.top10,
                        onOpen = actions.open,
                        onPlay = { actions.play(it, home.top10) },
                    )
                }
            }
            val saved = index.resolve(myList)
            if (saved.isNotEmpty() && filter == HomeFilter.All) {
                item(key = "mylist") {
                    Column {
                        SectionHeader("My List", emoji = "💜")
                        Spacer(Modifier.height(12.dp))
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(saved, key = { it.key }) { item ->
                                when (item) {
                                    is Watchable.Live -> PosterCard(
                                        item.channel,
                                        flag = flagOf(item.channel),
                                        onLongClick = { actions.playItem(item, saved) },
                                        onClick = { actions.openItem(item) },
                                    )
                                    is Watchable.Film -> MoviePoster(
                                        item.movie,
                                        progress = progressOf(item.movie),
                                        onLongClick = { actions.playItem(item, saved) },
                                        onClick = { actions.openItem(item) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
            items(home.rows, key = { it.key }) { row ->
                when (row) {
                    is HomeRow.Channels -> PosterRow(
                        modifier = Modifier.animateItem(),
                        title = row.collection.title,
                        channels = row.channels,
                        emoji = row.collection.emoji,
                        subtitle = row.collection.subtitle,
                        flagOf = flagOf,
                        onOpen = actions.open,
                        onPlay = { actions.play(it, row.channels) },
                        // Personal "fy-" rows are computed on the fly and have no full page
                        onSeeAll = if (row.collection.id.startsWith("fy-")) null else { { actions.push(Route.CollectionRoute(row.collection.id)) } },
                    )
                    is HomeRow.Movies -> MoviePosterRow(
                        modifier = Modifier.animateItem(),
                        title = row.row.title,
                        movies = row.movies,
                        emoji = row.row.emoji,
                        subtitle = when {
                            row.row.id.startsWith("yt-") -> "New releases · free from the official studio"
                            row.row.id.startsWith("fy-") -> null
                            else -> "Free classic movies · on demand"
                        },
                        progressOf = progressOf,
                        onOpen = actions.openMovie,
                        onPlay = actions.playMovie,
                        onSeeAll = if (row.row.id.startsWith("fy-")) null else { { actions.push(Route.MovieRowRoute(row.row.id)) } },
                    )
                }
            }
            item(key = "footer") {
                Text(
                    "Live channels from the open-source iptv-org project. Movies from the Internet Archive's public-domain collection.\nKinoWave doesn't host any video.",
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
            profile = profile,
            onProfile = onProfile,
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
    profile: Profile?,
    onProfile: () -> Unit,
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
                    if (profile != null) {
                        Spacer(Modifier.width(8.dp))
                        ProfileAvatar(profile, size = 44.dp, modifier = Modifier.bouncyClick(onClick = onProfile))
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
