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
const selectedInfoEl = document.getElementById('selectedInfo');
const poiSearchEl = document.getElementById('poiSearch');

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

// ---------------- MODAL FUNCTIONS ----------------
function showModal(data) {
  modalTitle.textContent = data.title || '';
  modalImage.src = data.img || '';
  modalImage.alt = data.title || 'POI image';
  modalDesc.textContent = data.desc || '';
  poiModal.setAttribute('aria-hidden', 'false');
  poiModal._current = data;
  selectedInfoEl.textContent = data.title || '';
}

function hideModal() {
  poiModal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
  poiModal._current = null;
  selectedInfoEl.textContent = 'Select a POI or Zone to see details';
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

// ---------------- MAP INIT ----------------
function initMaps() {
  // Desktop
  activeMapDesktop = L.map('map-desktop', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3, zoomControl: true, attributionControl: false });
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
    // remove old markers
    poiMarkers.forEach(m => {
      markerClusterGroupDesktop.removeLayer(m.desktop);
      markerClusterGroupMobile.removeLayer(m.mobile);
    });
    poiMarkers = [];

    snapshot.forEach(doc => {
      const d = doc.data();
      const lat = Number(d.coords.x);
      const lng = Number(d.coords.y);
      if (isNaN(lat) || isNaN(lng)) return;

      const markerDesktop = L.marker([lat, lng]).on('click', () => showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img }));
      const markerMobile = L.marker([lat, lng]).on('click', () => showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img }));

      markerDesktop.addTo(activeMapDesktop);
      markerMobile.addTo(activeMapMobile);


      poiMarkers.push({ id: doc.id, desktop: markerDesktop, mobile: markerMobile, data: d });
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
      const polyDesktop = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 }).on('click', () => showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img }));
      const polyMobile = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 }).on('click', () => showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img }));

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
      <img class="thumb" src="${d.thumb || d.img || ''}" alt="${d.title || 'POI'} thumbnail">
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

    li.querySelector('[data-action="goto"]').addEventListener('click', () => {
      const markerObj = poiMarkers.find(m => m.id === doc.id);
      if (markerObj) {
        activeMapDesktop.setView(markerObj.desktop.getLatLng(), Math.max(activeMapDesktop.getZoom(), activeMapDesktop.getMinZoom()));
        activeMapMobile.setView(markerObj.mobile.getLatLng(), Math.max(activeMapMobile.getZoom(), activeMapMobile.getMinZoom()));
        showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img });
      }
    });

    li.querySelector('[data-action="share"]').addEventListener('click', () => {
      const hash = `#poi=${encodeURIComponent(doc.id)}`;
      navigator.clipboard.writeText(location.origin + location.pathname + hash);
    });

    li.addEventListener('click', () => {
      const markerObj = poiMarkers.find(m => m.id === doc.id);
      if (markerObj) {
        activeMapDesktop.setView(markerObj.desktop.getLatLng(), Math.max(activeMapDesktop.getZoom(), activeMapDesktop.getMinZoom()));
        activeMapMobile.setView(markerObj.mobile.getLatLng(), Math.max(activeMapMobile.getZoom(), activeMapMobile.getMinZoom()));
        showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img });
      }
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
      <img class="thumb" src="${d.thumb || d.img || ''}" alt="${d.title || 'Zone'} thumbnail">
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

    li.querySelector('[data-action="goto"]').addEventListener('click', () => {
      const polyObj = zonePolygons.find(z => z.id === doc.id);
      if (polyObj) {
        activeMapDesktop.fitBounds(polyObj.desktop.getBounds());
        activeMapMobile.fitBounds(polyObj.mobile.getBounds());
        showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img });
      }
    });

    li.querySelector('[data-action="share"]').addEventListener('click', () => {
      const hash = `#poi=${encodeURIComponent(doc.id)}`;
      navigator.clipboard.writeText(location.origin + location.pathname + hash);
    });

    li.addEventListener('click', () => {
      const polyObj = zonePolygons.find(z => z.id === doc.id);
      if (polyObj) {
        activeMapDesktop.fitBounds(polyObj.desktop.getBounds());
        activeMapMobile.fitBounds(polyObj.mobile.getBounds());
        showModal({ id: doc.id, title: d.title, desc: d.desc, img: d.img });
      }
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

// ---------------- INIT ----------------
window.addEventListener('DOMContentLoaded', () => {
  initMaps();
  startListeners();
});

const sidebarEl = document.getElementById('sidebar');
const listBtn = document.getElementById('openListBtn');

listBtn.addEventListener('click', () => {
  sidebarEl.classList.toggle('open');
});
// Close sidebar when clicking outside (mobile)
document.addEventListener('click', (e) => {
  if (!sidebarEl.contains(e.target) && !listBtn.contains(e.target)) {
    sidebarEl.classList.remove('open');
  }
});
