# Nazra نظرة — Periocular Attendance Kiosk (web)

A niqab-friendly attendance kiosk that recognizes employees by the region around
their eyes and logs clock-in / clock-out with a timestamp. Runs **entirely in the
browser** — camera capture, eye detection, blink liveness, and recognition all
happen client-side with [MediaPipe Tasks for Web](https://ai.google.dev/edge/mediapipe).
Nothing is uploaded; data lives in the browser's local storage.

## Pages
- **`index.html`** — the attendance kiosk (recognize → blink → log).
- **`enroll.html`** — enroll an employee (capture ~40 eye samples under a name + ID).
- **`tutorial.html`** — how to use it.

## Run locally
Any static file server works (the camera needs `https://` or `localhost`):

```bash
npx serve .
# then open the printed http://localhost:3000
```

## Deploy on Vercel
This is a static site — no build step.

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo.
3. Framework preset: **Other**. Build command: *(none)*. Output dir: `.`
4. Deploy. Open the URL, allow camera access, enroll, and go.

> Camera access requires HTTPS — Vercel provides that automatically.

## How it works
1. **Detect** the eye region with MediaPipe FaceLandmarker (works with the lower face covered).
2. **Embed** the eye crop into a 1280-number fingerprint with an image embedder.
3. **Match** against enrolled fingerprints by cosine similarity; above a threshold → that
   employee, else *Unknown*.
4. **Blink** (MediaPipe blendshapes) confirms a live person before logging.

## Notes / limits
- Enrollments are stored **per browser/device**. For recognition shared across devices,
  add a backend database (future work).
- Tune `MATCH_THRESHOLD` in `js/kiosk.js` (higher = stricter).
- Concept project — not a certified biometric system.
