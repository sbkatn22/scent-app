"""
Perfume/Fragrance model based on the fra_cleaned.csv dataset.
Includes all fields from the dataset.
"""
from django.db import models
from user.models import Profile
from django.contrib.postgres.indexes import GinIndex


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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    summer_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    winter_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    day_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    night_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    light_sillage_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    moderate_sillage_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    strong_sillage_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    no_sillage_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    h0_2_longevity_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    h2_4_longevity_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    h4_6_longevity_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    h6_8_longevity_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    h8_10_longevity_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    h10_plus_longevity_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    super_overpriced_value_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    overpriced_value_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    alright_value_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    good_value_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    super_value_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    gender_female_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    gender_slightly_female_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    gender_unisex_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    gender_slightly_male_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    gender_male_count = models.PositiveIntegerField(default=0, null=True, blank=True)
    maceration_average = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "perfumes"
        ordering = ["-rating_count"]
        indexes = [
            GinIndex(fields=["brand"], name="brand_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["perfume"], name="perfume_trgm", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self):
        return f"{self.brand} - {self.perfume}"


class PerfumeCollected(models.Model):



    class PerfumeSize(models.TextChoices):
        SAMPLE = "SAMPLE", "Sample"
        DECANT = "DECANT", "Decant"
        MINI = "MINI", "Mini"
        BOTTLE = "BOTTLE", "Bottle"

    profile = models.ForeignKey(
        Profile, on_delete=models.CASCADE, related_name="collection"
    )
    perfume = models.ForeignKey(Perfume, on_delete=models.CASCADE)
    perfume_size = models.CharField(
        max_length=100,
        choices=PerfumeSize.choices,
        default=PerfumeSize.BOTTLE,
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "perfume_collected"
        unique_together = ["profile", "perfume", "perfume_size"]

    def __str__(self):
        return f"{self.profile.username} - {self.perfume.perfume}"