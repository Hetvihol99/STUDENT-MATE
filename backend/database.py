"""
SQLite database layer.
Matches the schema from the Cloudflare D1 edition (db/schema.ts) exactly,
so the same drizzle migrations describe both databases.
"""
import sqlite3
import threading
from pathlib import Path
from config import settings

_local = threading.local()

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_accounts (
    user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS courses (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS materials (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    status      TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    bytes       INTEGER NOT NULL,
    pages       INTEGER NOT NULL DEFAULT 0,
    seeded      INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    created_at  TEXT NOT NULL,
    deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS materials_owner_course ON materials(owner_id, course_id, status);

CREATE TABLE IF NOT EXISTS material_media (
    material_id TEXT PRIMARY KEY REFERENCES materials(id) ON DELETE CASCADE,
    video_url TEXT,
    mime_type TEXT NOT NULL,
    transcript_source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
    id          TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    page        INTEGER NOT NULL,
    text        TEXT NOT NULL,
    UNIQUE (material_id, page)
);

CREATE TABLE IF NOT EXISTS chunks (
    id      TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    text    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_page ON chunks(page_id);

CREATE TABLE IF NOT EXISTS topics (
    id        TEXT PRIMARY KEY,
    owner_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    data      TEXT NOT NULL,
    mastery   INTEGER NOT NULL DEFAULT 0,
    attempts  INTEGER NOT NULL DEFAULT 0,
    correct   INTEGER NOT NULL DEFAULT 0,
    last      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS topics_owner_course ON topics(owner_id, course_id);

CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner_id);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    text            TEXT NOT NULL,
    citations       TEXT NOT NULL,
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS quizzes (
    id           TEXT PRIMARY KEY,
    owner_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    material_id  TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    mode         TEXT NOT NULL,
    verification TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    expires_at   TEXT
);
CREATE INDEX IF NOT EXISTS quizzes_owner ON quizzes(owner_id);

CREATE TABLE IF NOT EXISTS questions (
    id       TEXT PRIMARY KEY,
    quiz_id  TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES topics(id),
    ordinal  INTEGER NOT NULL,
    data     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS questions_quiz ON questions(quiz_id);

CREATE TABLE IF NOT EXISTS attempts (
    id         TEXT PRIMARY KEY,
    quiz_id    TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    owner_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    score      INTEGER NOT NULL,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (quiz_id)
);
CREATE INDEX IF NOT EXISTS attempts_owner ON attempts(owner_id);

CREATE TABLE IF NOT EXISTS mastery_history (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic_id   TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    mastery    INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mastery_owner ON mastery_history(owner_id, created_at);

CREATE TABLE IF NOT EXISTS flashcards (
    id       TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    front    TEXT NOT NULL,
    back     TEXT NOT NULL,
    UNIQUE (owner_id, topic_id)
);

CREATE TABLE IF NOT EXISTS revisions (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic_id   TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS revisions_owner ON revisions(owner_id);

CREATE TABLE IF NOT EXISTS activity (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_owner ON activity(owner_id, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
    key      TEXT PRIMARY KEY,
    count    INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
);
"""


def get_db() -> sqlite3.Connection:
    """Return a per-thread SQLite connection, creating it on first use."""
    if not hasattr(_local, "conn") or _local.conn is None:
        db_path = Path(settings.database_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.executescript(SCHEMA_SQL)
        conn.commit()
        _local.conn = conn
    return _local.conn


def db_one(sql: str, *args):
    """Fetch a single row or None."""
    return get_db().execute(sql, args).fetchone()


def db_all(sql: str, *args):
    """Fetch all rows."""
    return get_db().execute(sql, args).fetchall()


def db_run(sql: str, *args):
    """Execute a statement."""
    conn = get_db()
    with conn:
        conn.execute(sql, args)


def db_batch(statements: list[tuple[str, tuple]]):
    """Execute multiple statements in a single transaction."""
    conn = get_db()
    try:
        for sql, args in statements:
            conn.execute(sql, args)
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def close_db() -> None:
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
        _local.conn = None
