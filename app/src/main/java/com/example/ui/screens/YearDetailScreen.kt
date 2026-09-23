package com.example.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.Book
import com.example.ui.IslamicBookCover

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YearDetailScreen(
    yearTitle: String,
    books: List<Book>,
    onBookClick: (Book) -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(yearTitle, fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            contentPadding = PaddingValues(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            items(books, key = { it.id }) { book ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onBookClick(book) },
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    IslamicBookCover(
                        pdfUrl = book.pdfUrl,
                        bookId = book.id,
                        title = book.title,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = book.title,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}
