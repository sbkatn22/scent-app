from django.db import models


class Profile(models.Model):
    supabase_uid = models.UUIDField(unique=True)
    username = models.CharField(max_length=100, unique=True)
    bio = models.TextField(blank=True)
    profile_picture = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    followers = models.ManyToManyField(
        'self',
        symmetrical=False,
        related_name='following',
        blank=True
    )

    class Meta:
        db_table = "profiles"

    def __str__(self):
        return self.username