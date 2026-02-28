"""
API views for the perfumes app.
"""
from django.core.paginator import Paginator, EmptyPage
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Perfume

# Default and maximum number of results per page for pagination
RESULTS_PER_PAGE = 10


def _perfume_to_dict(perfume):
    """
    Serialize a Perfume instance to a dictionary for JSON response.

    Args:
        perfume: A Perfume model instance.

    Returns:
        dict: A dictionary representation of the perfume with all relevant fields.
    """
    return {
        "id": perfume.id,
        "url": perfume.url,
        "perfume": perfume.perfume,
        "brand": perfume.brand,
        "country": perfume.country,
        "gender": perfume.gender,
        "rating_value": str(perfume.rating_value) if perfume.rating_value else None,
        "rating_count": perfume.rating_count,
        "year": perfume.year,
        "top": perfume.top,
        "middle": perfume.middle,
        "base": perfume.base,
        "perfumer1": perfume.perfumer1,
        "perfumer2": perfume.perfumer2,
        "mainaccord1": perfume.mainaccord1,
        "mainaccord2": perfume.mainaccord2,
        "mainaccord3": perfume.mainaccord3,
        "mainaccord4": perfume.mainaccord4,
        "mainaccord5": perfume.mainaccord5,
    }


@require_GET
def perfume_search(request):
    """
    Search perfumes by name with pagination.

    Query params:
        name (str): Search term to filter by perfume name (case-insensitive, partial match).
                   If omitted, returns all perfumes (paginated).
        page (int): Page number for pagination (default: 1). Each page returns up to 10 results.

    Example: GET /api/perfumes/search/?name=rose&page=1
    """
    # Extract and sanitize the search term from query params
    search_term = request.GET.get("name", "").strip()

    # Build the queryset: filter by name if provided, otherwise get all perfumes
    if search_term:
        perfumes_queryset = Perfume.objects.filter(perfume__icontains=search_term)
    else:
        perfumes_queryset = Perfume.objects.all()

    # Get total count before pagination (for response metadata)
    total_count = perfumes_queryset.count()

    # Paginate results: 10 items per page
    paginator = Paginator(perfumes_queryset, RESULTS_PER_PAGE)

    # Parse page number from query params; default to 1 if invalid or missing
    try:
        page_number = int(request.GET.get("page", 1))
        if page_number < 1:
            page_number = 1
    except (ValueError, TypeError):
        page_number = 1

    # Handle empty queryset: no pages to paginate
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
        # Get the requested page; use last valid page if page number is out of range
        try:
            page = paginator.page(page_number)
        except EmptyPage:
            page = paginator.page(paginator.num_pages)

        # Build pagination metadata and serialize results for this page
        pagination = {
            "page": page.number,
            "per_page": RESULTS_PER_PAGE,
            "total_count": total_count,
            "total_pages": paginator.num_pages,
            "has_next": page.has_next(),
            "has_previous": page.has_previous(),
        }
        results = [_perfume_to_dict(p) for p in page.object_list]

    return JsonResponse({
        "count": len(results),
        "pagination": pagination,
        "results": results,
    })
