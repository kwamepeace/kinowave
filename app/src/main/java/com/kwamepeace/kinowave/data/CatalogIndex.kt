package com.kwamepeace.kinowave.data

import java.text.Normalizer

/** Lookup tables and search over a loaded [Catalog]. Built once off the main thread. */
class CatalogIndex(val catalog: Catalog) {

    val channels: List<Channel> = catalog.channels
    val byId: Map<String, Channel> = channels.associateBy { it.id }

    /** Collections with their channels resolved, in catalog order. */
    val rows: List<Pair<Collection, List<Channel>>> =
        catalog.collections.map { col -> col to col.ids.mapNotNull(byId::get) }

    val collectionById: Map<String, Pair<Collection, List<Channel>>> = rows.associateBy { it.first.id }

    val movies: List<Movie> = catalog.movies
    val movieById: Map<String, Movie> = movies.associateBy { it.id }

    /** On-demand movie rows with their films resolved. */
    val movieRows: List<Pair<MovieRow, List<Movie>>> =
        catalog.movieRows.map { row -> row to row.ids.mapNotNull(movieById::get) }.filter { it.second.isNotEmpty() }

    val movieRowById: Map<String, Pair<MovieRow, List<Movie>>> = movieRows.associateBy { it.first.id }

    /** Whether this index was filtered for a Kids profile. */
    var isKids: Boolean = false
        private set

    /** Countries that have channels, most channels first. */
    val countryCounts: List<Pair<String, Int>> =
        channels.groupingBy { it.country }.eachCount().toList().sortedByDescending { it.second }

    val languageCounts: List<Pair<String, Int>> =
        channels.flatMap { it.languages }.groupingBy { it }.eachCount().toList().sortedByDescending { it.second }

    val categoryCounts: List<Pair<String, Int>> =
        channels.flatMap { it.categories }.groupingBy { it }.eachCount().toList().sortedByDescending { it.second }

    private val haystacks: Array<String> = Array(channels.size) { i ->
        val ch = channels[i]
        buildString {
            append(ch.name).append(' ')
            ch.network?.let { append(it).append(' ') }
            append(ch.country).append(' ')
            catalog.countries[ch.country]?.let { append(it.name).append(' ') }
            ch.languages.forEach { code -> catalog.languages[code]?.let { append(it).append(' ') } }
            ch.categories.forEach { append(categoryLabel(it)).append(' ') }
        }.normalized()
    }

    fun countryName(code: String): String = catalog.countries[code]?.name ?: code
    fun countryFlag(code: String): String = catalog.countries[code]?.flag ?: "🌐"
    fun languageName(code: String): String = catalog.languages[code] ?: code

    /** Collections whose title matches the query, e.g. "bolly" → Bollywood Blockbusters. */
    fun matchingCollections(query: String): List<Pair<Collection, List<Channel>>> {
        val q = query.normalized().trim()
        if (q.length < 2) return emptyList()
        return rows.filter { (col, _) ->
            val hay = "${col.title} ${col.subtitle.orEmpty()} ${col.id}".normalized()
            q.split(' ').filter { it.isNotBlank() }.all { hay.contains(it) }
        }
    }

    fun search(query: String, limit: Int = 200): List<Channel> {
        val terms = query.normalized().split(' ').filter { it.isNotBlank() }
        if (terms.isEmpty()) return emptyList()
        val scored = ArrayList<Pair<Channel, Int>>()
        for (i in channels.indices) {
            val hay = haystacks[i]
            if (!terms.all { hay.contains(it) }) continue
            val ch = channels[i]
            val name = ch.name.normalized()
            val bonus = when {
                name == terms.joinToString(" ") -> 1000
                name.startsWith(terms.first()) -> 400
                name.contains(terms.first()) -> 200
                else -> 0
            }
            scored += ch to (ch.score + bonus)
        }
        return scored.sortedByDescending { it.second }.take(limit).map { it.first }
    }

    fun searchMovies(query: String, limit: Int = 60): List<Movie> {
        val terms = query.normalized().split(' ').filter { it.isNotBlank() }
        if (terms.isEmpty()) return emptyList()
        return movies.filter { m ->
            val hay = "${m.title} ${m.year ?: ""} ${m.tags.joinToString(" ")} ${m.description.orEmpty().take(120)}".normalized()
            terms.all { hay.contains(it) }
        }.take(limit)
    }

    /** Films that share a row with [movie]. */
    fun similarMovies(movie: Movie, limit: Int = 18): List<Movie> =
        movieRows.filter { (_, list) -> list.any { it.id == movie.id } }
            .flatMap { it.second }.distinctBy { it.id }.filter { it.id != movie.id }.take(limit)

    /**
     * A copy of this index containing only kids-safe content: kids/animation/family channels,
     * the Kids and Anime rows, and the cartoon movie rows.
     */
    fun forKids(): CatalogIndex {
        val kidsCategories = setOf("kids", "animation", "family")
        val safe = channels.filter { ch -> ch.categories.any { it in kidsCategories } && "religious" !in ch.categories }
        val safeIds = safe.map { it.id }.toHashSet()
        val cols = catalog.collections
            .filter { it.id == "kids" || it.id == "anime" }
            .map { col -> col.copy(ids = col.ids.filter { it in safeIds }) }
        val kidsRows = catalog.movieRows.filter { it.kids }
        val kidsMovieIds = kidsRows.flatMap { it.ids }.toHashSet()
        return CatalogIndex(
            catalog.copy(
                channels = safe,
                collections = cols,
                movieRows = kidsRows,
                movies = catalog.movies.filter { it.id in kidsMovieIds },
            ),
        ).also { it.isKids = true }
    }

    fun byCountry(code: String) = channels.filter { it.country == code }
    fun byLanguage(code: String) = channels.filter { code in it.languages }
    fun byCategory(id: String) = channels.filter { id in it.categories }

    /** "More like this": channels sharing collections, then category + country. */
    fun similarTo(channel: Channel, limit: Int = 18): List<Channel> {
        val fromRows = rows.filter { (_, list) -> list.any { it.id == channel.id } }.flatMap { it.second }
        val sameKind = channels.filter { c ->
            c.country == channel.country && c.categories.any { it in channel.categories }
        }
        return (fromRows + sameKind).distinctBy { it.id }.filter { it.id != channel.id }.take(limit)
    }

    companion object {
        private val DIACRITICS = "\\p{Mn}+".toRegex()
        fun String.normalized(): String =
            Normalizer.normalize(lowercase(), Normalizer.Form.NFD).replace(DIACRITICS, "")
    }
}
