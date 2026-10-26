package com.kwamepeace.kinowave

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kwamepeace.kinowave.data.CatalogIndex
import com.kwamepeace.kinowave.data.Channel
import com.kwamepeace.kinowave.data.Movie
import com.kwamepeace.kinowave.ui.screens.MovieGridScreen
import com.kwamepeace.kinowave.ui.screens.MovieSheet
import com.kwamepeace.kinowave.ui.screens.ProfileEditorSheet
import com.kwamepeace.kinowave.ui.screens.ProfilePickerScreen
import androidx.compose.runtime.key
import com.kwamepeace.kinowave.ui.Actions
import com.kwamepeace.kinowave.ui.AppViewModel
import com.kwamepeace.kinowave.ui.Route
import com.kwamepeace.kinowave.ui.Tab
import com.kwamepeace.kinowave.ui.components.FloatingTabBar
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.screens.CollectionScreen
import com.kwamepeace.kinowave.ui.screens.DetailSheet
import com.kwamepeace.kinowave.ui.screens.DiscoverScreen
import com.kwamepeace.kinowave.ui.screens.HomeScreen
import com.kwamepeace.kinowave.ui.screens.LiveScreen
import com.kwamepeace.kinowave.ui.screens.MyListScreen
import com.kwamepeace.kinowave.ui.theme.Kino
import com.kwamepeace.kinowave.ui.theme.KinoTheme

class MainActivity : ComponentActivity() {

    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { vm.catalog.value is CatalogState.Loading }
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        setContent {
            KinoTheme {
                Box(Modifier.fillMaxSize().background(Kino.Ink)) {
                    val state by vm.catalog.collectAsStateWithLifecycle()
                    when (val s = state) {
                        is CatalogState.Ready -> ProfileGate(vm)
                        is CatalogState.Failed -> LoadFailed(s.message, vm::retryLoad)
                        CatalogState.Loading -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Kino.Pink)
                    }
                }
            }
        }
    }
}

/** "Who's watching?" until a profile is picked, then the app for that profile. */
@Composable
private fun ProfileGate(vm: AppViewModel) {
    val profile by vm.activeProfile.collectAsStateWithLifecycle()
    val profiles by vm.profiles.profiles.collectAsStateWithLifecycle()
    val index by vm.profileIndex.collectAsStateWithLifecycle()

    AnimatedContent(
        targetState = profile,
        contentKey = { it?.id },
        transitionSpec = { (fadeIn(tween(300)) + scaleIn(tween(320), initialScale = 1.04f)) togetherWith fadeOut(tween(160)) },
        label = "profile",
    ) { active ->
        val current = index
        if (active == null) {
            ProfilePickerScreen(
                profiles = profiles,
                onPick = vm.profiles::select,
                onSave = vm.profiles::save,
                onDelete = vm.profiles::delete,
                newProfile = vm.profiles::newProfile,
            )
        } else if (current != null && current.isKids == active.kids) {
            // Keyed by profile so tabs, scroll positions and lists reset when switching
            key(active.id) { KinoShell(vm, current) }
        } else {
            Box(Modifier.fillMaxSize()) {
                CircularProgressIndicator(Modifier.align(Alignment.Center), color = Kino.Pink)
            }
        }
    }
}

