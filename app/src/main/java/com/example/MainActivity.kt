package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.example.model.Book
import com.example.ui.screens.HomeScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // NOTE: cacheDir.deleteRecursively() REMOVED permanently.
        // PDF thumbnail caches and app caches are now safely preserved.

        setContent {
            MaterialTheme {
                Surface {
                    HomeScreen(
                        featuredBooks = sampleBooks.take(5),
                        recentBooks = sampleBooks
                    )
                }
            }
        }
    }

    companion object {
        val sampleBooks = listOf(
            Book("b1", "نور الایضاح", "https://example.com/books/noor_ul_izah.pdf", "علامہ شرنبلالی"),
            Book("b2", "ہدایۃ النحو", "https://example.com/books/hidayat_un_nahw.pdf", "ابن حاجب"),
            Book("b3", "قدوری", "https://example.com/books/qudoori.pdf", "امام قدوری"),
            Book("b4", "اصول الشاشی", "https://example.com/books/usool_shashi.pdf", "نظام الدین شاشی"),
            Book("b5", "کنز الدقائق", "https://example.com/books/kanz_ud_daqaiq.pdf", "امام نسفی"),
            Book("b6", "شرح جامی", "https://example.com/books/sharh_jami.pdf", "علامہ جامی")
        )
    }
}
