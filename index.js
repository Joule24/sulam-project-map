// Grab footer element
const selectedInfoEl = document.getElementById('selectedInfo');
const fitAllBtnTop = document.getElementById('fitAllBtnTop');

// Update footer
function updateFooterInfo(data) {
  selectedInfoEl.textContent = data ? `${data.title} — ${data.desc || ''}` : 'Select a POI or Zone to see details';
}

// ---------- CONFIG ----------
const IMAGE_FILENAME = "bwm_map3.jpg"; // map image file in project folder
const IMG_W = 1530;
const IMG_H = 1050;

// MARKERS (POIs)
const markersData = [
  { id: "marker-9", coords: [127, 1000], title: "POI 9", img: "poi_image.jpg", thumb: "poi_image_thumb.jpg", desc: "Built in 1920, with deep heritage value." },
  { id: "marker-1", coords: [650, 1270], title: "POI 10", img: "poi_image2.jpg", thumb: "poi_image2_thumb.jpg", desc: "Description for POI 10." },
  { id: "marker-2", coords: [683, 814], title: "POI 11", img: "poi_image3.jpg", thumb: "poi_image3_thumb.jpg", desc: "Description for POI 11." },
  { id: "marker-3", coords: [524, 613], title: "POI 12", img: "poi_image4.jpg", thumb: "poi_image4_thumb.jpg", desc: "Description for POI 12." },
  { id: "marker-4", coords: [347, 526], title: "POI 13", img: "poi_image5.jpg", thumb: "poi_image5_thumb.jpg", desc: "Description for POI 13." }
];

// POLYGONS (zones)
const polygonsData = [
  { id: "zone-F", coords: [[176, 1250], [141, 1286], [10, 1149], [43, 1118]], title: "Zone F", img: "zoneF.jpg", thumb: "zoneF_thumb.jpg", desc: "Details about Zone F." },
  { id: "zone-G", coords: [[482, 937], [668, 1154], [539, 1239], [435, 1201], [290, 1060]], title: "Zone G", img: "zoneG.jpg", thumb: "zoneG_thumb.jpg", desc: "Details about Zone G." },
  { id: "zone-H", coords: [[867, 1041], [868, 1131], [803, 1133], [800, 1049], [812, 1034]], title: "Zone H", img: "zoneH.jpg", thumb: "zoneH_thumb.jpg", desc: "Details about Zone H." },
  { id: "zone-I", coords: [[750, 936], [705, 1001], [526, 878], [566, 817]], title: "Zone I", img: "zoneI.jpg", thumb: "zoneI_thumb.jpg", desc: "Details about Zone I." },
  { id: "zone-J", coords: [[677, 719], [637, 766], [601, 737], [643, 695]], title: "Zone J", img: "zoneJ.jpg", thumb: "zoneJ_thumb.jpg", desc: "Details about Zone J." },
  { id: "zone-K", coords: [[681, 610], [652, 648], [555, 591], [585, 548]], title: "Zone K", img: "zoneK.jpg", thumb: "zoneK_thumb.jpg", desc: "Details about Zone K." },
  { id: "zone-L", coords: [[514, 557], [337, 718], [321, 697], [485, 541]], title: "Zone L", img: "zoneL.jpg", thumb: "zoneL_thumb.jpg", desc: "Details about Zone L." },
  { id: "zone-M", coords: [[250, 485], [294, 526], [281, 612], [202, 671], [128, 609]], title: "Zone M", img: "zoneM.jpg", thumb: "zoneM_thumb.jpg", desc: "Details about Zone M." }
];

// ---------- DOM refs ----------
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

// ---------- MODAL LOGIC ----------
function showModal(data) {
  modalTitle.textContent = data.title || '';
  modalImage.src = data.img || '';
  modalImage.alt = data.title || 'POI image';
  modalDesc.textContent = data.desc || '';
  poiModal.setAttribute('aria-hidden', 'false');
  poiModal._current = data;

  updateFooterInfo(data); // update footer info
}
function hideModal() {
  poiModal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
  poiModal._current = null;
  updateFooterInfo(null);
}
closeModalBtn.addEventListener('click', hideModal);
poiModal.addEventListener('click', (e) => { if (e.target === poiModal) hideModal(); });

