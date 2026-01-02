// index.js (Firestore dynamic POIs & Zones - desktop + mobile)

// ---------------- FIREBASE SETUP ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA093rrUBlUG4tDnGUdyql0-c7m-E2DDHw",
  authDomain: "sulam-project-map.firebaseapp.com",
  projectId: "sulam-project-map",
  storageBucket: "sulam-project-map.firebasestorage.app",
  messagingSenderId: "402597128748",
  appId: "1:402597128748:web:f73f4b44e44fcb55bfff89",
  measurementId: "G-SDHPJ5G431"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------- UI REFERENCES ----------------
const markerListEl = document.getElementById('markerList');
const zoneListEl = document.getElementById('zoneList');
const poiModal = document.getElementById('poiModal');
const modalTitle = document.getElementById('modalTitle');
const modalImage = document.getElementById('modalImage');
const modalDesc = document.getElementById('modalDesc');
const closeModalBtn = document.getElementById('closeModal');
const modalShareBtn = document.getElementById('modalShare');
const modalDirectionsBtn = document.getElementById('modalDirections');
const selectedInfoEl = document.getElementById('selectedInfo');
const poiSearchEl = document.getElementById('poiSearch');
const imageLabelEl = document.getElementById('imageLabel');
const showNowBtn = document.getElementById('showNowBtn');
const showThenBtn = document.getElementById('showThenBtn');

// ---------------- RECOMMENDATION UI ----------------
const recommendationBox = document.getElementById('recommendationBox');
const recommendationList = document.getElementById('recommendationList');

// ---------------- MAP CONFIG ----------------
const IMAGE_FILENAME = "bwm_map3.jpg";
const IMG_W = 1530;
const IMG_H = 1050;
const bounds = [[0, 0], [IMG_H, IMG_W]];

let activeMapDesktop = null;
let activeMapMobile = null;
let markerClusterGroupDesktop = null;
let markerClusterGroupMobile = null;
let poiMarkers = []; // { id, desktop, mobile }
let zonePolygons = []; // { id, desktop, mobile }

