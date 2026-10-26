package com.kwamepeace.kinowave.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kwamepeace.kinowave.R

object Kino {
    val Ink = Color(0xFF07070B)
    val Surface = Color(0xFF121219)
    val SurfaceHigh = Color(0xFF1C1C26)
    val Stroke = Color(0x1FFFFFFF)
    val Pink = Color(0xFFFF2D6F)
    val Violet = Color(0xFF8B5CF6)
    val Lime = Color(0xFFC8FF2E)
    val Cyan = Color(0xFF3DDCFF)
    val TextHigh = Color(0xFFF6F6FA)
    val TextMid = Color(0xFFB4B4C3)
    val TextLow = Color(0xFF7C7C8E)

    val BrandGradient = Brush.linearGradient(listOf(Pink, Violet))
    val BrandGradientH = Brush.horizontalGradient(listOf(Pink, Violet))
}

@OptIn(ExperimentalTextApi::class)
private fun bricolage(weight: Int) = Font(
    R.font.bricolage,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight), FontVariation.width(92f)),
)

@OptIn(ExperimentalTextApi::class)
private fun manrope(weight: Int) = Font(
    R.font.manrope,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

val Display = FontFamily(bricolage(500), bricolage(700), bricolage(800))
val Body = FontFamily(manrope(400), manrope(500), manrope(600), manrope(700), manrope(800))

private val typography = Typography(
    displayLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.ExtraBold, fontSize = 44.sp, lineHeight = 44.sp, letterSpacing = (-1.2).sp),
    displayMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp, lineHeight = 36.sp, letterSpacing = (-0.8).sp),
    headlineLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp, lineHeight = 32.sp, letterSpacing = (-0.6).sp),
    headlineMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 28.sp, letterSpacing = (-0.4).sp),
    headlineSmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 24.sp, letterSpacing = (-0.2).sp),
    titleLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 19.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.Bold, fontSize = 15.sp, lineHeight = 20.sp),
    titleSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Bold, fontSize = 13.sp, lineHeight = 18.sp),
    bodyLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 19.sp),
    bodySmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, lineHeight = 18.sp),
    labelMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp, lineHeight = 12.sp, letterSpacing = 0.6.sp),
)

private val colors = darkColorScheme(
    primary = Kino.Pink,
    onPrimary = Color.White,
    secondary = Kino.Violet,
    tertiary = Kino.Lime,
    background = Kino.Ink,
    onBackground = Kino.TextHigh,
    surface = Kino.Surface,
    onSurface = Kino.TextHigh,
    surfaceVariant = Kino.SurfaceHigh,
    onSurfaceVariant = Kino.TextMid,
    surfaceContainer = Kino.Surface,
    surfaceContainerHigh = Kino.SurfaceHigh,
    surfaceContainerLow = Kino.Surface,
    outline = Kino.Stroke,
)

private val shapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(26.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun KinoTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, shapes = shapes, content = content)
}
