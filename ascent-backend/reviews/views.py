"""
API views for the reviews app.
"""
import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt

from user.models import Profile
from perfumes.models import Perfume

from .models import Review
from helpers import _parse_json_body, _parse_json_body_optional, _get_profile_by_uid, _get_uid_from_bearer, _profile_to_dict, _fragrance_to_dict

def _review_to_dict(instance):
    """
    Serialize a Review instance to a dictionary for JSON responses.
    """
    return {
        "id": instance.id,
        "uid": str(instance.profile.supabase_uid),
        "fid": instance.perfume.id,
        "description": instance.description,
        "rating": float(instance.rating),
        "gender": instance.gender,
        "winter": instance.winter,
        "spring": instance.spring,
        "summer": instance.summer,
        "autumn": instance.autumn,
        "day": instance.day,
        "night": instance.night,
        "longevity": instance.longevity,
        "value": instance.value,
        "maceration": instance.maceration,
        "created_at": instance.created_at.isoformat(),
        "updated_at": instance.updated_at.isoformat(),
    }

@require_GET
def reviews_for_fragrance(request):
    """
    List reviews for a given fragrance.

    Query params:
      - fid (int, required): ID of the perfume.
    """
    fid_raw = request.GET.get("fid")
    if fid_raw in (None, ""):
        return JsonResponse(
            {"error": "Missing required query parameter: fid"},
            status=400,
        )

    try:
        perfume_id = int(fid_raw)
    except (TypeError, ValueError):
        return JsonResponse(
            {"error": "Invalid fid; must be an integer"},
            status=400,
        )

    reviews = Review.objects.filter(perfume_id=perfume_id).select_related(
        "profile", "perfume"
    )
    data = [_review_to_dict(r) for r in reviews]

    return JsonResponse(
        {
            "count": len(data),
            "results": data,
        }
    )

@require_GET
def reviews_for_user(request):
    """
    List reviews for a given user.

    Query params:
      - uid (str, required): Supabase user UUID (Profile.supabase_uid)
    """
    
    uid_raw, err = _get_uid_from_bearer(request)
    if err:
        return err
    

    profile, err = _get_profile_by_uid(uid_raw)
    if err:
        return err

    reviews = (
        Review.objects
        .filter(profile=profile)
        .select_related("profile", "perfume")
    )

    data = [_review_to_dict(r) for r in reviews]
    return JsonResponse({"count": len(data), "results": data})

@csrf_exempt
@require_POST
def review_create(request):
    """
    Create a new review for a fragrance.

    Expects JSON body with:
      - uid (str, required): Supabase user UUID of the reviewer.
      - fid (int, required): ID of the perfume being reviewed.
      - description (str, required): Up to 500 characters.
      - rating (float/decimal, required): 0.0–10.0 with one decimal place.
      - gender (str, required): One of:
          "Female", "Slightly Female", "Unisex", "Slightly Male", "Male"
      - winter, spring, summer, autumn, day, night (bool, optional): Defaults False.
      - longevity (str, required): One of:
          "0 - 2 hours", "2 - 4 hours", "4 - 6 hours",
          "6 - 8 hours", "8-10 hours", "10+ hours"
      - value (str, required): One of:
          "Super Overpriced", "Overpriced", "Alright",
          "Good Value", "Super Value"
      - maceration (int, optional): Non-negative number of days.
    """
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    required = ("fid", "description", "rating", "gender", "longevity", "value")
    for key in required:
        if body.get(key) in (None, ""):
            return JsonResponse(
                {"error": f"Missing required field: {key}"},
                status=400,
            )

    fid_raw = body.get("fid")

    uid_raw, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid_raw)
    if err:
        return err

    try:
        perfume = Perfume.objects.get(id=fid_raw)
    except (Perfume.DoesNotExist, ValueError, TypeError):
        return JsonResponse(
            {"error": "Perfume not found for given fid"},
            status=404,
        )

    description = str(body.get("description", "")).strip()
    if not description:
        return JsonResponse(
            {"error": "Description cannot be empty"},
            status=400,
        )
    if len(description) > 500:
        return JsonResponse(
            {"error": "Description exceeds 500 characters"},
            status=400,
        )

    # Rating: 0.0–10.0, one decimal place
    try:
        rating_val = Decimal(str(body.get("rating")))
    except (InvalidOperation, TypeError, ValueError):
        return JsonResponse(
            {"error": "Invalid rating value"},
            status=400,
        )
    if rating_val < Decimal("0.0") or rating_val > Decimal("10.0"):
        return JsonResponse(
            {"error": "Rating must be between 0.0 and 10.0"},
            status=400,
        )
    rating_val = rating_val.quantize(Decimal("0.1"))

    gender = str(body.get("gender", "")).strip()
    if gender not in Review.Gender.values:
        return JsonResponse(
            {
                "error": "Invalid gender value",
                "allowed": list(Review.Gender.values),
            },
            status=400,
        )

    longevity = str(body.get("longevity", "")).strip()
    if longevity not in Review.Longevity.values:
        return JsonResponse(
            {
                "error": "Invalid longevity value",
                "allowed": list(Review.Longevity.values),
            },
            status=400,
        )

    value = str(body.get("value", "")).strip()
    if value not in Review.Value.values:
        return JsonResponse(
            {
                "error": "Invalid value rating",
                "allowed": list(Review.Value.values),
            },
            status=400,
        )

    def as_bool(key):
        val = body.get(key)
        if isinstance(val, bool):
            return val
        return False

    maceration = body.get("maceration")
    if maceration is not None:
        try:
            maceration = int(maceration)
            if maceration < 0:
                raise ValueError
        except (TypeError, ValueError):
            return JsonResponse(
                {"error": "Maceration must be a non-negative integer if provided"},
                status=400,
            )

    review = Review.objects.create(
        profile=profile,
        perfume=perfume,
        description=description,
        rating=rating_val,
        gender=gender,
        winter=as_bool("winter"),
        spring=as_bool("spring"),
        summer=as_bool("summer"),
        autumn=as_bool("autumn"),
        day=as_bool("day"),
        night=as_bool("night"),
        longevity=longevity,
        value=value,
        maceration=maceration,
    )

    return JsonResponse(_review_to_dict(review), status=201)
