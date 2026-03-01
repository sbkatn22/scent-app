import json

from django.http import JsonResponse
from user.models import Profile
from user.supabase_client import get_supabase_admin
import uuid

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
        "summer_count": instance.summer_count,
        "winter_count": instance.winter_count,
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
        "collection": [{"id": perfume_collected.perfume.id, "size": perfume_collected.perfume_size, "added_on": perfume_collected.created_at} for perfume_collected in profile.collection.select_related("perfume").all()],

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