// ---------------- USER TRACKING ----------------
const youIcon = L.icon({
  iconUrl: 'you_icon.jpg',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

let youMarkerDesktop = null;
let youMarkerMobile = null;

const mapBoundsGPS = {
  topLeft: { lat: 2.9817734396960933, lng: 101.5108517014077 },   // adjust to your actual map latitude
  bottomRight: { lat: 2.981656921540031, lng: 101.51112863952406 }    // adjust to your actual map longitude
};

function latLngToPixel(lat, lng) {
  const { topLeft, bottomRight } = mapBoundsGPS;

  // Latitude → Y (top-left is 0)
  const y = ((lat - bottomRight.lat) / (topLeft.lat - bottomRight.lat)) * IMG_H;

  // Longitude → X (left is 0)
  const x = ((lng - topLeft.lng) / (bottomRight.lng - topLeft.lng)) * IMG_W;

  return [y, x];
}

// ---------------- RECOMMENDATION LOGIC ----------------
function distance(a, b) {
  const dy = a[0] - b[0];
  const dx = a[1] - b[1];
  return Math.sqrt(dy * dy + dx * dx);
}

function getAllPlaces() {
  const pois = poiMarkers.map(p => ({
    id: p.id,
    title: p.data.title,
    coords: p.desktop.getLatLng(),
    type: 'poi'
  }));

  const zones = zonePolygons.map(z => {
    const center = z.desktop.getBounds().getCenter();
    return {
      id: z.id,
      title: z.data.title,
      coords: center,
      type: 'zone'
    };
  });

  return [...pois, ...zones];
}

function showRecommendations(originCoords, excludeId) {
  if (!originCoords) {
    recommendationBox.classList.add('hidden');
    return;
  }

  // 1. Recompute all places fresh
  const allPlaces = [
    ...poiMarkers.map(p => ({
      id: p.id,
      title: p.data.title,
      desc: p.data.desc,
      img: getThumbnail(p.data),
      coords: {
        lat: p.desktop.getLatLng().lat,
        lng: p.desktop.getLatLng().lng
      },
      type: 'poi'
    })),
    ...zonePolygons.map(z => {
      const center = z.desktop.getBounds().getCenter();
      return {
        id: z.id,
        title: z.data.title,
        desc: z.data.desc,
        img: getThumbnail(z.data),
        coords: {
          lat: center.lat,
          lng: center.lng
        },
        type: 'zone'
      };
    })
  ];

  const ranked = allPlaces
    .filter(p => p.id !== excludeId)
    .map(p => ({
      ...p,
      dist: distance(
        [originCoords.lat, originCoords.lng],
        [p.coords.lat, p.coords.lng]
      )
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  if (!ranked.length) {
    recommendationBox.classList.add('hidden');
    return;
  }

  // 2. Build fresh list
  recommendationList.innerHTML = '';
  ranked.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="rec-thumb-wrapper">
        <img src="${item.img}" alt="${item.title}" class="rec-thumb">
      </div>
      <div class="rec-title-text">${item.title}</div>
    `;

    // 3. Each click uses fresh item object
    li.addEventListener('click', () => {
      activeMapDesktop.setView([item.coords.lat, item.coords.lng], Math.max(activeMapDesktop.getZoom(), activeMapDesktop.getMinZoom()));
      activeMapMobile.setView([item.coords.lat, item.coords.lng], Math.max(activeMapMobile.getZoom(), activeMapMobile.getMinZoom()));
      showModal(item); // triggers new recommendations
    });

    recommendationList.appendChild(li);
  });

  recommendationBox.classList.remove('hidden');
}

// ---------------- MODAL FUNCTIONS ----------------
function showModal(data) {
  // Normalize coords: always {lat, lng}
  let coords = data.coords;
  if (Array.isArray(coords)) {
    coords = { lat: coords[0], lng: coords[1] };
  }

  // Update modal content
  modalTitle.textContent = data.title || '';
  const images = normalizeImages(data);

  // Default to NOW
  if (images.now) {
    modalImage.src = images.now.url;
    imageLabelEl.textContent = images.now.label || 'NOW';
  } else {
    modalImage.src = 'placeholder.jpg';
    imageLabelEl.textContent = '';
  }

  // Button states
  showNowBtn.classList.add('active');
  showThenBtn.classList.remove('active');

  // Toggle handlers
  showNowBtn.onclick = () => {
    if (!images.now) return;
    modalImage.src = images.now.url;
    imageLabelEl.textContent = images.now.label || 'NOW';
    showNowBtn.classList.add('active');
    showThenBtn.classList.remove('active');
  };

  showThenBtn.onclick = () => {
    if (!images.then) return;
    modalImage.src = images.then.url;
    imageLabelEl.textContent = images.then.label || 'THEN';
    showThenBtn.classList.add('active');
    showNowBtn.classList.remove('active');
  };
  modalDesc.textContent = data.desc || '';
  poiModal.setAttribute('aria-hidden', 'false');
  poiModal._current = { ...data, coords };
  selectedInfoEl.textContent = data.title || '';

  // Center maps
  activeMapDesktop.setView([coords.lat, coords.lng], Math.max(activeMapDesktop.getZoom(), activeMapDesktop.getMinZoom()));
  activeMapMobile.setView([coords.lat, coords.lng], Math.max(activeMapMobile.getZoom(), activeMapMobile.getMinZoom()));

  // Show fresh recommendations
  showRecommendations(coords, data.id);

  // Reset AI I/O
  const aiAnswerEl = document.getElementById("aiAnswer");
  const aiQuestionEl = document.getElementById("aiQuestion");
  if (aiAnswerEl) aiAnswerEl.textContent = "";
  if (aiQuestionEl) aiQuestionEl.value = "";
}

function hideModal() {
  poiModal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
  poiModal._current = null;
  selectedInfoEl.textContent = 'Select a POI or Zone to see details';
  recommendationBox.classList.add('hidden');
}

closeModalBtn.addEventListener('click', hideModal);
poiModal.addEventListener('click', (e) => { if (e.target === poiModal) hideModal(); });

modalShareBtn.addEventListener('click', () => {
  if (!poiModal._current) return;
  const id = poiModal._current.id || poiModal._current.title;
  const hash = `#poi=${encodeURIComponent(id)}`;
  const url = location.origin + location.pathname + hash;
  navigator.clipboard.writeText(url).then(() => {
    modalShareBtn.textContent = 'Link copied';
    setTimeout(() => modalShareBtn.textContent = 'Copy link', 1400);
  });
});

modalDirectionsBtn.addEventListener('click', () => {
  if (!poiModal._current || !poiModal._current.coords) return;
  const { lat, lng } = poiModal._current.coords;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(googleMapsUrl, '_blank');
});

function normalizeImages(data) {
  // New structure
  if (data.images?.now || data.images?.then) {
    return {
      now: data.images?.now || null,
      then: data.images?.then || null
    };
  }

  // Legacy fallback
  if (data.img) {
    return {
      now: { url: data.img, label: 'Now' },
      then: null
    };
  }

  return { now: null, then: null };
}

function getThumbnail(data) {
  // Prefer explicit thumbnail
  if (data.thumb) return data.thumb;

  // Prefer NOW image if exists
  if (data.images?.now?.url) return data.images.now.url;

  // Legacy fallback
  if (data.img) return data.img;

  return 'placeholder.jpg';
}

// ---------------- MAP INIT ----------------
function initMaps() {
  // Desktop
  activeMapDesktop = L.map('map-desktop', { crs: L.CRS.Simple, minZoom: -1, maxZoom: 3, zoomControl: true, attributionControl: false, maxBounds: bounds, maxBoundsViscosity: 0.8 });
  L.imageOverlay(IMAGE_FILENAME, bounds).addTo(activeMapDesktop);
  activeMapDesktop.fitBounds(bounds);
  markerClusterGroupDesktop = L.markerClusterGroup();
  activeMapDesktop.addLayer(markerClusterGroupDesktop);

  // Mobile
  activeMapMobile = L.map('map-mobile', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 3,
    zoomControl: true,
    attributionControl: false,
    maxBounds: bounds,        // <-- restrict map to image bounds
    maxBoundsViscosity: 0.8   // <-- smooth bounce-back effect
  });
  L.imageOverlay(IMAGE_FILENAME, bounds).addTo(activeMapMobile);
  activeMapMobile.fitBounds(bounds);
  markerClusterGroupMobile = L.markerClusterGroup();
  activeMapMobile.addLayer(markerClusterGroupMobile);
}

// ---------------- FIRESTORE LISTENERS ----------------
const poisCol = collection(db, 'pois');
const zonesCol = collection(db, 'zones');

function startListeners() {
  // POIs
  onSnapshot(poisCol, snapshot => {
    // Remove old markers directly from maps
    poiMarkers.forEach(m => {
      activeMapDesktop.removeLayer(m.desktop);
      activeMapMobile.removeLayer(m.mobile);
    });
    poiMarkers = [];

    snapshot.forEach(doc => {
      const d = doc.data();
      const lat = Number(d.coords?.x);
      const lng = Number(d.coords?.y);
      if (isNaN(lat) || isNaN(lng)) return;

      const markerDesktop = L.marker([lat, lng])
        .on('click', () => showModal({
          id: doc.id,
          title: d.title,
          desc: d.desc,
          ...d,
          coords: [lat, lng]
        }));


      const markerMobile = L.marker([lat, lng])
        .on('click', () => showModal({
          id: doc.id,
          title: d.title,
          desc: d.desc,
          ...d,
          coords: [lat, lng]
        }));


      // Add markers straight to maps (NO CLUSTERING)
      markerDesktop.addTo(activeMapDesktop);
      markerMobile.addTo(activeMapMobile);

      poiMarkers.push({
        id: doc.id,
        desktop: markerDesktop,
        mobile: markerMobile,
        data: d
      });
    });

    populatePOIsSidebar(snapshot.docs);
  });


  // Zones
  onSnapshot(zonesCol, snapshot => {
    // remove old polygons
    zonePolygons.forEach(z => {
      activeMapDesktop.removeLayer(z.desktop);
      activeMapMobile.removeLayer(z.mobile);
    });
    zonePolygons = [];

    snapshot.forEach(doc => {
      const d = doc.data();
      const coords = d.coordinates.map(c => [c.x, c.y]); // Leaflet uses [lat, lng] = [y, x]
      const polyDesktop = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 }).on('click', () => {
        const center = polyDesktop.getBounds().getCenter();
        showModal({
          id: doc.id,
          title: d.title,
          desc: d.desc,
          ...d,
          coords: [center.lat, center.lng]
        });
      });

      const polyMobile = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 }).on('click', () => {
        const center = polyDesktop.getBounds().getCenter();
        showModal({
          id: doc.id,
          title: d.title,
          desc: d.desc,
          ...d,
          coords: [center.lat, center.lng]
        });
      });


      polyDesktop.addTo(activeMapDesktop);
      polyMobile.addTo(activeMapMobile);

      zonePolygons.push({ id: doc.id, desktop: polyDesktop, mobile: polyMobile, data: d });
    });

    populateZonesSidebar(snapshot.docs);
  });
}

