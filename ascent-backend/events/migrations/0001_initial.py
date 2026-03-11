from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Event",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("user_id", models.UUIDField(db_index=True)),
                ("action", models.CharField(
                    choices=[
                        ("COLLECTION_ADD",    "Collection Add"),
                        ("COLLECTION_REMOVE", "Collection Remove"),
                        ("DAILY_SCENT_SET",   "Daily Scent Set"),
                        ("DAILY_SCENT_REMOVE","Daily Scent Remove"),
                        ("FOLLOW",            "Follow"),
                        ("UNFOLLOW",          "Unfollow"),
                        ("REVIEW_CREATE",     "Review Create"),
                        ("REVIEW_UPDATE",     "Review Update"),
                        ("REVIEW_DELETE",     "Review Delete"),
                        ("WISHLIST_ADD",      "Wishlist Add"),
                        ("WISHLIST_REMOVE",   "Wishlist Remove"),
                    ],
                    db_index=True,
                    max_length=50,
                )),
                ("value", models.CharField(blank=True, max_length=255, null=True)),
                ("timestamp", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "db_table": "events",
                "ordering": ["-timestamp"],
            },
        ),
    ]
