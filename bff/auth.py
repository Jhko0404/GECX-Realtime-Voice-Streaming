import time
from typing import Dict, Any, Optional
from jose import jwt, JWTError
from bff.config import settings

ALGORITHM = "HS256"
TICKET_TTL_SECONDS = 60  # Ephemeral ticket valid for 60 seconds

def create_session_ticket(session_id: str, app_id: Optional[str] = None) -> str:
    """Issues an ephemeral signed JWT ticket for WebSocket connection authorization."""
    now = int(time.time())
    payload: Dict[str, Any] = {
        "sub": session_id,
        "iss": "gecx-streaming-bff",
        "aud": "gecx-web-client",
        "iat": now,
        "exp": now + TICKET_TTL_SECONDS,
        "app_id": app_id or settings.APP_ID,
        "project_id": settings.PROJECT_ID,
        "location": settings.LOCATION,
    }
    return jwt.encode(payload, settings.TICKET_SECRET_KEY, algorithm=ALGORITHM)

def verify_session_ticket(token: str) -> Optional[Dict[str, Any]]:
    """Verifies the ephemeral JWT ticket. Returns claims dictionary if valid, None otherwise."""
    try:
        payload = jwt.decode(
            token,
            settings.TICKET_SECRET_KEY,
            algorithms=[ALGORITHM],
            audience="gecx-web-client",
            issuer="gecx-streaming-bff",
        )
        return payload
    except JWTError:
        return None
