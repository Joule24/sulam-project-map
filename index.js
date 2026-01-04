// index.js (Firestore dynamic POIs & Zones - desktop + mobile)

// ---------------- FIREBASE SETUP ----------------
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { googleMapURL, IMG_W, IMG_H } from "./config.js";
import { firebaseInitializer, db } from "./helper/initializeFirebase.js";
import { tracking } from "./helper/gpsTracking.js";
import { setupAIAssistant } from "./AI_assistant.js";

// Static asset URLs (no bundler on Vercel)
const bwmMapImg = "assets/bwm_map3.jpg";
const youIconImg = "assets/you_icon.jpg";

firebaseInitializer();

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
const bounds = [[0, 0], [IMG_H, IMG_W]];

// Exported so helper modules (e.g. tracking) can receive references if needed
export let activeMapDesktop = null;
export let activeMapMobile = null;
let markerClusterGroupDesktop = null;
let markerClusterGroupMobile = null;
let poiMarkers = []; // { id, desktop, mobile }
let zonePolygons = []; // { id, desktop, mobile }

// ---------------- USER TRACKING ----------------
const youIcon = L.icon({
  iconUrl: youIconImg,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

let youMarkerDesktop = null;
let youMarkerMobile = null;




// ---------------- RECOMMENDATION LOGIC ----------------
function distance(a, b) {
  const dy = a[0] - b[0];
  const dx = a[1] - b[1];
  return Math.sqrt(dy * dy + dx * dx);
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
      const fullData = findFullDataById(item.id, item.type);
      if (!fullData) return;

      activeMapDesktop.setView(
        [fullData.coords[0], fullData.coords[1]],
        Math.max(activeMapDesktop.getZoom(), activeMapDesktop.getMinZoom())
      );

      activeMapMobile.setView(
        [fullData.coords[0], fullData.coords[1]],
        Math.max(activeMapMobile.getZoom(), activeMapMobile.getMinZoom())
      );

      showModal(fullData);
    });

    recommendationList.appendChild(li);
  });

  recommendationBox.classList.remove('hidden');
}

function findFullDataById(id, type) {
  if (type === 'poi') {
    const p = poiMarkers.find(p => p.id === id);
    if (!p) return null;

    const latlng = p.desktop.getLatLng();

    return {
      id: p.id,
      title: p.data.title,
      desc: p.data.desc,
      images: p.data.images || null,
      thumb: p.data.thumb || null,
      ...p.data,
      coords: [latlng.lat, latlng.lng]
    };
  }

  if (type === 'zone') {
    const z = zonePolygons.find(z => z.id === id);
    if (!z) return null;

    const center = z.desktop.getBounds().getCenter();

    return {
      id: z.id,
      title: z.data.title,
      desc: z.data.desc,
      images: z.data.images || null,
      thumb: z.data.thumb || null,
      ...z.data,
      coords: [center.lat, center.lng]
    };
  }

  return null;
}

// ---------------- MODAL FUNCTIONS ----------------
export const showModal = function showModal(data) {
  // Normalize coords: always {lat, lng} (these are pixel coordinates for map display)
  let coords = data.coords;
  if (Array.isArray(coords)) {
    coords = { lat: coords[0], lng: coords[1] };
  }

  // Update modal content
  modalTitle.textContent = data.title || '';
  const images = normalizeImages({
    ...data,
    images: data.images ?? data.data?.images
  });

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
  poiModal._current = { ...data, coords, realWorldCoords: data.realWorldCoords };
  selectedInfoEl.textContent = data.title || '';

  // Center maps (use pixel coordinates)
  activeMapDesktop.setView([coords.lat, coords.lng], Math.max(activeMapDesktop.getZoom(), activeMapDesktop.getMinZoom()));
  activeMapMobile.setView([coords.lat, coords.lng], Math.max(activeMapMobile.getZoom(), activeMapMobile.getMinZoom()));

  // Show fresh recommendations (use pixel coordinates for distance calculation)
  showRecommendations(coords, data.id);

  // Reset AI I/O
  const aiAnswerEl = document.getElementById("aiAnswer");
  const aiQuestionEl = document.getElementById("aiQuestion");
  if (aiAnswerEl) aiAnswerEl.textContent = "";
  if (aiQuestionEl) aiQuestionEl.value = "";
}

