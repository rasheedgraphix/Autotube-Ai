package com.example.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Helper object to generate PDF first-page thumbnail bitmaps.
 * Strictly stateless without any static memory cache map.
 */
object PdfThumbnailHelper {

    suspend fun getThumbnail(
        context: Context,
        pdfUrl: String,
        targetWidth: Int = 400,
        targetHeight: Int = 600
    ): Bitmap? = withContext(Dispatchers.IO) {
        try {
            if (pdfUrl.isBlank()) return@withContext null

            val file: File = if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) {
                val safeFileName = "pdf_thumb_${Math.abs(pdfUrl.hashCode())}.pdf"
                val destFile = File(context.cacheDir, safeFileName)
                if (!destFile.exists() || destFile.length() == 0L) {
                    val url = URL(pdfUrl)
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        connectTimeout = 15000
                        readTimeout = 15000
                        instanceFollowRedirects = true
                    }
                    conn.connect()
                    if (conn.responseCode in 200..299) {
                        conn.inputStream.use { input ->
                            FileOutputStream(destFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    } else {
                        return@withContext null
                    }
                }
                destFile
            } else if (pdfUrl.startsWith("content://") || pdfUrl.startsWith("file://")) {
                val uri = Uri.parse(pdfUrl)
                val tempFile = File(context.cacheDir, "temp_${System.currentTimeMillis()}.pdf")
                context.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        input.copyTo(output)
                    }
                }
                tempFile
            } else {
                File(pdfUrl)
            }

            if (!file.exists() || file.length() == 0L) return@withContext null

            renderFirstPage(file, targetWidth, targetHeight)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun renderFirstPage(file: File, width: Int = 400, height: Int = 600): Bitmap? {
        var pfd: ParcelFileDescriptor? = null
        var renderer: PdfRenderer? = null
        var page: PdfRenderer.Page? = null
        return try {
            pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            renderer = PdfRenderer(pfd)
            if (renderer.pageCount > 0) {
                page = renderer.openPage(0)
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                bitmap.eraseColor(Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                bitmap
            } else {
                null
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            try { page?.close() } catch (_: Exception) {}
            try { renderer?.close() } catch (_: Exception) {}
            try { pfd?.close() } catch (_: Exception) {}
        }
    }
}
