// admin.js — complete file with requested fixes applied

// ---------------- FIREBASE SETUP ----------------
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { firebaseInitializer, app, db } from "./helper/initializeFirebase.js";

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


firebaseInitializer();
const auth = getAuth(app);

// ---------------- UI REFERENCES ----------------
const actionSelect = document.getElementById('actionSelect');
const typeSelect = document.getElementById('typeSelect');
const existingContainer = document.getElementById('existingContainer');
const existingSelect = document.getElementById('existingSelect');
const formContainer = document.getElementById('formContainer');
const titleInput = document.getElementById('titleInput');
const descInput = document.getElementById('descInput');
// const imgFileInput = document.getElementById('poiImage');
// const previewImage = document.getElementById('previewImage');
const nowImageInput = document.getElementById('nowImageInput');
const thenImageInput = document.getElementById('thenImageInput');
const nowPreview = document.getElementById('nowPreview');
const thenPreview = document.getElementById('thenPreview');
const xInput = document.getElementById('xInput');
const yInput = document.getElementById('yInput');
const realWorldLatInput = document.getElementById('realWorldLatInput');
const realWorldLngInput = document.getElementById('realWorldLngInput');
const coordsListEl = document.getElementById('coords-list');
const logoutBtn = document.getElementById('logoutBtn');

// Confirm area buttons (make sure these exist in HTML)
const confirmArea = document.getElementById('confirmArea');
const resetCoordsBtn = document.getElementById('resetCoordsBtn');
const confirmGlobalBtn = document.getElementById('confirmGlobalBtn');
const cancelGlobalBtn = document.getElementById('cancelGlobalBtn');
const statusMsg = document.getElementById('statusMsg');

// ---------------- MAP ----------------
const IMAGE_FILENAME = "assets/bwm_map3.jpg";
const IMG_W = 1530;
const IMG_H = 1050;
const bounds = [[0, 0], [IMG_H, IMG_W]];
let map = null;
let currentMarker = null;
let currentPolygon = null;
let polygonCoords = [];

// store preview dataURL (if any)
// let previewDataURL = "";
let nowImageDataURL = "";
let thenImageDataURL = "";

// ---------------- SHARED CLICK HANDLER ----------------
function polygonClickHandler(e) {
  if (!typeSelect.value) return;

  const lat = Math.round(e.latlng.lat);
  const lng = Math.round(e.latlng.lng);

  if (typeSelect.value === 'poi') {
    // create (or move) a temporary marker and update inputs
    if (currentMarker) {
      try { map.removeLayer(currentMarker); } catch (err) { /* ignore */ }
      currentMarker = null;
    }
    currentMarker = L.marker([lat, lng], { draggable: true }).addTo(map)
      .on('drag', ev => {
        const pos = ev.target.getLatLng();
        xInput.value = Math.round(pos.lat);
        yInput.value = Math.round(pos.lng);
      });
    xInput.value = lat;
    yInput.value = lng;

  } else if (typeSelect.value === 'zone') {
    polygonCoords.push([lat, lng]);
    updatePolygon();
  }
}

// ---------------- INIT MAP ----------------
function initMap() {
  map = L.map('map', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3 });
  L.imageOverlay(IMAGE_FILENAME, bounds).addTo(map);
  map.fitBounds(bounds);

  // Attach the shared click handler (setFormEnabled will toggle this on/off)
  map.on('click', polygonClickHandler);
}

// ---------------- POLYGON ----------------
function updatePolygon() {
  if (!polygonCoords.length) {
    coordsListEl.classList.add('hidden');
    coordsListEl.innerHTML = '';
    if (currentPolygon) { try { map.removeLayer(currentPolygon); } catch (e) { } currentPolygon = null; }
    return;
  }

  coordsListEl.classList.remove('hidden');
  coordsListEl.innerHTML = polygonCoords.map((c, i) => `#${i + 1}: [${c[0]}, ${c[1]}]`).join('<br>');

  if (currentPolygon) {
    try { map.removeLayer(currentPolygon); } catch (e) { /* ignore */ }
    currentPolygon = null;
  }
  currentPolygon = L.polygon(polygonCoords, { color: '#1e6091', fillOpacity: 0.3 }).addTo(map);
}