@Composable
private fun KinoShell(vm: AppViewModel, index: CatalogIndex) {
    val context = LocalContext.current
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    val stack = remember { mutableStateListOf<Route>() }
    var sheetChannel by remember { mutableStateOf<Channel?>(null) }
    var sheetMovie by remember { mutableStateOf<Movie?>(null) }
    var showCategories by remember { mutableStateOf(false) }
    var focusSearch by remember { mutableStateOf(false) }
    var editingProfile by remember { mutableStateOf(false) }
    val myList by vm.prefs.myList.collectAsStateWithLifecycle()
    val progress by vm.prefs.progress.collectAsStateWithLifecycle()
    val profile by vm.activeProfile.collectAsStateWithLifecycle()
    val progressOf = { m: Movie -> progress[m.id]?.let { (pos, dur) -> if (dur > 0) pos.toFloat() / dur else null } }

    val actions = remember(vm, context) {
        Actions(
            open = { sheetChannel = it },
            play = { ch, queue -> vm.play(context, ch, queue) },
            push = { route -> showCategories = false; stack.add(route) },
            toggleList = { vm.toggleMyList(it) },
            openMovie = { sheetMovie = it },
            playMovie = { vm.playMovie(context, it) },
        )
    }

    BackHandler(enabled = showCategories || stack.isNotEmpty() || tab != Tab.Home) {
        when {
            showCategories -> showCategories = false
            stack.isNotEmpty() -> stack.removeAt(stack.lastIndex)
            else -> tab = Tab.Home
        }
    }

    Box(Modifier.fillMaxSize()) {
        AnimatedContent(
            targetState = tab,
            transitionSpec = {
                (fadeIn(tween(220)) + scaleIn(tween(260), initialScale = 0.98f)) togetherWith fadeOut(tween(140))
            },
            label = "tabs",
        ) { current ->
            when (current) {
                Tab.Home -> HomeScreen(
                    vm, index, actions,
                    onSearch = { focusSearch = true; tab = Tab.Discover },
                    onCategories = { showCategories = true },
                    onProfile = { vm.profiles.clearActive() },
                )
                Tab.Discover -> DiscoverScreen(index, actions, vm.regionCode, focusSearch, vm::visible)
                Tab.Live -> LiveScreen(index, actions, vm.regionCode, vm::visible)
                Tab.MyList -> MyListScreen(
                    vm, index, actions,
                    onSwitchProfile = { vm.profiles.clearActive() },
                    onEditProfile = { editingProfile = true },
                )
            }
        }

        // Pushed screens slide over the tabs
        AnimatedContent(
            targetState = stack.lastOrNull(),
            transitionSpec = {
                if (targetState != null && (initialState == null || stack.size > 1)) {
                    slideInHorizontally { it } + fadeIn() togetherWith fadeOut(tween(200))
                } else {
                    fadeIn(tween(150)) togetherWith slideOutHorizontally { it } + fadeOut()
                }
            },
            label = "routes",
        ) { route ->
            val back = { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }
            when (route) {
                null -> Unit
                is Route.MovieRowRoute -> MovieGridScreen(route.id, index, actions, progressOf, onBack = { back() })
                else -> CollectionScreen(route, index, actions, vm::visible, onBack = { back() })
            }
        }

        AnimatedVisibility(
            visible = showCategories,
            enter = fadeIn() + slideInVertically { it / 6 },
            exit = fadeOut() + slideOutVertically { it / 6 },
        ) {
            CategoriesOverlay(index, onPick = { actions.push(Route.CollectionRoute(it)) }, onClose = { showCategories = false })
        }

        AnimatedVisibility(
            visible = !showCategories,
            enter = fadeIn() + slideInVertically { it },
            exit = fadeOut() + slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            FloatingTabBar(selected = tab, onSelect = {
                stack.clear()
                if (it != Tab.Discover) focusSearch = false
                tab = it
            })
        }

        sheetChannel?.let { ch ->
            DetailSheet(
                channel = ch,
                index = index,
                saved = ch.id in myList,
                onDismiss = { sheetChannel = null },
                onPlay = { c, stream -> vm.play(context, c, index.similarTo(c, 60), stream) },
                onToggleList = { vm.toggleMyList(ch) },
                onOpenOther = { sheetChannel = it },
            )
        }

        sheetMovie?.let { m ->
            MovieSheet(
                movie = m,
                index = index,
                saved = m.listKey in myList,
                progress = progressOf(m),
                onDismiss = { sheetMovie = null },
                onPlay = { fromStart -> vm.playMovie(context, m, fromStart) },
                onToggleList = { vm.toggleMyList(m) },
                onOpenOther = { sheetMovie = it },
            )
        }

        val active = profile
        if (editingProfile && active != null) {
            ProfileEditorSheet(
                profile = active,
                isNew = false,
                canDelete = false,
                onDismiss = { editingProfile = false },
                onSave = { vm.profiles.save(it); editingProfile = false },
                onDelete = {},
            )
        }
    }
}

/** Netflix-style full-screen category picker. */
@Composable
private fun CategoriesOverlay(index: CatalogIndex, onPick: (String) -> Unit, onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0xF507070B))) {
        LazyColumn(
            contentPadding = PaddingValues(top = 40.dp, bottom = 160.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
        ) {
            items(index.rows, key = { it.first.id }) { (col, list) ->
                Text(
                    "${col.emoji}  ${col.title}",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Kino.TextMid,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.bouncyClick { onPick(col.id) }.padding(horizontal = 24.dp, vertical = 10.dp),
                )
            }
        }
        Text(
            "✕",
            style = MaterialTheme.typography.headlineMedium,
            color = Color.Black,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .bouncyClick(onClick = onClose)
                .clip(RoundedCornerShape(50))
                .background(Color.White)
                .padding(horizontal = 22.dp, vertical = 12.dp),
        )
    }
}

@Composable
private fun LoadFailed(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("😵‍💫", style = MaterialTheme.typography.displayLarge)
        Spacer(Modifier.height(12.dp))
        Text("Couldn't load channels", style = MaterialTheme.typography.headlineMedium, color = Kino.TextHigh)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = Kino.TextLow, textAlign = TextAlign.Center)
        Spacer(Modifier.height(20.dp))
        Text(
            "Try again",
            style = MaterialTheme.typography.labelLarge,
            color = Color.White,
            modifier = Modifier
                .bouncyClick(onClick = onRetry)
                .clip(RoundedCornerShape(50))
                .background(Kino.BrandGradientH)
                .padding(horizontal = 24.dp, vertical = 12.dp),
        )
    }
}
