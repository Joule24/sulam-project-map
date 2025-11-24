// admin.js
const addBtn = document.getElementById('addLocationBtn');
const removeBtn = document.getElementById('removeLocationBtn');

let locations = JSON.parse(localStorage.getItem('mapLocations')) || [];

// Broadcast storage change to update map
function broadcastMapUpdate() {
  localStorage.setItem('mapUpdate', Date.now());
}

// Add / update location
addBtn.addEventListener('click', () => {
  const name = document.getElementById('locationName').value.trim();
  const desc = document.getElementById('locationDesc').value.trim();
  const lat = parseFloat(document.getElementById('locationLat').value);
  const lng = parseFloat(document.getElementById('locationLng').value);

  if (!name || !desc || isNaN(lat) || isNaN(lng)) {
    alert('Please enter all fields correctly!');
    return;
  }

  const index = locations.findIndex(loc => loc.name.toLowerCase() === name.toLowerCase());
  const locObj = { name, desc, lat, lng };

  if (index !== -1) locations[index] = locObj;
  else locations.push(locObj);

  localStorage.setItem('mapLocations', JSON.stringify(locations));
  alert('Location added/updated successfully!');
  broadcastMapUpdate();
});

// Remove location
removeBtn.addEventListener('click', () => {
  const name = document.getElementById('removeLocationName').value.trim();
  if (!name) return alert('Please enter a location name!');

  locations = locations.filter(loc => loc.name.toLowerCase() !== name.toLowerCase());
  localStorage.setItem('mapLocations', JSON.stringify(locations));
  alert('Location removed successfully!');
  broadcastMapUpdate();
});
