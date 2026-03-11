"""
API views for the perfumes app (fragrance endpoints + daily scent endpoints via Upstash REST)
"""
import json
from decimal import Decimal, InvalidOperation
from datetime import datetime
from datetime import timedelta
from django.db.models import Q, Avg, Value, F
from django.contrib.postgres.search import TrigramSimilarity
from django.core.paginator import Paginator, EmptyPage
from django.db.models.functions import Concat
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from .models import Perfume, PerfumeCollected, DailyScent
from reviews.models import Review
import requests_cache
from retry_requests import retry
from upstash_redis import Redis
import os
import uuid
from pathlib import Path
from django.views.decorators.http import require_http_methods
from user.models import Profile
from .models import PerfumeCollected, Perfume
from helpers import _parse_json_body, _parse_json_body_optional, _get_profile_by_uid, _get_uid_from_bearer, _profile_to_dict, _fragrance_to_dict
from events.models import Event
import openmeteo_requests

# -------------------------
# Pagination
# -------------------------
RESULTS_PER_PAGE = 10

open_meteo_url = "https://api.open-meteo.com/v1/forecast"
cache_session = requests_cache.CachedSession('.cache', expire_after = 3600)
retry_session = retry(cache_session, retries = 5, backoff_factor = 0.2)
openmeteo = openmeteo_requests.Client(session = retry_session)

# -------------------------
# Upstash Redis (lazy) + DB fallback for daily scent
# -------------------------
_redis_client = None

