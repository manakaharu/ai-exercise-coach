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

const modeButtons = document.querySelectorAll(".mode-controls .control-btn");

// ================= STATE =================
let currentStream = null;
let isSessionActive = false;
let sessionStartTime = null;

let repCount = 0;
let squatState = "UP";
let currentLang = "TH";
let currentMode = "AUTO";

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

// ================= MODE CONTROL =================
modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    modeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentMode = btn.dataset.mode;

    repCount = 0;
    squatState = "UP";
    repValue.textContent = "0";
    scoreValue.textContent = "--%";

    feedback.textContent = `Mode: ${currentMode}`;
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
  canCount = false;

  repCount = 0;
  squatState = "UP";
  sessionStartTime = Date.now();

  repValue.textContent = "0";
  scoreValue.textContent = "0%";

  // clear old timer
  if (cooldownTimer) clearInterval(cooldownTimer);

  let remaining = 5;
  feedback.textContent = `Get ready... ${remaining}s`;

  cooldownTimer = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      feedback.textContent = `Get ready... ${remaining}s`;
    } else {
      clearInterval(cooldownTimer);
      canCount = true;
      feedback.textContent = "GO!";
    }
  }, 1000);
};

stopBtn.onclick = () => {
  isSessionActive = false;
  canCount = false;

  if (cooldownTimer) clearInterval(cooldownTimer);

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
  if (!canCount) return;

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

// ================= ZOOM CONTROL =================
const zoomWrapper = document.getElementById("zoomWrapper");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomResetBtn = document.getElementById("zoomReset");

let zoomLevel = 1;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.5;

function applyZoom() {
  zoomWrapper.style.transform = `scale(${zoomLevel})`;
  zoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
}

zoomInBtn.onclick = () => {
  zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
  applyZoom();
};

zoomOutBtn.onclick = () => {
  zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
  applyZoom();
};

zoomResetBtn.onclick = () => {
  zoomLevel = 1;
  applyZoom();
};

init();

