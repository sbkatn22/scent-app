"""
URL configuration for the perfumes app (fragrance endpoints).
"""
from django.urls import path

from . import views

urlpatterns = [
    path("search/", views.fragrance_search),
    path("create/", views.fragrance_create),
]
