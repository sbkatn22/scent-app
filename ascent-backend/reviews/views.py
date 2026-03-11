"""
API views for the reviews app.
"""
import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.views.decorators.csrf import csrf_exempt

from django.db.models import Avg

from user.models import Profile
from perfumes.models import Perfume

from .models import Review, Comment
from events.models import Event
from helpers import _parse_json_body, _parse_json_body_optional, _get_profile_by_uid, _get_uid_from_bearer, _profile_to_dict, _fragrance_to_dict, _get_profile_optional

def _recalculate_perfume_stats(perfume):
    """Recompute all denormalised stat columns on a Perfume from its reviews."""
    reviews = Review.objects.filter(perfume=perfume)
    count = reviews.count()

    perfume.rating_count = count
    if count == 0:
        perfume.rating_value = None
        perfume.maceration_average = None
    else:
        perfume.rating_value = reviews.aggregate(avg=Avg("rating"))["avg"]
        mac = reviews.exclude(maceration=None).aggregate(avg=Avg("maceration"))["avg"]
        perfume.maceration_average = mac

    # Season / occasion
    perfume.summer_count = reviews.filter(summer=True).count()
    perfume.winter_count = reviews.filter(winter=True).count()
    perfume.day_count    = reviews.filter(day=True).count()
    perfume.night_count  = reviews.filter(night=True).count()

    # Sillage
    perfume.no_sillage_count       = reviews.filter(sillage="No Sillage").count()
    perfume.light_sillage_count    = reviews.filter(sillage="Light Sillage").count()
    perfume.moderate_sillage_count = reviews.filter(sillage="Moderate Sillage").count()
    perfume.strong_sillage_count   = reviews.filter(sillage="Strong Sillage").count()

    # Longevity
    perfume.h0_2_longevity_count     = reviews.filter(longevity="0 - 2 hours").count()
    perfume.h2_4_longevity_count     = reviews.filter(longevity="2 - 4 hours").count()
    perfume.h4_6_longevity_count     = reviews.filter(longevity="4 - 6 hours").count()
    perfume.h6_8_longevity_count     = reviews.filter(longevity="6 - 8 hours").count()
    perfume.h8_10_longevity_count    = reviews.filter(longevity="8-10 hours").count()
    perfume.h10_plus_longevity_count = reviews.filter(longevity="10+ hours").count()

    # Value
    perfume.super_overpriced_value_count = reviews.filter(value="Super Overpriced").count()
    perfume.overpriced_value_count       = reviews.filter(value="Overpriced").count()
    perfume.alright_value_count          = reviews.filter(value="Alright").count()
    perfume.good_value_count             = reviews.filter(value="Good Value").count()
    perfume.super_value_count            = reviews.filter(value="Super Value").count()

    # Gender impression
    perfume.gender_female_count          = reviews.filter(gender="Female").count()
    perfume.gender_slightly_female_count = reviews.filter(gender="Slightly Female").count()
    perfume.gender_unisex_count          = reviews.filter(gender="Unisex").count()
    perfume.gender_slightly_male_count   = reviews.filter(gender="Slightly Male").count()
    perfume.gender_male_count            = reviews.filter(gender="Male").count()

    perfume.save()