// modal share
modalShareBtn.addEventListener('click', () => {
  if (!poiModal._current) return;
  const id = poiModal._current.id || poiModal._current.title;
  const hash = `#poi=${encodeURIComponent(id)}`;
  const url = location.origin + location.pathname + hash;
  navigator.clipboard?.writeText(url).then(() => {
    modalShareBtn.textContent = 'Link copied';
    setTimeout(() => modalShareBtn.textContent = 'Copy link', 1400);
  }).catch(() => alert('Copy failed — use URL + ' + hash));
});

// copy map link
copyMapLinkBtn.addEventListener('click', () => {
  const url = location.origin + location.pathname;
  navigator.clipboard?.writeText(url).then(() => {
    copyMapLinkBtn.textContent = 'Copied';
    setTimeout(() => copyMapLinkBtn.textContent = 'Copy map link', 1400);
  });
});

// fit all
fitAllBtn.addEventListener('click', () => {
  if (activeMap) activeMap.fitBounds([[0, 0], [IMG_H, IMG_W]]);
});
fitAllBtnTop.addEventListener('click', () => {
  if (activeMap) activeMap.fitBounds([[0, 0], [IMG_H, IMG_W]]);
});

// Sidebar open/close behavior
function openSidebar() {
  if (window.matchMedia('(max-width:900px)').matches) {
    sidebarEl.classList.add('open');
  } else {
    sidebarEl.classList.remove('hidden');
  }
  setTimeout(() => activeMap && activeMap.invalidateSize(), 260);
}
function closeSidebar() {
  if (window.matchMedia('(max-width:900px)').matches) {
    sidebarEl.classList.remove('open');
  } else {
    sidebarEl.classList.add('hidden');
  }
  setTimeout(() => activeMap && activeMap.invalidateSize(), 260);
}
openListBtn.addEventListener('click', () => {
  if (sidebarEl.classList.contains('open')) closeSidebar(); else openSidebar();
});
closeSidebarBtn.addEventListener('click', closeSidebar);

// ---------- MAP SETUP ----------
let activeMap = null;
let markerClusterGroup = null;
let markerLayerRefs = []; // {id, marker, data}
let userMarker = null; // "You Are Here"
const bounds = [[0, 0], [IMG_H, IMG_W]];

function createImageMap(containerId, options = {}) {
  const map = L.map(containerId, {
    crs: L.CRS.Simple,
    minZoom: options.minZoom,
    maxZoom: options.maxZoom,
    zoomControl: true,
    attributionControl: false
  });

  L.imageOverlay(IMAGE_FILENAME, bounds).addTo(map);
  setTimeout(() => map.invalidateSize(), 0);
  map.fitBounds(bounds);
  const fitZoom = map.getBoundsZoom(bounds);
  if (options.lockMinZoomToFit) map.setMinZoom(fitZoom);
  map.setMaxBounds(bounds);

  // Markers
  markerLayerRefs = [];
  if (options.useClustering === false) {
    markersData.forEach((p) => {
      const m = L.marker(p.coords).addTo(map);
      m.on('click', () => { showModal(p); setHashForObject(p.id); });
      markerLayerRefs.push({ id: p.id, marker: m, data: p });
    });
  } else {
    markerClusterGroup = L.markerClusterGroup();
    markersData.forEach((p) => {
      const m = L.marker(p.coords);
      m.on('click', () => { showModal(p); setHashForObject(p.id); });
      markerClusterGroup.addLayer(m);
      markerLayerRefs.push({ id: p.id, marker: m, data: p });
    });
    map.addLayer(markerClusterGroup);
  }

  // Polygons
  polygonsData.forEach(poly => {
    L.polygon(poly.coords, { color: '#1e6091', fillOpacity: 0.28, weight: 2 })
      .addTo(map)
      .on('click', () => { showModal(poly); setHashForObject(poly.id); });
  });

  return map;
}

