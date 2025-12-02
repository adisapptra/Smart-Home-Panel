import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  push,
  limitToLast,
  query,
  onChildAdded,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* =======================
   CONFIGURE FIREBASE HERE
   =======================
   Replace with your project's config object.
*/

const firebaseConfig = {
  apiKey: "AIzaSyDztUmlROJ1l_oLK0mD9XD_wvrxpVJY48I",
  authDomain: "finpro-sisben2---adi-saputra.firebaseapp.com",
  databaseURL: "https://finpro-sisben2---adi-saputra-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "finpro-sisben2---adi-saputra",
  storageBucket: "finpro-sisben2---adi-saputra.firebasestorage.app",
  messagingSenderId: "750065422170",
  appId: "1:750065422170:web:46e076147dc9319456ad63"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Paths
const ROOT = '/smart_home';
const ldrRef = ref(db, `${ROOT}/ldr`);
const pirRef = ref(db, `${ROOT}/pir`);
const lampRef = ref(db, `${ROOT}/lamp_state`);
const brightnessRef = ref(db, `${ROOT}/brightness`);
const modeRef = ref(db, `${ROOT}/mode`);
const historyRef = ref(db, `${ROOT}/history`);

// UI Elements
const connectionStatus = document.getElementById('connectionStatus');
const ldrLabel = document.getElementById('ldrLabel');
const ldrBar = document.getElementById('ldrBar');
const pirLabel = document.getElementById('pirLabel');
const lampLabel = document.getElementById('lampLabel');
const lampPreview = document.getElementById('lampPreview');
const modeToggle = document.getElementById('modeToggle');
const modeLabel = document.getElementById('modeLabel');
const btnOn = document.getElementById('btnOn');
const btnOff = document.getElementById('btnOff');
const brightness = document.getElementById('brightness');
const brValue = document.getElementById('brValue');

// Chart setup (simple)
const ctx = document.getElementById('ldrChart').getContext('2d');
const ldrChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'LDR',
      data: [],
      fill: true,
      tension: 0.25,
      radius: 2
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { display: false },
      y: { suggestedMin: 0, suggestedMax: 4095 }
    },
    plugins: { legend: { display: false } }
  }
});

// Helpers
function mapLdrToPct(raw) {
  const max = 4095; // typical 12-bit ADC
  const pct = Math.max(0, Math.min(100, Math.round((raw / max) * 100)));
  return pct;
}

function setConnection(online) {
  if (online) {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.remove('offline'); connectionStatus.classList.add('online');
  } else {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('online'); connectionStatus.classList.add('offline');
  }
}

/* =========================
   Realtime listeners (UI)
   ========================= */
onValue(ldrRef, (snap) => {
  const val = snap.exists() ? snap.val() : null;
  if (val === null) return;
  setConnection(true);
  ldrLabel.textContent = `${val} (raw) • ${mapLdrToPct(val)}%`;
  ldrBar.style.width = `${mapLdrToPct(val)}%`;

  // push to chart (keep last 60)
  const time = new Date().toLocaleTimeString();
  ldrChart.data.labels.push(time);
  ldrChart.data.datasets[0].data.push(val);
  if (ldrChart.data.labels.length > 60) {
    ldrChart.data.labels.shift();
    ldrChart.data.datasets[0].data.shift();
  }
  ldrChart.update();
}, (err) => {
  console.error('LDR listener error', err);
  setConnection(false);
});

onValue(pirRef, (snap) => {
  const val = snap.exists() ? snap.val() : null;
  if (val === null) return;
  pirLabel.textContent = val === 1 ? 'Motion Detected' : 'No Motion';
  pirLabel.style.color = val === 1 ? '#ef4444' : '#6b7280';
}, (err) => {
  console.error('PIR listener error', err);
});

onValue(lampRef, (snap) => {
  const val = snap.exists() ? snap.val() : null;
  if (val === null) return;
  lampLabel.textContent = String(val);
  lampPreview.style.boxShadow = val === 'ON'
    ? '0 8px 30px rgba(59,130,246,0.28), 0 0 40px rgba(59,130,246,0.14) inset'
    : '0 4px 18px rgba(16,42,67,0.04)';
}, (err) => {
  console.error('Lamp listener error', err);
});

onValue(brightnessRef, (snap) => {
  const val = snap.exists() ? snap.val() : null;
  if (val === null) return;
  brightness.value = val;
  brValue.textContent = val;
}, (err) => {
  console.error('Brightness listener error', err);
});

onValue(modeRef, (snap) => {
  const val = snap.exists() ? snap.val() : null;
  const mode = val || 'AUTO';
  modeLabel.textContent = mode;
  modeToggle.checked = (mode === 'MANUAL');
}, (err) => {
  console.error('Mode listener error', err);
});

/* =========================
   UI -> Firebase actions
   ========================= */
btnOn.addEventListener('click', () => {
  set(lampRef, 'ON');
  // optional: write history
  push(historyRef, { type: 'lamp', value: 'ON', ts: serverTimestamp() });
});

btnOff.addEventListener('click', () => {
  set(lampRef, 'OFF');
  push(historyRef, { type: 'lamp', value: 'OFF', ts: serverTimestamp() });
});

// Mode toggle
modeToggle.addEventListener('change', (e) => {
  const mode = e.target.checked ? 'MANUAL' : 'AUTO';
  set(modeRef, mode);
  push(historyRef, { type: 'mode', value: mode, ts: serverTimestamp() });
});

// Brightness slider with small debounce
let brTimeout = null;
brightness.addEventListener('input', (e) => {
  const v = parseInt(e.target.value);
  brValue.textContent = v;
  // debounce write
  if (brTimeout) clearTimeout(brTimeout);
  brTimeout = setTimeout(()=> {
    set(brightnessRef, v);
    push(historyRef, { type: 'brightness', value: v, ts: serverTimestamp() });
  }, 300);
});

/* =========================
   Optional: read recent history into chart
   ========================= */
const recentQuery = query(historyRef, limitToLast(60));
onChildAdded(recentQuery, (snap) => {
  const item = snap.val();
  if (!item) return;
  // If it's an LDR type entry, we could push to chart - but ESP32 should push LDR separately
  // This callback helps if your ESP32 also logs ldr into /history.
}, (err) => console.error('History error', err));

/* =========================
   Initialization: set defaults if not exists
   ========================= */
function setIfNotExists(pathRef, defaultValue) {
  onValue(pathRef, (snap) => {
    if (!snap.exists()) set(pathRef, defaultValue);
  }, { onlyOnce: true });
}
setIfNotExists(modeRef, 'AUTO');
setIfNotExists(lampRef, 'OFF');
setIfNotExists(brightnessRef, 180);

/* =========================
   Connectivity helper
   ========================= */
// We'll set a short liveness ping (optional)
setTimeout(()=>{
  setConnection(true);
}, 600);
