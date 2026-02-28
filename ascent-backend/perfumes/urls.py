"""
URL configuration for the perfumes app.
"""
from django.urls import path

from . import views

urlpatterns = [
    # Search perfumes by name; supports ?name=... and ?page=... (10 results per page)
    path("search/", views.perfume_search),
]
