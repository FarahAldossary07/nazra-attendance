// Nazra · shared browser engine
// Loads MediaPipe (JS), detects the eye region, builds a "fingerprint"
// (embedding), matches against enrolled people, and stores data in the browser.
import {
  FaceLandmarker,
  ImageEmbedder,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm";

// --- landmark indices (478-point mesh), same as the Python version ---
export const EYE_REGION_IDS = [
  33, 133, 159, 158, 157, 173, 145, 153, 154, 155, 144, 163, 7, 246,
  362, 263, 386, 385, 384, 398, 374, 380, 381, 382, 373, 390, 249, 466,
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
  468, 469, 470, 471, 472, 473, 474, 475, 476, 477,
];

let faceLandmarker = null;
let imageEmbedder = null;

// offscreen canvas used to cut out the eye-region crop before embedding
const cropCanvas = document.createElement("canvas");
const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });

export async function initModels(onStatus = () => {}) {
  onStatus("Loading AI models…");
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "models/face_landmarker.task" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true, // gives eyeBlink scores for liveness
  });
  imageEmbedder = await ImageEmbedder.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "models/embedder.tflite" },
    l2Normalize: true,
  });
  onStatus("Models ready.");
}

// Start the webcam and return the <video> element (already playing).
export async function startCamera(video, facingMode = "user") {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return video;
}

export function detect(video, tsMs) {
  if (!faceLandmarker) return null;
  return faceLandmarker.detectForVideo(video, tsMs);
}

// Are the eyes currently closed? Uses MediaPipe blendshape "eyeBlink" scores.
export function isBlinking(result, threshold = 0.5) {
  const bs = result?.faceBlendshapes?.[0]?.categories;
  if (!bs) return false;
  let l = 0, r = 0;
  for (const c of bs) {
    if (c.categoryName === "eyeBlinkLeft") l = c.score;
    if (c.categoryName === "eyeBlinkRight") r = c.score;
  }
  return (l + r) / 2 > threshold;
}

// Bounding box around the eye/brow/iris landmarks (pixels in the video frame).
export function periocularBox(landmarks, w, h, pad = 0.6) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of EYE_REGION_IDS) {
    const p = landmarks[i];
    x0 = Math.min(x0, p.x * w); x1 = Math.max(x1, p.x * w);
    y0 = Math.min(y0, p.y * h); y1 = Math.max(y1, p.y * h);
  }
  const bw = x1 - x0, bh = y1 - y0;
  x0 = Math.max(0, x0 - bw * pad * 0.4);
  x1 = Math.min(w, x1 + bw * pad * 0.4);
  y0 = Math.max(0, y0 - bh * pad);
  y1 = Math.min(h, y1 + bh * pad * 0.5);
  return { x: x0 | 0, y: y0 | 0, w: (x1 - x0) | 0, h: (y1 - y0) | 0 };
}

// Turn the eye-region crop into an L2-normalized fingerprint (Float32Array).
export function embed(video, box) {
  if (!imageEmbedder || box.w < 8 || box.h < 8) return null;
  cropCanvas.width = box.w;
  cropCanvas.height = box.h;
  cropCtx.drawImage(video, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  const res = imageEmbedder.embed(cropCanvas);
  const e = res?.embeddings?.[0]?.floatEmbedding;
  return e ? Float32Array.from(e) : null;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ---------------- browser storage ----------------
const DB_KEY = "nazra_enrollment";
const LOG_KEY = "nazra_log";

export function loadEnrollment() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; }
  catch { return {}; }
}
export function saveEnrollment(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Add samples for a person (embeddings rounded to save space; capped at 40).
export function addPerson(empId, name, vectors) {
  const db = loadEnrollment();
  const rounded = vectors.map((v) => Array.from(v, (x) => +x.toFixed(4)));
  const prev = db[empId]?.embeddings || [];
  let all = prev.concat(rounded);
  if (all.length > 40) all = all.slice(all.length - 40);
  db[empId] = { name, embeddings: all };
  saveEnrollment(db);
  return db[empId].embeddings.length;
}

export function removePerson(empId) {
  const db = loadEnrollment();
  delete db[empId];
  saveEnrollment(db);
}

// Identify a live fingerprint. Returns {id, name, sim} — id null if below threshold.
export function identify(liveVec, threshold) {
  const db = loadEnrollment();
  let best = { id: null, name: null, sim: -1 };
  for (const [id, rec] of Object.entries(db)) {
    for (const s of rec.embeddings) {
      const sim = dot(liveVec, s); // unit vectors → dot == cosine similarity
      if (sim > best.sim) best = { id, name: rec.name, sim };
    }
  }
  return best.sim >= threshold ? best : { id: null, name: null, sim: best.sim };
}

// ---------------- attendance log ----------------
export function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; }
  catch { return []; }
}

export function todaysDirection(empId) {
  const today = new Date().toISOString().slice(0, 10);
  const mine = loadLog().filter((r) => r.id === empId && r.date === today);
  const last = mine.length ? mine[mine.length - 1].direction : null;
  return last === "IN" ? "OUT" : "IN";
}

export function writeLog(empId, name) {
  const now = new Date();
  const direction = todaysDirection(empId);
  const entry = {
    ts: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString(),
    id: empId,
    name,
    direction,
  };
  const log = loadLog();
  log.push(entry);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  return entry;
}

export function exportLogCsv() {
  const log = loadLog();
  const header = "datetime,employee_id,date,time,direction,name\n";
  const rows = log
    .map((r) => `${r.ts},${r.id},${r.date},${r.time},${r.direction},"${r.name}"`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "attendance.csv";
  a.click();
}
