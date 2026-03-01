from django.contrib import admin
from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "profile",
        "perfume",
        "rating",
        "gender",
        "longevity",
        "value",
        "created_at",
    ]
    list_filter = ["gender", "longevity", "value"]
    search_fields = ["description", "profile__username", "perfume__perfume"]
    ordering = ["-created_at"]
