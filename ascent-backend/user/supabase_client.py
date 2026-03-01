"""
Supabase admin client for server-side auth (create user, etc.).
Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
"""
import os

_supabase_admin = None


def get_supabase_admin():
    """Lazy-init and return the Supabase admin client (service_role)."""
    
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for register."
        )
    from supabase import create_client
    from supabase.lib.client_options import ClientOptions

    _supabase_admin = create_client(
            url,
            key,
            options=ClientOptions(
                auto_refresh_token=False,
                persist_session=False,
            ),
        )
    return _supabase_admin
