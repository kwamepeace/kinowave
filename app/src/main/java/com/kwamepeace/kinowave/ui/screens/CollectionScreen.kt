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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.categoryLabel
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.Route
import com.kwamepeace.kinowave.ui.components.FilterChipK
import com.kwamepeace.kinowave.ui.components.PosterCard
import com.kwamepeace.kinowave.ui.components.bleed
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.components.collectionColors
import com.kwamepeace.kinowave.ui.components.seedColors
import com.kwamepeace.kinowave.ui.theme.Kino

private data class ListSpec(
    val title: String,
    val emoji: String,
    val subtitle: String?,
    val colors: List<Color>,
    val channels: List<Channel>,
)

private fun specFor(route: Route, index: CatalogIndex): ListSpec = when (route) {
    is Route.CollectionRoute -> {
        val (col, list) = index.collectionById[route.id] ?: (null to emptyList())
        ListSpec(col?.title ?: "Collection", col?.emoji ?: "", col?.subtitle, collectionColors(col?.colors ?: emptyList(), route.id), list)
    }
    is Route.CountryRoute -> ListSpec(
        index.countryName(route.code), index.countryFlag(route.code), "Live channels from ${index.countryName(route.code)}",
        seedColors(route.code), index.byCountry(route.code),
    )
    is Route.LanguageRoute -> ListSpec(
        index.languageName(route.code), "🗣️", "Channels in ${index.languageName(route.code)}",
        seedColors(route.code), index.byLanguage(route.code),
    )
    is Route.CategoryRoute -> ListSpec(
        categoryLabel(route.id), "📺", null, seedColors(route.id), index.byCategory(route.id),
    )
}

/** Full grid for a collection, country, language or category, with category sub-filters. */
@Composable
fun CollectionScreen(
    route: Route,
    index: CatalogIndex,
    actions: Actions,
    visible: (List<Channel>) -> List<Channel>,
    onBack: () -> Unit,
) {
    val spec = remember(route, index) { specFor(route, index) }
    val all = remember(spec) { visible(spec.channels) }
    val subFilters = remember(all) {
        all.flatMap { it.categories }.groupingBy { it }.eachCount().entries
            .sortedByDescending { it.value }.filter { it.value >= 3 }.take(12).map { it.key }
    }
    var sub by rememberSaveable(route) { mutableStateOf<String?>(null) }
    val shown = remember(all, sub) { sub?.let { s -> all.filter { s in it.categories } } ?: all }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(108.dp),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 130.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize().background(Kino.Ink),
    ) {
        item(key = "header", span = { GridItemSpan(maxLineSpan) }) {
            Box(
                Modifier
                    .bleed(16.dp)
                    .background(Brush.verticalGradient(listOf(spec.colors.first().copy(alpha = 0.85f), spec.colors.last().copy(alpha = 0.35f), Kino.Ink)))
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp)
                    .padding(top = 8.dp, bottom = 18.dp),
            ) {
                Column {
                    Box(
                        Modifier.size(44.dp).bouncyClick(onClick = onBack).clip(CircleShape).background(Color(0x33000000)),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White) }
                    Spacer(Modifier.height(28.dp))
                    if (spec.emoji.isNotEmpty()) Text(spec.emoji, fontSize = 44.sp)
                    Text(spec.title, style = MaterialTheme.typography.displayMedium, color = Color.White)
                    spec.subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = Color(0xD9FFFFFF)) }
                    Spacer(Modifier.height(16.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Row(
                            Modifier
                                .bouncyClick { shown.firstOrNull()?.let { actions.play(it, shown) } }
                                .clip(CircleShape)
                                .background(Color.White)
                                .padding(horizontal = 18.dp, vertical = 11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Rounded.PlayArrow, null, tint = Color.Black)
                            Spacer(Modifier.width(4.dp))
                            Text("Play", style = MaterialTheme.typography.labelLarge, color = Color.Black)
                        }
                        Spacer(Modifier.width(10.dp))
                        Row(
                            Modifier
                                .bouncyClick { shown.randomOrNull()?.let { actions.play(it, shown) } }
                                .clip(CircleShape)
                                .background(Color(0x33FFFFFF))
                                .padding(horizontal = 18.dp, vertical = 11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Rounded.Shuffle, null, tint = Color.White, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Surprise me", style = MaterialTheme.typography.labelLarge, color = Color.White)
                        }
                        Spacer(Modifier.weight(1f))
                        Text("${shown.size}", style = MaterialTheme.typography.headlineSmall, color = Color(0xB3FFFFFF))
                    }
                }
            }
        }
        if (subFilters.size > 1) {
            item(key = "subs", span = { GridItemSpan(maxLineSpan) }) {
                LazyRow(
                    modifier = Modifier.bleed(16.dp),
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item { FilterChipK("All", selected = sub == null) { sub = null } }
                    items(subFilters) { id -> FilterChipK(categoryLabel(id), selected = sub == id) { sub = if (sub == id) null else id } }
                }
            }
        }
        items(shown, key = { it.id }) { ch ->
            PosterCard(
                ch,
                width = null,
                flag = index.countryFlag(ch.country),
                modifier = Modifier.animateItem(),
                onLongClick = { actions.play(ch, shown) },
                onClick = { actions.open(ch) },
            )
        }
    }
}