def get_redis():
    """Lazy Redis client. Loads .env so vars are set when running server from any cwd. Returns None if Redis is unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parent.parent / "ascentdjango" / ".env"
        load_dotenv(env_path)
    except Exception:
        pass
    url = os.environ.get("UPSTASH_REDIS_REST_URL")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if not url or not token:
        _redis_client = False  # mark as "checked, not available"
        return None
    try:
        _redis_client = Redis(url=url, token=token)
        return _redis_client
    except Exception:
        _redis_client = False
        return None

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
    
    if fragrance.updated_at < timezone.now() - timedelta(days=3):
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

    if not all([timestamp]):
        return JsonResponse({"error": "timestamp are required"}, status=400)

    try:
        if isinstance(timestamp, (int, float)):
            dt = datetime.utcfromtimestamp(timestamp)
        else:
            dt = datetime.fromisoformat(timestamp)
        day_str = dt.strftime("%Y-%m-%d")
        day_date = dt.date()
    except Exception as e:
        return JsonResponse({"error": f"Invalid timestamp: {e}"}, status=400)

    user_id_str = str(user_id)
    key = f"daily_scent:{user_id_str}:{day_str}"

    if not perfume_id:
        redis_client = get_redis()
        if redis_client:
            try:
                redis_client.delete(key)
            except Exception:
                pass
        DailyScent.objects.filter(user_id=user_id_str, day=day_date).delete()
        Event.objects.create(user_id=user_id, action=Event.Action.DAILY_SCENT_REMOVE, value=day_str)
        return JsonResponse({"message": "deleted key"}, status=201)

    # Try Redis first; fall back to DB on failure or if Redis unavailable
    redis_client = get_redis()
    if redis_client:
        try:
            redis_client.set(key, str(perfume_id), ex=TTL_SECONDS)
            Event.objects.create(user_id=user_id, action=Event.Action.DAILY_SCENT_SET, value=str(perfume_id))
            return JsonResponse({"day": day_str, "perfume_id": perfume_id}, status=201)
        except Exception:
            pass  # fall through to DB fallback

    try:
        perfume = Perfume.objects.get(id=perfume_id)
    except Perfume.DoesNotExist:
        return JsonResponse({"error": "Perfume not found"}, status=400)
    DailyScent.objects.update_or_create(
        user_id=user_id_str, day=day_date, defaults={"perfume": perfume}
    )
    Event.objects.create(user_id=user_id, action=Event.Action.DAILY_SCENT_SET, value=str(perfume_id))
    return JsonResponse({"day": day_str, "perfume_id": perfume_id}, status=201)


def get_day_scent_for_user(timestamp, user_id):
    if timestamp is None:
        return None
    if isinstance(timestamp, (int, float)):
        dt = datetime.utcfromtimestamp(timestamp)
    else:
        dt = datetime.fromisoformat(timestamp)
    day_str = dt.strftime("%Y-%m-%d")
    day_date = dt.date()
    user_id_str = str(user_id)
    redis_client = get_redis()
    if redis_client:
        try:
            value = redis_client.get(f"daily_scent:{user_id_str}:{day_str}")
            if value:
                return _fragrance_to_dict(Perfume.objects.get(id=int(value)))
        except Exception:
            pass
    try:
        row = DailyScent.objects.get(user_id=user_id_str, day=day_date)
        return _fragrance_to_dict(row.perfume)
    except DailyScent.DoesNotExist:
        return None

@require_GET
def get_day_scent(request):
    """
    Get all daily scents for a user.
    """
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err
    timestamp = request.GET.get("timestamp")
    try:
        perf_obj = get_day_scent_for_user(user_id=user_id, timestamp=timestamp)
    except Exception as e:
        return JsonResponse({"error": "Failed to fetch from Redis", "detail": str(e)}, status=500)
    return JsonResponse({"daily_scent": perf_obj}, status=200)

@require_GET
def get_daily_scents(request):
    """
    Get all daily scents for a user.
    """
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err
    user_id_str = str(user_id)
    results = []
    redis_client = get_redis()
    if redis_client:
        try:
            cursor = 0
            keys = []
            while True:
                cursor, batch = redis_client.scan(cursor=cursor, match=f"daily_scent:{user_id_str}:*")
                keys.extend(batch)
                if cursor == 0:
                    break
            for key in keys:
                perfume_id = redis_client.get(key)
                day = key.split(":")[-1]
                if perfume_id:
                    results.append({"day": day, "perfume": _fragrance_to_dict(Perfume.objects.get(id=int(perfume_id)))})
        except Exception:
            results = []  # fall through to DB fallback

    if not results:
        for row in DailyScent.objects.filter(user_id=user_id_str).order_by("-day"):
            results.append({"day": row.day.strftime("%Y-%m-%d"), "perfume": _fragrance_to_dict(row.perfume)})

    results.sort(key=lambda x: x["day"])
    return JsonResponse({"daily_scents": results}, status=200)
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
    perfume_size = body.get("size")
    if perfume_size not in PerfumeCollected.PerfumeSize.values:
        perfume_size = PerfumeCollected.PerfumeSize.BOTTLE
    
    collected, created = PerfumeCollected.objects.get_or_create(profile=profile, perfume=perfume, perfume_size=perfume_size)
    
    if not created:
        # Already exists → remove it
        collected.delete()
        Event.objects.create(user_id=user_id, action=Event.Action.COLLECTION_REMOVE, value=str(perfume_id))
        return JsonResponse({"message": "Perfume removed from collection", "perfume_id": perfume_id}, status=200)

    Event.objects.create(user_id=user_id, action=Event.Action.COLLECTION_ADD, value=str(perfume_id))
    return JsonResponse({"message": "Perfume added to collection", "perfume_id": perfume_id}, status=201)

@csrf_exempt
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

# -------------------------
# Perfume like endpoints
# -------------------------
@csrf_exempt
@require_POST
def toggle_fragrance_like(request):
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

    if profile.liked_fragrances.filter(id=perfume.id).exists():
        profile.liked_fragrances.remove(perfume)
        Event.objects.create(user_id=user_id, action=Event.Action.UNLIKE_FRAGRANCE, value=str(perfume_id))
        return JsonResponse({"message": "Fragrance unliked", "perfume_id": perfume_id, "liked": False}, status=200)

    profile.liked_fragrances.add(perfume)
    Event.objects.create(user_id=user_id, action=Event.Action.LIKE_FRAGRANCE, value=str(perfume_id))
    return JsonResponse({"message": "Fragrance liked", "perfume_id": perfume_id, "liked": True}, status=201)


@csrf_exempt
@require_GET
def get_liked_fragrances(request):
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(user_id)
    if err:
        return err

    liked = [_fragrance_to_dict(p) for p in profile.liked_fragrances.all()]
    return JsonResponse({"liked_fragrances": liked}, status=200)


# -------------------------
# Perfume wishlist endpoints
# -------------------------
@csrf_exempt
@require_POST
def toggle_wishlist(request):
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

    if profile.wishlist.filter(id=perfume.id).exists():
        profile.wishlist.remove(perfume)
        Event.objects.create(user_id=user_id, action=Event.Action.WISHLIST_REMOVE, value=str(perfume_id))
        return JsonResponse({"message": "Perfume removed from wishlist", "perfume_id": perfume_id}, status=200)

    profile.wishlist.add(perfume)
    Event.objects.create(user_id=user_id, action=Event.Action.WISHLIST_ADD, value=str(perfume_id))
    return JsonResponse({"message": "Perfume added to wishlist", "perfume_id": perfume_id}, status=201)


@csrf_exempt
@require_GET
def get_wishlist(request):
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(user_id)
    if err:
        return err

    wishlist = [_fragrance_to_dict(p) for p in profile.wishlist.all()]
    return JsonResponse({"wishlist": wishlist}, status=200)


def get_weather(coordinates):
    params = {
        "latitude": coordinates["latitude"],
        "longitude": coordinates["longitude"],
        "current": ["temperature_2m", "is_day", "rain", "snowfall", "apparent_temperature", "relative_humidity_2m"],
    }
    response = openmeteo.weather_api(open_meteo_url, params=params)[0]
    current_data = response.Current()
    formatted_data = {
        "current_temperature_2m": current_data.Variables(0).Value(),
        "current_is_day": current_data.Variables(1).Value(),
        "current_rain": current_data.Variables(2).Value(),
        "current_snowfall": current_data.Variables(3).Value(),
        "current_apparent_temperature": current_data.Variables(4).Value(),
        "current_relative_humidity_2m": current_data.Variables(5).Value(),
    }
    return formatted_data


def _score_perfume(perfume, profile, weather, collection_ids):
    """
    Compute a recommendation score for a perfume given the user's profile
    and current weather conditions.
    """
    # Weather basics
    temp = weather.get("current_apparent_temperature") or weather.get(
        "current_temperature_2m"
    )
    is_day = bool(weather.get("current_is_day", 1))
    humidity = weather.get("current_relative_humidity_2m")

    # Main accords – used for weather pairing logic
    accords = [
        (perfume.mainaccord1 or "").lower(),
        (perfume.mainaccord2 or "").lower(),
        (perfume.mainaccord3 or "").lower(),
        (perfume.mainaccord4 or "").lower(),
        (perfume.mainaccord5 or "").lower(),
    ]
    accords = [a for a in accords if a]

    is_gourmand = any("gourmand" in a or "sweet" in a  for a in accords)
    is_oudy = any("oud" in a or "agarwood" in a for a in accords)
    is_warm_amber_spicy = any(
        "amber" in a or "spicy" in a or "oriental" in a for a in accords
    )
    is_fresh = any(
        any(
            kw in a
            for kw in (
                "fresh",
                "citrus",
                "green",
                "aquatic",
                "marine",
                "ozonic",
                "aldehydic",
                "fruity",
                "green"
            )
        )
        for a in accords
    )

    # Base rating score (normalize ~3–5 to 0–1)
    rating_score = 0.5
    if perfume.rating_value is not None:
        try:
            rating = float(perfume.rating_value)
            rating_score = max(0.0, min(1.0, (rating - 3.0) / 2.0))
        except (TypeError, ValueError):
            rating_score = 0.5

    # Season preference inferred from temperature
    season = None
    if temp is not None:
        if temp <= 10:
            season = "winter"
        elif temp >= 23:
            season = "summer"
        else:
            season = "mild"

    summer_count = perfume.summer_count or 0
    winter_count = perfume.winter_count or 0
    season_total = summer_count + winter_count
    if season_total > 0:
        summer_frac = summer_count / season_total
        winter_frac = winter_count / season_total
    else:
        summer_frac = winter_frac = 0.5

    if season == "summer":
        season_score = summer_frac
    elif season == "winter":
        season_score = winter_frac
    else:
        season_score = 0.5 * (summer_frac + winter_frac)

    # Time of day (day/night)
    day_count = perfume.day_count or 0
    night_count = perfume.night_count or 0
    dn_total = day_count + night_count
    if dn_total > 0:
        day_frac = day_count / dn_total
        night_frac = night_count / dn_total
    else:
        day_frac = night_frac = 0.5
    time_of_day_score = day_frac if is_day else night_frac

    # Longevity: match average community vote to weather-driven target
    lon_counts = {
        1: perfume.h0_2_longevity_count or 0,
        2: perfume.h2_4_longevity_count or 0,
        3: perfume.h4_6_longevity_count or 0,
        4: perfume.h6_8_longevity_count or 0,
        5: perfume.h8_10_longevity_count or 0,
        6: perfume.h10_plus_longevity_count or 0,
    }
    lon_total = sum(lon_counts.values())
    if lon_total > 0:
        avg_idx = sum(level * count for level, count in lon_counts.items()) / lon_total
    else:
        avg_idx = 3.5

    if temp is None:
        target_idx = 4.0
    else:
        if temp <= 5:
            target_idx = 5.5  # prefer very long in cold
        elif temp >= 27:
            target_idx = 3.0  # prefer moderate in heat
        else:
            # linear interpolation between 5 °C and 27 °C
            t = (temp - 5) / (27 - 5)
            target_idx = 5.5 + (3.0 - 5.5) * t
    longevity_score = max(0.0, 1.0 - abs(avg_idx - target_idx) / 5.0)

    # Gender alignment: use detailed review counts if present
    total_gender_votes = (
        (perfume.gender_female_count or 0)
        + (perfume.gender_slightly_female_count or 0)
        + (perfume.gender_unisex_count or 0)
        + (perfume.gender_slightly_male_count or 0)
        + (perfume.gender_male_count or 0)
    )

    if total_gender_votes > 0:
        gf = perfume.gender_female_count or 0
        gsf = perfume.gender_slightly_female_count or 0
        gu = perfume.gender_unisex_count or 0
        gsm = perfume.gender_slightly_male_count or 0
        gm = perfume.gender_male_count or 0

        if profile.cologne_gender == Profile.Gender.FEMALE:
            aligned = gf + 0.7 * gsf + 0.4 * gu
        elif profile.cologne_gender == Profile.Gender.SLIGHTLY_FEMALE:
            aligned = 0.7 * gf + gsf + 0.5 * gu
        elif profile.cologne_gender == Profile.Gender.UNISEX:
            aligned = (
                0.5 * gf + 0.5 * gm + gu + 0.7 * gsf + 0.7 * gsm
            )
        elif profile.cologne_gender == Profile.Gender.SLIGHTLY_MALE:
            aligned = 0.3 * gsf + gsm + 0.7 * gm + 0.5 * gu
        else:  # Profile.Gender.MALE
            aligned = gm + 0.7 * gsm + 0.4 * gu

        gender_score = max(0.0, min(1.0, aligned / total_gender_votes))
    else:
        # Fallback to basic perfume.gender label
        g = (perfume.gender or "").lower()
        if g == "unisex":
            gender_score = 0.9
        elif profile.cologne_gender in (
            Profile.Gender.MALE,
            Profile.Gender.SLIGHTLY_MALE,
        ) and g == "men":
            gender_score = 1.0
        elif profile.cologne_gender in (
            Profile.Gender.FEMALE,
            Profile.Gender.SLIGHTLY_FEMALE,
        ) and g == "women":
            gender_score = 1.0
        else:
            gender_score = 0.6

    # Humidity adjustment – very humid days penalize heavy gourmand/oud/amber scents,
    # and slightly reward fresher styles.
    if humidity is not None:
        humidity_factor = 1.0 - max(0.0, (humidity - 60.0) / 60.0) * 0.2
        if humidity >= 70:
            if is_gourmand or is_oudy or is_warm_amber_spicy:
                humidity_factor *= 0.6
            if is_fresh:
                humidity_factor *= 1.1
        humidity_factor = max(0.5, min(1.3, humidity_factor))
    else:
        humidity_factor = 1.0

    # Accord–temperature pairing: warm heavy scents for cold, fresher for heat.
    accord_temp_score = 0.5
    if temp is not None and accords:
        if temp <= 10:
            if is_gourmand or is_oudy or is_warm_amber_spicy:
                accord_temp_score = 1.0
            elif is_fresh:
                accord_temp_score = 0.4
        elif temp >= 27:
            if is_fresh:
                accord_temp_score = 1.0
            elif is_gourmand or is_oudy or is_warm_amber_spicy:
                accord_temp_score = 0.2
        else:
            if is_fresh or is_warm_amber_spicy:
                accord_temp_score = 0.7
            else:
                accord_temp_score = 0.5

    # Small bonus if the user already owns the fragrance
    in_collection_bonus = 0.2 if perfume.id in collection_ids else 0.0

    score = (
        2.5 * rating_score
        + 1.5 * season_score
        + 1.2 * longevity_score
        + 1.0 * gender_score
        + 0.8 * time_of_day_score
        + 0.8 * accord_temp_score
        + in_collection_bonus
    )

    score *= humidity_factor
    return float(score)

@csrf_exempt
@require_POST
def get_reccommendations(request):
    user_id, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(user_id)
    if err:
        return err
    try:
        body = json.loads(request.body)
        coordinates = body.get("coordinates")
        if not coordinates:
            return JsonResponse({"error": "coordinates is required"}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    try:
        weather = get_weather(coordinates=coordinates)
    except Exception as e:
        print(e)
        return JsonResponse({"error": "Something is wrong"}, status=500)

    collected_qs = profile.collection.select_related("perfume").all()
    collection_perfumes = [pc.perfume for pc in collected_qs]
    collection_ids = {p.id for p in collection_perfumes}
    formatted_collection = [_fragrance_to_dict(perf) for perf in collection_perfumes]

    # Derive simple season and time-of-day flags from weather
    temp = weather.get("current_apparent_temperature") or weather.get(
        "current_temperature_2m"
    )
    is_day = bool(weather.get("current_is_day", 1))

    season = None
    if temp is not None:
        if temp <= 10:
            season = "winter"
        elif temp >= 23:
            season = "summer"
        else:
            season = "mild"

    # Start from all perfumes and filter by season / time of day using vote counts,
    # then take the top 500 by rating_count before scoring.
    qs = Perfume.objects.all()

    if season == "summer":
        # Exclude scents that are clearly winter-leaning when it's summer
        qs = qs.exclude(
            winter_count__gt=0,
            winter_count__gte=F("summer_count"),
        )
    elif season == "winter":
        # Exclude scents that are clearly summer-leaning when it's winter
        qs = qs.exclude(
            summer_count__gt=0,
            summer_count__gte=F("winter_count"),
        )

    if is_day:
        qs = qs.exclude(
            Q(night_count__gt=0) & Q(night_count__gt=F("day_count"))
        )
    else:
        qs = qs.exclude(
            Q(day_count__gt=0) & Q(day_count__gt=F("night_count"))
        )

    candidates_qs = qs.order_by("-rating_count")[:500]
    candidates = list(candidates_qs)

    scored = []
    for perfume in candidates:
        score = _score_perfume(perfume, profile, weather, collection_ids)
        scored.append((perfume, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    # Build a final set of 3 recommendations, ensuring at least one
    # comes from the user's collection if possible.
    top_pool = scored[:50]
    collection_pool = [item for item in top_pool if item[0].id in collection_ids]

    selected = []
    used_ids = set()

    if collection_pool:
        selected.append(collection_pool[0])
        used_ids.add(collection_pool[0][0].id)

    for perfume, score in top_pool:
        if len(selected) >= 3:
            break
        if perfume.id in used_ids:
            continue
        selected.append((perfume, score))
        used_ids.add(perfume.id)

    recommendations = []
    for perfume, score in selected[:3]:
        data = _fragrance_to_dict(perfume)
        data["score"] = round(score, 3)
        data["in_collection"] = perfume.id in collection_ids
        recommendations.append(data)

    return JsonResponse(
        {
            "weather": weather,
            "collection": formatted_collection,
            "recommendations": recommendations,
        },
        status=200,
    )