package com.kwamepeace.kinowave.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Backspace
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.kwamepeace.kinowave.data.PROFILE_AVATARS
import com.kwamepeace.kinowave.data.PROFILE_COLORS
import com.kwamepeace.kinowave.data.Profile
import com.kwamepeace.kinowave.ui.components.Pill
import com.kwamepeace.kinowave.ui.components.bouncyClick
import com.kwamepeace.kinowave.ui.components.rememberTick
import com.kwamepeace.kinowave.ui.theme.Kino
import kotlinx.coroutines.launch

fun profileBrush(profile: Profile): Brush {
    val (a, b) = PROFILE_COLORS[profile.color.coerceIn(0, PROFILE_COLORS.lastIndex)]
    return Brush.linearGradient(listOf(Color(a), Color(b)))
}

@Composable
fun ProfileAvatar(profile: Profile, size: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier.size(size).clip(RoundedCornerShape(size * 0.3f)).background(profileBrush(profile)),
        contentAlignment = Alignment.Center,
    ) {
        Text(profile.avatar, fontSize = (size.value * 0.5f).sp)
    }
}

/** Netflix-style "Who's watching?" screen. */
@Composable
fun ProfilePickerScreen(
    profiles: List<Profile>,
    onPick: (Profile) -> Unit,
    onSave: (Profile) -> Unit,
    onDelete: (Profile) -> Unit,
    newProfile: (kids: Boolean) -> Profile,
) {
    var managing by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Profile?>(null) }
    var unlocking by remember { mutableStateOf<Pair<Profile, Boolean>?>(null) } // profile, forEdit

    Box(Modifier.fillMaxSize().background(Kino.Ink)) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(32.dp))
            Text(
                if (managing) "Manage profiles" else "Who's watching?",
                style = MaterialTheme.typography.headlineLarge,
                color = Kino.TextHigh,
            )
            Spacer(Modifier.height(36.dp))
            FlowRowCentered {
                profiles.forEach { p ->
                    ProfileTile(p, managing) {
                        when {
                            p.locked -> unlocking = p to managing
                            managing -> editing = p
                            else -> onPick(p)
                        }
                    }
                }
                if (profiles.size < 6) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(112.dp)) {
                        Box(
                            Modifier
                                .size(104.dp)
                                .bouncyClick { editing = newProfile(false) }
                                .clip(RoundedCornerShape(30.dp))
                                .border(2.dp, Kino.Stroke, RoundedCornerShape(30.dp)),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Rounded.Add, "Add profile", tint = Kino.TextMid, modifier = Modifier.size(40.dp)) }
                        Spacer(Modifier.height(10.dp))
                        Text("Add profile", style = MaterialTheme.typography.titleSmall, color = Kino.TextMid)
                    }
                }
            }
            Spacer(Modifier.height(40.dp))
            Text(
                if (managing) "Done" else "Manage profiles",
                style = MaterialTheme.typography.labelLarge,
                color = if (managing) Color.Black else Kino.TextHigh,
                modifier = Modifier
                    .bouncyClick { managing = !managing }
                    .clip(RoundedCornerShape(50))
                    .background(if (managing) Color.White else Color(0x14FFFFFF))
                    .border(1.dp, Kino.Stroke, RoundedCornerShape(50))
                    .padding(horizontal = 22.dp, vertical = 12.dp),
            )
        }
    }

    editing?.let { p ->
        ProfileEditorSheet(
            profile = p,
            isNew = profiles.none { it.id == p.id },
            canDelete = profiles.size > 1 && profiles.any { it.id == p.id },
            onDismiss = { editing = null },
            onSave = { onSave(it); editing = null },
            onDelete = { onDelete(it); editing = null },
        )
    }
    unlocking?.let { (p, forEdit) ->
        PinDialog(
            title = "Enter ${p.name}'s PIN",
            check = { it == p.pin },
            onDismiss = { unlocking = null },
            onSuccess = {
                unlocking = null
                if (forEdit) editing = p else onPick(p)
            },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowCentered(content: @Composable () -> Unit) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) { content() }
}

