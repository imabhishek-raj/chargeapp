import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// Mock Dataset for Delhi-NCR EV Stations
const MOCK_STATIONS = [
  { id: 1, name: 'Kashmere Gate EV Station', address: 'Near Metro Gate No. 1, Delhi', type: 'Fast CCS2', lat: 28.6675, lng: 77.2282 },
  { id: 2, name: 'Connaught Place Hub', address: 'Block E, Radial Road 2, New Delhi', type: 'Fast CCS2 & AC Type 2', lat: 28.6304, lng: 77.2177 },
  { id: 3, name: 'Saket District Centre Chargers', address: 'Behind Select CityWalk Mall, New Delhi', type: 'DC Fast 60kW', lat: 28.5285, lng: 77.2192 },
  { id: 4, name: 'Cyber City Charging Zone', address: 'Tower B Parking, Phase 3, Gurugram', type: 'Ultra Fast 120kW', lat: 28.4952, lng: 77.0891 }
];

export default function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [stations] = useState(MOCK_STATIONS);
  const [selectedStation, setSelectedStation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Core References for Google's Drawing Engines
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);

  // Monitor screen size adjustments dynamically
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Map Engine
  useEffect(() => {
    if (!mapRef.current) return;

    // Custom Map Configuration Style (Dark Mode Aesthetic)
    const darkMapStyle = [
      { elementType: "geometry", stylers: [{ color: "#21262d" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#21262d" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#8b949e" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#30363d" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#161b22" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] }
    ];

    const instance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 28.6139, lng: 77.2090 }, // Central Delhi coordinates
      zoom: 11,
      styles: darkMapStyle,
      // Completely wipes native mobile/desktop maps controls
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false
    });

    // Create Routing Managers
    directionsServiceRef.current = new window.google.maps.DirectionsService();
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      polylineOptions: {
        strokeColor: "#58a6ff",
        strokeWeight: 5,
        strokeOpacity: 0.85
      },
      suppressMarkers: false
    });
    directionsRendererRef.current.setMap(instance);

    setMap(instance);
  }, []);

  // Render Charging Station Markers
  useEffect(() => {
    if (!map) return;

    // Wipe any older existing pins
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

      marker.addListener('click', () => {
        handleStationSelect(station);
      });

      markersRef.current.push(marker);
    });
  }, [map, stations]);

  const handleStationSelect = (station) => {
    setSelectedStation(station);
    map.panTo({ lat: station.lat, lng: station.lng });
    map.setZoom(14);
  };

  // Turn-By-Turn Direction Request Engine (In-App Only)
  const calculateInAppRoute = (station) => {
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;

    // Use Geolocation or Fallback smoothly to center if location permissions block
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const originPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        requestGoogleRoute(originPoint, station);
      },
      () => {
        // Fallback simulated user position if geolocation is disabled in local browser
        const simulatedUserPoint = { lat: 28.5939, lng: 77.2290 };
        requestGoogleRoute(simulatedUserPoint, station);
      }
    );
  };

  const requestGoogleRoute = (origin, station) => {
    directionsServiceRef.current.route(
      {
        origin: origin,
        destination: { lat: station.lat, lng: station.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          directionsRendererRef.current.setDirections(response);
          
          // Capture calculated route meta details safely
          const leg = response.routes[0].legs[0];
          setRouteInfo({
            distance: leg.distance.text,
            duration: leg.duration.text
          });
        } else {
          alert('Could not compute map navigation lines: ' + status);
        }
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', height: '100vh', width: '100vw' }}>
      
      {/* Dynamic Vertical Sidebar */}
      <div className="sidebar" style={{ 
        width: isMobile ? '100%' : '360px', 
        height: isMobile ? '45vh' : '100%' 
      }}>
        
        {/* Branding Container */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="branding-header">chargeapp.in</h1>
          <span style={{ fontSize: '0.75rem', color: '#8b949e', background: '#21262d', padding: '4px 8px', borderRadius: '12px', border: '1px solid #30363d' }}>
            {stations.length} stations near you
          </span>
        </div>

        {/* Scrollable Cards Wrapper */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${isActive ? 'active' : ''}`}>{station.type}</span>
                </div>

                {/* Open Route inside application window */}
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

        {/* Live Route Navigation Readout Overlay */}
        {routeInfo && (
          <div className="route-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>⏱️ ETA: <span style={{ color: '#58a6ff' }}>{routeInfo.duration}</span></span>
              <span>📍 Distance: <span style={{ color: '#2ea44f' }}>{routeInfo.distance}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Main Map Box Engine */}
      <div ref={mapRef} style={{ flex: 1, height: '100%', width: isMobile ? '100%' : 'auto' }} />
    </div>
  );
}