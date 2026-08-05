// Nazra · attendance kiosk (browser)
import * as nz from "./core.js";

const MATCH_THRESHOLD = 0.72; // min similarity to accept an identity (raise = stricter)
const ARM_FRAMES = 6;         // frames a known person must persist before arming the prompt
const LOG_COOLDOWN = 20000;   // ms before the same person can be logged again
const SUCCESS_SHOW = 3000;    // ms to show "LOG SUCCESSFUL"

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");
const statusEl = document.getElementById("status");
const bannerEl = document.getElementById("banner");
const logEl = document.getElementById("log");

let stableId = null, stableCount = 0;
let lastLog = {};        // id -> timestamp
let successUntil = 0, successText = "";
let closedFrames = 0, lastBlink = false;

function setStatus(text, cls = "") { statusEl.textContent = text; statusEl.className = "status " + cls; }
function showBanner(text, cls) { bannerEl.style.display = "block"; bannerEl.textContent = text; bannerEl.className = "banner " + cls; }
function hideBanner() { bannerEl.style.display = "none"; }

function renderLog() {
  const log = nz.loadLog().slice().reverse().slice(0, 8);
  logEl.innerHTML = log.length
    ? log.map((r) => `<div class="logline">${r.time} · ${r.direction} · ${r.name} (ID ${r.id})</div>`).join("")
    : '<div class="empty logline">No entries yet.</div>';
}

function refreshEnrollHint() {
  const db = nz.loadEnrollment();
  const n = Object.keys(db).length;
  document.getElementById("enrollhint").textContent = n
    ? `${n} employee(s) enrolled on this device.`
    : "No employees enrolled yet — click “＋ Enroll employee”.";
}

async function main() {
  try {
    await nz.initModels(setStatus);
    await nz.startCamera(video);
  } catch (e) {
    setStatus("Camera/model error — allow camera access", "no");
    console.error(e);
    return;
  }
  refreshEnrollHint();
  renderLog();
  window.addEventListener("focus", () => { refreshEnrollHint(); renderLog(); });
  document.getElementById("export").onclick = () => nz.exportLogCsv();
  requestAnimationFrame(loop);
}

function loop() {
  const now = performance.now();
  if (video.readyState >= 2) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    octx.clearRect(0, 0, overlay.width, overlay.height);

    const res = nz.detect(video, now);
    const db = nz.loadEnrollment();

    if (!Object.keys(db).length) {
      setStatus("No employees enrolled", "no");
      showBanner("No employees enrolled — click “Enroll employee”", "info");
    } else if (res && res.faceLandmarks && res.faceLandmarks[0]) {
      handleFace(res, db, now);
    } else {
      setStatus("No face", "no");
      hideBanner();
      stableId = null; stableCount = 0;
    }
  }
  requestAnimationFrame(loop);
}

function handleFace(res, db, now) {
  const lm = res.faceLandmarks[0];
  const box = nz.periocularBox(lm, overlay.width, overlay.height);
  const vec = nz.embed(video, box);
  let id = null, name = null, sim = -1;
  if (vec) { const m = nz.identify(vec, MATCH_THRESHOLD); id = m.id; name = m.name; sim = m.sim; }

  const known = id !== null;
  drawBox(box, known, known ? `Employee ${id}, ${name}` : "UNKNOWN", sim);
  setStatus(known ? `Recognized (${sim.toFixed(2)})` : `Unknown (${sim.toFixed(2)})`, known ? "ok" : "no");

  // blink edge-detection
  const blinkingNow = nz.isBlinking(res);
  if (blinkingNow) closedFrames++;
  let blinkEvent = false;
  if (!blinkingNow && lastBlink && closedFrames >= 1) blinkEvent = true;
  if (!blinkingNow) closedFrames = 0;
  lastBlink = blinkingNow;

  // stability
  if (known && id === stableId) stableCount++;
  else if (known) { stableId = id; stableCount = 1; }
  else { stableId = null; stableCount = 0; }

  const armed = stableId !== null && stableCount >= ARM_FRAMES &&
                now - (lastLog[stableId] || 0) > LOG_COOLDOWN;

  if (now < successUntil) {
    showBanner(successText, "ok");
  } else if (armed) {
    showBanner("BLINK TO LOG ATTENDANCE", "arm");
    if (blinkEvent) {
      const entry = nz.writeLog(stableId, name);
      lastLog[stableId] = now;
      successText = `LOG SUCCESSFUL — ${entry.direction} ${entry.time}`;
      successUntil = now + SUCCESS_SHOW;
      renderLog();
    }
  } else if (known && now - (lastLog[id] || 0) <= LOG_COOLDOWN) {
    showBanner(`Already logged ✓ (Employee ${id})`, "info");
  } else {
    hideBanner();
  }
}

function drawBox(box, known, label, sim) {
  const color = known ? "#5ad6b0" : "#ff6b6b";
  octx.lineWidth = 3;
  octx.strokeStyle = color;
  octx.strokeRect(box.x, box.y, box.w, box.h);
  // label background + text (un-mirror text so it reads correctly)
  octx.save();
  octx.translate(overlay.width, 0);
  octx.scale(-1, 1);
  const lx = overlay.width - box.x - box.w;
  octx.font = "bold 20px -apple-system,Segoe UI,Roboto,sans-serif";
  const tw = octx.measureText(label).width;
  octx.fillStyle = color;
  octx.fillRect(lx, box.y - 28, tw + 14, 26);
  octx.fillStyle = "#0f1115";
  octx.fillText(label, lx + 7, box.y - 9);
  octx.fillStyle = color;
  octx.font = "16px -apple-system,Segoe UI,Roboto,sans-serif";
  octx.fillText(`match ${sim.toFixed(2)}`, lx, box.y + box.h + 20);
  octx.restore();
}

main();
