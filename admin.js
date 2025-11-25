// index.js (module) — Firestore-backed map (real-time)
//
// Note: ensure your index.html includes Leaflet and MarkerCluster scripts
// before page load (they can be at end of body). This module waits for
// Leaflet to be present before creating the map.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ------------------ Firebase init ------------------
const firebaseConfig = {
  apiKey: "AIzaSyA093rrUBlUG4tDnGUdyql0-c7m-E2DDHw",
  authDomain: "sulam-project-map.firebaseapp.com",
  projectId: "sulam-project-map",
  storageBucket: "sulam-project-map.appspot.com",
  messagingSenderId: "402597128748",
  appId: "1:402597128748:web:f73f4b44e44fcb55bfff89",
  measurementId: "G-SDHPJ5G431"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------------ Utility: wait for Leaflet ------------------
async function waitForLeaflet(timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      if (window.L && typeof window.L.map === 'function') return resolve();
      if (Date.now() - start > timeout) return reject(new Error('Leaflet not found'));
      setTimeout(check, 50);
    })();
  });
}

// ------------------ UI refs ------------------
const selectedInfoEl = document.getElementById('selectedInfo');
const fitAllBtnTop = document.getElementById('fitAllBtnTop');
const markerListEl = document.getElementById('markerList');
const zoneListEl = document.getElementById('zoneList');
const poiSearchEl = document.getElementById('poiSearch');
const poiModal = document.getElementById('poiModal');
const modalTitle = document.getElementById('modalTitle');
const modalImage = document.getElementById('modalImage');
const modalDesc = document.getElementById('modalDesc');
const closeModalBtn = document.getElementById('closeModal');
const modalShareBtn = document.getElementById('modalShare');
const fitAllBtn = document.getElementById('fitAllBtn');
const copyMapLinkBtn = document.getElementById('copyMapLink');
const openListBtn = document.getElementById('openListBtn');
const sidebarEl = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const adminBtn = document.getElementById('adminBtn');

// ------------------ Map config ------------------
const IMAGE_FILENAME = "bwm_map3.jpg";
const IMG_W = 1530;
const IMG_H = 1050;
const bounds = [[0,0],[IMG_H,IMG_W]];

// Optional static data you had — keep or remove
const markersData = [
  { id: "marker-9", coords: [127,1000], title: "POI 9", img: "poi_image.jpg", thumb: "poi_image_thumb.jpg", desc: "Built in 1920, with deep heritage value." },
  { id: "marker-1", coords: [650,1270], title: "POI 10", img: "poi_image2.jpg", thumb: "poi_image2_thumb.jpg", desc: "Description for POI 10." },
  { id: "marker-2", coords: [683,814], title: "POI 11", img: "poi_image3.jpg", thumb: "poi_image3_thumb.jpg", desc: "Description for POI 11." },
  { id: "marker-3", coords: [524,613], title: "POI 12", img: "poi_image4.jpg", thumb: "poi_image4_thumb.jpg", desc: "Description for POI 12." },
  { id: "marker-4", coords: [347,526], title: "POI 13", img: "poi_image5.jpg", thumb: "poi_image5_thumb.jpg", desc: "Description for POI 13." }
];

const polygonsData = [
  { id: "zone-F", coords: [[176,1250],[141,1286],[10,1149],[43,1118]], title:"Zone F", img:"zoneF.jpg", thumb:"zoneF_thumb.jpg", desc:"Details about Zone F." },
  { id: "zone-G", coords: [[482,937],[668,1154],[539,1239],[435,1201],[290,1060]], title:"Zone G", img:"zoneG.jpg", thumb:"zoneG_thumb.jpg", desc:"Details about Zone G." },
  { id: "zone-H", coords: [[867,1041],[868,1131],[803,1133],[800,1049],[812,1034]], title:"Zone H", img:"zoneH.jpg", thumb:"zoneH_thumb.jpg", desc:"Details about Zone H." },
  { id: "zone-I", coords: [[750,936],[705,1001],[526,878],[566,817]], title:"Zone I", img:"zoneI.jpg", thumb:"zoneI_thumb.jpg", desc:"Details about Zone I." }
  // ... keep or remove as desired
];

