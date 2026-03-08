"""
User API: login, register, refresh, and me (get/update/delete).
Auth: login/register return JWT; me and refresh use Bearer token or refresh_token.
"""
import json
import uuid

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Profile
from .supabase_client import get_supabase_admin
from helpers import _parse_json_body, _parse_json_body_optional, _get_profile_by_uid, _get_uid_from_bearer, _profile_to_dict, _fragrance_to_dict, _summarized_profiles_from_queryset
from perfumes.views import get_day_scent_for_user



# ----- Login -----
@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    data, err = _parse_json_body(request)
    if err:
        return err

    email = (data.get("email") or "").strip()
    password = data.get("password")
    if not email or not password:
        return JsonResponse({"error": "Email and password are required"}, status=400)

    try:
        admin = get_supabase_admin()
        resp = admin.auth.sign_in_with_password({"email": email, "password": password})
    except Exception as e:
        msg = str(e).lower()
        if any(x in msg for x in ["invalid", "credentials", "wrong", "password"]):
            return JsonResponse({"error": "Invalid email or password."}, status=401)
        return JsonResponse({"error": "Login failed."}, status=401)

    # Extract user UID safely
    user = getattr(resp, "user", None) or (resp if isinstance(resp, dict) else {}).get("user")
    if not user:
        return JsonResponse({"error": "Login failed."}, status=401)
    try:
        if hasattr(user, "dict"):
            uid_value = user.dict().get("id")
        elif isinstance(user, dict):
            uid_value = user.get("id")
        else:
            return JsonResponse({"error": "Login failed."}, status=401)
        uid = uuid.UUID(uid_value)
    except Exception:
        return JsonResponse({"error": "Login failed."}, status=401)

    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    # Extract session safely
    session = getattr(resp, "session", None) or (resp if isinstance(resp, dict) else {}).get("session")
    payload = {"profile": _profile_to_dict(profile)}
    if session:
        if hasattr(session, "dict"):
            session_dict = session.dict()
        elif isinstance(session, dict):
            session_dict = session
        else:
            session_dict = {}
        payload.update({k: v for k, v in session_dict.items() if k in ["access_token", "refresh_token", "expires_at"] and v is not None})

    return JsonResponse(payload)


# ----- Register -----
@csrf_exempt
@require_http_methods(["POST"])
def create(request):
    data, err = _parse_json_body(request)
    if err:
        return err

    email = (data.get("email") or "").strip()
    password = data.get("password")
    username = (data.get("username") or "").strip()
    if not email or not password or not username:
        return JsonResponse({"error": "Email, password, and username are required"}, status=400)

    try:
        if Profile.objects.filter(username=username).exists():
            return JsonResponse({"error": "Username already exists."}, status=400)
        admin = get_supabase_admin()
        print(email)
        print(password)
        print(username)
        resp = admin.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"username": username},
        })
        
    except Exception as e:
        msg = str(e).lower()
        if any(x in msg for x in ["already", "exists", "registered"]):
            return JsonResponse({"error": "A user with this email already exists."}, status=400)
        print(e)
        return JsonResponse({"error": "Could not create auth user."}, status=400)

    user = getattr(resp, "user", None) or (resp if isinstance(resp, dict) else {}).get("user")
    if not user:
        return JsonResponse({"error": "Auth user created but no user id returned."}, status=500)
    try:
        if hasattr(user, "dict"):
            uid_value = user.dict().get("id")
        elif isinstance(user, dict):
            uid_value = user.get("id")
        else:
            return JsonResponse({"error": "Invalid user object."}, status=500)
        uid = uuid.UUID(uid_value)
    except Exception:
        return JsonResponse({"error": "Invalid user id from auth."}, status=500)

    if Profile.objects.filter(supabase_uid=uid).exists():
        return JsonResponse({"error": "Profile already exists for this user."}, status=400)

    profile = Profile.objects.create(
        supabase_uid=uid,
        username=username,
        bio=(data.get("bio") or "").strip() or "",
        profile_picture=(data.get("profile_picture") or "").strip() or "",
    )
    return JsonResponse({"profile": _profile_to_dict(profile)}, status=201)


