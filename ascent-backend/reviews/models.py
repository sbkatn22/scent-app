"""
Review model for user reviews of fragrances.
"""
from django.db import models

from user.models import Profile
from perfumes.models import Perfume


class Review(models.Model):
    """
    User review of a perfume, including seasonality, time-of-day, performance
    and value information.
    """

    class Gender(models.TextChoices):
        FEMALE = "Female", "Female"
        SLIGHTLY_FEMALE = "Slightly Female", "Slightly Female"
        UNISEX = "Unisex", "Unisex"
        SLIGHTLY_MALE = "Slightly Male", "Slightly Male"
        MALE = "Male", "Male"

    class Longevity(models.TextChoices):
        H0_2 = "0 - 2 hours", "0 - 2 hours"
        H2_4 = "2 - 4 hours", "2 - 4 hours"
        H4_6 = "4 - 6 hours", "4 - 6 hours"
        H6_8 = "6 - 8 hours", "6 - 8 hours"
        H8_10 = "8-10 hours", "8-10 hours"
        H10_PLUS = "10+ hours", "10+ hours"

    class Value(models.TextChoices):
        SUPER_OVERPRICED = "Super Overpriced", "Super Overpriced"
        OVERPRICED = "Overpriced", "Overpriced"
        ALRIGHT = "Alright", "Alright"
        GOOD_VALUE = "Good Value", "Good Value"
        SUPER_VALUE = "Super Value", "Super Value"

    class Sillage(models.TextChoices):
        NO_SILLAGE = "No Sillage", "No Sillage"
        LIGHT_SILLAGE = "Light Sillage", "Light Sillage"
        MODERATE_SILLAGE = "Moderate Sillage", "Moderate Sillage"
        STRONG_SILLAGE = "Strong Sillage", "Strong Sillage"

    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    perfume = models.ForeignKey(
        Perfume,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    description = models.CharField(max_length=500)
    rating = models.DecimalField(max_digits=3, decimal_places=1)
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
    )
    winter = models.BooleanField(default=False)
    spring = models.BooleanField(default=False)
    summer = models.BooleanField(default=False)
    autumn = models.BooleanField(default=False)
    day = models.BooleanField(default=False)
    night = models.BooleanField(default=False)
    sillage = models.CharField(
        max_length=20,
        choices=Sillage.choices,
        null=True, blank=True
    )
    longevity = models.CharField(
        max_length=20,
        choices=Longevity.choices,
    )
    value = models.CharField(
        max_length=20,
        choices=Value.choices,
    )
    maceration = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reviews"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.profile.username} - {self.perfume.perfume} ({self.rating})"
