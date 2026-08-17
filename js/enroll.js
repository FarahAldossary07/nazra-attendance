// Nazra · enrollment (browser)
import * as nz from "./core.js";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const msgEl = document.getElementById("msg");

let buffer = [];        // captured-but-not-saved fingerprints
let latestVec = null, latestBox = null, hasFace = false;

function setStatus(t, cls = "") { statusEl.textContent = t; statusEl.className = "status " + cls; }
function msg(t) { msgEl.textContent = t; }

function renderPeople() {
  const db = nz.loadEnrollment();
  const el = document.getElementById("people");
  const ids = Object.keys(db);
  el.innerHTML = ids.length
    ? ids.map((id) =>
        `<li><span>${db[id].name} · ID ${id} · ${db[id].embeddings.length} samples</span>
         <button data-id="${id}">Remove</button></li>`).join("")
    : '<li class="empty">None yet.</li>';
  el.querySelectorAll("button").forEach((b) =>
    (b.onclick = () => { nz.removePerson(b.dataset.id); renderPeople(); msg(`Removed ID ${b.dataset.id}.`); }));
}

async function main() {
  try {
    await nz.initModels(setStatus);
    await nz.startCamera(video);
  } catch (e) {
    setStatus("Camera/model error - allow camera access", "no");
    console.error(e);
    return;
  } finally {
    window.dispatchEvent(new Event("nazra-ready")); // fade the loading screen
  }
  renderPeople();
  document.getElementById("cap1").onclick = () => capture(1);
  document.getElementById("cap20").onclick = () => capture(20);
  document.getElementById("clear").onclick = () => { buffer = []; countEl.textContent = 0; msg("Cleared unsaved samples."); };
  document.getElementById("save").onclick = save;
  requestAnimationFrame(loop);
}

function loop() {
  const now = performance.now();
  if (video.readyState >= 2) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const res = nz.detect(video, now);
    if (res && res.faceLandmarks && res.faceLandmarks[0]) {
      const box = nz.periocularBox(res.faceLandmarks[0], overlay.width, overlay.height);
      latestVec = nz.embed(video, box);
      latestBox = box; hasFace = true;
      octx.lineWidth = 3; octx.strokeStyle = "#f5be5a";
      octx.strokeRect(box.x, box.y, box.w, box.h);
      setStatus("Eyes found", "ok");
    } else {
      hasFace = false; latestVec = null;
      setStatus("No face", "no");
    }
  }
  requestAnimationFrame(loop);
}

async function capture(n) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (hasFace && latestVec) { buffer.push(latestVec); got++; }
    countEl.textContent = buffer.length;
    await new Promise((r) => setTimeout(r, 120)); // spread out for variety
  }
  msg(got ? `Captured ${got} sample(s). Move your head slightly between captures.`
         : "No eyes detected - look at the camera.");
}

function save() {
  const name = document.getElementById("name").value.trim();
  const id = document.getElementById("empid").value.trim();
  if (!name || !id) return msg("Enter a name and an ID first.");
  if (buffer.length < 3) return msg("Capture at least 3 samples first.");
  const total = nz.addPerson(id, name, buffer);
  buffer = []; countEl.textContent = 0;
  renderPeople();
  msg(`Saved ${name} (ID ${id}) - ${total} samples stored. You can enroll another, or go to the kiosk.`);
}

main();
