// ================= DOM =================
const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const cameraSelect = document.getElementById("cameraSelect");
const langBtn = document.getElementById("langBtn");

const scoreValue = document.getElementById("scoreValue");
const repValue = document.getElementById("repValue");
const feedback = document.getElementById("feedback");

const scoreLabel = document.getElementById("scoreLabel");
const repLabel = document.getElementById("repLabel");
const summaryText = document.getElementById("summaryText");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// ⭐ MODE BUTTONS (จุดสำคัญ)
const modeButtons = document.querySelectorAll(".mode-controls .control-btn");

// ================= STATE =================
let currentStream = null;
let isSessionActive = false;
let sessionStartTime = null;

let repCount = 0;
let squatState = "UP";
let currentLang = "TH";
let currentMode = "AUTO"; // ⭐ สำคัญ
const COOLDOWN_MS = 5000;
let canCount = false;
let cooldownTimer = null;

// ================= LANGUAGE =================
const TEXT = {
  TH: { score: "คะแนน", reps: "ครั้ง" },
  EN: { score: "SCORE", reps: "REPS" }
};

langBtn.onclick = () => {
  currentLang = currentLang === "TH" ? "EN" : "TH";
  scoreLabel.textContent = TEXT[currentLang].score;
  repLabel.textContent = TEXT[currentLang].reps;
};

// ================= MODE CONTROL (แก้หลัก) =================
modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // ลบ active ทุกปุ่ม
    modeButtons.forEach(b => b.classList.remove("active"));

    // ใส่ active ให้ปุ่มที่กด
    btn.classList.add("active");

    // เปลี่ยน mode จริง
    currentMode = btn.dataset.mode;

    // reset ค่า
    repCount = 0;
    squatState = "UP";
    repValue.textContent = "0";
    scoreValue.textContent = "--%";

    feedback.textContent = `Mode: ${currentMode}`;
    console.log("MODE =", currentMode);
  });
});

// ================= CAMERA =================
async function setupCameraSelector() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d => d.kind === "videoinput");

  cameraSelect.innerHTML = "";
  cams.forEach((cam, i) => {
    const opt = document.createElement("option");
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(opt);
  });

  startCamera(cams[0].deviceId);
}

async function startCamera(deviceId) {
  if (currentStream) currentStream.getTracks().forEach(t => t.stop());

  currentStream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false
  });

  video.srcObject = currentStream;
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

cameraSelect.onchange = () => startCamera(cameraSelect.value);

// ================= SESSION =================
startBtn.onclick = () => {
  isSessionActive = true;
  repCount = 0;
  squatState = "UP";
  sessionStartTime = Date.now();

  repValue.textContent = "0";
  scoreValue.textContent = "0%";
  feedback.textContent = "Session started";
};

stopBtn.onclick = () => {
  isSessionActive = false;
  const duration = Math.round((Date.now() - sessionStartTime) / 1000);
  summaryText.textContent = `Time: ${duration}s | Reps: ${repCount}`;
};

// ================= MEDIAPIPE =================
const pose = new Pose({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
});

pose.setOptions({
  modelComplexity: 0,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onPoseResults);

async function detectPose() {
  await pose.send({ image: video });
  requestAnimationFrame(detectPose);
}

// ================= POSE RESULT =================
function onPoseResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!results.poseLandmarks) return;

  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
    color: "#22c55e",
    lineWidth: 4
  });

  drawLandmarks(ctx, results.poseLandmarks, {
    color: "#ef4444",
    radius: 4
  });

  if (isSessionActive) detectSquat(results.poseLandmarks);
}

// ================= SQUAT LOGIC =================
function detectSquat(lm) {
  const hip = lm[23];
  const knee = lm[25];
  if (!hip || !knee) return;

  const diff = knee.y - hip.y;

  if (diff < 0.04 && squatState === "UP") {
    squatState = "DOWN";
  }

  if (diff > 0.14 && squatState === "DOWN") {
    squatState = "UP";
    repCount++;

    repValue.textContent = repCount;
    scoreValue.textContent = `${Math.min(repCount * 10, 100)}%`;
  }
}

// ================= INIT =================
async function init() {
  scoreLabel.textContent = TEXT.TH.score;
  repLabel.textContent = TEXT.TH.reps;
  await setupCameraSelector();
  detectPose();
}

init();

