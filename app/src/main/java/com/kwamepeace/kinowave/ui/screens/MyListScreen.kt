package com.kwamepeace.kinowave.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kwamepeace.kinowave.BuildConfig
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.AppViewModel
import com.kwamepeace.kinowave.ui.components.PosterCard
import com.kwamepeace.kinowave.ui.components.WideCard
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.theme.Kino

@Composable
fun MyListScreen(vm: AppViewModel, index: CatalogIndex, actions: Actions) {
    val myList by vm.prefs.myList.collectAsStateWithLifecycle()
    val recents by vm.prefs.recents.collectAsStateWithLifecycle()
    val hide by vm.prefs.hideUnreliable.collectAsStateWithLifecycle()
    val refreshing by vm.refreshing.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val saved = myList.mapNotNull(index.byId::get)
    val watched = recents.mapNotNull(index.byId::get)

    LazyVerticalGrid(
        columns = GridCells.Adaptive(108.dp),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 130.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        line("header") {
            Row(Modifier.statusBarsPadding().padding(top = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(56.dp).clip(CircleShape).background(Kino.BrandGradient),
                    contentAlignment = Alignment.Center,
                ) { Text("😎", fontSize = 28.sp) }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text("My Space", style = MaterialTheme.typography.headlineLarge, color = Kino.TextHigh)
                    Text(
                        "${saved.size} saved · ${watched.size} watched",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Kino.TextLow,
                    )
                }
            }
        }

        if (watched.isNotEmpty()) {
            line("recents-title") { Title("Recently watched", action = "Clear") { vm.prefs.clearRecents() } }
            line("recents") {
                androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(watched.size) { i ->
                        val ch = watched[i]
                        WideCard(ch, onLongClick = { actions.open(ch) }, onClick = { actions.play(ch, watched) })
                    }
                }
            }
        }

        line("list-title") { Title("My List") }
        if (saved.isEmpty()) {
            line("empty") {
                Text(
                    "Nothing saved yet. Tap + on any channel to keep it here. ✨",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Kino.TextLow,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Kino.Surface)
                        .padding(20.dp),
                )
            }
        } else {
            items(saved, key = { it.id }) { ch ->
                PosterCard(
                    ch,
                    width = null,
                    flag = index.countryFlag(ch.country),
                    modifier = Modifier.animateItem(),
                    onLongClick = { actions.play(ch, saved) },
                    onClick = { actions.open(ch) },
                )
            }
        }

        line("settings-title") { Title("Settings") }
        line("settings") {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(Kino.Surface)
                    .border(1.dp, Kino.Stroke, RoundedCornerShape(22.dp))
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Hide unreliable channels", style = MaterialTheme.typography.titleMedium, color = Kino.TextHigh)
                        Text(
                            "Skip channels that are geo-locked or only on air part-time.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Kino.TextLow,
                        )
                    }
                    Switch(
                        checked = hide,
                        onCheckedChange = vm.prefs::setHideUnreliable,
                        colors = SwitchDefaults.colors(checkedTrackColor = Kino.Pink, checkedThumbColor = Color.White),
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Channel list", style = MaterialTheme.typography.titleMedium, color = Kino.TextHigh)
                        Text(
                            "${index.channels.size} channels · updated ${index.catalog.updated.take(10)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Kino.TextLow,
                        )
                    }
                    Box(
                        Modifier
                            .bouncyClick {
                                vm.refreshCatalog { updated ->
                                    Toast.makeText(
                                        context,
                                        if (updated) "Channel list updated 🎉" else "You're already up to date",
                                        Toast.LENGTH_SHORT,
                                    ).show()
                                }
                            }
                            .clip(CircleShape)
                            .background(Kino.BrandGradientH)
                            .padding(horizontal = 16.dp, vertical = 9.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (refreshing) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text("Refresh", style = MaterialTheme.typography.labelLarge, color = Color.White)
                    }
                }
                Text(
                    "KinoWave ${BuildConfig.VERSION_NAME} · Streams come from the open-source iptv-org project " +
                        "(github.com/iptv-org/iptv). KinoWave doesn't host or own any of the channels.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Kino.TextLow,
                )
            }
        }
    }
}

private fun LazyGridScope.line(key: String, content: @Composable () -> Unit) {
    item(key = key, span = { GridItemSpan(maxLineSpan) }) { content() }
}

@Composable
private fun Title(text: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.headlineSmall, color = Kino.TextHigh, modifier = Modifier.weight(1f))
        if (action != null) {
            Text(
                action,
                style = MaterialTheme.typography.labelMedium,
                color = Kino.Pink,
                modifier = Modifier.bouncyClick(onClick = onAction).padding(6.dp),
            )
        }
    }
}
