"""
URL configuration for the perfumes app (fragrance endpoints).
"""
from django.urls import path

from . import views

urlpatterns = [
    # Perfume endpoints
    path("search/", views.fragrance_search),
    path("create/", views.fragrance_create),
    path("get/", views.fragrance_get),

    # Collection endpoints
    path("collection/toggle/", views.toggle_collection),
    path("collection/get/", views.get_collection),

    # Daily scent endpoints
    path("daily_scent/create/", views.create_daily_scent),
    path("daily_scent/get/", views.get_daily_scents),

    path("reccomendations", views.get_reccommendations)
]