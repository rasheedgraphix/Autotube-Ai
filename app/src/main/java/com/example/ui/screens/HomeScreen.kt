package com.example.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
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
fun HomeScreen(
    featuredBooks: List<Book>,
    recentBooks: List<Book>,
    onBookClick: (Book) -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("درس نظامی لائبریری", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            Text(
                text = "منتخب کتب",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(featuredBooks, key = { it.id }) { book ->
                    Column(
                        modifier = Modifier
                            .width(105.dp)
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

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "تمام کتب",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(recentBooks, key = { it.id }) { book ->
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
}