// ---------- INIT DESKTOP / MOBILE ----------
const mq = window.matchMedia('(max-width:768px)');

function initDesktop() {
  sidebarEl.classList.remove('open');
  sidebarEl.classList.remove('hidden');
  document.getElementById('map-desktop').style.display = 'block';
  document.getElementById('map-mobile').style.display = 'none';
  openListBtn.style.display = 'none';

  if (activeMap) { try { activeMap.remove(); } catch (e) { } activeMap = null; }
  activeMap = createImageMap('map-desktop', { minZoom: -2, maxZoom: 3, lockMinZoomToFit: true, useClustering: true });

  setTimeout(() => { activeMap.invalidateSize(); activeMap.fitBounds(bounds); populateSidebar(); }, 120);
}

function initMobile() {
  sidebarEl.classList.remove('hidden');
  sidebarEl.classList.remove('open');
  document.getElementById('map-desktop').style.display = 'none';
  document.getElementById('map-mobile').style.display = 'block';
  openListBtn.style.display = 'block';

  if (activeMap) { try { activeMap.remove(); } catch (e) { } activeMap = null; }
  activeMap = createImageMap('map-mobile', { minZoom: -2, maxZoom: 3, lockMinZoomToFit: false, useClustering: false });

  setTimeout(() => { activeMap.invalidateSize(); activeMap.fitBounds(bounds); populateSidebar(); }, 120);
}

function chooseAndInit() { if (mq.matches) initMobile(); else initDesktop(); }
chooseAndInit();
if (mq.addEventListener) mq.addEventListener('change', chooseAndInit); else mq.addListener(chooseAndInit);

window.addEventListener('resize', () => {
  clearTimeout(window._mapResizeTO);
  window._mapResizeTO = setTimeout(() => chooseAndInit(), 220);
});

// ---------- STORAGE / DYNAMIC MARKERS ----------
function addMarkersFromStorage() {
  if (!markerClusterGroup) return;

  const savedLocations = JSON.parse(localStorage.getItem('mapLocations')) || [];

  // Clear old dynamic markers first
  markerClusterGroup.clearLayers();
  markerLayerRefs = markerLayerRefs.filter(r => !r.id.startsWith('loc-')); // keep static markers only

  savedLocations.forEach(loc => {
    const m = L.marker([loc.lat, loc.lng]);
    m.on('click', () => showModal(loc));
    markerClusterGroup.addLayer(m);
    markerLayerRefs.push({
      id: 'loc-' + loc.name.replace(/\s+/g, '_'),
      marker: m,
      data: loc
    });
  });

  populateSidebar();
}

window.addEventListener('storage', (e) => {
  if (e.key === 'mapUpdate') {
    addMarkersFromStorage();
  }
});


// ---------- SIDEBAR population & search ----------
function populateSidebar() {
  markerListEl.innerHTML = "";
  zoneListEl.innerHTML = "";

  // markers
  markersData.forEach((p) => {
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
      const ref = markerLayerRefs.find(r => r.id === p.id);
      if (ref) {
        markerClusterGroup.zoomToShowLayer(ref.marker, () => {
          activeMap.setView(p.coords, Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal(p);
          setHashForObject(p.id);
        });
      }
    });
    li.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const hash = `#poi=${encodeURIComponent(p.id)}`;
      const url = location.origin + location.pathname + hash;
      navigator.clipboard?.writeText(url).then(() => {
        const btn = e.currentTarget;
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => btn.textContent = old, 1400);
      });
    });

    li.addEventListener('click', () => {
      const ref = markerLayerRefs.find(r => r.id === p.id);
      if (ref) {
        markerClusterGroup.zoomToShowLayer(ref.marker, () => {
          activeMap.setView(p.coords, Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal(p);
          setHashForObject(p.id);
        });
      }
    });
  });

  // zones
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
      const url = location.origin + location.pathname + hash;
      navigator.clipboard?.writeText(url).then(() => {
        const btn = e.currentTarget;
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => btn.textContent = old, 1400);
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

// Filter/search
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

  // filter markers on the map
  markerClusterGroup.clearLayers();
  markerLayerRefs.forEach(ref => {
    if (!q || ref.data.title.toLowerCase().includes(q) || (ref.data.desc || '').toLowerCase().includes(q)) {
      markerClusterGroup.addLayer(ref.marker);
    }
  });
});