// ------------------ State ------------------
let activeMap = null;
let markerClusterGroup = null;
let staticMarkerRefs = [];   // {id, marker, data}
let dynamicMarkerRefs = [];  // db-driven POI markers
let dynamicZoneRefs = [];    // db-driven zone polygon objects

// ------------------ UI helpers ------------------
function updateFooterInfo(data) {
  selectedInfoEl.textContent = data ? `${data.title} — ${data.desc || ''}` : 'Select a POI or Zone to see details';
}

function showModal(data) {
  modalTitle.textContent = data.title || '';
  modalImage.src = data.img || '';
  modalImage.alt = data.title || 'POI image';
  modalDesc.textContent = data.desc || '';
  poiModal.setAttribute('aria-hidden', 'false');
  poiModal._current = data;
  updateFooterInfo(data);
}
function hideModal() {
  poiModal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
  poiModal._current = null;
  updateFooterInfo(null);
}
closeModalBtn.addEventListener('click', hideModal);
poiModal.addEventListener('click', (e) => { if (e.target === poiModal) hideModal(); });

// share/copy actions
modalShareBtn?.addEventListener('click', () => {
  if (!poiModal._current) return;
  const id = poiModal._current.id || poiModal._current.title;
  const hash = `#poi=${encodeURIComponent(id)}`;
  const url = location.origin + location.pathname + hash;
  navigator.clipboard?.writeText(url).then(()=> {
    modalShareBtn.textContent = 'Link copied';
    setTimeout(()=> modalShareBtn.textContent = 'Copy link', 1400);
  }).catch(()=> alert('Copy failed — use URL + ' + hash));
});
copyMapLinkBtn?.addEventListener('click', () => {
  const url = location.origin + location.pathname;
  navigator.clipboard?.writeText(url).then(()=> {
    copyMapLinkBtn.textContent = 'Copied';
    setTimeout(()=> copyMapLinkBtn.textContent = 'Copy map link', 1400);
  });
});

// fit all
fitAllBtn?.addEventListener('click', () => { if (activeMap) activeMap.fitBounds(bounds); });
fitAllBtnTop?.addEventListener('click', () => { if (activeMap) activeMap.fitBounds(bounds); });

// sidebar toggle (mobile)
function openSidebar(){ if (window.matchMedia('(max-width:900px)').matches) sidebarEl.classList.add('open'); else sidebarEl.classList.remove('hidden'); setTimeout(()=> activeMap && activeMap.invalidateSize(), 260); }
function closeSidebar(){ if (window.matchMedia('(max-width:900px)').matches) sidebarEl.classList.remove('open'); else sidebarEl.classList.add('hidden'); setTimeout(()=> activeMap && activeMap.invalidateSize(), 260); }
openListBtn?.addEventListener('click', () => { if (sidebarEl.classList.contains('open')) closeSidebar(); else openSidebar(); });
closeSidebarBtn?.addEventListener('click', closeSidebar);

// admin button behavior
if (adminBtn) adminBtn.addEventListener('click', ()=> { window.location.href = 'login.html'; });

// ------------------ Create image map ------------------
function createImageMap(containerId, options = {}) {
  const map = L.map(containerId, {
    crs: L.CRS.Simple,
    minZoom: options.minZoom,
    maxZoom: options.maxZoom,
    zoomControl: true,
    attributionControl: false
  });

  L.imageOverlay(IMAGE_FILENAME, bounds).addTo(map);
  setTimeout(()=> map.invalidateSize(), 0);
  map.fitBounds(bounds);
  const fitZoom = map.getBoundsZoom(bounds);
  if (options.lockMinZoomToFit) map.setMinZoom(fitZoom);
  map.setMaxBounds(bounds);

  // static markers
  staticMarkerRefs = [];
  if (options.useClustering === false) {
    markersData.forEach(p => {
      const m = L.marker(p.coords).addTo(map);
      m.on('click', ()=> { showModal(p); setHashForObject(p.id); });
      staticMarkerRefs.push({ id: p.id, marker: m, data: p });
    });
  } else {
    markerClusterGroup = L.markerClusterGroup();
    markersData.forEach(p => {
      const m = L.marker(p.coords);
      m.on('click', ()=> { showModal(p); setHashForObject(p.id); });
      markerClusterGroup.addLayer(m);
      staticMarkerRefs.push({ id: p.id, marker: m, data: p });
    });
    map.addLayer(markerClusterGroup);
  }

  // static polygons
  polygonsData.forEach(poly => {
    L.polygon(poly.coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 })
      .addTo(map)
      .on('click', ()=> { showModal(poly); setHashForObject(poly.id); });
  });

  return map;
}