# ----- Refresh -----
@csrf_exempt
@require_http_methods(["POST"])
def refresh(request):
    data, err = _parse_json_body(request)
    if err:
        return err
    refresh_token = (data.get("refresh_token") or "").strip()
    if not refresh_token:
        return JsonResponse({"error": "refresh_token is required"}, status=400)

    try:
        admin = get_supabase_admin()
        resp = admin.auth.refresh_session(refresh_token)
        session = getattr(resp, "session", None) or (resp if isinstance(resp, dict) else {}).get("session")
        if not session:
            return JsonResponse({"error": "No session returned."}, status=500)
        if hasattr(session, "dict"):
            session_dict = session.dict()
        elif isinstance(session, dict):
            session_dict = session
        else:
            session_dict = {}
        payload = {k: v for k, v in session_dict.items() if k in ["access_token", "refresh_token", "expires_at"] and v is not None}
        return JsonResponse(payload)
    except Exception:
        return JsonResponse({"error": "Invalid or already used refresh token."}, status=401)


# ----- Me -----
@csrf_exempt
@require_http_methods(["GET", "POST", "PATCH", "PUT", "DELETE"])
def me(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err
    profile, err = _get_profile_by_uid(uid)
    if err:
        return err

    if request.method in ("GET", "POST"):
        return JsonResponse({"profile": _profile_to_dict(profile)})

    if request.method in ("PATCH", "PUT"):
        data, err = _parse_json_body_optional(request)
        if err:
            return err
        if "username" in data:
            username = (data.get("username") or "").strip()
            if not username:
                return JsonResponse({"error": "username cannot be blank"}, status=400)
            profile.username = username
        if "bio" in data:
            profile.bio = (data.get("bio") or "").strip()
        if "profile_picture" in data:
            profile.profile_picture = (data.get("profile_picture") or "").strip()
        profile.save()
        return JsonResponse({"profile": _profile_to_dict(profile)})
    return JsonResponse({"error": "Invalid method."}, status=405)

@csrf_exempt
@require_http_methods(["POST"])
def toggle_follow(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err
    profile, err = _get_profile_by_uid(uid)
    if err:
        return err
    foreign_profile_id = request.GET.get("uid")
    if uid == foreign_profile_id:
        return JsonResponse({"error": "Cannot follow yourself"}, status=400)
    foreign_profile, err = _get_profile_by_uid(foreign_profile_id)
    if err:
        return err
    if not foreign_profile:
        return JsonResponse({"error": "Profile not found"}, status=404)
    if profile.following.filter(pk=foreign_profile.id).exists():
        profile.following.remove(foreign_profile)
    else:
        profile.following.add(foreign_profile)
    profile.save()
    following = _summarized_profiles_from_queryset(profile.following.all())
    return JsonResponse({"following": following}, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def get_following(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err
    profile, err = _get_profile_by_uid(uid)
    if err:
        return err
    following = _summarized_profiles_from_queryset(profile.following.all())
    return JsonResponse({"following": following}, status=200)
 
@csrf_exempt
@require_http_methods(["GET"])
def get_followers(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err
    profile, err = _get_profile_by_uid(uid)
    if err:
        return err
    followers = _summarized_profiles_from_queryset(profile.followers.all())
    return JsonResponse({"followers": followers}, status=200)
     

@csrf_exempt
@require_http_methods(["GET"])
def get_followers_scents(request):
    uid, err = _get_uid_from_bearer(request)
    if err:
        return err
    profile, err = _get_profile_by_uid(uid)
    if err:
        return err
    following = _summarized_profiles_from_queryset(profile.following.all())
    timestamp = request.GET.get("timestamp")
    for follower in following:
        scent = get_day_scent_for_user(user_id=follower.uid, timestamp=timestamp)
        follower["daily_scent"] = scent
    return JsonResponse({"following": following}, status=200)