def _review_to_dict(instance, profile=None, liked_review_ids=None):
    """
    Serialize a Review instance to a dictionary for JSON responses.
    Pass profile (or liked_review_ids set) to populate the `liked` field.
    """
    if liked_review_ids is not None:
        liked = instance.id in liked_review_ids
    elif profile is not None:
        liked = instance.likes.filter(id=profile.id).exists()
    else:
        liked = False

    return {
        "id": instance.id,
        "uid": str(instance.profile.supabase_uid),
        "username": instance.profile.username,
        "profile_picture": instance.profile.profile_picture or "",
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
        "like_count": instance.likes.count(),
        "liked": liked,
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

    profile = _get_profile_optional(request)
    reviews = Review.objects.filter(perfume_id=perfume_id).select_related("profile", "perfume")

    liked_review_ids = set(
        profile.liked_reviews.values_list("id", flat=True)
    ) if profile else None

    data = [_review_to_dict(r, liked_review_ids=liked_review_ids) for r in reviews]

    return JsonResponse({"count": len(data), "results": data})

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

    reviews = Review.objects.filter(profile=profile).select_related("profile", "perfume")
    liked_review_ids = set(profile.liked_reviews.values_list("id", flat=True))
    data = [_review_to_dict(r, liked_review_ids=liked_review_ids) for r in reviews]
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

    if Review.objects.filter(profile=profile, perfume=perfume).exists():
        return JsonResponse(
            {"error": "You have already reviewed this fragrance"},
            status=409,
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

    Event.objects.create(user_id=uid_raw, action=Event.Action.REVIEW_CREATE, value=str(perfume.id))
    return JsonResponse(_review_to_dict(review, profile=profile), status=201)


@csrf_exempt
@require_http_methods(["PATCH"])
def review_update(request, review_id):
    """
    Partially update a review. Only the review's author may edit it.
    All fields are optional — only supplied fields are updated.

    URL param:
      - review_id (int): ID of the review to update.

    Accepts any subset of:
      description, rating, gender, longevity, value,
      winter, spring, summer, autumn, day, night, maceration

    Requires Authorization: Bearer <access_token>.
    Returns the updated review on success (200).
    """
    uid_raw, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid_raw)
    if err:
        return err

    try:
        review = Review.objects.select_related("profile", "perfume").get(id=review_id)
    except Review.DoesNotExist:
        return JsonResponse({"error": "Review not found"}, status=404)

    if review.profile.supabase_uid != profile.supabase_uid:
        return JsonResponse({"error": "You can only edit your own reviews"}, status=403)

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    if "description" in body:
        description = str(body["description"]).strip()
        if not description:
            return JsonResponse({"error": "Description cannot be empty"}, status=400)
        if len(description) > 500:
            return JsonResponse({"error": "Description exceeds 500 characters"}, status=400)
        review.description = description

    if "rating" in body:
        try:
            from decimal import Decimal, InvalidOperation
            rating_val = Decimal(str(body["rating"]))
        except (InvalidOperation, TypeError, ValueError):
            return JsonResponse({"error": "Invalid rating value"}, status=400)
        if rating_val < Decimal("0.0") or rating_val > Decimal("10.0"):
            return JsonResponse({"error": "Rating must be between 0.0 and 10.0"}, status=400)
        review.rating = rating_val.quantize(Decimal("0.1"))

    if "gender" in body:
        gender = str(body["gender"]).strip()
        if gender not in Review.Gender.values:
            return JsonResponse({"error": "Invalid gender value", "allowed": list(Review.Gender.values)}, status=400)
        review.gender = gender

    if "longevity" in body:
        longevity = str(body["longevity"]).strip()
        if longevity not in Review.Longevity.values:
            return JsonResponse({"error": "Invalid longevity value", "allowed": list(Review.Longevity.values)}, status=400)
        review.longevity = longevity

    if "value" in body:
        value = str(body["value"]).strip()
        if value not in Review.Value.values:
            return JsonResponse({"error": "Invalid value rating", "allowed": list(Review.Value.values)}, status=400)
        review.value = value

    for flag in ("winter", "spring", "summer", "autumn", "day", "night"):
        if flag in body:
            val = body[flag]
            review.__setattr__(flag, bool(val) if isinstance(val, bool) else False)

    if "maceration" in body:
        maceration = body["maceration"]
        if maceration is not None:
            try:
                maceration = int(maceration)
                if maceration < 0:
                    raise ValueError
            except (TypeError, ValueError):
                return JsonResponse({"error": "Maceration must be a non-negative integer if provided"}, status=400)
        review.maceration = maceration

    review.save()
    Event.objects.create(user_id=uid_raw, action=Event.Action.REVIEW_UPDATE, value=str(review.perfume.id))
    return JsonResponse(_review_to_dict(review, profile=profile), status=200)


@csrf_exempt
@require_http_methods(["DELETE"])
def review_delete(request, review_id):
    """
    Delete a review by ID. Only the review's author may delete it.

    URL param:
      - review_id (int): ID of the review to delete.

    Requires Authorization: Bearer <access_token>.
    Returns 204 on success.
    """
    uid_raw, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid_raw)
    if err:
        return err

    try:
        review = Review.objects.select_related("profile", "perfume").get(id=review_id)
    except Review.DoesNotExist:
        return JsonResponse({"error": "Review not found"}, status=404)

    if review.profile.supabase_uid != profile.supabase_uid:
        return JsonResponse({"error": "You can only delete your own reviews"}, status=403)

    perfume_id = review.perfume.id
    review.delete()
    Event.objects.create(user_id=uid_raw, action=Event.Action.REVIEW_DELETE, value=str(perfume_id))
    return JsonResponse({}, status=204)


# -------------------------
# Comment helpers
# -------------------------
def _comment_to_dict(comment, liked_comment_ids=None):
    if liked_comment_ids is not None:
        liked = comment.id in liked_comment_ids
    else:
        liked = False

    return {
        "id": comment.id,
        "review_id": comment.review_id,
        "parent_id": comment.parent_id,
        "content": comment.content,
        "author": {
            "uid": str(comment.profile.supabase_uid),
            "username": comment.profile.username,
            "profile_picture": comment.profile.profile_picture or "",
        },
        "like_count": comment.likes.count(),
        "liked": liked,
        "created_at": comment.created_at.isoformat(),
        "updated_at": comment.updated_at.isoformat(),
        "replies": [],
    }


def _build_comment_tree(comments, liked_comment_ids=None):
    """Build a nested comment tree from a flat list of Comment instances."""
    lookup = {}
    for c in comments:
        lookup[c.id] = _comment_to_dict(c, liked_comment_ids=liked_comment_ids)
    roots = []
    for c in comments:
        if c.parent_id is None:
            roots.append(lookup[c.id])
        else:
            parent = lookup.get(c.parent_id)
            if parent is not None:
                parent["replies"].append(lookup[c.id])
    return roots


