package com.kwamepeace.kinowave.player

import android.content.Context
import android.content.Intent
import com.kwamepeace.kinowave.data.Channel

object PlayerLauncher {
    const val EXTRA_CHANNEL = "channel"
    const val EXTRA_QUEUE = "queue"
    const val EXTRA_STREAM = "stream"

    /** Opens the full-screen player; [queue] lets the viewer zap to neighbouring channels. */
    fun play(context: Context, channel: Channel, queue: List<Channel> = emptyList(), streamIndex: Int = 0) {
        val ids = (if (queue.any { it.id == channel.id }) queue else listOf(channel) + queue)
            .map { it.id }.distinct().take(300)
        val intent = Intent(context, PlayerActivity::class.java)
            .putExtra(EXTRA_CHANNEL, channel.id)
            .putStringArrayListExtra(EXTRA_QUEUE, ArrayList(ids))
            .putExtra(EXTRA_STREAM, streamIndex)
            .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        context.startActivity(intent)
    }
}