// ---------- PERMALINK / HASH HANDLING ----------
function setHashForObject(id) {
  location.hash = `poi=${encodeURIComponent(id)}`;
}
function openFromHash() {
  if (!location.hash) return;
  try {
    const params = new URLSearchParams(location.hash.replace('#', ''));
    const poi = params.get('poi');
    if (!poi) return;
    const m = markersData.find(x => x.id === poi);
    if (m) {
      const ref = markerLayerRefs.find(r => r.id === m.id);
      if (ref) {
        markerClusterGroup.zoomToShowLayer(ref.marker, () => {
          activeMap.setView(m.coords, Math.max(activeMap.getZoom(), activeMap.getMinZoom()));
          showModal(m);
        });
      }
      return;
    }
    const z = polygonsData.find(x => x.id === poi);
    if (z) {
      const poly = L.polygon(z.coords);
      activeMap.fitBounds(poly.getBounds());
      showModal(z);
      return;
    }
  } catch (e) { /* ignore */ }
}
setTimeout(() => openFromHash(), 600);

// ---------- GPS bounds (for testing) ----------
let GPS_BOUNDS = {
  topLeft: { lat: 2.983514010761342, lng: 101.50687851708854 },     // test area top-left
  bottomRight: { lat: 2.979212941647669, lng: 101.51626533200081 }  // test area bottom-right
};

userMarker = null; // "You Are Here" marker

// ---------- GPS / "You Are Here" ----------
function convertGPStoMapCoords(lat, lng) {
  const { topLeft, bottomRight } = GPS_BOUNDS;

  // Normalize lat/lng into 0–1 range
  const xRatio = (lng - topLeft.lng) / (bottomRight.lng - topLeft.lng);
  const yRatio = (topLeft.lat - lat) / (topLeft.lat - bottomRight.lat); // lat decreases going down

  // Convert to pixel coords
  const x = xRatio * IMG_W;
  const y = yRatio * IMG_H;

  return [y, x]; // Leaflet uses [y, x] (row, col)
}

function startTrackingUser() {
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported");
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      const coords = convertGPStoMapCoords(
        position.coords.latitude,
        position.coords.longitude
      );

      if (!userMarker) {
        userMarker = L.marker(coords, {
          title: "You Are Here",
          icon: L.icon({
            iconUrl: 'you_icon.jpg', // small icon to represent user
            iconSize: [64, 64],
            iconAnchor: [64, 128] // x=center, y=bottom
          })
        }).addTo(activeMap);
      } else {
        userMarker.setLatLng(coords);
      }
    },
    (err) => console.error("GPS error:", err),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
  );
}

// start tracking a short while after map loads
setTimeout(() => startTrackingUser(), 800);

// index.js
const adminBtn = document.getElementById('adminBtn');

// Redirect to login if not logged in
adminBtn.addEventListener('click', () => {
  window.location.href = 'login.html';
});

// Load map content dynamically
function loadMapContent() {
  const locations = JSON.parse(localStorage.getItem('mapLocations')) || [];

  const listContainer = document.querySelector('.list'); // your sidebar list
  listContainer.innerHTML = ''; // clear previous

  locations.forEach(loc => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="thumb"></div>
      <div class="item-text">
        <span class="title">${loc.name}</span>
        <span class="meta">${loc.desc}</span>
      </div>
    `;
    listContainer.appendChild(li);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadMapContent();        // your sidebar list for saved locations
  addMarkersFromStorage(); // add markers to the map
});