// ---------------- SIDEBAR ----------------
function populatePOIsSidebar(docs) {
  markerListEl.innerHTML = '';
  docs.forEach(doc => {
    const d = doc.data();
    const li = document.createElement('li');
    li.dataset.id = doc.id;
    li.innerHTML = `
      <img class="thumb"
     src="${getThumbnail(d)}"
     alt="${d.title || 'POI'} thumbnail">
      <div class="item-text">
        <div class="title">${d.title}</div>
        <div class="meta">POI</div>
      </div>
      <div class="list-actions">
        <button class="btn small" data-action="goto">Go</button>
        <button class="btn small secondary" data-action="share">Share</button>
      </div>
    `;
    markerListEl.appendChild(li);

    const markerObj = poiMarkers.find(m => m.id === doc.id);
    if (!markerObj) return;

    // GO button
    li.querySelector('[data-action="goto"]').addEventListener('click', () => {
      const markerObj = poiMarkers.find(m => m.id === doc.id);
      if (!markerObj) return;

      const latlngDesktop = markerObj.desktop.getLatLng();
      const latlngMobile = markerObj.mobile.getLatLng();

      // Fit bounds with padding and maxZoom to prevent over-zoom
      activeMapDesktop.fitBounds([latlngDesktop], { padding: [80, 80], maxZoom: 1 });
      activeMapMobile.fitBounds([latlngMobile], { padding: [80, 80], maxZoom: 1 });

      showModal({
        id: doc.id,
        title: d.title,
        desc: d.desc,
        ...d,
        coords: [latlngDesktop.lat, latlngDesktop.lng]
      });
    });

    // SHARE button
    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const hash = `#poi=${encodeURIComponent(doc.id)}`;
      navigator.clipboard.writeText(location.origin + location.pathname + hash);
    });

    // Click anywhere on the list item
    li.addEventListener('click', () => {
      const markerObj = poiMarkers.find(m => m.id === doc.id);
      if (!markerObj) return;

      const latlngDesktop = markerObj.desktop.getLatLng();
      const latlngMobile = markerObj.mobile.getLatLng();

      activeMapDesktop.fitBounds([latlngDesktop], { padding: [80, 80], maxZoom: 1 });
      activeMapMobile.fitBounds([latlngMobile], { padding: [80, 80], maxZoom: 1 });

      showModal({
        id: doc.id,
        title: d.title,
        desc: d.desc,
        ...d,
        coords: [latlngDesktop.lat, latlngDesktop.lng]
      });
    });
  });
}

