"""
API views for the perfumes app (fragrance endpoints + daily scent endpoints via Upstash REST)
"""
import json
from decimal import Decimal, InvalidOperation
from datetime import datetime

from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt

from .models import Perfume, PerfumeCollected
from user.models import Profile

from upstash_redis import Redis
import os
import uuid
from user.supabase_client import get_supabase_admin


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
# Perfume serializers
# -------------------------

def _get_uid_from_bearer(request):
    auth = request.META.get("HTTP_AUTHORIZATION")
    if not auth or not auth.startswith("Bearer "):
        return None, JsonResponse({"error": "Authorization header with Bearer token is required."}, status=401)
    token = auth[7:].strip()
    if not token:
        return None, JsonResponse({"error": "Bearer token is required."}, status=401)

    try:
        admin = get_supabase_admin()
        user_resp = admin.auth.get_user(token)
        # user_resp is a UserResponse object; convert to dict safely
        user_dict = user_resp.user.dict() if hasattr(user_resp.user, "dict") else {}
        uid_value = user_dict.get("id")
        uid = uuid.UUID(uid_value)
        return uid, None
    except Exception:
        return None, JsonResponse({"error": "Invalid or expired token."}, status=401)

def _profile_to_dict(profile):
    return {
        "id": profile.id,
        "supabase_uid": str(profile.supabase_uid),
        "username": profile.username,
        "bio": profile.bio or "",
        "profile_picture": profile.profile_picture or "",
        "created_at": profile.created_at.isoformat(),
        "updated_at": profile.updated_at.isoformat(),
        "collection": [perfume_collected.perfume.id for perfume_collected in profile.collection.select_related("perfume").all()],

    }


def _get_profile_by_uid(uid):
    try:
        return Profile.objects.get(supabase_uid=uid), None
    except Profile.DoesNotExist:
        return None, JsonResponse({"error": "User not found."}, status=404)

def _fragrance_to_dict(instance):
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