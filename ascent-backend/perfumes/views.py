"""
API views for the perfumes app (fragrance endpoints).
"""
import json
import os
from decimal import Decimal, InvalidOperation
from datetime import datetime

from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt

from .models import Perfume

import redis

# Default and maximum number of results per page for pagination
RESULTS_PER_PAGE = 10

# -------------------------
# Upstash Redis configuration
# -------------------------
UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_REST_URL")
UPSTASH_REDIS_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN")

redis_client = redis.Redis(
    host=UPSTASH_REDIS_URL,
    password=UPSTASH_REDIS_TOKEN,
    decode_responses=True,
)

TTL_SECONDS = 32 * 24 * 60 * 60  # 32 days

# -------------------------
# Perfume serializers
# -------------------------
def _fragrance_to_dict(instance):
    """
    Serialize a Perfume instance to a dictionary for JSON response.
    Uses "fragrance" as the label for the fragrance name.

    Args:
        instance: A Perfume model instance.

    Returns:
        dict: A dictionary representation of the fragrance with all relevant fields.
    """
    return {
        "id": instance.id,
        "url": instance.url,
        "fragrance": instance.perfume,
        "brand": instance.brand,
        "country": instance.country,
        "gender": instance.gender,
        "rating_value": str(instance.rating_value) if instance.rating_value else None,
        "rating_count": instance.rating_count,
        "year": instance.year,
        "top_note": instance.top_note,
        "middle_note": instance.middle_note,
        "base_note": instance.base_note,
        "perfumer1": instance.perfumer1,
        "perfumer2": instance.perfumer2,
        "mainaccord1": instance.mainaccord1,
        "mainaccord2": instance.mainaccord2,
        "mainaccord3": instance.mainaccord3,
        "mainaccord4": instance.mainaccord4,
        "mainaccord5": instance.mainaccord5,
    }

# -------------------------
# Perfume endpoints
# -------------------------
@require_GET
def fragrance_search(request):
    """
    Search fragrances by name or brand with pagination.

    Query params:
        name (str): Search term to filter by fragrance name or brand (case-insensitive, partial match).
        page (int): Page number for pagination (default: 1). Each page returns up to 10 results.

    Example: GET /api/fragrances/search/?name=rose&page=1
    """
    search_term = request.GET.get("name", "").strip()

    if search_term:
        qs = Perfume.objects.filter(
            Q(perfume__icontains=search_term) | Q(brand__icontains=search_term)
        )
    else:
        qs = Perfume.objects.all()

    total_count = qs.count()
    paginator = Paginator(qs, RESULTS_PER_PAGE)

    try:
        page_number = int(request.GET.get("page", 1))
        if page_number < 1:
            page_number = 1
    except (ValueError, TypeError):
        page_number = 1

    if paginator.num_pages == 0:
        pagination = {
            "page": 1,
            "per_page": RESULTS_PER_PAGE,
            "total_count": 0,
            "total_pages": 0,
            "has_next": False,
            "has_previous": False,
        }
        results = []
    else:
        try:
            page = paginator.page(page_number)
        except EmptyPage:
            page = paginator.page(paginator.num_pages)
        pagination = {
            "page": page.number,
            "per_page": RESULTS_PER_PAGE,
            "total_count": total_count,
            "total_pages": paginator.num_pages,
            "has_next": page.has_next(),
            "has_previous": page.has_previous(),
        }
        results = [_fragrance_to_dict(p) for p in page.object_list]

    return JsonResponse({
        "count": len(results),
        "pagination": pagination,
        "results": results,
    })


