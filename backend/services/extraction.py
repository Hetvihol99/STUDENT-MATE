"""
Document extraction service.
Supports: text-based PDF (via pdfplumber), UTF-8 TXT, Markdown.
Scanned / image-only PDFs raise a clear error — OCR is not included.
"""
import io
from pathlib import Path
from fastapi import HTTPException
from config import settings

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


def extract_pages(filename: str, content: bytes, mime_type: str = "") -> list[str]:
    """
    Extract page-level text from an uploaded file.
    Returns a list of strings, one per page (or one item for text files).
    Raises HTTPException on validation or extraction failure.
    """
    ext = Path(filename).suffix.lower()
    size = len(content)

    if size == 0:
        raise HTTPException(400, {"error": "File is empty.", "code": "file_empty"})
    if size > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, {"error": f"File exceeds {settings.max_upload_mb} MB limit.", "code": "file_size"})

    if ext not in (".pdf", ".txt", ".md"):
        raise HTTPException(415, {
            "error": "Supported formats: text-based PDF, UTF-8 TXT, Markdown (.md).",
            "code": "unsupported",
        })

    # ----- Text / Markdown -----
    if ext in (".txt", ".md"):
        if mime_type and mime_type not in (
            "text/plain", "text/markdown", "application/octet-stream", ""
        ):
            raise HTTPException(415, {"error": "MIME type does not match text format.", "code": "mime"})
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(422, {"error": "File must be valid UTF-8 text.", "code": "encoding"})
        if "\x00" in text or not text.strip():
            raise HTTPException(422, {
                "error": "Text must be non-empty UTF-8 without binary data.",
                "code": "text_invalid",
            })
        if len(text) > settings.max_text_chars:
            raise HTTPException(422, {
                "error": f"Text exceeds {settings.max_text_chars:,} character limit.",
                "code": "text_limit",
            })
        return [text]

    # ----- PDF -----
    if not PDF_AVAILABLE:
        raise HTTPException(503, {
            "error": "PDF processing unavailable. Install pdfplumber.",
            "code": "pdf_unavailable",
        })
    if mime_type and mime_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(415, {"error": "MIME type does not match PDF format.", "code": "mime"})
    if not content[:5].startswith(b"%PDF-"):
        raise HTTPException(422, {"error": "This is not a valid PDF file.", "code": "invalid_pdf"})

    try:
        pages: list[str] = []
        total_chars = 0
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            if len(pdf.pages) > settings.max_pdf_pages:
                raise HTTPException(422, {
                    "error": f"PDFs are limited to {settings.max_pdf_pages} pages.",
                    "code": "page_limit",
                })
            for page in pdf.pages:
                text = (page.extract_text() or "").strip()
                total_chars += len(text)
                if total_chars > settings.max_text_chars:
                    raise HTTPException(422, {
                        "error": f"Extracted text exceeds {settings.max_text_chars:,} characters.",
                        "code": "text_limit",
                    })
                pages.append(text)

        if not any(len(p) > 15 for p in pages):
            raise HTTPException(422, {
                "error": "No readable text found. Scanned PDFs need OCR, which is not included.",
                "code": "no_text",
            })
        return pages
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, {
            "error": "PDF extraction failed. Use an unencrypted text-based PDF.",
            "code": "extraction_failed",
        }) from exc
