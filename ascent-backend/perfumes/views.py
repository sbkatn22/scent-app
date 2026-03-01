"""
API views for the perfumes app (fragrance endpoints + daily scent endpoints via Upstash REST)
"""
import json
from decimal import Decimal, InvalidOperation
from datetime import datetime
from datetime import timedelta
from django.db.models import Q, Avg, Value
from django.contrib.postgres.search import TrigramSimilarity
from django.core.paginator import Paginator, EmptyPage
from django.db.models.functions import Concat
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from .models import Perfume, PerfumeCollected
from reviews.models import Review

from upstash_redis import Redis
import os
import uuid

from helpers import _parse_json_body, _parse_json_body_optional, _get_profile_by_uid, _get_uid_from_bearer, _profile_to_dict, _fragrance_to_dict


# -------------------------
# Pagination
# -------------------------
RESULTS_PER_PAGE = 10

# ------------------------- 
# Upstash Redis REST client
# -------------------------
redis = Redis(
    url=os.environ.get("UPSTASH_REDIS_REST_URL"),
    token=os.environ.get("UPSTASH_REDIS_REST_TOKEN")
)
TTL_SECONDS = 32 * 24 * 60 * 60  # 32 days




# -------------------------
# Perfume endpoints
# -------------------------
@require_GET
def fragrance_search(request):
    search_term = request.GET.get("name", "").strip()
    qs = Perfume.objects.all()

    if search_term:
        # Combine brand + perfume into one searchable field
        qs = qs.annotate(
            full_name=Concat("brand", Value(" "), "perfume"),
            similarity=TrigramSimilarity("brand", search_term) +
                       TrigramSimilarity("perfume", search_term)
        ).filter(
            similarity__gt=0.2  # threshold (tune this)
        ).order_by("-similarity")

    total_count = qs.count()
    paginator = Paginator(qs, RESULTS_PER_PAGE)

    try:
        page_number = int(request.GET.get("page", 1))
        if page_number < 1:
            page_number = 1
    except (ValueError, TypeError):
        page_number = 1

    try:
        page = paginator.page(page_number)
    except:
        page = paginator.page(paginator.num_pages) if paginator.num_pages else []

    results = [_fragrance_to_dict(p) for p in getattr(page, "object_list", [])]

    return JsonResponse({
        "count": len(results),
        "results": results,
    })


@csrf_exempt
@require_POST
def fragrance_create(request):
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    required = ("url", "fragrance", "brand", "country", "gender")
    for key in required:
        if not body.get(key):
            return JsonResponse({"error": f"Missing required field: {key}"}, status=400)

    url = body["url"].strip()
    fragrance_name = body["fragrance"].strip()
    brand = body["brand"].strip()
    country = body["country"].strip()
    gender = body["gender"].strip()

    if not all([url, fragrance_name, brand, country, gender]):
        return JsonResponse({"error": "Required fields cannot be empty"}, status=400)

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
        return JsonResponse({"error": "Failed to create fragrance", "detail": str(e)}, status=400)

    return JsonResponse(_fragrance_to_dict(obj), status=201)


