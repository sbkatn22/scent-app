"""
Perfume/Fragrance model based on the fra_cleaned.csv dataset.
Includes all fields from the dataset.
"""
from django.db import models


class Perfume(models.Model):
    """Model representing a perfume/fragrance from the Fragrantica dataset."""

    url = models.URLField(max_length=500)
    perfume = models.CharField(max_length=255)
    brand = models.CharField(max_length=255)
    country = models.CharField(max_length=100)
    gender = models.CharField(max_length=20)  # men, women, unisex
    rating_value = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True
    )
    rating_count = models.PositiveIntegerField(null=True, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    top = models.TextField(blank=True)  # top notes
    middle = models.TextField(blank=True)  # middle notes
    base = models.TextField(blank=True)  # base notes
    perfumer1 = models.CharField(max_length=255, blank=True)
    perfumer2 = models.CharField(max_length=255, blank=True)
    mainaccord1 = models.CharField(max_length=100, blank=True)
    mainaccord2 = models.CharField(max_length=100, blank=True)
    mainaccord3 = models.CharField(max_length=100, blank=True)
    mainaccord4 = models.CharField(max_length=100, blank=True)
    mainaccord5 = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "perfumes"
        ordering = ["-rating_count"]

    def __str__(self):
        return f"{self.brand} - {self.perfume}"