// ------------------ Init desktop/mobile ------------------
const mq = window.matchMedia('(max-width:768px)');
function initDesktop(){
  sidebarEl.classList.remove('open');
  sidebarEl.classList.remove('hidden');
  document.getElementById('map-desktop').style.display = 'block';
  if (document.getElementById('map-mobile')) document.getElementById('map-mobile').style.display = 'none';
  if (openListBtn) openListBtn.style.display = 'none';

  if (activeMap) { try { activeMap.remove(); } catch(e){} activeMap = null; }
  activeMap = createImageMap('map-desktop', { minZoom: -2, maxZoom: 3, lockMinZoomToFit: true, useClustering: true });
  setTimeout(()=> { activeMap.invalidateSize(); activeMap.fitBounds(bounds); populateSidebar(); }, 120);
}
function initMobile(){
  sidebarEl.classList.remove('hidden');
  sidebarEl.classList.remove('open');
  if (document.getElementById('map-desktop')) document.getElementById('map-desktop').style.display = 'none';
  document.getElementById('map-mobile').style.display = 'block';
  if (openListBtn) openListBtn.style.display = 'block';

  if (activeMap) { try { activeMap.remove(); } catch(e){} activeMap = null; }
  activeMap = createImageMap('map-mobile', { minZoom: -2, maxZoom: 3, lockMinZoomToFit: false, useClustering: false });
  setTimeout(()=> { activeMap.invalidateSize(); activeMap.fitBounds(bounds); populateSidebar(); }, 120);
}
function chooseAndInit() { if (mq.matches) initMobile(); else initDesktop(); }
chooseAndInit();
if (mq.addEventListener) mq.addEventListener('change', chooseAndInit); else mq.addListener(chooseAndInit);
window.addEventListener('resize', ()=> { clearTimeout(window._mapResizeTO); window._mapResizeTO = setTimeout(()=> chooseAndInit(), 220); });

// ------------------ Firestore realtime listeners ------------------
const poiCol = collection(db, 'poi');
const zonesCol = collection(db, 'zones');

let unsubPOI = null;
let unsubZones = null;

function clearDynamicMaps() {
  // remove dynamic markers
  if (markerClusterGroup) {
    dynamicMarkerRefs.forEach(ref => {
      try { markerClusterGroup.removeLayer(ref.marker); } catch(e){}
    });
  } else {
    dynamicMarkerRefs.forEach(ref => {
      try { activeMap.removeLayer(ref.marker); } catch(e){}
    });
  }
  dynamicMarkerRefs = [];

  // remove dynamic zones
  dynamicZoneRefs.forEach(z => {
    try { activeMap.removeLayer(z.layer); } catch(e){}
  });
  dynamicZoneRefs = [];
}

