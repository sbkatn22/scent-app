from django.contrib import admin
from .models import Perfume


@admin.register(Perfume)
class PerfumeAdmin(admin.ModelAdmin):
    list_display = ["perfume", "brand", "country", "gender", "rating_value", "year"]
    list_filter = ["gender", "country"]
    search_fields = ["perfume", "brand"]
    ordering = ["-rating_count"]
