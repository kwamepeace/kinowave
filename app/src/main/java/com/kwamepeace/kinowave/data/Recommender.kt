package com.kwamepeace.kinowave.data

import kotlin.math.ln
import kotlin.math.pow

/**
 * Content-based "For You" recommender.
 *
 * Every channel and film is described by features: its categories, country, languages, network,
 * the curated rows it belongs to, and (for films) its row and tags. A profile's taste is the sum of
 * the features of everything it watched, weighted by watch time, number of plays and recency
 * (half-life two weeks), plus everything saved to My List. Items are then ranked by how well their
 * features match the taste, with a small quality prior so reliable, high-res streams win ties.
 *
 * A brand-new profile has no history yet, so it starts from the phone's country and language.
 */
class Recommender(
    private val index: CatalogIndex,
    stats: Map<String, WatchStat>,
    myList: List<String>,
    region: String,
    language: String,
    now: Long = System.currentTimeMillis(),
) {
    /** Channel id → ids of the curated rows containing it. */
    private val channelRows: Map<String, List<String>> = buildMap<String, MutableList<String>> {
        index.rows.forEach { (col, list) -> list.forEach { ch -> getOrPut(ch.id) { mutableListOf() } += col.id } }
    }

    /** Movie id → ids of the movie rows containing it. */
    private val movieRows: Map<String, List<String>> = buildMap<String, MutableList<String>> {
        index.movieRows.forEach { (row, list) -> list.forEach { m -> getOrPut(m.id) { mutableListOf() } += row.id } }
    }

    private val taste = HashMap<String, Double>()

    /** Watched items, most engaged first. */
    val history: List<Pair<String, Double>>

    val hasHistory: Boolean

    init {
        fun add(feature: String, weight: Double) {
            taste[feature] = (taste[feature] ?: 0.0) + weight
        }

        // Cold-start priors
        if (region.isNotEmpty()) add("cc:$region", 1.2)
        if (language.isNotEmpty()) add("lang:$language", 1.0)

        history = stats.mapNotNull { (key, st) ->
            if (!exists(key)) return@mapNotNull null
            val days = (now - st.lastWatched).coerceAtLeast(0) / 86_400_000.0
            val recency = 0.5.pow(days / 14.0)
            val engagement = ln(1.0 + st.seconds / 60.0) + 0.35 * st.plays
            key to engagement * recency
        }.sortedByDescending { it.second }

        history.forEach { (key, w) -> featuresOf(key).forEach { (f, fw) -> add(f, w * fw) } }
        myList.forEach { key -> featuresOf(key).forEach { (f, fw) -> add(f, 0.9 * fw) } }
        hasHistory = history.isNotEmpty() || myList.isNotEmpty()

        // Normalise so the strongest taste is worth 3 points, keeping the quality prior meaningful
        val top = taste.values.maxOrNull() ?: 0.0
        if (top > 0) taste.replaceAll { _, v -> v / top * 3.0 }
    }

    private fun exists(key: String): Boolean =
        if (key.startsWith(Movie.MOVIE_PREFIX)) index.movieById.containsKey(key.removePrefix(Movie.MOVIE_PREFIX))
        else index.byId.containsKey(key)

    /** Weighted features describing an item. Rows count most: they are the best genre signal we have. */
    private fun featuresOf(key: String): List<Pair<String, Double>> {
        if (key.startsWith(Movie.MOVIE_PREFIX)) {
            val m = index.movieById[key.removePrefix(Movie.MOVIE_PREFIX)] ?: return emptyList()
            return movieFeatures(m)
        }
        val ch = index.byId[key] ?: return emptyList()
        return channelFeatures(ch)
    }

    private fun channelFeatures(ch: Channel): List<Pair<String, Double>> = buildList {
        channelRows[ch.id]?.forEach { add("col:$it" to 1.0) }
        ch.categories.forEach { add("cat:$it" to 0.6) }
        add("cc:${ch.country}" to 0.5)
        ch.languages.take(2).forEach { add("lang:$it" to 0.5) }
        ch.network?.let { add("nw:$it" to 0.4) }
        add("kind:live" to 0.3)
    }

    private fun movieFeatures(m: Movie): List<Pair<String, Double>> = buildList {
        movieRows[m.id]?.forEach { add("mrow:$it" to 1.0) }
        m.tags.forEach { add("tag:$it" to 0.5) }
        m.year?.let { add("decade:${it / 10}" to 0.3) }
        add("kind:movie" to 0.3)
    }

    private fun match(features: List<Pair<String, Double>>): Double =
        features.sumOf { (f, w) -> (taste[f] ?: 0.0) * w }

    fun score(ch: Channel): Double {
        val unreliable = if (ch.isGeoBlocked || ch.isPartTime) 0.6 else 0.0
        return match(channelFeatures(ch)) + ch.score / 150.0 - unreliable
    }

    fun score(m: Movie): Double = match(movieFeatures(m)) + if (m.poster?.contains("services/img") == false) 0.2 else 0.0

    /** How much this profile likes a curated row: its own weight plus how well its best items match. */
    fun rowScore(collectionId: String, channels: List<Channel>): Double =
        (taste["col:$collectionId"] ?: 0.0) * 2 + channels.take(8).map { score(it) }.average().takeIf { !it.isNaN() }.orZero() * 0.5

    fun movieRowScore(rowId: String, movies: List<Movie>): Double =
        (taste["mrow:$rowId"] ?: 0.0) * 2 + movies.take(8).map { score(it) }.average().takeIf { !it.isNaN() }.orZero() * 0.5

    /** Best-matching channels, skipping ones watched a lot already and keeping rows varied. */
    fun topChannels(limit: Int, exclude: Set<String> = emptySet(), hide: (Channel) -> Boolean = { false }): List<Channel> {
        val perRow = HashMap<String, Int>()
        return index.channels.asSequence()
            .filter { it.id !in exclude && !hide(it) && it.logo != null }
            .map { it to score(it) }
            .sortedByDescending { it.second }
            .map { it.first }
            .filter { ch ->
                // At most 4 picks from the same curated row, so one genre can't take over
                val row = channelRows[ch.id]?.firstOrNull() ?: "none"
                val n = perRow[row] ?: 0
                if (n >= 4) false else { perRow[row] = n + 1; true }
            }
            .take(limit)
            .toList()
    }

    fun topMovies(limit: Int, exclude: Set<String> = emptySet()): List<Movie> =
        index.movies.asSequence()
            .filter { it.id !in exclude }
            .sortedByDescending { score(it) }
            .take(limit)
            .toList()

    /** The most engaging recent item, for a "Because you watched…" row. */
    fun seed(): String? = history.firstOrNull()?.first

    private fun Double?.orZero() = this ?: 0.0

    companion object {
        /** Locale language → ISO 639-3 code as used by iptv-org ("en" → "eng"). */
        fun languageCode(locale: java.util.Locale): String =
            runCatching { locale.isO3Language }.getOrDefault("").takeIf { it.length == 3 }.orEmpty()
    }
}