@Composable
private fun ProfileTile(profile: Profile, managing: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(112.dp)) {
        Box(Modifier.bouncyClick(pressedScale = 0.9f, onClick = onClick)) {
            ProfileAvatar(profile, 104.dp)
            if (managing) {
                Box(
                    Modifier.matchParentSize().clip(RoundedCornerShape(31.dp)).background(Color(0x99000000)),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.Edit, "Edit", tint = Color.White, modifier = Modifier.size(34.dp)) }
            }
            if (profile.locked) {
                Box(
                    Modifier.align(Alignment.BottomEnd).offset(6.dp, 6.dp).size(30.dp).clip(CircleShape).background(Kino.Surface),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.Lock, "Locked", tint = Kino.TextHigh, modifier = Modifier.size(16.dp)) }
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(profile.name.ifBlank { "Profile" }, style = MaterialTheme.typography.titleSmall, color = Kino.TextHigh, maxLines = 1)
        if (profile.kids) Pill("KIDS", background = Kino.Lime, color = Color(0xFF0B0B0B), modifier = Modifier.padding(top = 4.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProfileEditorSheet(
    profile: Profile,
    isNew: Boolean,
    canDelete: Boolean,
    onDismiss: () -> Unit,
    onSave: (Profile) -> Unit,
    onDelete: (Profile) -> Unit,
) {
    var name by remember { mutableStateOf(profile.name) }
    var avatar by remember { mutableStateOf(profile.avatar) }
    var color by remember { mutableStateOf(profile.color) }
    var kids by remember { mutableStateOf(profile.kids) }
    var pin by remember { mutableStateOf(profile.pin.orEmpty()) }
    var settingPin by remember { mutableStateOf(false) }
    val draft = profile.copy(name = name.trim().take(16), avatar = avatar, color = color, kids = kids, pin = pin.ifEmpty { null })

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Kino.Surface,
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            ProfileAvatar(draft, 96.dp)
            Spacer(Modifier.height(18.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0x14FFFFFF))
                    .border(1.dp, Kino.Stroke, RoundedCornerShape(18.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                if (name.isEmpty()) Text("Profile name", style = MaterialTheme.typography.bodyLarge, color = Kino.TextLow)
                BasicTextField(
                    value = name,
                    onValueChange = { name = it.take(16) },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = Kino.TextHigh),
                    cursorBrush = SolidColor(Kino.Pink),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            SheetLabel("Avatar")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PROFILE_AVATARS.forEach { a ->
                    Box(
                        Modifier
                            .size(46.dp)
                            .bouncyClick { avatar = a }
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (a == avatar) Color(0x33FFFFFF) else Color(0x0FFFFFFF))
                            .border(if (a == avatar) 2.dp else 0.dp, if (a == avatar) Kino.Pink else Color.Transparent, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) { Text(a, fontSize = 24.sp) }
                }
            }

            SheetLabel("Colour")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PROFILE_COLORS.forEachIndexed { i, (a, b) ->
                    Box(
                        Modifier
                            .size(38.dp)
                            .bouncyClick { color = i }
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Color(a), Color(b))))
                            .border(if (i == color) 3.dp else 0.dp, if (i == color) Color.White else Color.Transparent, CircleShape),
                    )
                }
            }

            Spacer(Modifier.height(18.dp))
            ToggleRow("Kids profile", "Only kids, animation and family channels plus cartoons.", kids) { kids = it }
            Spacer(Modifier.height(10.dp))
            ToggleRow(
                "Profile lock",
                if (pin.isEmpty()) "Ask for a 4-digit PIN before opening this profile." else "Locked with a PIN.",
                pin.isNotEmpty(),
            ) { on -> if (on) settingPin = true else pin = "" }

            Spacer(Modifier.height(24.dp))
            Text(
                if (isNew) "Create profile" else "Save",
                style = MaterialTheme.typography.labelLarge,
                color = Color.White,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .bouncyClick(pressedScale = 0.97f) { if (draft.name.isNotBlank()) onSave(draft) }
                    .clip(RoundedCornerShape(50))
                    .background(if (draft.name.isNotBlank()) Kino.BrandGradientH else SolidColor(Color(0x33FFFFFF)))
                    .padding(vertical = 15.dp),
            )
            if (canDelete) {
                Spacer(Modifier.height(10.dp))
                Text(
                    "Delete profile",
                    style = MaterialTheme.typography.labelLarge,
                    color = Kino.Pink,
                    modifier = Modifier.bouncyClick { onDelete(profile) }.padding(12.dp),
                )
            }
        }
    }

    if (settingPin) {
        PinDialog(
            title = "Choose a 4-digit PIN",
            check = { true },
            onDismiss = { settingPin = false },
            onSuccess = { pin = it; settingPin = false },
        )
    }
}

