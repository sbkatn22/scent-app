from django.db import models


class Profile(models.Model):
    class Gender(models.TextChoices):
        FEMALE = "Female", "Female"
        SLIGHTLY_FEMALE = "Slightly Female", "Slightly Female"
        UNISEX = "Unisex", "Unisex"
        SLIGHTLY_MALE = "Slightly Male", "Slightly Male"
        MALE = "Male", "Male"


    supabase_uid = models.UUIDField(unique=True)
    username = models.CharField(max_length=100, unique=True)
    bio = models.TextField(blank=True)
    profile_picture = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    cologne_gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.UNISEX
    )

    followers = models.ManyToManyField(
        'self',
        symmetrical=False,
        related_name='following',
        blank=True
    )
    wishlist = models.ManyToManyField(
        "perfumes.Perfume",
        blank=True,
        related_name="wishlisted_by",
    )
    liked_fragrances = models.ManyToManyField(
        "perfumes.Perfume",
        blank=True,
        related_name="liked_by",
    )

    class Meta:
        db_table = "profiles"

    def __str__(self):
        return self.username