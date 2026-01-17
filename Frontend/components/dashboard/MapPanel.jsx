// components/map/MapPanel.jsx
'use client'; // Marks this component as client-side only

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet with SSR disabled
const LoadLeaflet = dynamic(() => import('leaflet'), {
  ssr: false,
  loading: () => <p>Loading map...</p>, // Optional loading indicator
});

// CSS import for Leaflet (required for styling)
import 'leaflet/dist/leaflet.css';

const MapPanel = ({ isVisible }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [L, setL] = useState(null);

  useEffect(() => {
    // Initialize Leaflet only if not already loaded
    if (!L && typeof window !== 'undefined') {
      import('leaflet').then(module => {
        const leaflet = module.L || module.default || module;
        setL(leaflet);
        console.log('Leaflet loaded:', leaflet);
      }).catch(error => {
        console.error('Failed to load Leaflet:', error);
      });
    }
  }, [L]); // Re-run if L changes (though it should only set once)

  useEffect(() => {
    // Debugging: Log to check Leaflet and visibility
    console.log('L:', L, 'isVisible:', isVisible);

    // Check if Leaflet is available and component is visible
    if (typeof window === 'undefined' || !L || !mapRef.current || !isVisible) {
      console.log('Map initialization skipped due to:', {
        window: typeof window,
        L: !!L,
        mapRef: !!mapRef.current,
        isVisible,
      });
      return;
    }

    // Initialize map if not already initialized
    if (!mapInstanceRef.current) {
      try {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [28.644800,  77.216721], // Default center (Delhi)
          zoom: 4, // Default zoom level
          layers: [
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }),
          ],
        });

        // Prepare custom icon for marker
        const customIcon = L.icon({
          iconUrl: '/location.png', // from Next.js public folder
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -28],
          className: 'map-location-icon'
        });

        // Marker state held locally inside closure
        let clickMarker = null;

        // On map click: add/update marker and populate chat input
        mapInstanceRef.current.on('click', (e) => {
          const { lat, lng } = e.latlng;

          // Add or move marker
          if (!clickMarker) {
            clickMarker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
          } else {
            clickMarker.setLatLng([lat, lng]);
          }
          clickMarker.bindPopup(`Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`).openPopup();

          // Push formatted coords into chat input if available
          if (typeof window !== 'undefined' && typeof window.__setChatInput === 'function') {
            // Format matches your backend parser: "lat <num> lon <num>"
            const text = `lat ${lat.toFixed(6)} lon ${lng.toFixed(6)}`;
            window.__setChatInput(text);
          }
        });

        console.log('Map initialized successfully');
      } catch (error) {
        console.error('Map initialization failed:', error);
      }
    }

    // Update map visibility and size
    if (isVisible && mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      console.log('Map size invalidated');
    }

    // Cleanup on unmount or visibility change
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        console.log('Map cleaned up');
      }
    };
  }, [isVisible, L]); // Depend on isVisible and L

  // Render loading state or map container
  return <div ref={mapRef} style={{ height: '100%', width: '100%', position: 'absolute' }} />;
};

export default MapPanel;