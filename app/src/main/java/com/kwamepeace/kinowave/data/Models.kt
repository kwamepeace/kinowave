package com.kwamepeace.kinowave.data

import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Compact catalog produced by scripts/build-catalog.mjs from the iptv-org API. */
@Serializable
data class Catalog(
    val updated: String = "",
    val countries: Map<String, Country> = emptyMap(),
    val languages: Map<String, String> = emptyMap(),
    val collections: List<Collection> = emptyList(),
    val channels: List<Channel> = emptyList(),
    val movies: List<Movie> = emptyList(),
    val movieRows: List<MovieRow> = emptyList(),
)

/** A public-domain film from the Internet Archive, playable on demand. */
@Immutable
@Serializable
data class Movie(
    val id: String,
    @SerialName("t") val title: String,
    @SerialName("u") val url: String,
    /** ~240p copy used by data saver. */
    @SerialName("lu") val lowUrl: String? = null,
    @SerialName("p") val poster: String? = null,
    /** A frame from the film, used as a backdrop. */
    @SerialName("b") val still: String? = null,
    @SerialName("y") val year: Int? = null,
    @SerialName("len") val lengthSeconds: Int = 0,
    @SerialName("d") val description: String? = null,
    @SerialName("g") val tags: List<String> = emptyList(),
) {
    /** Key used in My List / history so movies and channels can share one list. */
    val listKey: String get() = MOVIE_PREFIX + id

    val runtimeLabel: String?
        get() = lengthSeconds.takeIf { it > 0 }?.let { s ->
            val h = s / 3600
            val m = (s % 3600) / 60
            if (h > 0) "${h}h ${m}m" else "${m}m"
        }

    companion object {
        const val MOVIE_PREFIX = "m:"
    }
}

@Immutable
@Serializable
data class MovieRow(
    val id: String,
    val title: String,
    val emoji: String = "",
    val colors: List<String> = emptyList(),
    val ids: List<String> = emptyList(),
    /** Suitable for Kids profiles. */
    val kids: Boolean = false,
)

@Immutable
@Serializable
data class Country(
    @SerialName("n") val name: String,
    @SerialName("f") val flag: String = "",
)

@Immutable
@Serializable
data class Collection(
    val id: String,
    val title: String,
    val emoji: String = "",
    val subtitle: String? = null,
    /** "movies", "tv" or "all" — which home filter chip shows this row. */
    val tab: String = "all",
    val colors: List<String> = emptyList(),
    val ids: List<String> = emptyList(),
)

@Immutable
@Serializable
data class Channel(
    val id: String,
    @SerialName("n") val name: String,
    @SerialName("l") val logo: String? = null,
    @SerialName("c") val country: String = "",
    @SerialName("g") val categories: List<String> = emptyList(),
    @SerialName("la") val languages: List<String> = emptyList(),
    @SerialName("nw") val network: String? = null,
    @SerialName("s") val streams: List<Stream> = emptyList(),
    val score: Int = 0,
) {
    val bestQuality: String? get() = streams.firstOrNull()?.quality
    val isGeoBlocked: Boolean get() = streams.all { it.geoBlocked }
    val isPartTime: Boolean get() = streams.all { it.partTime }
}

@Immutable
@Serializable
data class Stream(
    @SerialName("u") val url: String,
    @SerialName("q") val quality: String? = null,
    @SerialName("ua") val userAgent: String? = null,
    @SerialName("r") val referrer: String? = null,
    @SerialName("gb") val geoBlocked: Boolean = false,
    @SerialName("p") val partTime: Boolean = false,
)

/** Human label for a stream quality like "1080p" → "HD". */
fun qualityBadge(quality: String?): String? {
    val n = quality?.takeWhile { it.isDigit() }?.toIntOrNull() ?: return null
    return when {
        n >= 2160 -> "4K"
        n >= 1080 -> "FHD"
        n >= 720 -> "HD"
        else -> "SD"
    }
}

private val CATEGORY_LABELS = mapOf(
    "auto" to "Auto", "animation" to "Animation", "business" to "Business", "classic" to "Classic",
    "comedy" to "Comedy", "cooking" to "Cooking", "culture" to "Culture", "documentary" to "Documentary",
    "education" to "Education", "entertainment" to "Entertainment", "family" to "Family", "general" to "General",
    "kids" to "Kids", "legislative" to "Legislative", "lifestyle" to "Lifestyle", "movies" to "Movies",
    "music" to "Music", "news" to "News", "outdoor" to "Outdoor", "relax" to "Relax", "religious" to "Faith",
    "science" to "Science", "series" to "Series", "shop" to "Shopping", "sports" to "Sports", "travel" to "Travel",
    "weather" to "Weather", "interactive" to "Interactive", "public" to "Public",
)

fun categoryLabel(id: String): String = CATEGORY_LABELS[id] ?: id.replaceFirstChar { it.uppercase() }
