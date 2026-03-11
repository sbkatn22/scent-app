from django.db import models


class Event(models.Model):

    class Action(models.TextChoices):
        COLLECTION_ADD    = "COLLECTION_ADD",    "Collection Add"
        COLLECTION_REMOVE = "COLLECTION_REMOVE", "Collection Remove"
        DAILY_SCENT_SET   = "DAILY_SCENT_SET",   "Daily Scent Set"
        DAILY_SCENT_REMOVE = "DAILY_SCENT_REMOVE", "Daily Scent Remove"
        FOLLOW            = "FOLLOW",            "Follow"
        UNFOLLOW          = "UNFOLLOW",          "Unfollow"
        REVIEW_CREATE     = "REVIEW_CREATE",     "Review Create"
        REVIEW_UPDATE     = "REVIEW_UPDATE",     "Review Update"
        REVIEW_DELETE     = "REVIEW_DELETE",     "Review Delete"
        WISHLIST_ADD      = "WISHLIST_ADD",      "Wishlist Add"
        WISHLIST_REMOVE   = "WISHLIST_REMOVE",   "Wishlist Remove"
        LIKE_FRAGRANCE    = "LIKE_FRAGRANCE",    "Like Fragrance"
        UNLIKE_FRAGRANCE  = "UNLIKE_FRAGRANCE",  "Unlike Fragrance"
        LIKE_REVIEW       = "LIKE_REVIEW",       "Like Review"
        UNLIKE_REVIEW     = "UNLIKE_REVIEW",     "Unlike Review"
        LIKE_COMMENT      = "LIKE_COMMENT",      "Like Comment"
        UNLIKE_COMMENT    = "UNLIKE_COMMENT",    "Unlike Comment"

    # Supabase UUID of the user who triggered the action
    user_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=50, choices=Action.choices, db_index=True)
    # Contextual value — e.g. perfume id, target user uid, etc. Nullable.
    value = models.CharField(max_length=255, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "events"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user_id} | {self.action} | {self.value} @ {self.timestamp}"
