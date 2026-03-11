"""
URL configuration for the reviews app.
"""
from django.urls import path

from . import views

urlpatterns = [
    path("create/", views.review_create),
    path("by-user/", views.reviews_for_user),
    path("update/<int:review_id>/", views.review_update),
    path("delete/<int:review_id>/", views.review_delete),
    path("", views.reviews_for_fragrance),

    # Comment endpoints
    path("comments/", views.comments_for_review),
    path("comments/create/", views.comment_create),
    path("comments/update/<int:comment_id>/", views.comment_update),
    path("comments/delete/<int:comment_id>/", views.comment_delete),

    # Like endpoints
    path("likes/toggle/", views.toggle_review_like),
    path("comments/likes/toggle/", views.toggle_comment_like),
]