# -------------------------
# Perfume endpoints
# -------------------------
@csrf_exempt
@require_GET
def fragrance_get(request):
    """
    Get a fragrance by ID.
    """
    fragrance_id = request.GET.get("id")
    if not fragrance_id:
        return JsonResponse({"error": "id is required"}, status=400)

    try:
        fragrance = Perfume.objects.get(id=fragrance_id)
    except Perfume.DoesNotExist:
        return JsonResponse({"error": "Fragrance not found"}, status=404)
    
    if fragrance.updated_at > timezone.now() - timedelta(days=3):
        reviews = fragrance.reviews.all()
        fragrance.rating_value = reviews.aggregate(Avg("rating"))["rating__avg"]
        fragrance.rating_count = len(reviews)
        fragrance.summer_count = reviews.filter(summer=True).count()
        fragrance.winter_count = reviews.filter(winter=True).count()
        fragrance.day_count = reviews.filter(day=True).count()
        fragrance.night_count = reviews.filter(night=True).count()
        fragrance.light_sillage_count = reviews.filter(sillage=Review.Sillage.LIGHT_SILLAGE).count()
        fragrance.moderate_sillage_count = reviews.filter(sillage=Review.Sillage.MODERATE_SILLAGE).count()
        fragrance.strong_sillage_count = reviews.filter(sillage=Review.Sillage.STRONG_SILLAGE).count()
        fragrance.no_sillage_count = reviews.filter(sillage=Review.Sillage.NO_SILLAGE).count()
        fragrance.h0_2_longevity_count = reviews.filter(longevity=Review.Longevity.H0_2).count()
        fragrance.h2_4_longevity_count = reviews.filter(longevity=Review.Longevity.H2_4).count()
        fragrance.h4_6_longevity_count = reviews.filter(longevity=Review.Longevity.H4_6).count()
        fragrance.h6_8_longevity_count = reviews.filter(longevity=Review.Longevity.H6_8).count()
        fragrance.h8_10_longevity_count = reviews.filter(longevity=Review.Longevity.H8_10).count()
        fragrance.h10_plus_longevity_count = reviews.filter(longevity=Review.Longevity.H10_PLUS).count()
        fragrance.super_overpriced_value_count = reviews.filter(value=Review.Value.SUPER_OVERPRICED).count()
        fragrance.overpriced_value_count = reviews.filter(value=Review.Value.OVERPRICED).count()
        fragrance.alright_value_count = reviews.filter(value=Review.Value.ALRIGHT).count()
        fragrance.good_value_count = reviews.filter(value=Review.Value.GOOD_VALUE).count()
        fragrance.super_value_count = reviews.filter(value=Review.Value.SUPER_VALUE).count()
        fragrance.gender_female_count = reviews.filter(gender=Review.Gender.FEMALE).count()
        fragrance.gender_slightly_female_count = reviews.filter(gender=Review.Gender.SLIGHTLY_FEMALE).count()
        fragrance.gender_unisex_count = reviews.filter(gender=Review.Gender.UNISEX).count()
        fragrance.gender_slightly_male_count = reviews.filter(gender=Review.Gender.SLIGHTLY_MALE).count()
        fragrance.gender_male_count = reviews.filter(gender=Review.Gender.MALE).count()
        fragrance.maceration_average = reviews.filter(maceration__isnull=False).aggregate(Avg("maceration"))["maceration__avg"]
        fragrance.save()


    return JsonResponse(_fragrance_to_dict(fragrance), status=200)

# -------------------------
# Daily scent endpoints using Upstash REST client
# -------------------------
@csrf_exempt
@require_POST
def create_daily_scent(request):
    """
    Create a daily scent entry for a user.
    """
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    
    perfume_id = body.get("perfume_id")
    timestamp = body.get("timestamp")

    if not all([perfume_id, timestamp]):
        return JsonResponse({"error": "perfume_id, and timestamp are required"}, status=400)

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
        redis.set(key, str(perfume_id), ex=TTL_SECONDS)
    except Exception as e:
        return JsonResponse({"error": "Failed to set value in Redis", "detail": str(e)}, status=500)

    return JsonResponse({"day": day_str, "perfume_id": perfume_id}, status=201)


@require_GET
def get_daily_scents(request):
    """
    Get all daily scents for a user.
    """
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    try:
        # SCAN keys pattern instead of KEYS (recommended in Upstash)
        cursor = 0
        keys = []
        while True:
            cursor, batch = redis.scan(cursor=cursor, match=f"daily_scent:{user_id}:*")
            keys.extend(batch)
            if cursor == 0:
                break

        results = []
        for key in keys:
            perfume_id = redis.get(key)
            day = key.split(":")[-1]
            if perfume_id:
                results.append({"day": day, "perfume_id": perfume_id})

    except Exception as e:
        return JsonResponse({"error": "Failed to fetch from Redis", "detail": str(e)}, status=500)

    results.sort(key=lambda x: x["day"])
    return JsonResponse({"daily_scents": results}, status=200)
from django.views.decorators.http import require_http_methods
from user.models import Profile
from .models import PerfumeCollected, Perfume

# -------------------------
# Perfume collection endpoints
# -------------------------
@csrf_exempt
@require_POST
def toggle_collection(request):
    """
    Add a perfume to user's collection if not already added,
    or remove it if it exists.
    Expects JSON: { "perfume_id": <int> }
    """
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(user_id)
    if err:
        return err

    try:
        body = json.loads(request.body)
        perfume_id = body.get("perfume_id")
        if not perfume_id:
            return JsonResponse({"error": "perfume_id is required"}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    try:
        perfume = Perfume.objects.get(id=perfume_id)
    except Perfume.DoesNotExist:
        return JsonResponse({"error": "Perfume not found"}, status=404)

    collected, created = PerfumeCollected.objects.get_or_create(profile=profile, perfume=perfume)
    
    if not created:
        # Already exists → remove it
        collected.delete()
        return JsonResponse({"message": "Perfume removed from collection", "perfume_id": perfume_id}, status=200)
    
    return JsonResponse({"message": "Perfume added to collection", "perfume_id": perfume_id}, status=201)


@require_GET
def get_collection(request):
    """
    Fetch the user's perfume collection.
    """
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(user_id)
    if err:
        return err

    
    collection = _profile_to_dict(profile).get("collection", [])
    return JsonResponse({"collection": collection}, status=200)