function startFirestoreListeners() {
  // detach previous
  if (typeof unsubPOI === 'function') unsubPOI();
  if (typeof unsubZones === 'function') unsubZones();

  unsubPOI = onSnapshot(poiCol, (snap) => {
    // rebuild dynamic POIs
    if (!activeMap) return;
    clearDynamicMaps();

    snap.forEach(doc => {
      const data = doc.data();
      // expect fields: name, desc, lat, lng, image (optional)
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (isNaN(lat) || isNaN(lng)) {
        // skip invalid coordinate entries
        return;
      }
      const marker = L.marker([lat, lng]);
      marker.on('click', ()=> {
        showModal({ id: 'db-poi-'+doc.id, title: data.name, desc: data.desc, img: data.image || '' });
        setHashForObject('db-poi-'+doc.id);
      });
      if (markerClusterGroup) markerClusterGroup.addLayer(marker); else marker.addTo(activeMap);
      dynamicMarkerRefs.push({ id: 'db-poi-'+doc.id, marker, data: { id: doc.id, ...data } });
    });

    populateSidebar();
  }, (err) => {
    console.error('POI onSnapshot error', err);
  });

  unsubZones = onSnapshot(zonesCol, (snap) => {
    if (!activeMap) return;
    // remove existing dynamic zones only
    dynamicZoneRefs.forEach(z => { try { activeMap.removeLayer(z.layer); } catch(e){} });
    dynamicZoneRefs = [];

    snap.forEach(doc => {
      const data = doc.data();
      // expect fields: name, desc, coords: [[y,x],[y,x],...], image (optional)
      const coords = data.coords || [];
      if (!Array.isArray(coords) || !coords.length) return;

      const poly = L.polygon(coords, { color: '#1e6091', fillOpacity: 0.24, weight: 2 });
      poly.addTo(activeMap).on('click', ()=> {
        showModal({ id: 'db-zone-'+doc.id, title: data.name, desc: data.desc, img: data.image || '' });
        setHashForObject('db-zone-'+doc.id);
      });

      dynamicZoneRefs.push({ id: 'db-zone-'+doc.id, layer: poly, data: { id: doc.id, ...data } });
    });

    populateSidebar();
  }, (err) => {
    console.error('Zones onSnapshot error', err);
  });
}

// start listeners when leaflet is ready
waitForLeaflet(6000).then(() => {
  // small delay to ensure map created
  setTimeout(()=> startFirestoreListeners(), 300);
}).catch(err => {
  console.warn('Leaflet not ready, firestore listeners not started:', err);
});

