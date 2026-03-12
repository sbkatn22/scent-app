import json

from django.http import JsonResponse
from user.models import Profile
from user.supabase_client import get_supabase_admin
import uuid
from django.utils import timezone
from datetime import timedelta
from django.db.models import Avg
from reviews.models import Review

def _fragrance_to_dict(instance):
    if instance.updated_at < timezone.now() - timedelta(days=0):
        reviews = instance.reviews.all()
        instance.rating_value = reviews.aggregate(Avg("rating"))["rating__avg"]
        instance.rating_count = len(reviews)
        instance.summer_count = reviews.filter(summer=True).count()
        instance.winter_count = reviews.filter(winter=True).count()
        instance.spring_count = reviews.filter(spring=True).count()
        instance.autumn_count = reviews.filter(autumn=True).count()
        instance.day_count = reviews.filter(day=True).count()
        instance.night_count = reviews.filter(night=True).count()
        instance.light_sillage_count = reviews.filter(sillage=Review.Sillage.LIGHT_SILLAGE).count()
        instance.moderate_sillage_count = reviews.filter(sillage=Review.Sillage.MODERATE_SILLAGE).count()
        instance.strong_sillage_count = reviews.filter(sillage=Review.Sillage.STRONG_SILLAGE).count()
        instance.no_sillage_count = reviews.filter(sillage=Review.Sillage.NO_SILLAGE).count()
        instance.h0_2_longevity_count = reviews.filter(longevity=Review.Longevity.H0_2).count()
        instance.h2_4_longevity_count = reviews.filter(longevity=Review.Longevity.H2_4).count()
        instance.h4_6_longevity_count = reviews.filter(longevity=Review.Longevity.H4_6).count()
        instance.h6_8_longevity_count = reviews.filter(longevity=Review.Longevity.H6_8).count()
        instance.h8_10_longevity_count = reviews.filter(longevity=Review.Longevity.H8_10).count()
        instance.h10_plus_longevity_count = reviews.filter(longevity=Review.Longevity.H10_PLUS).count()
        instance.super_overpriced_value_count = reviews.filter(value=Review.Value.SUPER_OVERPRICED).count()
        instance.overpriced_value_count = reviews.filter(value=Review.Value.OVERPRICED).count()
        instance.alright_value_count = reviews.filter(value=Review.Value.ALRIGHT).count()
        instance.good_value_count = reviews.filter(value=Review.Value.GOOD_VALUE).count()
        instance.super_value_count = reviews.filter(value=Review.Value.SUPER_VALUE).count()
        instance.gender_female_count = reviews.filter(gender=Review.Gender.FEMALE).count()
        instance.gender_slightly_female_count = reviews.filter(gender=Review.Gender.SLIGHTLY_FEMALE).count()
        instance.gender_unisex_count = reviews.filter(gender=Review.Gender.UNISEX).count()
        instance.gender_slightly_male_count = reviews.filter(gender=Review.Gender.SLIGHTLY_MALE).count()
        instance.gender_male_count = reviews.filter(gender=Review.Gender.MALE).count()
        instance.maceration_average = reviews.filter(maceration__isnull=False).aggregate(Avg("maceration"))["maceration__avg"]
        instance.save()
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
        "summer_count": instance.summer_count,
        "winter_count": instance.winter_count,
        "spring_count": instance.spring_count,
        "autumn_count": instance.autumn_count,
        "day_count": instance.day_count,
        "night_count": instance.night_count,
        "light_sillage_count": instance.light_sillage_count,
        "moderate_sillage_count": instance.moderate_sillage_count,
        "strong_sillage_count": instance.strong_sillage_count,
        "no_sillage_count": instance.no_sillage_count,
        "h0_2_longevity_count": instance.h0_2_longevity_count,
        "h2_4_longevity_count": instance.h2_4_longevity_count,
        "h4_6_longevity_count": instance.h4_6_longevity_count,
        "h6_8_longevity_count": instance.h6_8_longevity_count,
        "h8_10_longevity_count": instance.h8_10_longevity_count,
        "h10_plus_longevity_count": instance.h10_plus_longevity_count,
        "super_overpriced_value_count": instance.super_overpriced_value_count,
        "overpriced_value_count": instance.overpriced_value_count,
        "alright_value_count": instance.alright_value_count,
        "good_value_count": instance.good_value_count,
        "super_value_count": instance.super_value_count,
        "gender_female_count": instance.gender_female_count,
        "gender_slightly_female_count": instance.gender_slightly_female_count,
        "gender_unisex_count": instance.gender_unisex_count,
        "gender_slightly_male_count": instance.gender_slightly_male_count,
        "gender_male_count": instance.gender_male_count,
        "maceration_average": instance.maceration_average,
    }

    
def _parse_json_body(request):
    if not request.body:
        return None, JsonResponse({"error": "Request body is required"}, status=400)
    try:
        return json.loads(request.body), None
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Invalid JSON"}, status=400)


def _parse_json_body_optional(request):
    if not request.body:
        return {}, None
    try:
        return json.loads(request.body), None
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Invalid JSON"}, status=400)