# -------------------------
# Comment endpoints
# -------------------------
@require_GET
def comments_for_review(request):
    review_id = request.GET.get("review_id")
    if not review_id:
        return JsonResponse({"error": "review_id is required"}, status=400)

    try:
        review_id = int(review_id)
    except (TypeError, ValueError):
        return JsonResponse({"error": "review_id must be an integer"}, status=400)

    if not Review.objects.filter(id=review_id).exists():
        return JsonResponse({"error": "Review not found"}, status=404)

    profile = _get_profile_optional(request)
    comments = Comment.objects.filter(review_id=review_id).select_related("profile")

    liked_comment_ids = set(
        profile.liked_comments.values_list("id", flat=True)
    ) if profile else None

    tree = _build_comment_tree(comments, liked_comment_ids=liked_comment_ids)
    return JsonResponse({"comments": tree}, status=200)


@csrf_exempt
@require_POST
def comment_create(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    review_id = body.get("review_id")
    content = str(body.get("content", "")).strip()
    parent_id = body.get("parent_id")

    if not review_id:
        return JsonResponse({"error": "review_id is required"}, status=400)
    if not content:
        return JsonResponse({"error": "content is required"}, status=400)
    if len(content) > 1000:
        return JsonResponse({"error": "content exceeds 1000 characters"}, status=400)

    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return JsonResponse({"error": "Review not found"}, status=404)

    parent = None
    if parent_id is not None:
        try:
            parent = Comment.objects.get(id=parent_id, review=review)
        except Comment.DoesNotExist:
            return JsonResponse({"error": "Parent comment not found"}, status=404)

    comment = Comment.objects.create(
        review=review,
        profile=profile,
        parent=parent,
        content=content,
    )
    return JsonResponse(_comment_to_dict(comment), status=201)


@csrf_exempt
@require_http_methods(["PATCH"])
def comment_update(request, comment_id):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    try:
        comment = Comment.objects.select_related("profile").get(id=comment_id)
    except Comment.DoesNotExist:
        return JsonResponse({"error": "Comment not found"}, status=404)

    if comment.profile.supabase_uid != profile.supabase_uid:
        return JsonResponse({"error": "You can only edit your own comments"}, status=403)

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    content = str(body.get("content", "")).strip()
    if not content:
        return JsonResponse({"error": "content is required"}, status=400)
    if len(content) > 1000:
        return JsonResponse({"error": "content exceeds 1000 characters"}, status=400)

    comment.content = content
    comment.save()
    return JsonResponse(_comment_to_dict(comment), status=200)


@csrf_exempt
@require_http_methods(["DELETE"])
def comment_delete(request, comment_id):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    try:
        comment = Comment.objects.select_related("profile").get(id=comment_id)
    except Comment.DoesNotExist:
        return JsonResponse({"error": "Comment not found"}, status=404)

    if comment.profile.supabase_uid != profile.supabase_uid:
        return JsonResponse({"error": "You can only delete your own comments"}, status=403)

    comment.delete()
    return JsonResponse({}, status=204)


# -------------------------
# Like endpoints
# -------------------------
@csrf_exempt
@require_POST
def toggle_review_like(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    review_id = body.get("review_id")
    if not review_id:
        return JsonResponse({"error": "review_id is required"}, status=400)

    try:
        review = Review.objects.select_related("profile", "perfume").get(id=review_id)
    except Review.DoesNotExist:
        return JsonResponse({"error": "Review not found"}, status=404)

    if review.likes.filter(id=profile.id).exists():
        review.likes.remove(profile)
        Event.objects.create(user_id=uid, action=Event.Action.UNLIKE_REVIEW, value=str(review_id))
        return JsonResponse({"message": "Review unliked", "review_id": review_id, "like_count": review.likes.count(), "liked": False}, status=200)

    review.likes.add(profile)
    Event.objects.create(user_id=uid, action=Event.Action.LIKE_REVIEW, value=str(review_id))
    return JsonResponse({"message": "Review liked", "review_id": review_id, "like_count": review.likes.count(), "liked": True}, status=200)


@csrf_exempt
@require_POST
def toggle_comment_like(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err

    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    comment_id = body.get("comment_id")
    if not comment_id:
        return JsonResponse({"error": "comment_id is required"}, status=400)

    try:
        comment = Comment.objects.select_related("profile").get(id=comment_id)
    except Comment.DoesNotExist:
        return JsonResponse({"error": "Comment not found"}, status=404)

    if comment.likes.filter(id=profile.id).exists():
        comment.likes.remove(profile)
        Event.objects.create(user_id=uid, action=Event.Action.UNLIKE_COMMENT, value=str(comment_id))
        return JsonResponse({"message": "Comment unliked", "comment_id": comment_id, "like_count": comment.likes.count(), "liked": False}, status=200)

    comment.likes.add(profile)
    Event.objects.create(user_id=uid, action=Event.Action.LIKE_COMMENT, value=str(comment_id))
    return JsonResponse({"message": "Comment liked", "comment_id": comment_id, "like_count": comment.likes.count(), "liked": True}, status=200)
