package com.kwamepeace.kinowave.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.tappableElement
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bookmarks
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.kwamepeace.kinowave.ui.Tab
import com.kwamepeace.kinowave.ui.theme.Kino

private data class TabItem(val tab: Tab, val label: String, val icon: ImageVector)

private val TABS = listOf(
    TabItem(Tab.Home, "Home", Icons.Rounded.Home),
    TabItem(Tab.Discover, "Discover", Icons.Rounded.Explore),
    TabItem(Tab.Live, "Live", Icons.Rounded.LiveTv),
    TabItem(Tab.MyList, "My Space", Icons.Rounded.Bookmarks),
)

/** Floating glass pill navigation; the active tab stretches open to show its label. */
@Composable
fun FloatingTabBar(selected: Tab, onSelect: (Tab) -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(50)
    Row(
        modifier
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.tappableElement))
            .padding(bottom = 10.dp)
            .shadow(24.dp, shape, ambientColor = Color.Black, spotColor = Color.Black)
            .clip(shape)
            .background(Color(0xE6121219))
            .border(1.dp, Color(0x1FFFFFFF), shape)
            .padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TABS.forEach { item ->
            val active = item.tab == selected
            Row(
                Modifier
                    .bouncyClick(pressedScale = 0.9f) { onSelect(item.tab) }
                    .clip(shape)
                    .then(if (active) Modifier.background(Kino.BrandGradientH) else Modifier)
                    .padding(horizontal = if (active) 16.dp else 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    item.icon,
                    contentDescription = item.label,
                    tint = if (active) Color.White else Kino.TextLow,
                    modifier = Modifier.size(22.dp),
                )
                AnimatedVisibility(
                    visible = active,
                    enter = fadeIn() + expandHorizontally(spring(dampingRatio = Spring.DampingRatioLowBouncy, stiffness = Spring.StiffnessMediumLow)),
                    exit = fadeOut() + shrinkHorizontally(),
                ) {
                    Row {
                        Spacer(Modifier.width(8.dp))
                        Text(item.label, style = MaterialTheme.typography.labelLarge, color = Color.White)
                    }
                }
            }
        }
    }
}
