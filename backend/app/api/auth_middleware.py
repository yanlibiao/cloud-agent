"""Auth dependency — JWT token validation."""
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> int:
    """Extract and validate JWT from Authorization header. Returns user_id."""
    if credentials is None:
        logger.warning("Auth failed: no Authorization header")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    logger.info(f"Auth header received, token length={len(token)}, starts_with={token[:20]}...")
    try:
        from jose import JWTError, jwt

        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: int = int(payload.get("sub"))
        if user_id is None:
            logger.warning("Auth failed: no sub in token payload")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        logger.info(f"Auth success: user_id={user_id}")
        return user_id
    except JWTError as e:
        logger.warning(f"Auth failed: JWT decode error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
