# 🎓 STUDENT-MATE AI

> A full-stack AI-powered study workspace — organize, learn, quiz, and revise smarter.
> Built with ❤️ by Team Snippet

    

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Google-Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

---

## 🌌 What is STUDENT-MATE?

**STUDENT-MATE** is a personal AI study application that brings your entire learning journey into one intelligent workspace.

Upload your course materials (PDFs, videos, YouTube links), ask an AI tutor questions backed by your own content, auto-generate quizzes, track your mastery, and review flashcards — all in a clean, minimal interface built for deep focus..

----  

## ✨ Key Features

| Feature | Description |  
|---------|-------------|
| 📚 **Smart Library** | Upload PDFs, TXT, Markdown, MP4, MOV videos, or YouTube links |
| 🤖 **AI Tutor** | Ask questions grounded in *your* uploaded material via Gemini |
| 🧠 **Auto Quiz Generation** | MCQ, short-answer, numerical, or mixed. Easy / medium / adaptive |
| 📊 **Progress Tracking** | Mastery estimates, topic breakdowns, quiz history, exportable reports |
| 🗂️ **Flashcards & Revision** | AI-generated flashcards for quick recall |
| 🔐 **Private Accounts** | Argon2id hashing, HttpOnly cookies, 7-day session expiry |
| 🎬 **Video Learning** | Uploaded videos + embedded YouTube with AI-extracted study text |
| 📄 **Source-Linked Answers** | Every tutor answer cites the exact passage from your material |

---

## 🏗️ Architecture

    Browser (React 19 + TypeScript + Vite)
         |
         | /api/study
         v
    Python FastAPI Backend
         |
         |-- SQLite (accounts, courses, materials, quizzes, progress)
         |-- Local file storage (PDFs, videos)
         |
         v
    Google Gemini API
    (Tutoring | Quiz Generation | Video Extraction)

    --- Hosted Edition ---
    Next.js App Router  <-->  Cloudflare Workers + D1 + R2 + Drizzle

---

## 🛠️ Tech Stack

**Frontend**
- React 19, TypeScript, Vite / Vinext
- Tailwind CSS, shadcn UI, Radix UI
- Recharts, Lucide React, Sonner

**Backend (Local)**
- Python, FastAPI, Uvicorn
- SQLite, pdfplumber, HTTPX
- Argon2id, Pydantic, python-dotenv

**Hosted Edition**
- Cloudflare Workers, D1, R2
- Drizzle ORM, Zod, unpdf

**AI**
- Google Gemini API (tutor, quizzes, video extraction)
- Gemini Files API, JSON Schema, Keyword Retrieval (RAG)

---

## 📁 Project Structure

    STUDENT-MATE/
    ├── backend/
    │   ├── main.py              # FastAPI entry point
    │   ├── config.py            # Settings & environment
    │   ├── database.py          # SQLite schema & ops
    │   ├── auth.py              # Session & authentication
    │   ├── routes/              # accounts, materials, chat, quizzes, revision
    │   ├── services/            # gemini, extraction, retrieval, grading, video
    │   └── tests/
    │
    └── frontend/
        ├── app/                 # Main screens & hosted API routes
        ├── components/          # Tutor, quiz, materials, UI controls
        ├── lib/                 # API client, types, utilities
        ├── hooks/               # Reusable React hooks
        ├── server/              # Cloudflare Worker backend
        ├── db/ & drizzle/       # Hosted DB schema & migrations
        ├── docs/                # Architecture & deployment docs
        ├── tests/
        └── public/

---

## 🚀 Quick Start

**Prerequisites:** Node.js 22+, Python 3.11+, Gemini API key

**1. Clone**

    git clone https://github.com/Hetvihol99/STUDENT-MATE.git
    cd STUDENT-MATE

**2. Backend setup**

    python3 -m venv backend/.venv
    backend/.venv/bin/python -m pip install -r backend/requirements.txt
    cp backend/.env.example backend/.env
    # Add your GEMINI_API_KEY to backend/.env

**3. Frontend setup**

    cd frontend
    npm ci

**4. Run the app**

    npm run dev

**5. Open browser**

    http://127.0.0.1:5173

---

## 🔑 Environment Variables

    GEMINI_API_KEY=your_gemini_api_key_here
    GEMINI_MODEL=gemini-3.1-flash-lite
    APP_ENV=development
    SESSION_DAYS=7
    MAX_UPLOAD_MB=5
    MAX_VIDEO_MB=50
    MAX_PDF_PAGES=25

---

## 🧪 Tests

    # Python tests (26 tests)
    backend/.venv/bin/python -m unittest discover -s backend/tests -v

    # TypeScript type check
    cd frontend && npm run typecheck

    # Frontend unit tests (21 tests)
    cd frontend && npm test

    # HTTP smoke test
    cd frontend && npm run check:local

---

## 🔒 Security

- Argon2id password hashing
- HttpOnly session cookies
- SHA-256 session fingerprints (raw tokens never stored)
- 7-day session expiry with revocation on password change
- Owner-scoped data access
- CORS origin validation

---

## 📖 Documentation

| File | Description |
|------|-------------|
| docs/ARCHITECTURE.md | System design and data flow |
| docs/API.md | Full API reference |
| docs/DEPLOYMENT.md | Deployment guide |
| docs/DEMO.md | 3-5 minute demo walkthrough |
| docs/FEATURES.md | Complete feature list |
| docs/DATABASE.md | Database schema |
| docs/VALIDATION.md | Test and validation results |
| PROJECT-INFO.txt | Complete technical reference |

---

## ⚠️ Known Limitations

- Scanned PDFs need OCR (not included)
- Private/unlisted YouTube videos cannot be auto-extracted
- Very long videos may need a manual transcript
- No email verification or social login for local accounts
- Adaptive difficulty is a study estimate, not a validated learning model

---

## 👥 Team — Snippet

> Built with ❤️ by four passionate developers

| Name | Role |
|------|------|
| 👨‍💻 **Het Vihol** | Full-Stack Developer |
| 👨‍💻 **Mohit** | Backend Developer | 
| 👩‍💻 **Rutva** | Frontend Developer |
| 👨‍💻 **Dhruv** | AI & Integration & Project Lead |

---

⭐ Star this repo if it helped you!

Made with ❤️ by Team Snippet · STUDENT-MATE AI © 2026
