package com.kwamepeace.kinowave.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.ui.theme.Kino

/** Something in "Continue watching" or My List: a live channel or a film. */
sealed interface Watchable {
    val key: String

    data class Live(val channel: Channel) : Watchable {
        override val key: String get() = channel.id
    }

    data class Film(val movie: Movie, val progress: Float? = null) : Watchable {
        override val key: String get() = movie.listKey
    }
}

/** Portrait film poster with real artwork, year badge and an optional resume bar. */
@Composable
fun MoviePoster(
    movie: Movie,
    modifier: Modifier = Modifier,
    width: Dp? = 124.dp,
    progress: Float? = null,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier
            .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
            .aspectRatio(0.68f)
            .bouncyClick(onLongClick = onLongClick, onClick = onClick)
            .clip(shape)
            .background(Brush.linearGradient(seedColors(movie.id)))
            .border(1.dp, Color(0x22FFFFFF), shape),
    ) {
        AsyncImage(
            model = movie.poster ?: movie.still,
            contentDescription = movie.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        GradientScrim(
            Modifier.fillMaxWidth().height(84.dp).align(Alignment.BottomCenter),
            listOf(Color.Transparent, Color(0xE6000000)),
        )
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 10.dp, vertical = 9.dp)) {
            Text(
                movie.title,
                style = MaterialTheme.typography.titleSmall,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (progress != null) {
                Spacer(Modifier.height(6.dp))
                ProgressBar(progress)
            }
        }
        movie.year?.let { Pill(it.toString(), Modifier.align(Alignment.TopEnd).padding(8.dp)) }
    }
}

@Composable
fun ProgressBar(progress: Float, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(Color(0x40FFFFFF))) {
        Box(Modifier.fillMaxWidth(progress.coerceIn(0.03f, 1f)).height(4.dp).clip(CircleShape).background(Kino.Lime))
    }
}

@Composable
fun MoviePosterRow(
    title: String,
    movies: List<Movie>,
    onOpen: (Movie) -> Unit,
    onPlay: (Movie) -> Unit,
    modifier: Modifier = Modifier,
    emoji: String = "",
    subtitle: String? = null,
    progressOf: (Movie) -> Float? = { null },
    onSeeAll: (() -> Unit)? = null,
) {
    Column(modifier) {
        SectionHeader(title, emoji = emoji, subtitle = subtitle, onSeeAll = onSeeAll)
        Spacer(Modifier.height(12.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(movies, key = { it.id }) { m ->
                MoviePoster(m, progress = progressOf(m), onLongClick = { onPlay(m) }, onClick = { onOpen(m) })
            }
        }
    }
}

/** Landscape film card with a resume bar, for "Continue watching". */
@Composable
fun MovieWideCard(movie: Movie, progress: Float?, onLongClick: (() -> Unit)?, onClick: () -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    Column(Modifier.width(196.dp)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .bouncyClick(onLongClick = onLongClick, onClick = onClick)
                .clip(shape)
                .background(Brush.linearGradient(seedColors(movie.id)))
                .border(1.dp, Color(0x22FFFFFF), shape),
        ) {
            AsyncImage(
                model = movie.still ?: movie.poster,
                contentDescription = movie.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                Modifier
                    .align(Alignment.Center)
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color(0xCC000000))
                    .border(1.dp, Color(0x66FFFFFF), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(24.dp))
            }
            if (progress != null) ProgressBar(progress, Modifier.align(Alignment.BottomCenter).padding(10.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(
            movie.title,
            style = MaterialTheme.typography.titleSmall,
            color = Kino.TextHigh,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

/** "Continue watching": live channels and films side by side. */
@Composable
fun ContinueWatchingRow(
    items: List<Watchable>,
    onOpen: (Watchable) -> Unit,
    onPlay: (Watchable) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        SectionHeader("Continue watching", emoji = "⏯️")
        Spacer(Modifier.height(12.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(items, key = { it.key }) { item ->
                when (item) {
                    is Watchable.Live -> WideCard(item.channel, onLongClick = { onOpen(item) }, onClick = { onPlay(item) })
                    is Watchable.Film -> MovieWideCard(item.movie, item.progress, onLongClick = { onOpen(item) }, onClick = { onPlay(item) })
                }
            }
        }
    }
}
