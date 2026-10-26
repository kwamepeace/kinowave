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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kwamepeace.kinowave.BuildConfig
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.AppViewModel
import com.kwamepeace.kinowave.ui.components.MovieWideCard
import com.kwamepeace.kinowave.ui.components.MoviePoster
import com.kwamepeace.kinowave.ui.components.PosterCard
import com.kwamepeace.kinowave.ui.components.Watchable
import com.kwamepeace.kinowave.ui.components.WideCard
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.resolve
import com.kwamepeace.kinowave.ui.theme.Kino

@Composable
fun MyListScreen(
    vm: AppViewModel,
    index: CatalogIndex,
    actions: Actions,
    onSwitchProfile: () -> Unit,
    onEditProfile: () -> Unit,
) {
    val profile by vm.activeProfile.collectAsStateWithLifecycle()
    val myList by vm.prefs.myList.collectAsStateWithLifecycle()
    val recents by vm.prefs.recents.collectAsStateWithLifecycle()
    val progress by vm.prefs.progress.collectAsStateWithLifecycle()
    val hide by vm.prefs.hideUnreliable.collectAsStateWithLifecycle()
    val dataSaver by vm.settings.dataSaver.collectAsStateWithLifecycle()
    val saverMobileOnly by vm.settings.saverOnMobileOnly.collectAsStateWithLifecycle()
    val autoplay by vm.settings.autoplayNext.collectAsStateWithLifecycle()
    val refreshing by vm.refreshing.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val saved = index.resolve(myList, progress)
    val watched = index.resolve(recents, progress)

    LazyVerticalGrid(
        columns = GridCells.Adaptive(108.dp),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 130.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        line("header") {
            Row(Modifier.statusBarsPadding().padding(top = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                profile?.let { ProfileAvatar(it, 60.dp, Modifier.bouncyClick(onClick = onEditProfile)) }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(profile?.name ?: "My Space", style = MaterialTheme.typography.headlineLarge, color = Kino.TextHigh)
                    Text(
                        "${saved.size} saved · ${watched.size} watched" + if (index.isKids) " · Kids" else "",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Kino.TextLow,
                    )
                }
                Text(
                    "Switch",
                    style = MaterialTheme.typography.labelLarge,
                    color = Kino.TextHigh,
                    modifier = Modifier
                        .bouncyClick(onClick = onSwitchProfile)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0x14FFFFFF))
                        .border(1.dp, Kino.Stroke, RoundedCornerShape(50))
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                )
            }
        }

        if (watched.isNotEmpty()) {
            line("recents-title") { Title("Recently watched", action = "Clear") { vm.prefs.clearRecents() } }
            line("recents") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(watched.size) { i ->
                        when (val item = watched[i]) {
                            is Watchable.Live -> WideCard(item.channel, onLongClick = { actions.openItem(item) }, onClick = { actions.playItem(item, watched) })
                            is Watchable.Film -> MovieWideCard(item.movie, item.progress, onLongClick = { actions.openItem(item) }, onClick = { actions.playItem(item, watched) })
                        }
                    }
                }
            }
        }

        line("list-title") { Title("My List") }
        if (saved.isEmpty()) {
            line("empty") {
                Text(
                    "Nothing saved yet. Tap + on any channel or movie to keep it here. ✨",
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
            items(saved, key = { it.key }) { item ->
                when (item) {
                    is Watchable.Live -> PosterCard(
                        item.channel,
                        width = null,
                        flag = index.countryFlag(item.channel.country),
                        modifier = Modifier.animateItem(),
                        onLongClick = { actions.playItem(item, saved) },
                        onClick = { actions.openItem(item) },
                    )
                    is Watchable.Film -> MoviePoster(
                        item.movie,
                        width = null,
                        progress = item.progress,
                        modifier = Modifier.animateItem(),
                        onLongClick = { actions.playItem(item, saved) },
                        onClick = { actions.openItem(item) },
                    )
                }
            }
        }

        line("playback-title") { Title("Playback") }
        line("playback") {
            SettingsCard {
                ToggleRow(
                    "Data saver",
                    "Cap video around 480p, use lighter movie files and skip heavy effects.",
                    dataSaver,
                    vm.settings::setDataSaver,
                )
                if (dataSaver) {
                    ToggleRow(
                        "Only on mobile data",
                        "Full quality on Wi-Fi, data saver on mobile data.",
                        saverMobileOnly,
                        vm.settings::setSaverOnMobileOnly,
                    )
                }
                HorizontalDivider(color = Kino.Stroke)
                ToggleRow(
                    "Autoplay next channel",
                    "If a channel won't load, hop to the next one after a few seconds.",
                    autoplay,
                    vm.settings::setAutoplayNext,
                )
                ToggleRow(
                    "Hide unreliable channels",
                    "Skip channels that are geo-locked or only on air part-time.",
                    hide,
                    vm.prefs::setHideUnreliable,
                )
            }
        }

        line("about-title") { Title("Library") }
        line("about") {
            SettingsCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Channels and movies", style = MaterialTheme.typography.titleMedium, color = Kino.TextHigh)
                        Text(
                            "${index.channels.size} channels · ${index.movies.size} movies · updated ${index.catalog.updated.take(10)}",
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
                                        if (updated) "Library updated 🎉" else "You're already up to date",
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
                    "KinoWave ${BuildConfig.VERSION_NAME} · Live channels come from the open-source iptv-org project " +
                        "(github.com/iptv-org/iptv); movies come from the Internet Archive's public-domain collection. " +
                        "KinoWave doesn't host or own any of the content.",
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
private fun SettingsCard(content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(Kino.Surface)
            .border(1.dp, Kino.Stroke, RoundedCornerShape(22.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) { content() }
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

