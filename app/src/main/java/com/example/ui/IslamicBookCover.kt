package com.example.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.util.PdfThumbnailHelper

// Predefined authentic traditional Islamic manuscript gradient palettes
private val CoverGradients = listOf(
    listOf(Color(0xFF0E3A2F), Color(0xFF1F5C4A)), // Deep Emerald & Forest Jade
    listOf(Color(0xFF0F2B48), Color(0xFF1D4E7C)), // Persian Sapphire & Royal Navy
    listOf(Color(0xFF381A4C), Color(0xFF5E2B7A)), // Damascene Violet & Imperial Plum
    listOf(Color(0xFF5A1E1E), Color(0xFF8B2E2E)), // Andalusian Maroon & Deep Crimson
    listOf(Color(0xFF4A3525), Color(0xFF73523B)), // Antique Moroccan Leather & Bronze
    listOf(Color(0xFF1B3B3F), Color(0xFF2E6168)), // Byzantine Teal & Peacock
    listOf(Color(0xFF3B2F1D), Color(0xFF6B5535)), // Gilded Sienna & Warm Ochre
    listOf(Color(0xFF202A38), Color(0xFF3B4B60)), // Ottoman Slate & Midnight Graphite
    listOf(Color(0xFF4A1525), Color(0xFF7A2540)), // Ottoman Ruby & Persian Rose
    listOf(Color(0xFF1D3B24), Color(0xFF356B41))  // Medina Olive & Palm Green
)

/**
 * Islamic Book Cover Component.
 * - Keyed to remember(pdfUrl) so changing URLs always reloads cleanly without stale states.
 * - Falls back dynamically to bookId.hashCode() distinct gradient color so no two books look identical.
 */
@Composable
fun IslamicBookCover(
    pdfUrl: String,
    bookId: String,
    title: String = "",
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var bitmap by remember(pdfUrl) { mutableStateOf<Bitmap?>(null) }
    var isLoading by remember(pdfUrl) { mutableStateOf(pdfUrl.isNotBlank()) }

    LaunchedEffect(pdfUrl) {
        if (pdfUrl.isNotBlank()) {
            isLoading = true
            bitmap = PdfThumbnailHelper.getThumbnail(context, pdfUrl)
            isLoading = false
        } else {
            bitmap = null
            isLoading = false
        }
    }

    // Unique gradient calculated from bookId.hashCode()
    val paletteIndex = kotlin.math.abs(bookId.hashCode()) % CoverGradients.size
    val gradientColors = CoverGradients[paletteIndex]

    val shape = RoundedCornerShape(8.dp)

    Box(
        modifier = modifier
            .aspectRatio(0.68f)
            .shadow(6.dp, shape = shape)
            .clip(shape)
            .background(Brush.verticalGradient(gradientColors))
            .border(1.5.dp, Color(0xFFD4AF37).copy(alpha = 0.55f), shape),
        contentAlignment = Alignment.Center
    ) {
        val currentBitmap = bitmap
        if (currentBitmap != null) {
            Image(
                bitmap = currentBitmap.asImageBitmap(),
                contentDescription = title.ifEmpty { "Book Cover" },
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            // Elegant ornate fall-back book cover with distinctive gradient colors
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(8.dp)
                    .border(1.dp, Color(0xFFD4AF37).copy(alpha = 0.35f), RoundedCornerShape(4.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Top Ornate Header
                Text(
                    text = "﷽",
                    color = Color(0xFFD4AF37),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )

                // Middle Book Title
                if (isLoading) {
                    CircularProgressIndicator(
                        color = Color(0xFFD4AF37),
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = title.ifEmpty { "درس نظامی" },
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Bottom Subtitle Identifier
                Text(
                    text = "جلد / کتاب",
                    color = Color(0xFFD4AF37).copy(alpha = 0.85f),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
