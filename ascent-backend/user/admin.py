from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["username", "supabase_uid", "created_at"]
    search_fields = ["username", "supabase_uid"]
    readonly_fields = ["created_at", "updated_at"]
    filter_horizontal = ["collection"]
