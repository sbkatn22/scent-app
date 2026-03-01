"""
Load fragrances from fra_cleaned.csv using the POST create flow (fragrance_create view).
Reads CSV, builds the same JSON payload the API expects, and calls the create view for each row.
"""
import csv
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand
from django.test import RequestFactory

from perfumes.views import fragrance_create


def safe_decimal(val):
    if val is None or str(val).strip() == "":
        return None
    s = str(val).strip().replace(",", ".")
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def safe_int(val):
    if val is None or str(val).strip() == "":
        return None
    try:
        return int(float(str(val).replace(",", ".")))
    except (ValueError, TypeError):
        return None


def note_string_to_list(s):
    if not s or not str(s).strip():
        return []
    return [n.strip() for n in str(s).split(",") if n.strip()]


def row_to_payload(row):
    """Map CSV row (dict with CSV column names) to the JSON body expected by POST /api/fragrances/create/."""
    url = (row.get("url") or "").strip()
    fragrance = (row.get("Perfume") or "").strip()
    brand = (row.get("Brand") or "").strip()
    country = (row.get("Country") or "").strip()
    gender = (row.get("Gender") or "").strip()

    payload = {
        "url": url or "https://example.com/placeholder",
        "fragrance": fragrance or "Unknown",
        "brand": brand or "Unknown",
        "country": country or "Unknown",
        "gender": gender or "unisex",
    }

    rv = safe_decimal(row.get("Rating Value"))
    if rv is not None:
        payload["rating_value"] = str(rv)
    rc = safe_int(row.get("Rating Count"))
    if rc is not None:
        payload["rating_count"] = rc
    year = safe_int(row.get("Year"))
    if year is not None:
        payload["year"] = year

    top = note_string_to_list(row.get("Top"))
    if top:
        payload["top_note"] = top
    middle = note_string_to_list(row.get("Middle"))
    if middle:
        payload["middle_note"] = middle
    base = note_string_to_list(row.get("Base"))
    if base:
        payload["base_note"] = base

    for key, csv_key in [
        ("perfumer1", "Perfumer1"),
        ("perfumer2", "Perfumer2"),
        ("mainaccord1", "mainaccord1"),
        ("mainaccord2", "mainaccord2"),
        ("mainaccord3", "mainaccord3"),
        ("mainaccord4", "mainaccord4"),
        ("mainaccord5", "mainaccord5"),
    ]:
        val = (row.get(csv_key) or "").strip()
        if val:
            payload[key] = val

    return payload


class Command(BaseCommand):
    help = "Load fragrances from fra_cleaned.csv using the POST create method (fragrance_create view)."

    def add_arguments(self, parser):
        parser.add_argument(
            "csv_path",
            nargs="?",
            default=r"c:\Users\sanka\Downloads\archive\fra_cleaned.csv",
            type=str,
            help="Path to fra_cleaned.csv",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Load only first N rows (0 = all).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print payload for first row and exit.",
        )

    def handle(self, *args, **options):
        csv_path = Path(options["csv_path"])
        limit = options["limit"]
        dry_run = options["dry_run"]

        if not csv_path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {csv_path}"))
            return

        with open(csv_path, "r", encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            rows = list(reader)

        total = len(rows)
        if limit > 0:
            rows = rows[:limit]
            self.stdout.write(f"Limiting to first {len(rows)} rows (of {total}).")
        else:
            self.stdout.write(f"Loading {total} rows from {csv_path}.")

        if dry_run:
            if rows:
                payload = row_to_payload(rows[0])
                self.stdout.write(json.dumps(payload, indent=2))
            return

        factory = RequestFactory()
        created = 0
        errors = 0
        for i, row in enumerate(rows):
            payload = row_to_payload(row)
            request = factory.post(
                "/api/fragrances/create/",
                data=json.dumps(payload),
                content_type="application/json",
            )
            response = fragrance_create(request)
            if response.status_code == 201:
                created += 1
            else:
                errors += 1
                try:
                    body = json.loads(response.content)
                    msg = body.get("error") or body.get("detail") or response.content.decode()
                except Exception:
                    msg = response.content.decode()
                self.stderr.write(self.style.WARNING(f"Row {i + 1}: {msg}"))

            if (i + 1) % 500 == 0:
                self.stdout.write(f"Processed {i + 1}/{len(rows)} ... created={created}, errors={errors}")

        self.stdout.write(
            self.style.SUCCESS(f"Done. Created={created}, errors={errors}, total={len(rows)}")
        )
