from django.http import JsonResponse


def ping(request):
    """Simple health/liveness endpoint."""
    return JsonResponse({"status": "ok", "message": "pong"})
