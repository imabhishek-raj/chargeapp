import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const MOCK_STATIONS = [
  { id: 1, name: 'Kashmere Gate EV Station', address: 'Near Metro Gate No. 1, Delhi', type: 'Fast CCS2', lat: 28.6675, lng: 77.2282 },
  { id: 2, name: 'Connaught Place Hub', address: 'Block E, Radial Road 2, New Delhi', type: 'Fast CCS2 & AC Type 2', lat: 28.6304, lng: 77.2177 },
  { id: 3, name: 'Saket District Centre Chargers', address: 'Behind Select CityWalk Mall, New Delhi', type: 'DC Fast 60kW', lat: 28.5285, lng: 77.2192 },
  { id: 4, name: 'Cyber City Charging Zone', address: 'Tower B Parking, Phase 3, Gurugram', type: 'Ultra Fast 120kW', lat: 28.4952, lng: 77.0891 }
];

export default function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [stations] = useState(MOCK_STATIONS);
  const [selectedStation, setSelectedStation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mapError, setMapError] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Script Loader Engine
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsSdkLoaded(true);
      return;
    }
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsSdkLoaded(true));
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; 
    if (!apiKey) {
      console.error("Missing VITE_GOOGLE_MAPS_API_KEY initialization configuration.");
      setMapError(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => setIsSdkLoaded(true));
    script.addEventListener('error', () => setMapError(true));
    document.head.appendChild(script);
  }, []);

  // 2. Map Canvas Mounting Lifecycle
  useEffect(() => {
    if (!isSdkLoaded || !mapRef.current) return;

    try {
      const darkMapStyle = [
        { elementType: "geometry", stylers: [{ color: "#21262d" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#21262d" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8b949e" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#30363d" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#161b22" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] }
      ];

      const instance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 28.6139, lng: 77.2090 },
        zoom: 11,
        styles: darkMapStyle,
        disableDefaultUI: true,
        zoomControl: true,
      });

      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        polylineOptions: { strokeColor: "#58a6ff", strokeWeight: 5, strokeOpacity: 0.85 }
      });
      directionsRendererRef.current.setMap(instance);

      setMap(instance);
    } catch (err) {
      console.error("Initialization fault:", err);
      setMapError(true);
    }
  }, [isSdkLoaded]);

  // 3. Automated Geolocation Watch Pipeline & Custom User Anchor Dot
  useEffect(() => {
    if (!map || !isSdkLoaded) return;

    if (navigator.geolocation) {
      // Actively stream precise user coordinate telemetry shifts
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const currentCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setUserLocation(currentCoords);

          // Render or dynamically shift the glowing user position anchor dot
          if (userMarkerRef.current) {
            userMarkerRef.current.setPosition(currentCoords);
          } else {
            userMarkerRef.current = new window.google.maps.Marker({
              position: currentCoords,
              map: map,
              title: "Your Location",
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#58a6ff", // Neon tracking blue
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }
            });
            
            // Auto-center camera onto user position on initial successful load
            map.panTo(currentCoords);
            map.setZoom(13);
          }
        },
        (error) => console.warn("Live geolocation stream trace warning:", error),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [map, isSdkLoaded]);

  // 4. Render Station Pinpoints
  useEffect(() => {
    if (!map || !isSdkLoaded) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    stations.forEach(station => {
      const marker = new window.google.maps.Marker({
        position: { lat: station.lat, lng: station.lng },
        map: map,
        title: station.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#2ea44f",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        }
      });

      marker.addListener('click', () => handleStationSelect(station));
      markersRef.current.push(marker);
    });
  }, [map, stations, isSdkLoaded]);

  const handleStationSelect = (station) => {
    setSelectedStation(station);
    if (map) {
      map.panTo({ lat: station.lat, lng: station.lng });
      map.setZoom(14);
    }
  };

  // 5. Calculate In-App Navigation Routes
  const calculateInAppRoute = (station) => {
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;

    const startPoint = userLocation || { lat: 28.5939, lng: 77.2290 }; // Use live coordinate dot, fallback to backup center if blocked

    directionsServiceRef.current.route(
      {
        origin: startPoint,
        destination: { lat: station.lat, lng: station.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          directionsRendererRef.current.setDirections(response);
          const leg = response.routes[0].legs[0];
          setRouteInfo({
            distance: leg.distance.text,
            duration: leg.duration.text
          });
        } else {
          alert('Route routing failed: ' + status);
        }
      }
    );
  };

  // Explicit Camera Refocus Sweep Command Triggered by Floating Target Button
  const handleRecenter = () => {
    if (!map || !userLocation) {
      alert("GPS coordinates not acquired yet. Please check your browser's location settings.");
      return;
    }
    map.panTo(userLocation);
    map.setZoom(15);
  };

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', height: '100vh', width: '100vw', position: 'relative' }}>
      
      {/* Sidebar Layout */}
      <div className="sidebar" style={{ width: isMobile ? '100%' : '360px', height: isMobile ? '45vh' : '100%' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="branding-header">chargeapp.in</h1>
          <span style={{ fontSize: '0.75rem', color: '#8b949e', background: '#21262d', padding: '4px 8px', borderRadius: '12px', border: '1px solid #30363d' }}>
            {stations.length} stations
          </span>
        </div>

        <div className="station-list-container">
          {stations.map((station, idx) => {
            const isActive = selectedStation?.id === station.id;
            return (
              <div 
                key={station.id} 
                className={`station-card ${isActive ? 'active' : ''}`}
                style={{ animationDelay: `${idx * 0.08}s` }}
                onClick={() => handleStationSelect(station)}
              >
                <h3 className="station-title">{station.name}</h3>
                <p className="station-address">{station.address}</p>
                <div>
                  <span className={`badge ${isActive ? 'active' : ''}`}>{station.type}</span>
                </div>

                {isActive && (
                  <button 
                    className="nav-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      calculateInAppRoute(station);
                    }}
                  >
                    Start In-App Navigation
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {routeInfo && (
          <div className="route-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>⏱️ ETA: <span style={{ color: '#58a6ff' }}>{routeInfo.duration}</span></span>
              <span>📍 Dist: <span style={{ color: '#2ea44f' }}>{routeInfo.distance}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Main Map Box Context Area */}
      {mapError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', backgroundColor: '#0d1117' }}>
          <h3>Map Configuration Error</h3>
        </div>
      ) : (
        <div style={{ flex: 1, height: '100%', width: isMobile ? '100%' : 'auto', position: 'relative', backgroundColor: '#0d1117' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Floating Aesthetic Target Recenter Overlay UI Controls Button */}
          {isSdkLoaded && (
            <button 
              onClick={handleRecenter}
              className="recenter-btn"
              style={{
                position: 'absolute',
                bottom: isMobile ? '24px' : '32px',
                right: '24px',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#21262d',
                border: '1px solid #30363d',
                color: '#58a6ff',
                fontSize: '1.6rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                zIndex: 99,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = '#58a6ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = '#30363d';
              }}
            >
              🎯
            </button>
          )}

          {!isSdkLoaded && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#58a6ff', fontSize: '1.1rem', fontWeight: '600' }}>
              connecting to google maps...
            </div>
          )}
        </div>
      )}
    </div>
  );
}