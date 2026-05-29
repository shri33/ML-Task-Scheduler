import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

redis_url = os.getenv("REDIS_URL", "redis://redis:6379")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=redis_url,
    strategy="fixed-window"
)
