from django.urls import path

from . import views

urlpatterns = [
    path("login", views.login),
    path("register", views.create),
    path("refresh", views.refresh),
    path("me", views.me),
    path("follow", views.toggle_follow),
    path("following", views.get_following),
    path("followers", views.get_followers)

]