// ---------------- LOAD EXISTING ----------------
async function loadExisting(type) {
  existingSelect.innerHTML = '';
  if (!type) return;
  const colRef = collection(db, type === 'poi' ? 'pois' : 'zones');
  const snapshot = await getDocs(colRef);
  snapshot.forEach(docSnap => {
    const opt = document.createElement('option');
    opt.value = docSnap.id;
    opt.textContent = docSnap.data().title || docSnap.id;
    existingSelect.appendChild(opt);
  });
  // show confirm area if there are items (useful for remove)
  confirmArea.classList.toggle('hidden', snapshot.size === 0 && actionSelect.value === 'remove');
  updateResetBtnVisibility();
}

// ---------------- HELPERS ----------------
function setFormEnabled(enabled) {
  // enabled = true -> allow editing; false -> disable inputs (used for "remove")
  [titleInput, descInput, imgFileInput, xInput, yInput, realWorldLatInput, realWorldLngInput].forEach(el => {
    el.disabled = !enabled;
    el.classList.toggle('muted', !enabled);
  });

  // image inputs only disabled, previews always visible
  nowImageInput.disabled = !enabled;
  thenImageInput.disabled = !enabled;

  // toggle map click handling for polygon/poi editing
  if (!enabled) {
    map.off('click', polygonClickHandler);
  } else {
    map.on('click', polygonClickHandler);
  }
}

function updateResetBtnVisibility() {
  const show = (typeSelect.value === 'zone') && (actionSelect.value === 'add' || actionSelect.value === 'edit');
  if (typeof resetCoordsBtn !== 'undefined' && resetCoordsBtn !== null) {
    resetCoordsBtn.style.display = show ? 'block' : 'none';
  }
}

// ---------------- EVENT LISTENERS ----------------
const container = function () {
  existingContainer.classList.add('hidden');
  formContainer.classList.add('hidden');
  confirmArea.classList.add('hidden');
};

actionSelect.addEventListener('change', () => {
  resetForm();
  container();
  polygonCoords = [];

  if (actionSelect.value === 'add') {
    // Add: show form + confirm
    formContainer.classList.remove('hidden');
    confirmArea.classList.remove('hidden');
    setFormEnabled(true);
  } else if (actionSelect.value === 'edit') {
    // Edit: show existing picker + form + confirm
    if (typeSelect.value) {
      existingContainer.classList.remove('hidden');
      formContainer.classList.remove('hidden');
      confirmArea.classList.remove('hidden');
      loadExisting(typeSelect.value);
    }
    setFormEnabled(true);
  } else if (actionSelect.value === 'remove') {
    // Remove: show existing picker + form (read-only) + confirm
    if (typeSelect.value) {
      existingContainer.classList.remove('hidden');
      formContainer.classList.remove('hidden');
      confirmArea.classList.remove('hidden');
      loadExisting(typeSelect.value);
    }
    setFormEnabled(false);
  }

  updateResetBtnVisibility();
});

typeSelect.addEventListener('change', async () => {
  polygonCoords = [];
  // when type changes and action is edit/remove, reload existing and show form
  if (actionSelect.value === 'edit' || actionSelect.value === 'remove') {
    existingContainer.classList.remove('hidden');
    formContainer.classList.remove('hidden');
    confirmArea.classList.remove('hidden');
    await loadExisting(typeSelect.value);
  }
  // show/hide coords section depending on type
  document.getElementById('coordsInputs').classList.toggle('hidden', typeSelect.value !== 'zone' && typeSelect.value !== 'poi');
  updateResetBtnVisibility();
});

