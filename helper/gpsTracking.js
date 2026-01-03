import { topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, IMG_W, IMG_H } from "../config.js";

// Local Leaflet icon using static asset path
const youIcon = L.icon({
  iconUrl: "assets/you_icon.jpg",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const mapBoundsGPS = {
  topLeft: { lat: topLeftLat, lng: topLeftLng },
  bottomRight: { lat: bottomRightLat, lng: bottomRightLng }
};

function latLngToPixel(lat, lng) {
  const { topLeft, bottomRight } = mapBoundsGPS;

  // Latitude → Y (top-left is 0)
  const y = ((lat - bottomRight.lat) / (topLeft.lat - bottomRight.lat)) * IMG_H;

  // Longitude → X (left is 0)
  const x = ((lng - topLeft.lng) / (bottomRight.lng - topLeft.lng)) * IMG_W;

  return [y, x];
}

/**
 * Start GPS tracking for both desktop and mobile maps.
 * We accept the map instances as arguments to avoid circular imports.
 */
export function tracking(activeMapDesktop, activeMapMobile) {
  let youMarkerDesktop = null;
  let youMarkerMobile = null;

  if (!navigator.geolocation) {
    console.warn("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const coords = latLngToPixel(lat, lng); // convert GPS → map pixel

      // Desktop
      if (activeMapDesktop) {
        if (youMarkerDesktop) {
          youMarkerDesktop.setLatLng(coords);
        } else {
          youMarkerDesktop = L.marker(coords, { icon: youIcon }).addTo(activeMapDesktop);
        }
      }

      // Mobile
      if (activeMapMobile) {
        if (youMarkerMobile) {
          youMarkerMobile.setLatLng(coords);
        } else {
          youMarkerMobile = L.marker(coords, { icon: youIcon }).addTo(activeMapMobile);
        }
      }
    },
    (err) => {
      console.error("GPS error:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000
    }
  );
}