def _profile_to_dict(profile):
    return {
        "id": profile.id,
        "supabase_uid": str(profile.supabase_uid),
        "username": profile.username,
        "bio": profile.bio or "",
        "profile_picture": profile.profile_picture or "",
        "created_at": profile.created_at.isoformat(),
        "updated_at": profile.updated_at.isoformat(),
        "followers_count": profile.followers.count(),
        "following_count": profile.following.count(),
        "collection": [
            {
                **_fragrance_to_dict(perfume_collected.perfume),
                "size": perfume_collected.perfume_size,
                "added_on": perfume_collected.created_at,
            }
            for perfume_collected in profile.collection.select_related("perfume").all()
        ],

    }


def _get_profile_by_uid(uid):
    try:
        return Profile.objects.get(supabase_uid=uid), None
    except Profile.DoesNotExist:
        return None, JsonResponse({"error": "User not found."}, status=404)


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


def _get_profile_optional(request):
    """Returns the Profile if a valid Bearer token is present, else None."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        from user.supabase_client import get_supabase_admin
        import uuid
        admin = get_supabase_admin()
        user_resp = admin.auth.get_user(token)
        user_dict = user_resp.user.dict() if hasattr(user_resp.user, "dict") else {}
        uid = uuid.UUID(user_dict.get("id"))
        return Profile.objects.get(supabase_uid=uid)
    except Exception:
        return None


def _recalculate_fragrance_stats(perfume):
    """
    Recompute all denormalised community-stat columns on a Perfume instance
    from the current set of reviews, then save. Safe to call anytime.
    """
    from django.db.models import Avg
    from reviews.models import Review

    reviews = perfume.reviews.all()
    count = reviews.count()

    perfume.rating_count = count
    if count == 0:
        perfume.rating_value    = None
        perfume.maceration_average = None
    else:
        perfume.rating_value       = reviews.aggregate(avg=Avg("rating"))["avg"]
        perfume.maceration_average = reviews.exclude(maceration=None).aggregate(avg=Avg("maceration"))["avg"]

    # Season / occasion
    perfume.summer_count = reviews.filter(summer=True).count()
    perfume.winter_count = reviews.filter(winter=True).count()
    perfume.spring_count = reviews.filter(spring=True).count()
    perfume.autumn_count = reviews.filter(autumn=True).count()
    perfume.day_count    = reviews.filter(day=True).count()
    perfume.night_count  = reviews.filter(night=True).count()

    # Sillage
    perfume.no_sillage_count       = reviews.filter(sillage=Review.Sillage.NO_SILLAGE).count()
    perfume.light_sillage_count    = reviews.filter(sillage=Review.Sillage.LIGHT_SILLAGE).count()
    perfume.moderate_sillage_count = reviews.filter(sillage=Review.Sillage.MODERATE_SILLAGE).count()
    perfume.strong_sillage_count   = reviews.filter(sillage=Review.Sillage.STRONG_SILLAGE).count()

    # Longevity
    perfume.h0_2_longevity_count     = reviews.filter(longevity=Review.Longevity.H0_2).count()
    perfume.h2_4_longevity_count     = reviews.filter(longevity=Review.Longevity.H2_4).count()
    perfume.h4_6_longevity_count     = reviews.filter(longevity=Review.Longevity.H4_6).count()
    perfume.h6_8_longevity_count     = reviews.filter(longevity=Review.Longevity.H6_8).count()
    perfume.h8_10_longevity_count    = reviews.filter(longevity=Review.Longevity.H8_10).count()
    perfume.h10_plus_longevity_count = reviews.filter(longevity=Review.Longevity.H10_PLUS).count()

    # Value
    perfume.super_overpriced_value_count = reviews.filter(value=Review.Value.SUPER_OVERPRICED).count()
    perfume.overpriced_value_count       = reviews.filter(value=Review.Value.OVERPRICED).count()
    perfume.alright_value_count          = reviews.filter(value=Review.Value.ALRIGHT).count()
    perfume.good_value_count             = reviews.filter(value=Review.Value.GOOD_VALUE).count()
    perfume.super_value_count            = reviews.filter(value=Review.Value.SUPER_VALUE).count()

    # Gender impression
    perfume.gender_female_count          = reviews.filter(gender=Review.Gender.FEMALE).count()
    perfume.gender_slightly_female_count = reviews.filter(gender=Review.Gender.SLIGHTLY_FEMALE).count()
    perfume.gender_unisex_count          = reviews.filter(gender=Review.Gender.UNISEX).count()
    perfume.gender_slightly_male_count   = reviews.filter(gender=Review.Gender.SLIGHTLY_MALE).count()
    perfume.gender_male_count            = reviews.filter(gender=Review.Gender.MALE).count()

    perfume.save()


def _summarized_profiles_from_queryset(qs):
    profiles = [{"uid": f_profile.supabase_uid, "profile_picture": f_profile.profile_picture, "username": f_profile.username} for f_profile in qs]
    return profiles