existingSelect.addEventListener('change', async () => {
  if (!existingSelect.value) {
    // Clear form when no item selected
    resetForm();
    return;
  }
  if (actionSelect.value === 'edit' || actionSelect.value === 'remove') {
    // Ensure form container is visible when item is selected
    formContainer.classList.remove('hidden');
    confirmArea.classList.remove('hidden');

    const colRef = collection(db, typeSelect.value === 'poi' ? 'pois' : 'zones');
    const snap = await getDocs(colRef);
    const dataDoc = snap.docs.find(d => d.id === existingSelect.value);
    if (!dataDoc) return;
    const data = dataDoc.data();

    titleInput.value = data.title || '';
    descInput.value = data.desc || '';
    // previewDataURL = data.img || '';
    // if (previewDataURL) {
    //   previewImage.src = previewDataURL;
    //   previewImage.style.display = 'block';
    // } else {
    //   previewImage.style.display = 'none';
    // }

    // Reset
    nowImageDataURL = '';
    thenImageDataURL = '';

    // Load images
    if (data.images?.now?.url) {
      nowPreview.src = data.images.now.url;
      nowPreview.style.display = 'block';
    } else {
      nowPreview.style.display = 'none';
    }

    if (data.images?.then?.url) {
      thenPreview.src = data.images.then.url;
      thenPreview.style.display = 'block';
    } else {
      thenPreview.style.display = 'none';
    }

    if (typeSelect.value === 'poi') {
      const lat = data.coords?.x;
      const lng = data.coords?.y;
      xInput.value = lat ?? '';
      yInput.value = lng ?? '';

      // Load real-world coordinates
      realWorldLatInput.value = data.realWorldCoords?.lat ?? '';
      realWorldLngInput.value = data.realWorldCoords?.lng ?? '';

      if (currentMarker) { try { map.removeLayer(currentMarker); } catch (e) { } currentMarker = null; }
      if (!isNaN(Number(lat)) && !isNaN(Number(lng))) {
        const draggable = actionSelect.value === 'edit';
        currentMarker = L.marker([Number(lat), Number(lng)], { draggable: draggable }).addTo(map);
        if (draggable) {
          currentMarker.on('drag', ev => {
            const pos = ev.target.getLatLng();
            xInput.value = Math.round(pos.lat);
            yInput.value = Math.round(pos.lng);
          });
        }
        map.setView([Number(lat), Number(lng)], Math.max(map.getZoom(), map.getMinZoom()));
      }
      coordsListEl.classList.add('hidden');
    } else if (typeSelect.value === 'zone') {
      polygonCoords = (data.coordinates || []).map(c => [c.x, c.y]);
      updatePolygon();
    }
    // If remove action, keep form disabled (read-only view)
    setFormEnabled(actionSelect.value !== 'remove');
  }
});

// Reset polygon coords (useful when editing a zone and admin wants to start fresh)
if (resetCoordsBtn) {
  resetCoordsBtn.addEventListener('click', () => {
    if (!confirm('Clear all coordinates for this zone? This will remove existing vertices.')) return;
    polygonCoords = [];
    if (currentPolygon) {
      try { map.removeLayer(currentPolygon); } catch (e) { /* ignore */ }
      currentPolygon = null;
    }
    coordsListEl.classList.add('hidden');
    coordsListEl.innerHTML = '';
    statusMsg.textContent = 'Coordinates cleared — you can now add new vertices by clicking the map.';
    try { map.fitBounds(bounds); } catch (e) { /* ignore */ }
  });
}

// ---------------- FILE INPUT PREVIEW + COMPRESSION ----------------
nowImageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    nowPreview.style.display = 'none';
    nowImageDataURL = '';
    return;
  }

  nowImageDataURL = await compressImage(file, 1024, 0.7);
  nowPreview.src = nowImageDataURL;
  nowPreview.style.display = 'block';
});

thenImageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    thenPreview.style.display = 'none';
    thenImageDataURL = '';
    return;
  }

  thenImageDataURL = await compressImage(file, 1024, 0.7);
  thenPreview.src = thenImageDataURL;
  thenPreview.style.display = 'block';
});

// ---------------- HELPER FUNCTION: COMPRESS IMAGE ----------------
function compressImage(file, maxSize = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = reject;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // proportional resize
      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > width && height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          const reader2 = new FileReader();
          reader2.onload = () => resolve(reader2.result);
          reader2.onerror = reject;
          reader2.readAsDataURL(blob);
        },
        'image/jpeg',
        quality
      );
    };

    reader.readAsDataURL(file);
  });
}

