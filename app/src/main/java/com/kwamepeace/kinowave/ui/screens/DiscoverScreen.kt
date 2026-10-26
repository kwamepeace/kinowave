package com.kwamepeace.kinowave.ui.screens

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Collection
import com.kwamepeace.kinowave.data.categoryLabel
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.Route
import com.kwamepeace.kinowave.ui.components.FilterChipK
import com.kwamepeace.kinowave.ui.components.PosterCard
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.components.collectionColors
import com.kwamepeace.kinowave.ui.theme.Kino
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

private val QUICK_SEARCHES = listOf("Bollywood", "Nollywood", "K-Drama", "Anime", "Horror", "Telenovelas", "Sports", "Comedy")

@Composable
fun DiscoverScreen(
    index: CatalogIndex,
    actions: Actions,
    regionCode: String,
    focusSearch: Boolean,
    visible: (List<Channel>) -> List<Channel>,
) {
    var query by rememberSaveable { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    LaunchedEffect(focusSearch) { if (focusSearch) runCatching { focus.requestFocus() } }

    // Debounced search off the main thread
    val results by produceState(SearchResults(), query, index) {
        delay(140)
        value = withContext(Dispatchers.Default) {
            SearchResults(index.matchingCollections(query), visible(index.search(query)))
        }
    }

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.statusBarsPadding().padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(12.dp))
            Text("Discover", style = MaterialTheme.typography.headlineLarge, color = Kino.TextHigh)
            Spacer(Modifier.height(14.dp))
            SearchField(
                query = query,
                onQuery = { query = it },
                modifier = Modifier.focusRequester(focus),
                onDone = { focusManager.clearFocus() },
            )
        }
        Spacer(Modifier.height(8.dp))

        LazyVerticalGrid(
            columns = GridCells.Adaptive(108.dp),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 130.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            if (query.isBlank()) {
                browseContent(index, actions, regionCode) { query = it }
            } else {
                if (results.collections.isNotEmpty()) {
                    fullLine("cols") {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(results.collections, key = { it.first.id }) { (col, _) ->
                                FilterChipK(col.title, selected = true, leading = col.emoji) {
                                    actions.push(Route.CollectionRoute(col.id))
                                }
                            }
                        }
                    }
                }
                fullLine("count") {
                    Text(
                        if (results.channels.isEmpty()) "No channels match \"$query\" yet. Try a country, language or genre."
                        else "${results.channels.size} channels",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Kino.TextLow,
                    )
                }
                items(results.channels, key = { it.id }) { ch ->
                    PosterCard(
                        ch,
                        width = null,
                        flag = index.countryFlag(ch.country),
                        onLongClick = { actions.play(ch, results.channels) },
                        onClick = { actions.open(ch) },
                    )
                }
            }
        }
    }
}

private data class SearchResults(
    val collections: List<Pair<Collection, List<Channel>>> = emptyList(),
    val channels: List<Channel> = emptyList(),
)

private fun LazyGridScope.fullLine(key: String, content: @Composable () -> Unit) {
    item(key = key, span = { GridItemSpan(maxLineSpan) }) { content() }
}

private fun LazyGridScope.browseContent(
    index: CatalogIndex,
    actions: Actions,
    regionCode: String,
    onQuickSearch: (String) -> Unit,
) {
    fullLine("quick") {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(QUICK_SEARCHES) { q -> FilterChipK(q, selected = false, leading = "🔎") { onQuickSearch(q) } }
        }
    }
    fullLine("vibes-title") { BrowseTitle("Browse by vibe") }
    // Two collection tiles per row
    index.rows.chunked(2).forEachIndexed { i, pair ->
        fullLine("vibes-$i") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                pair.forEach { (col, list) ->
                    VibeTile(col, list.size, Modifier.weight(1f)) { actions.push(Route.CollectionRoute(col.id)) }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }

    fullLine("countries-title") { BrowseTitle("Countries") }
    fullLine("countries") {
        val countries = index.countryCounts.map { it.first }.let { codes ->
            if (regionCode in codes) listOf(regionCode) + (codes - regionCode) else codes
        }.take(60)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(countries) { code ->
                FilterChipK(index.countryName(code), selected = code == regionCode, leading = index.countryFlag(code)) {
                    actions.push(Route.CountryRoute(code))
                }
            }
        }
    }

    fullLine("languages-title") { BrowseTitle("Languages") }
    fullLine("languages") {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(index.languageCounts.take(40)) { (code, _) ->
                FilterChipK(index.languageName(code), selected = false, leading = "🗣️") {
                    actions.push(Route.LanguageRoute(code))
                }
            }
        }
    }

    fullLine("genres-title") { BrowseTitle("All categories") }
    fullLine("genres") {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(index.categoryCounts) { (id, count) ->
                FilterChipK("${categoryLabel(id)} · $count", selected = false) { actions.push(Route.CategoryRoute(id)) }
            }
        }
    }
}

@Composable
private fun BrowseTitle(text: String) {
    Text(text, style = MaterialTheme.typography.headlineSmall, color = Kino.TextHigh, modifier = Modifier.padding(top = 10.dp))
}

@Composable
private fun VibeTile(col: Collection, count: Int, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Box(
        modifier
            .aspectRatio(1.55f)
            .bouncyClick(onClick = onClick)
            .clip(shape)
            .background(Brush.linearGradient(collectionColors(col.colors, col.id)))
            .border(1.dp, Color(0x26FFFFFF), shape)
            .padding(14.dp),
    ) {
        Text(col.emoji, fontSize = 34.sp, modifier = Modifier.align(Alignment.TopEnd))
        Column(Modifier.align(Alignment.BottomStart)) {
            Text(col.title, style = MaterialTheme.typography.titleLarge, color = Color.White, maxLines = 2)
            Text("$count channels", style = MaterialTheme.typography.labelMedium, color = Color(0xCCFFFFFF))
        }
    }
}

@Composable
fun SearchField(query: String, onQuery: (String) -> Unit, modifier: Modifier = Modifier, onDone: () -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color(0x14FFFFFF))
            .border(1.dp, Kino.Stroke, shape)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, null, tint = Kino.TextMid)
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f)) {
            if (query.isEmpty()) {
                Text("Bollywood, anime, Ghana, Hindi, CNN…", style = MaterialTheme.typography.bodyLarge, color = Kino.TextLow)
            }
            BasicTextField(
                value = query,
                onValueChange = onQuery,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = Kino.TextHigh),
                cursorBrush = SolidColor(Kino.Pink),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onDone() }),
                modifier = modifier.fillMaxWidth(),
            )
        }
        if (query.isNotEmpty()) {
            Icon(
                Icons.Rounded.Close,
                "Clear",
                tint = Kino.TextMid,
                modifier = Modifier.size(22.dp).bouncyClick { onQuery("") },
            )
        }
    }
}
