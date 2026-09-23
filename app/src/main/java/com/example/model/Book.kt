package com.example.model

data class Book(
    val id: String,
    val title: String,
    val pdfUrl: String,
    val author: String = "",
    val yearName: String = "",
    val description: String = ""
)
