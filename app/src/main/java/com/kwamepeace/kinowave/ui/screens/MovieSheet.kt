package com.kwamepeace.kinowave.ui.screens

import android.content.Intent
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.ui.components.GradientScrim
import com.kwamepeace.kinowave.ui.components.MoviePoster
import com.kwamepeace.kinowave.ui.components.Pill
import com.kwamepeace.kinowave.ui.components.ProgressBar
import com.kwamepeace.kinowave.ui.components.SectionHeader
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.components.seedColors
import com.kwamepeace.kinowave.ui.theme.Kino

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MovieSheet(
    movie: Movie,
    index: CatalogIndex,
    saved: Boolean,
    progress: Float?,
    onDismiss: () -> Unit,
    onPlay: (fromStart: Boolean) -> Unit,
    onToggleList: () -> Unit,
    onOpenOther: (Movie) -> Unit,
) {
    val similar = remember(movie, index) { index.similarMovies(movie) }
    val context = LocalContext.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Kino.Ink,
        shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
        dragHandle = null,
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp),
        ) {
            // Backdrop: a frame from the film, with the poster overlapping it
            Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Brush.linearGradient(seedColors(movie.id)))) {
                AsyncImage(
                    model = movie.still ?: movie.poster,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                GradientScrim(Modifier.fillMaxSize(), listOf(Color(0x33000000), Color(0x8007070B), Kino.Ink))
                Box(
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 12.dp)
                        .size(width = 40.dp, height = 5.dp)
                        .clip(CircleShape)
                        .background(Color(0x66FFFFFF)),
                )
            }
            Row(Modifier.padding(horizontal = 20.dp).offset(y = (-56).dp), verticalAlignment = Alignment.Bottom) {
                MoviePoster(movie, width = 104.dp) { onPlay(false) }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(movie.title, style = MaterialTheme.typography.headlineMedium, color = Kino.TextHigh)
                    Spacer(Modifier.height(4.dp))
                    val meta = listOfNotNull(movie.year?.toString(), movie.runtimeLabel, "Public domain")
                    Text(meta.joinToString("  •  "), style = MaterialTheme.typography.bodyMedium, color = Kino.TextMid)
                }
            }

            Column(Modifier.padding(horizontal = 20.dp).offset(y = (-40).dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill("ON DEMAND", background = Kino.Lime, color = Color(0xFF0B0B0B))
                    movie.tags.forEach { t -> Pill(t.replaceFirstChar { it.uppercase() }, background = Color(0x1FFFFFFF)) }
                }
                Spacer(Modifier.height(18.dp))
                Row(
                    Modifier
                        .fillMaxWidth()
                        .bouncyClick(pressedScale = 0.97f) { onPlay(false) }
                        .clip(RoundedCornerShape(50))
                        .background(Color.White)
                        .padding(vertical = 15.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.PlayArrow, null, tint = Color.Black)
                    Spacer(Modifier.width(6.dp))
                    Text(if (progress != null) "Resume" else "Play", style = MaterialTheme.typography.labelLarge, color = Color.Black)
                }
                if (progress != null) {
                    Spacer(Modifier.height(10.dp))
                    ProgressBar(progress)
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MovieAction(if (saved) Icons.Rounded.Check else Icons.Rounded.Add, if (saved) "In My List" else "My List", Modifier.weight(1f), onToggleList)
                    if (progress != null) {
                        MovieAction(Icons.Rounded.Replay, "Start over", Modifier.weight(1f)) { onPlay(true) }
                    } else {
                        MovieAction(Icons.Rounded.Share, "Share", Modifier.weight(1f)) {
                            val send = Intent(Intent.ACTION_SEND)
                                .setType("text/plain")
                                .putExtra(Intent.EXTRA_TEXT, "Watching ${movie.title} (${movie.year ?: "classic"}) free on KinoWave 🍿 https://archive.org/details/${movie.id}")
                            context.startActivity(Intent.createChooser(send, "Share ${movie.title}"))
                        }
                    }
                }
                movie.description?.let {
                    Spacer(Modifier.height(18.dp))
                    Text(it, style = MaterialTheme.typography.bodyLarge, color = Kino.TextMid)
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "From the Internet Archive's public-domain film collection.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Kino.TextLow,
                )
            }

            if (similar.isNotEmpty()) {
                SectionHeader("More like this", emoji = "✨", modifier = Modifier.offset(y = (-24).dp))
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(similar, key = { it.id }) { m -> MoviePoster(m, width = 112.dp) { onOpenOther(m) } }
                }
            }
        }
    }
}

@Composable
private fun MovieAction(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
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
