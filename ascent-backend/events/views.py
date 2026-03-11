from django.http import JsonResponse
from django.views.decorators.http import require_GET

from helpers import _get_uid_from_bearer
from .models import Event
from user.models import Profile
from perfumes.models import Perfume
from reviews.models import Review, Comment

# Actions whose `value` is a Perfume ID
_FRAGRANCE_ACTIONS = {
    "COLLECTION_ADD", "COLLECTION_REMOVE",
    "DAILY_SCENT_SET", "DAILY_SCENT_REMOVE",
    "LIKE_FRAGRANCE", "UNLIKE_FRAGRANCE",
    "WISHLIST_ADD", "WISHLIST_REMOVE",
    "REVIEW_CREATE", "REVIEW_UPDATE", "REVIEW_DELETE",
}
# Actions whose `value` is a target user's supabase_uid
_FOLLOW_ACTIONS = {"FOLLOW", "UNFOLLOW"}
# Actions whose `value` is a Review ID
_REVIEW_ACTIONS = {"LIKE_REVIEW", "UNLIKE_REVIEW"}
# Actions whose `value` is a Comment ID
_COMMENT_ACTIONS = {"LIKE_COMMENT", "UNLIKE_COMMENT"}


def _build_enriched_events(events_list):
    """
    Given a list of Event instances, batch-resolve:
      - username  (from user_id → Profile)
      - target_label  (human-readable name for the `value` field)
    Returns a list of dicts ready for JSON serialisation.
    """
    # 1. Batch-resolve actor usernames
    user_ids = {str(e.user_id) for e in events_list}
    uid_to_username = {
        str(p.supabase_uid): p.username
        for p in Profile.objects.filter(supabase_uid__in=user_ids).only("supabase_uid", "username")
    }

    # 2. Bucket values by type
    fragrance_ids, follow_uids, review_ids, comment_ids = set(), set(), set(), set()
    for e in events_list:
        if not e.value:
            continue
        action = e.action
        try:
            if action in _FRAGRANCE_ACTIONS:
                fragrance_ids.add(int(e.value))
            elif action in _FOLLOW_ACTIONS:
                follow_uids.add(e.value)
            elif action in _REVIEW_ACTIONS:
                review_ids.add(int(e.value))
            elif action in _COMMENT_ACTIONS:
                comment_ids.add(int(e.value))
        except (ValueError, TypeError):
            pass

    # 3. Batch-fetch each bucket
    fid_to_label = {
        p.id: f"{p.brand.replace('-', ' ')} {p.perfume.replace('-', ' ')}".strip()
        for p in Perfume.objects.filter(id__in=fragrance_ids).only("id", "perfume", "brand")
    }
    target_uid_to_username = {
        str(p.supabase_uid): p.username
        for p in Profile.objects.filter(supabase_uid__in=follow_uids).only("supabase_uid", "username")
    }
    review_id_to_label = {
        r.id: f"{r.perfume.brand.replace('-', ' ')} {r.perfume.perfume.replace('-', ' ')}".strip()
        for r in Review.objects.select_related("perfume").filter(id__in=review_ids)
    }
    comment_id_to_label = {
        c.id: f"{c.review.perfume.brand.replace('-', ' ')} {c.review.perfume.perfume.replace('-', ' ')}".strip()
        for c in Comment.objects.select_related("review__perfume").filter(id__in=comment_ids)
    }

    def _target_label(event):
        if not event.value:
            return None
        action = event.action
        try:
            if action in _FRAGRANCE_ACTIONS:
                return fid_to_label.get(int(event.value))
            if action in _FOLLOW_ACTIONS:
                return target_uid_to_username.get(event.value)
            if action in _REVIEW_ACTIONS:
                return review_id_to_label.get(int(event.value))
            if action in _COMMENT_ACTIONS:
                return comment_id_to_label.get(int(event.value))
        except (ValueError, TypeError):
            pass
        return None

    return [
        {
            "id": e.id,
            "user_id": str(e.user_id),
            "username": uid_to_username.get(str(e.user_id)),
            "action": e.action,
            "value": e.value,
            "target_label": _target_label(e),
            "timestamp": e.timestamp.isoformat(),
        }
        for e in events_list
    ]


@require_GET
def get_events(request):
    """
    Fetch events. Requires Bearer auth.

    Optional query params (can be combined):
      - id     (int)  : return a single event by primary key
      - uid    (str)  : filter by initiating user's Supabase UUID
      - action (str)  : filter by action enum value
    """
    _, err = _get_uid_from_bearer(request)
    if err:
        return err

    event_id = request.GET.get("id")
    if event_id:
        try:
            event = Event.objects.get(id=int(event_id))
        except (Event.DoesNotExist, ValueError, TypeError):
            return JsonResponse({"error": "Event not found"}, status=404)
        enriched = _build_enriched_events([event])
        return JsonResponse({"event": enriched[0]}, status=200)

    qs = Event.objects.all()

    uid = (request.GET.get("uid") or "").strip()
    if uid:
        qs = qs.filter(user_id=uid)

    action = (request.GET.get("action") or "").strip()
    if action:
        if action not in Event.Action.values:
            return JsonResponse(
                {"error": "Invalid action", "allowed": list(Event.Action.values)},
                status=400,
            )
        qs = qs.filter(action=action)

    events_list = list(qs)
    enriched = _build_enriched_events(events_list)
    return JsonResponse({"count": len(enriched), "results": enriched}, status=200)
