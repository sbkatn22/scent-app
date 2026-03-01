"""
URL configuration for the reviews app.
"""
from django.urls import path

from . import views

urlpatterns = [
    path("create/", views.review_create),
    path("by-user/", views.reviews_for_user),
    path("", views.reviews_for_fragrance),
]
