# Quiz, practice and video verification

## Problems fixed

The live provider returned `Multiple Choice`, `True/False` and `Short Answer` labels when the app expected `MCQ`, `Short answer` and `Numerical`. Both Python and hosted TypeScript quiz generation now send explicit response schemas, with requested question types, difficulties and counts. Harmless legacy label variants and empty/null aliases are normalized; source quotes and answer keys still must pass validation. Non-MCQ option arrays are removed so the frontend renders text/numeric inputs instead of an empty radio group.

Targeted practice now starts from the topic's own ready material, even if another material is listed first in the same course. Course changes cannot retain an out-of-scope topic. Generation failures appear inline as well as in notifications. The dashboard's Continue learning statistics now refer to the selected course. Blank document cover pages no longer create empty initial topics.

## Added material options

- Document uploads: PDF, TXT, Markdown, up to 5 MB by default.
- Video uploads: MP4, M4V, WebM, MOV, up to 50 MB by default.
- Public YouTube video links, including short links and Shorts URLs.
- Automatic Gemini study-text extraction or a supplied transcript/lesson text.
- Private video playback with byte ranges; embedded public YouTube playback.
- Navigable source sections, timestamped playback, section topics, flashcards, quizzes and tutor retrieval.

These media imports run through the Python backend used by `npm run dev`. The separate hosted Worker keeps its original document-only storage contract; video controls are enabled only when the backend declares video support.

## Checked

- Live Gemini reproduction of the original invalid question types.
- Live schema-constrained quiz generation and validation.
- Live Gemini video extraction from a locally generated four-second teaching clip.
- Live HTTP video upload → AI quiz creation → saved submission.
- Live public YouTube import using Google's documentation example: five extracted sections.
- Browser targeted practice selected the correct video/topic, created five valid questions, and rendered short-answer inputs.
- Desktop browser video playback loaded the four-second WebM with no media error.
- Mobile browser selected and uploaded the actual clip through the file chooser with a supplied transcript.
- YouTube source panel loaded the embedded public video; Next section changed the transcript and player timestamp.
- 24 Python and 21 TypeScript tests passed, including provider upload/polling/cleanup, transcript validation, URL allowlisting, ownership, ranged downloads, quiz grading and practice selection.
- TypeScript compilation, production build and the complete HTTP smoke check passed.

[YouTube import screenshot](screenshots/youtube-import.jpg), [video study view](screenshots/video-study-material.jpg).

Automatic extraction depends on provider model access, quota and video availability. Pasted transcripts avoid the extraction call. AI-created study text is an interpretation of the video and should be checked against the original. A quote checked against saved AI study text is not independent verification of the underlying video.

Sources for the provider integration: [structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [video and YouTube input](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding).

## Citation correction for the Bayes PDF

Quiz citations now select an ID from a server-built catalog of exact source excerpts. The server attaches the original text, so the model does not need to reproduce PDF formulas, Unicode symbols or line breaks. Unknown source IDs and fabricated provider-supplied quotes are still rejected. The same change applies to both Python and TypeScript quiz generation.

A single uploaded-document topic now selects evidence across its PDF instead of limiting practice to the topic's first readable page. Large evidence sets are sampled across the document rather than truncated to the beginning.

The actual 12-page Bayes PDF shown in the reported error was tested in an isolated temporary workspace. Two live requests using five MCQs, adaptive difficulty and the document topic both returned five questions, with verified excerpts spanning multiple pages. Both submissions succeeded. The original account and progress were not modified. The suite now passes 26 Python tests and 21 TypeScript tests; type checks, the HTTP smoke check and the production build also pass.