// ------------------ Sidebar population ------------------
function populateSidebar() {
  markerListEl.innerHTML = "";
  zoneListEl.innerHTML = "";

  // static markers first
  staticMarkerRefs.forEach(refObj => {
    const p = refObj.data;
    const li = document.createElement('li');
    li.dataset.id = p.id;
    const thumbSrc = p.thumb || p.img || "";
    li.innerHTML = `
      <img class="thumb" src="${thumbSrc}" alt="${p.title} thumbnail">
      <div class="item-text">
        <div class="title">${p.title}</div>
        <div class="meta">POI</div>
      </div>
      <div class="list-actions">
        <button class="btn small" data-action="goto">Go</button>
        <button class="btn small secondary" data-action="share">Share</button>
      </div>
    `;
    markerListEl.appendChild(li);

    li.querySelector('[data-action="goto"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (markerClusterGroup) {
        markerClusterGroup.zoomToShowLayer(refObj.marker, () => {
          activeMap.setView(p.coords, Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal(p); setHashForObject(p.id);
        });
      } else {
        activeMap.setView(p.coords); showModal(p); setHashForObject(p.id);
      }
    });

    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const hash = `#poi=${encodeURIComponent(p.id)}`;
      navigator.clipboard?.writeText(location.origin + location.pathname + hash).then(()=> {
        const btn = e.currentTarget; const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = old, 1400);
      });
    });

    li.addEventListener('click', () => {
      if (markerClusterGroup) {
        markerClusterGroup.zoomToShowLayer(refObj.marker, () => {
          activeMap.setView(p.coords, Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal(p); setHashForObject(p.id);
        });
      } else {
        activeMap.setView(p.coords); showModal(p); setHashForObject(p.id);
      }
    });
  });

  // dynamic DB POIs
  dynamicMarkerRefs.forEach(ref => {
    const d = ref.data;
    const li = document.createElement('li');
    li.dataset.id = ref.id;
    const thumbSrc = d.image || "";
    li.innerHTML = `
      <img class="thumb" src="${thumbSrc}" alt="${d.name || 'Location'} thumbnail">
      <div class="item-text">
        <div class="title">${d.name || '(untitled)'}</div>
        <div class="meta">Custom POI</div>
      </div>
      <div class="list-actions">
        <button class="btn small" data-action="goto">Go</button>
        <button class="btn small secondary" data-action="share">Share</button>
      </div>
    `;
    markerListEl.appendChild(li);

    li.querySelector('[data-action="goto"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (markerClusterGroup) {
        markerClusterGroup.zoomToShowLayer(ref.marker, () => {
          activeMap.setView(ref.marker.getLatLng(), Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal({ title: d.name, desc: d.desc, img: d.image || '' }); setHashForObject(ref.id);
        });
      } else {
        activeMap.setView(ref.marker.getLatLng()); showModal({ title: d.name, desc: d.desc, img: d.image || '' }); setHashForObject(ref.id);
      }
    });

    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const hash = `#poi=${encodeURIComponent(ref.id)}`;
      navigator.clipboard?.writeText(location.origin + location.pathname + hash).then(()=> {
        const btn = e.currentTarget; const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = old, 1400);
      });
    });

    li.addEventListener('click', () => {
      if (markerClusterGroup) {
        markerClusterGroup.zoomToShowLayer(ref.marker, () => {
          activeMap.setView(ref.marker.getLatLng(), Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal({ title: d.name, desc: d.desc, img: d.image || '' }); setHashForObject(ref.id);
        });
      } else {
        activeMap.setView(ref.marker.getLatLng()); showModal({ title: d.name, desc: d.desc, img: d.image || '' }); setHashForObject(ref.id);
      }
    });
  });

  // dynamic DB zones
  dynamicZoneRefs.forEach(zref => {
    const z = zref.data;
    const li = document.createElement('li');
    li.dataset.id = zref.id;
    const thumbSrc = z.image || "";
    li.innerHTML = `
      <img class="thumb" src="${thumbSrc}" alt="${z.name || 'Zone'} thumbnail">
      <div class="item-text">
        <div class="title">${z.name || '(untitled)'}</div>
        <div class="meta">Zone</div>
      </div>
      <div class="list-actions">
        <button class="btn small" data-action="goto">Go</button>
        <button class="btn small secondary" data-action="share">Share</button>
      </div>
    `;
    zoneListEl.appendChild(li);

    li.querySelector('[data-action="goto"]').addEventListener('click', (e) => {
      e.stopPropagation();
      activeMap.fitBounds(zref.layer.getBounds());
      showModal({ title: z.name, desc: z.desc, img: z.image || '' });
      setHashForObject(zref.id);
    });

    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const hash = `#poi=${encodeURIComponent(zref.id)}`;
      navigator.clipboard?.writeText(location.origin + location.pathname + hash).then(()=> {
        const btn = e.currentTarget; const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = old, 1400);
      });
    });

    li.addEventListener('click', () => {
      activeMap.fitBounds(zref.layer.getBounds());
      showModal({ title: z.name, desc: z.desc, img: z.image || '' });
      setHashForObject(zref.id);
    });
  });

  // static zones
  polygonsData.forEach(z => {
    const li = document.createElement('li');
    li.dataset.id = z.id;
    const thumbSrc = z.thumb || z.img || "";
    li.innerHTML = `
      <img class="thumb" src="${thumbSrc}" alt="${z.title} thumbnail">
      <div class="item-text">
        <div class="title">${z.title}</div>
        <div class="meta">Zone</div>
      </div>
      <div class="list-actions">
        <button class="btn small" data-action="goto">Go</button>
        <button class="btn small secondary" data-action="share">Share</button>
      </div>
    `;
    zoneListEl.appendChild(li);

    li.querySelector('[data-action="goto"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const poly = L.polygon(z.coords);
      activeMap.fitBounds(poly.getBounds());
      showModal(z);
      setHashForObject(z.id);
    });

    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const hash = `#poi=${encodeURIComponent(z.id)}`;
      navigator.clipboard?.writeText(location.origin + location.pathname + hash).then(()=> {
        const btn = e.currentTarget; const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = old, 1400);
      });
    });

    li.addEventListener('click', () => {
      const poly = L.polygon(z.coords);
      activeMap.fitBounds(poly.getBounds());
      showModal(z);
      setHashForObject(z.id);
    });
  });
}