@Composable
private fun SheetLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        color = Kino.TextHigh,
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 10.dp),
    )
}

@Composable
fun ToggleRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Kino.TextHigh)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Kino.TextLow)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = Kino.Pink, checkedThumbColor = Color.White),
        )
    }
}

/** Four-dot PIN entry with a chunky keypad; shakes on a wrong PIN. */
@Composable
fun PinDialog(title: String, check: (String) -> Boolean, onDismiss: () -> Unit, onSuccess: (String) -> Unit) {
    var entered by remember { mutableStateOf("") }
    val shake = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val tick = rememberTick()

    LaunchedEffect(entered) {
        if (entered.length == 4) {
            if (check(entered)) {
                onSuccess(entered)
            } else {
                for (x in listOf(18f, -16f, 12f, -8f, 4f, 0f)) shake.animateTo(x, spring(stiffness = Spring.StiffnessHigh))
                entered = ""
            }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .clip(RoundedCornerShape(30.dp))
                .background(Kino.Surface)
                .border(1.dp, Kino.Stroke, RoundedCornerShape(30.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(title, style = MaterialTheme.typography.headlineSmall, color = Kino.TextHigh, textAlign = TextAlign.Center)
            Spacer(Modifier.height(20.dp))
            Row(
                Modifier.offset(x = shake.value.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                repeat(4) { i ->
                    Box(
                        Modifier
                            .size(18.dp)
                            .clip(CircleShape)
                            .then(
                                if (i < entered.length) Modifier.background(Kino.BrandGradient)
                                else Modifier.border(2.dp, Kino.TextLow, CircleShape),
                            ),
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫")
            keys.chunked(3).forEach { rowKeys ->
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(vertical = 7.dp)) {
                    rowKeys.forEach { k ->
                        Box(
                            Modifier
                                .size(66.dp)
                                .then(
                                    if (k.isEmpty()) Modifier
                                    else Modifier.bouncyClick(pressedScale = 0.88f) {
                                        tick()
                                        scope.launch { shake.snapTo(0f) }
                                        entered = when {
                                            k == "⌫" -> entered.dropLast(1)
                                            entered.length < 4 -> entered + k
                                            else -> entered
                                        }
                                    }.clip(CircleShape).background(Color(0x14FFFFFF)),
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            when (k) {
                                "⌫" -> Icon(Icons.AutoMirrored.Rounded.Backspace, "Delete", tint = Kino.TextHigh)
                                "" -> Unit
                                else -> Text(k, style = MaterialTheme.typography.headlineMedium, color = Kino.TextHigh)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "Cancel",
                style = MaterialTheme.typography.labelLarge,
                color = Kino.TextMid,
                modifier = Modifier.bouncyClick(onClick = onDismiss).padding(12.dp),
            )
        }
    }
}

