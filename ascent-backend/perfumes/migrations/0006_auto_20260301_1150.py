# perfumes/migrations/000X_enable_trigram.py

from django.db import migrations
from django.contrib.postgres.operations import TrigramExtension


class Migration(migrations.Migration):

    dependencies = [
        ("perfumes", "0005_perfume_alright_value_count_perfume_created_at_and_more"),  # replace with your latest migration
    ]

    operations = [
        TrigramExtension(),
    ]