function populateZonesSidebar(docs) {
  zoneListEl.innerHTML = '';

  docs.forEach(doc => {
    const d = doc.data();
    const li = document.createElement('li');
    li.dataset.id = doc.id;

    li.innerHTML = `
      <img class="thumb"
     src="${getThumbnail(d)}"
     alt="${d.title || 'Zone'} thumbnail">
      <div class="item-text">
        <div class="title">${d.title}</div>
        <div class="meta">Zone</div>
      </div>
      <div class="list-actions">
        <button class="btn small" data-action="goto">Go</button>
        <button class="btn small secondary" data-action="share">Share</button>
      </div>
    `;

    zoneListEl.appendChild(li);

    // GO button
    li.querySelector('[data-action="goto"]').addEventListener('click', () => {
      const polyObj = zonePolygons.find(z => z.id === doc.id);
      if (!polyObj) return;

      const center = polyObj.desktop.getBounds().getCenter();

      activeMapDesktop.fitBounds(polyObj.desktop.getBounds());
      activeMapMobile.fitBounds(polyObj.mobile.getBounds());

      showModal({
        id: doc.id,
        title: d.title,
        desc: d.desc,
        ...d,
        coords: [center.lat, center.lng]
      });
    });

    // SHARE button
    li.querySelector('[data-action="share"]').addEventListener('click', () => {
      const hash = `#poi=${encodeURIComponent(doc.id)}`;
      navigator.clipboard.writeText(location.origin + location.pathname + hash);
    });

    // Click anywhere on the list item
    li.addEventListener('click', () => {
      const polyObj = zonePolygons.find(z => z.id === doc.id);
      if (!polyObj) return;

      const center = polyObj.desktop.getBounds().getCenter();

      activeMapDesktop.fitBounds(polyObj.desktop.getBounds());
      activeMapMobile.fitBounds(polyObj.mobile.getBounds());

      showModal({
        id: doc.id,
        title: d.title,
        desc: d.desc,
        ...d,
        coords: [center.lat, center.lng]
      });
    });
  });
}

