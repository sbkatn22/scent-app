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
        "collection_ids": list(profile.collection.values_list("id", flat=True)),
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