"""
Perfume/Fragrance model based on the fra_cleaned.csv dataset.
Includes all fields from the dataset.
"""
from django.db import models
from user.models import Profile


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
    top_note = models.JSONField(default=list, blank=True)  # list of strings
    middle_note = models.JSONField(default=list, blank=True)  # list of strings
    base_note = models.JSONField(default=list, blank=True)  # list of strings
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


class PerfumeCollected(models.Model):

    class FragranceType(models.TextChoices):
        EDT = "EDT", "Eau de Toilette"
        EDP = "EDP", "Eau de Parfum"
        PARFUM = "PARFUM", "Parfum"
        OTHER = "OTHER", "Other"

    class PerfumeSize(models.TextChoices):
        SAMPLE = "SAMPLE", "Sample"
        DECANT = "DECANT", "Decant"
        MINI = "MINI", "Mini"
        BOTTLE = "BOTTLE", "Bottle"

    profile = models.ForeignKey(
        Profile, on_delete=models.CASCADE, related_name="collection"
    )
    perfume = models.ForeignKey(Perfume, on_delete=models.CASCADE)
    perfume_type = models.CharField(
        max_length=100,
        choices=FragranceType.choices,
        default=FragranceType.EDT,
    )
    perfume_size = models.CharField(
        max_length=100,
        choices=PerfumeSize.choices,
        default=PerfumeSize.SAMPLE,
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "perfume_collected"
        unique_together = ["profile", "perfume"]

    def __str__(self):
        return f"{self.profile.username} - {self.perfume.perfume}"