// Helper function to get coordinates for Google Maps (real-world if available, else pixel)
function getGoogleMapsCoords(data) {
  if (data.realWorldCoords?.lat != null && data.realWorldCoords?.lng != null) {
    return { lat: data.realWorldCoords.lat, lng: data.realWorldCoords.lng };
  }
  // Fallback to pixel coordinates
  let coords = data.coords;
  if (Array.isArray(coords)) {
    coords = { lat: coords[0], lng: coords[1] };
  }
  return coords;
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
  if (!poiModal._current) return;
  const coords = getGoogleMapsCoords(poiModal._current);
  if (!coords || coords.lat == null || coords.lng == null) return;
  const googleMapsUrl = `${googleMapURL}${coords.lat},${coords.lng}`;
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
  L.imageOverlay(bwmMapImg, bounds).addTo(activeMapDesktop);
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
  L.imageOverlay(bwmMapImg, bounds).addTo(activeMapMobile);
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

      const modalData = {
        id: doc.id,
        title: d.title,
        desc: d.desc,
        images: d.images || null,
        coords: [lat, lng],
        realWorldCoords: d.realWorldCoords || null
      };

      const markerDesktop = L.marker([lat, lng])
        .on('click', () => showModal(modalData));


      const markerMobile = L.marker([lat, lng])
        .on('click', () => showModal(modalData));


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
      const tempPoly = L.polygon(coords);
      const center = tempPoly.getBounds().getCenter();
      const modalData = {
        id: doc.id,
        title: d.title,
        desc: d.desc,
        images: d.images || null,
        coords: [center.lat, center.lng],
        realWorldCoords: d.realWorldCoords || null
      };
      const polyDesktop = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 }).on('click', () => {
        showModal(modalData);
      });

      const polyMobile = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 }).on('click', () => {
        showModal(modalData);
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
      <img class="thumb" src="${getThumbnail(d)}" alt="${d.title || 'POI'} thumbnail">
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
        images: d.images || null,
        coords: [latlngDesktop.lat, latlngDesktop.lng],
        realWorldCoords: d.realWorldCoords || null
      });
    });

    // SHARE button - copy Google Maps URL for this POI
    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const markerObj = poiMarkers.find(m => m.id === doc.id);
      if (!markerObj) return;
      const coords = getGoogleMapsCoords({ coords: markerObj.desktop.getLatLng(), realWorldCoords: markerObj.data.realWorldCoords });
      const googleMapsUrl = `${googleMapURL}${coords.lat},${coords.lng}`;
      navigator.clipboard.writeText(googleMapsUrl);
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
        images: d.images || null,
        coords: [latlngDesktop.lat, latlngDesktop.lng],
        realWorldCoords: d.realWorldCoords || null
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
      <img class="thumb" src="${getThumbnail(d)}" alt="${d.title || 'Zone'} thumbnail">
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
        images: d.images || null,
        coords: [center.lat, center.lng],
        realWorldCoords: d.realWorldCoords || null
      });
    });

    // SHARE button - copy Google Maps URL for this Zone (center point)
    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const polyObj = zonePolygons.find(z => z.id === doc.id);
      if (!polyObj) return;
      const center = polyObj.desktop.getBounds().getCenter();
      const coords = getGoogleMapsCoords({ coords: center, realWorldCoords: polyObj.data.realWorldCoords });
      const googleMapsUrl = `${googleMapURL}${coords.lat},${coords.lng}`;
      navigator.clipboard.writeText(googleMapsUrl);
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
        images: d.images || null,
        coords: [center.lat, center.lng],
        realWorldCoords: d.realWorldCoords || null
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
// function trackUser() {
//   if (!navigator.geolocation) {
//     alert("Geolocation is not supported by your browser");
//     return;
//   }

//   navigator.geolocation.watchPosition((position) => {
//     const lat = position.coords.latitude;
//     const lng = position.coords.longitude;

//     const coords = latLngToPixel(lat, lng); // convert GPS → map pixel

//     // Desktop
//     if (youMarkerDesktop) {
//       youMarkerDesktop.setLatLng(coords);
//     } else {
//       youMarkerDesktop = L.marker(coords, { icon: youIcon }).addTo(activeMapDesktop);
//     }

//     // Mobile
//     if (youMarkerMobile) {
//       youMarkerMobile.setLatLng(coords);
//     } else {
//       youMarkerMobile = L.marker(coords, { icon: youIcon }).addTo(activeMapMobile);
//     }

//   }, (err) => {
//     console.error("GPS error:", err);
//   }, {
//     enableHighAccuracy: true,
//     maximumAge: 1000
//   });
// }

// ---------------- INIT ----------------
window.addEventListener('DOMContentLoaded', () => {
  initMaps();
  startListeners();

  // start real-time GPS tracking (pass map instances explicitly)
  tracking(activeMapDesktop, activeMapMobile);

  // wire AI assistant (uses current modal selection)
  setupAIAssistant(() => poiModal._current);

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
    sessionStorage.setItem("introSeen", "true");
  }

  closeIntroBtn.addEventListener('click', closeIntro);
  gotItBtn.addEventListener('click', closeIntro);
  // show only once per session
  if (!sessionStorage.getItem("introSeen")) {
    introPopup.style.display = "flex";
  } else {
    introPopup.style.display = "none";
  }
  document.getElementById("infoBtn").addEventListener("click", () => {
    document.getElementById("mapIntroPopup").style.display = "flex";
  });
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