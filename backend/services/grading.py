"""
Answer grading — mirrors lib/demo.ts grade() exactly.
"""
import math
import re
from typing import Any


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def grade(question: dict[str, Any], answer: str) -> bool:
    """
    Grade a single question.
    Returns True if the answer is correct.
    """
    q_type = question.get("type", "")
    correct = question.get("answer", "")

    if not answer:
        return False

    if q_type == "Numerical":
        try:
            given = float(answer)
            expected = float(correct)
            return math.isfinite(given) and math.isfinite(expected) and abs(given - expected) < 0.001
        except (ValueError, TypeError):
            return False

    if q_type == "MCQ":
        return _norm(answer) == _norm(correct)

    # Short answer — check answer and any declared aliases
    aliases: list[str] = question.get("aliases") or []
    accepted = [correct] + aliases
    return any(_norm(answer) == _norm(a) for a in accepted)