// ---------------- GLOBAL CONFIRM / CANCEL ----------------
if (confirmGlobalBtn) {
  confirmGlobalBtn.addEventListener('click', async () => {

    if (!auth.currentUser) {
      alert("You must be logged in.");
      window.location.href = "login.html";
      return;
    }

    if (!typeSelect.value || !actionSelect.value) return alert('Select action and content type.');
    const colName = typeSelect.value === 'poi' ? 'pois' : 'zones';
    const colRef = collection(db, colName);

    try {
      if (actionSelect.value === 'add') {
        if (!nowImageDataURL) {
          return alert("NOW image is required.");
        }

        const data = {
          title: titleInput.value,
          desc: descInput.value,
          images: {
            now: {
              url: nowImageDataURL,
              label: "Now"
            },
            then: thenImageDataURL
              ? { url: thenImageDataURL, label: "Then" }
              : null
          },
          thumb: nowImageDataURL
        };

        if (typeSelect.value === 'poi') {
          data.coords = { x: Number(xInput.value || 0), y: Number(yInput.value || 0) };
          const realLat = realWorldLatInput.value.trim();
          const realLng = realWorldLngInput.value.trim();
          if (realLat || realLng) {
            data.realWorldCoords = {
              lat: realLat ? Number(realLat) : null,
              lng: realLng ? Number(realLng) : null
            };
          }
        }
        if (typeSelect.value === 'zone') data.coordinates = polygonCoords.map(c => ({ x: c[0], y: c[1] }));
        if (!confirm('Confirm adding new item?')) return;
        const newDocRef = await addDoc(colRef, data);
        statusMsg.textContent = `Item added (id: ${newDocRef.id})`;
      } else if (actionSelect.value === 'edit') {
        if (!existingSelect.value) return alert('Pick an existing item to edit.');
        const docRef = doc(db, colName, existingSelect.value);
        const data = {
          title: titleInput.value,
          desc: descInput.value,
          img: previewDataURL || ''
        };

        // NOW image — overwrite if new upload
        if (nowImageDataURL) {
          updateData["images.now"] = {
            url: nowImageDataURL,
            label: "Now"
          };
          updateData.thumb = nowImageDataURL;
        }

        // THEN image — overwrite if new upload
        if (thenImageDataURL) {
          updateData["images.then"] = {
            url: thenImageDataURL,
            label: "Then"
          };
        }

        // coords
        if (typeSelect.value === 'poi') {
          data.coords = { x: Number(xInput.value || 0), y: Number(yInput.value || 0) };
          const realLat = realWorldLatInput.value.trim();
          const realLng = realWorldLngInput.value.trim();
          if (realLat || realLng) {
            data.realWorldCoords = {
              lat: realLat ? Number(realLat) : null,
              lng: realLng ? Number(realLng) : null
            };
          } else {
            // If fields are empty, remove realWorldCoords
            data.realWorldCoords = null;
          }
        }
        if (typeSelect.value === 'zone') data.coordinates = polygonCoords.map(c => ({ x: c[0], y: c[1] }));
        if (!confirm('Confirm updating item?')) return;
        await updateDoc(docRef, data);
        statusMsg.textContent = 'Item updated successfully!';
      } else if (actionSelect.value === 'remove') {
        if (!existingSelect.value) return alert('Pick an existing item to remove.');
        const docRef = doc(db, colName, existingSelect.value);
        if (!confirm('Confirm removing item?')) return;
        await deleteDoc(docRef);
        statusMsg.textContent = 'Item removed successfully!';
      }

      // reset & refresh
      resetForm();
      await loadExisting(typeSelect.value);
    } catch (err) {
      console.error('Write error:', err);
      statusMsg.textContent = 'Error: ' + (err.message || err);
      alert('Error writing to Firestore — check console and rules.');
    }
  });
}

if (cancelGlobalBtn) {
  cancelGlobalBtn.addEventListener('click', () => {
    resetForm();
    existingSelect.innerHTML = '';
    container();
  });
}

// ---------------- LOG OUT ----------------
logoutBtn.addEventListener('click', async () => {
  if (!confirm("Are you sure you want to log out?")) return;
  try {
    await signOut(auth);
    alert("Logged out successfully!");
    window.location.href = "login.html"; // redirect after logout
  } catch (err) {
    console.error("Logout error:", err);
    alert("Error logging out: " + err.message);
  }
});

// ---------------- RESET FORM ----------------
function resetForm() {
  titleInput.value = '';
  descInput.value = '';
  nowImageInput.value = '';
  thenImageInput.value = '';
  nowPreview.style.display = 'none';
  thenPreview.style.display = 'none';
  nowImageDataURL = '';
  thenImageDataURL = '';

  xInput.value = '';
  yInput.value = '';
  realWorldLatInput.value = '';
  realWorldLngInput.value = '';
  polygonCoords = [];
  if (currentMarker) { try { map.removeLayer(currentMarker); } catch (e) { } currentMarker = null; }
  if (currentPolygon) { try { map.removeLayer(currentPolygon); } catch (e) { } currentPolygon = null; }
  coordsListEl.classList.add('hidden');
  coordsListEl.innerHTML = '';
  statusMsg.textContent = '';
  // re-enable click handler if needed (default)
  setFormEnabled(true);
  updateResetBtnVisibility();
}

// ---------------- INIT ----------------
// AUTH GUARD
window.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      alert("You must log in to access the admin panel.");
      window.location.href = "login.html"; // redirect to your login page
    } else {
      console.log("Logged in as:", user.email);
      document.body.style.display = "flex"; // reveal body after auth
      initMap();
    }
  });
});