// ---------------- SEARCH ----------------
poiSearchEl.addEventListener('input', () => {
  const q = poiSearchEl.value.trim().toLowerCase();

  Array.from(markerListEl.children).forEach(li => {
    const title = li.querySelector('.title').textContent.toLowerCase();
    li.style.display = title.includes(q) ? '' : 'none';
  });
  Array.from(zoneListEl.children).forEach(li => {
    const title = li.querySelector('.title').textContent.toLowerCase();
    li.style.display = title.includes(q) ? '' : 'none';
  });
});

// ---------------- GPS TRACKING ----------------
function trackUser() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  navigator.geolocation.watchPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    const coords = latLngToPixel(lat, lng); // convert GPS → map pixel

    // Desktop
    if (youMarkerDesktop) {
      youMarkerDesktop.setLatLng(coords);
    } else {
      youMarkerDesktop = L.marker(coords, { icon: youIcon }).addTo(activeMapDesktop);
    }

    // Mobile
    if (youMarkerMobile) {
      youMarkerMobile.setLatLng(coords);
    } else {
      youMarkerMobile = L.marker(coords, { icon: youIcon }).addTo(activeMapMobile);
    }

  }, (err) => {
    console.error("GPS error:", err);
  }, {
    enableHighAccuracy: true,
    maximumAge: 1000
  });
}

// ---------------- INIT ----------------
window.addEventListener('DOMContentLoaded', () => {
  initMaps();
  startListeners();

  trackUser(); // <-- start real-time GPS tracking

  const fitAllBtnTop = document.getElementById('fitAllBtnTop');
  fitAllBtnTop.addEventListener('click', () => {
    activeMapDesktop.fitBounds([[0, 0], [IMG_H, IMG_W]]);
    activeMapMobile.fitBounds([[0, 0], [IMG_H, IMG_W]]);
  });

  const fitAllBtnSidebar = document.getElementById('fitAllBtn');
  fitAllBtnSidebar.addEventListener('click', () => {
    activeMapDesktop.fitBounds([[0, 0], [IMG_H, IMG_W]]);
    activeMapMobile.fitBounds([[0, 0], [IMG_H, IMG_W]]);
  });

  const copyMapLinkBtn = document.getElementById('copyMapLink');
  copyMapLinkBtn.addEventListener('click', () => {
    const url = location.origin + location.pathname;
    navigator.clipboard.writeText(url).then(() => {
      copyMapLinkBtn.textContent = 'Link copied';
      setTimeout(() => {
        copyMapLinkBtn.textContent = 'Copy map link';
      }, 1400);
    });
  });

  // Intro popup logic
  const introPopup = document.getElementById('mapIntroPopup');
  const closeIntroBtn = document.getElementById('closeIntroPopup');
  const gotItBtn = document.getElementById('gotItBtn');

  function closeIntro() {
    introPopup.style.display = 'none';
  }

  closeIntroBtn.addEventListener('click', closeIntro);
  gotItBtn.addEventListener('click', closeIntro);
});

const sidebarEl = document.getElementById('sidebar');

const adminBtn = document.getElementById('adminBtn');
adminBtn.addEventListener('click', () => {
  window.location.href = 'login.html';
});

// Sidebar toggle helpers (mobile uses .open, desktop uses .hidden)
function isMobileWidth() {
  return window.matchMedia('(max-width:900px)').matches;
}

function openSidebarForMobile() {
  sidebarEl.classList.add('open');
  sidebarEl.classList.remove('hidden');
  setTimeout(() => { activeMapDesktop && activeMapDesktop.invalidateSize(); activeMapMobile && activeMapMobile.invalidateSize(); }, 260);
}
function closeSidebarForMobile() {
  sidebarEl.classList.remove('open');
  // keep hidden class handled by CSS for desktop
  setTimeout(() => { activeMapDesktop && activeMapDesktop.invalidateSize(); activeMapMobile && activeMapMobile.invalidateSize(); }, 260);
}
function toggleSidebar() {
  if (isMobileWidth()) {
    // mobile: toggle open/closed
    if (sidebarEl.classList.contains('open')) closeSidebarForMobile(); else openSidebarForMobile();
  } else {
    // desktop: toggle hidden/visible
    sidebarEl.classList.toggle('hidden');
    // ensure .open isn't stuck
    sidebarEl.classList.remove('open');
    setTimeout(() => { activeMapDesktop && activeMapDesktop.invalidateSize(); activeMapMobile && activeMapMobile.invalidateSize(); }, 260);
  }
}

