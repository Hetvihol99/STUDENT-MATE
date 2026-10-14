from .bootstrap import router as bootstrap_router
from .materials import router as materials_router
from .chat import router as chat_router
from .quizzes import router as quizzes_router
from .revision import router as revision_router

__all__ = [
    "bootstrap_router",
    "materials_router",
    "chat_router",
    "quizzes_router",
    "revision_router",
]