@csrf_exempt
@require_POST
def fragrance_create(request):
    """
    Create a new fragrance (POST).

    Expects JSON body with at least: url, fragrance (name), brand, country, gender.
    Optional: rating_value, rating_count, year, top_note, middle_note, base_note,
    perfumer1, perfumer2, mainaccord1–mainaccord5.
    top_note, middle_note, base_note should be lists of strings.

    Example: POST /api/fragrances/create/
    """
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid JSON body"},
            status=400,
        )

    required = ("url", "fragrance", "brand", "country", "gender")
    for key in required:
        if not body.get(key):
            return JsonResponse(
                {"error": f"Missing required field: {key}"},
                status=400,
            )

    url = body["url"].strip()
    fragrance_name = body["fragrance"].strip()
    brand = body["brand"].strip()
    country = body["country"].strip()
    gender = body["gender"].strip()

    if not all([url, fragrance_name, brand, country, gender]):
        return JsonResponse(
            {"error": "Required fields cannot be empty"},
            status=400,
        )

    def opt_str(key, default=""):
        val = body.get(key)
        return val.strip() if isinstance(val, str) else default

    def opt_int(key):
        val = body.get(key)
        if val is None:
            return None
        try:
            return int(val)
        except (TypeError, ValueError):
            return None

    def opt_decimal(key):
        val = body.get(key)
        if val is None:
            return None
        try:
            return Decimal(str(val))
        except (TypeError, ValueError, InvalidOperation):
            return None

    def opt_list(key):
        val = body.get(key)
        if val is None:
            return []
        if isinstance(val, list) and all(isinstance(x, str) for x in val):
            return val
        if isinstance(val, str):
            return [val] if val else []
        return []

    try:
        obj = Perfume.objects.create(
            url=url,
            perfume=fragrance_name,
            brand=brand,
            country=country,
            gender=gender,
            rating_value=opt_decimal("rating_value"),
            rating_count=opt_int("rating_count"),
            year=opt_int("year"),
            top_note=opt_list("top_note"),
            middle_note=opt_list("middle_note"),
            base_note=opt_list("base_note"),
            perfumer1=opt_str("perfumer1"),
            perfumer2=opt_str("perfumer2"),
            mainaccord1=opt_str("mainaccord1"),
            mainaccord2=opt_str("mainaccord2"),
            mainaccord3=opt_str("mainaccord3"),
            mainaccord4=opt_str("mainaccord4"),
            mainaccord5=opt_str("mainaccord5"),
        )
    except Exception as e:
        return JsonResponse(
            {"error": "Failed to create fragrance", "detail": str(e)},
            status=400,
        )

    return JsonResponse(_fragrance_to_dict(obj), status=201)

# -------------------------
# Daily scent endpoints (Upstash Redis)
# -------------------------
@csrf_exempt
@require_POST
def create_daily_scent(request):
    """
    Create a daily scent entry for a user.

    Expects JSON body with:
        user_id (str or int)
        perfume_id (str or int)
        timestamp (ISO8601 string or UNIX timestamp)

    Stores the perfume_id keyed by "daily_scent:{user_id}:{YYYY-MM-DD}" with TTL 32 days.
    """
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    user_id = body.get("user_id")
    perfume_id = body.get("perfume_id")
    timestamp = body.get("timestamp")

    if not all([user_id, perfume_id, timestamp]):
        return JsonResponse({"error": "user_id, perfume_id, and timestamp are required"}, status=400)

    # Convert timestamp to date string YYYY-MM-DD
    try:
        if isinstance(timestamp, (int, float)):
            dt = datetime.utcfromtimestamp(timestamp)
        else:
            dt = datetime.fromisoformat(timestamp)
        day_str = dt.strftime("%Y-%m-%d")
    except Exception as e:
        return JsonResponse({"error": f"Invalid timestamp: {e}"}, status=400)

    key = f"daily_scent:{user_id}:{day_str}"

    try:
        redis_client.set(name=key, value=str(perfume_id), ex=TTL_SECONDS)
    except Exception as e:
        return JsonResponse({"error": "Failed to set value in Redis", "detail": str(e)}, status=500)

    return JsonResponse({"user_id": user_id, "day": day_str, "perfume_id": perfume_id}, status=201)


@require_GET
def get_daily_scents(request):
    """
    Get all daily scents for a user.

    Query param:
        user_id (required)

    Returns a list of {day: YYYY-MM-DD, perfume_id: str}.
    """
    user_id = request.GET.get("user_id")
    if not user_id:
        return JsonResponse({"error": "user_id is required"}, status=400)

    try:
        pattern = f"daily_scent:{user_id}:*"
        keys = redis_client.keys(pattern)
        results = []
        for key in keys:
            day = key.split(":")[-1]
            perfume_id = redis_client.get(key)
            if perfume_id:
                results.append({"day": day, "perfume_id": perfume_id})
    except Exception as e:
        return JsonResponse({"error": "Failed to fetch from Redis", "detail": str(e)}, status=500)

    # Sort by day ascending
    results.sort(key=lambda x: x["day"])
    return JsonResponse({"user_id": user_id, "daily_scents": results}, status=200)