// ------------------ Search input (filters list + cluster) ------------------
poiSearchEl?.addEventListener('input', () => {
  const q = poiSearchEl.value.trim().toLowerCase();
  Array.from(markerListEl.children).forEach(li => {
    const title = li.querySelector('.title')?.textContent?.toLowerCase() || '';
    li.style.display = title.includes(q) ? '' : 'none';
  });
  Array.from(zoneListEl.children).forEach(li => {
    const title = li.querySelector('.title')?.textContent?.toLowerCase() || '';
    li.style.display = title.includes(q) ? '' : 'none';
  });

  if (!markerClusterGroup) return;
  markerClusterGroup.clearLayers();
  const allRefs = staticMarkerRefs.concat(dynamicMarkerRefs);
  allRefs.forEach(ref => {
    const title = (ref.data.title || ref.data.name || '').toString().toLowerCase();
    const desc = (ref.data.desc || '').toString().toLowerCase();
    if (!q || title.includes(q) || desc.includes(q)) markerClusterGroup.addLayer(ref.marker);
  });
});

// ------------------ Permalink/hash handling ------------------
function setHashForObject(id) { location.hash = `poi=${encodeURIComponent(id)}`; }
function openFromHash() {
  if (!location.hash) return;
  try {
    const params = new URLSearchParams(location.hash.replace('#',''));
    const poi = params.get('poi');
    if (!poi) return;

    // static markers
    const m = staticMarkerRefs.find(x => x.id === poi);
    if (m) {
      if (markerClusterGroup) markerClusterGroup.zoomToShowLayer(m.marker, ()=> { activeMap.setView(m.marker.getLatLng(), Math.max(activeMap.getZoom(), activeMap.getMinZoom())); showModal(m.data); });
      else { activeMap.setView(m.marker.getLatLng()); showModal(m.data); }
      return;
    }

    // dynamic markers
    const dref = dynamicMarkerRefs.find(r => r.id === poi || r.data.id === poi);
    if (dref) {
      if (markerClusterGroup) markerClusterGroup.zoomToShowLayer(dref.marker, ()=> { activeMap.setView(dref.marker.getLatLng(), Math.max(activeMap.getZoom(), activeMap.getMinZoom())); showModal({ title: dref.data.name, desc: dref.data.desc, img: dref.data.image || '' }); });
      else { activeMap.setView(dref.marker.getLatLng()); showModal({ title: dref.data.name, desc: dref.data.desc, img: dref.data.image || '' }); }
      return;
    }

    // dynamic zones
    const zref = dynamicZoneRefs.find(z => z.id === poi || z.data.id === poi);
    if (zref) {
      activeMap.fitBounds(zref.layer.getBounds());
      showModal({ title: zref.data.name, desc: zref.data.desc, img: zref.data.image || ''});
      return;
    }

    // static zones
    const z = polygonsData.find(x => x.id === poi);
    if (z) { const poly = L.polygon(z.coords); activeMap.fitBounds(poly.getBounds()); showModal(z); return; }
  } catch (e) { /* ignore */ }
}
setTimeout(()=> openFromHash(), 600);

// ------------------ GPS "You are here" (keeps previous behaviour) ------------------
let GPS_BOUNDS = {
  topLeft: { lat: 2.983514010761342, lng: 101.50687851708854 },
  bottomRight: { lat: 2.979212941647669, lng: 101.51626533200081 }
};
let userMarker = null;

function convertGPStoMapCoords(lat, lng) {
  const { topLeft, bottomRight } = GPS_BOUNDS;
  const xRatio = (lng - topLeft.lng) / (bottomRight.lng - topLeft.lng);
  const yRatio = (topLeft.lat - lat) / (topLeft.lat - bottomRight.lat);
  const x = xRatio * IMG_W;
  const y = yRatio * IMG_H;
  return [y, x];
}
function startTrackingUser() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition((position) => {
    const coords = convertGPStoMapCoords(position.coords.latitude, position.coords.longitude);
    if (!userMarker) {
      userMarker = L.marker(coords, { title: "You Are Here", icon: L.icon({ iconUrl: 'you_icon.jpg', iconSize: [64,64], iconAnchor: [64,128] }) }).addTo(activeMap);
    } else userMarker.setLatLng(coords);
  }, (err)=> console.error("GPS error:", err), { enableHighAccuracy:true, maximumAge:1000, timeout:5000 });
}
setTimeout(()=> startTrackingUser(), 800);

// ------------------ initial DOMContentLoaded tasks ------------------
window.addEventListener('DOMContentLoaded', ()=> {
  populateSidebar();
});