// Hook existing elements (safe no-op if element missing)
const toggleDesktopBtn = document.getElementById('toggleSidebarBtn');
const openListBtnEl = document.getElementById('openListBtn');
const closeSidebarBtnEl = document.getElementById('closeSidebarBtn');

// wire desktop toggle button
if (toggleDesktopBtn) toggleDesktopBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar(); });

// wire the floating mobile button (already existed) — reuse same toggle
if (openListBtnEl) openListBtnEl.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar(); });

// make the X (close) button close in both modes
if (closeSidebarBtnEl) closeSidebarBtnEl.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isMobileWidth()) closeSidebarForMobile();
  else sidebarEl.classList.add('hidden');
});

// Close sidebar when clicking outside (only collapse mobile; desktop remains)
document.addEventListener('click', (e) => {
  if (!sidebarEl.contains(e.target) && !openListBtnEl?.contains(e.target) && !toggleDesktopBtn?.contains(e.target)) {
    if (isMobileWidth()) closeSidebarForMobile();
  }
});

// Keep layout consistent when resizing: if resize from mobile->desktop, ensure classes set correctly
window.addEventListener('resize', () => {
  if (!isMobileWidth()) {
    // ensure mobile open state is removed when switching to desktop
    sidebarEl.classList.remove('open');
  }
});

// ---------------- AI ASSISTANT (OpenRouter) ----------------
const OPENROUTER_API_KEY = "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";

async function fetchWikipediaSummary(title) {
  // Hybrid AI using simple Wikipedia REST API for web data
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.extract || null;
  } catch (e) {
    return null;
  }
}

//AI models used sequentially (fallback if one fails)
const MODELS = [
  "mistralai/devstral-2512:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "xiaomi/mimo-v2-flash:free",
  "z-ai/glm-4.5-air:free"
];

async function askAIDestination(question) {
  const current = poiModal._current;
  if (!current) return "Please select a POI or Zone first.";

  const { title, desc, coords } = current;
  const lat = coords?.lat;
  const lng = coords?.lng;

  // Fetch web data
  const wikiSummary = (await fetchWikipediaSummary(title))?.slice(0, 800);

  // Prepare webResults text
  const webResults = wikiSummary
    ? `Wikipedia summary:\n${wikiSummary}`
    : "No external data found.";

  for (const model of MODELS) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "KUL City Walk AI Assistant"
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: `
You are a helpful travel assistant.
Use the provided place information first.
If it is insufficient, use general world knowledge.
If external data is included, treat it as factual.
Keep answers concise and visitor-friendly.
Do not mention any coordinates or technical details.
`
              },
              {
                role: "user",
                content: `
Place name: ${title}

Description from map database:
${desc || "No description available."}

Coordinates:
Latitude: ${lat ?? "Unknown"}
Longitude: ${lng ?? "Unknown"}

External search results:
${webResults}

Question:
${question}
`
              }
            ],
            max_tokens: 150
          })
        }
      );

      const data = await response.json();

      if (data.error) {
        console.warn(`Model failed: ${model}`, data.error.message);
        continue; // try next model
      }

      const content = data.choices?.[0]?.message?.content;
      if (content && content.trim()) return content;

      console.warn(`Empty response from model: ${model}`);
      continue;
    } catch (err) {
      console.warn(`Request failed for model: ${model}`, err);
    }
  }
  return "⚠️ AI is temporarily unavailable due to free model limits. Please try again in a moment.";
}

//js hook to wire AI Assistant button
const aiAskBtn = document.getElementById("aiAskBtn");
const aiAnswerEl = document.getElementById("aiAnswer");
const aiQuestionEl = document.getElementById("aiQuestion");

if (aiAskBtn) {
  aiAskBtn.addEventListener("click", async () => {
    const q = aiQuestionEl.value.trim();
    if (!q) return;

    // dot animation when generating response
    let dots = 0;
    aiAnswerEl.textContent = "🤖 Thinking";
    const interval = setInterval(() => {
      aiAnswerEl.textContent = "🤖 Thinking" + ".".repeat(dots % 4);
      dots++;
    }, 500);

    try {
      const answer = await askAIDestination(q);
      clearInterval(interval);
      aiAnswerEl.textContent = answer;
    } catch (err) {
      clearInterval(interval);
      aiAnswerEl.textContent = "⚠️ Failed to get response.";
      console.error(err);
    }
  });

  // Optional: submit on Enter key
  aiQuestionEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") aiAskBtn.click();
  });
}
