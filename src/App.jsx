import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { db, collection, addDoc, getDocs } from './firebase';

export default function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [stations, setStations] = useState([]);
  const [filteredStations, setFilteredStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mapError, setMapError] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Real-Time UI Filter State Variables
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'CCS2', 'AC Type 2'
  const [speedFilter, setSpeedFilter] = useState('ALL'); // 'ALL', 'FAST', 'REGULAR'

  // Host Input Modal Display Toggle States
  const [showHostForm, setShowHostForm] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationType, setNewStationType] = useState('CCS2');
  const [newStationSpeed, setNewStationSpeed] = useState('FAST');

  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

  // Monitor layout shift viewports
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Live Database Pins from Firestore
  const fetchDatabaseStations = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "stations"));
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      
      // Fallback baseline nodes if your remote Firestore collection is empty initially
      if (items.length === 0) {
        setStations([
          { id: 'm1', name: 'Kashmere Gate EV Hub', address: 'Metro Gate 1, Delhi', type: 'CCS2', speed: 'FAST', lat: 28.6675, lng: 77.2282 },
          { id: 'm2', name: 'Connaught Place Station', address: 'Block E, New Delhi', type: 'AC Type 2', speed: 'REGULAR', lat: 28.6304, lng: 77.2177 },
          { id: 'm3', name: 'Saket District Centre Chargers', address: 'Behind Select CityWalk Mall, New Delhi', type: 'CCS2', speed: 'FAST', lat: 28.5285, lng: 77.2192 }
        ]);
      } else {
        setStations(items);
      }
    } catch (err) {
      console.error("Firestore database parsing failure:", err);
    }
  };

  useEffect(() => {
    fetchDatabaseStations();
  }, []);

  // Compute Runtime Structural Filters
  useEffect(() => {
    let result = stations;

    if (typeFilter !== 'ALL') {
      result = result.filter(s => s.type === typeFilter);
    }
    if (speedFilter !== 'ALL') {
      result = result.filter(s => s.speed === speedFilter);
    }

    setFilteredStations(result);
  }, [stations, typeFilter, speedFilter]);

  // Google Script Async Loader Execution
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsSdkLoaded(true);
      return;
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapError(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => setIsSdkLoaded(true));
    script.addEventListener('error', () => setMapError(true));
    document.head.appendChild(script);
  }, []);

  // Map Instance Creation Lifecycle
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
      setMapError(true); 
    }
  }, [isSdkLoaded]);

  // Automated Live Location Tracking Engine
  useEffect(() => {
    if (!map || !isSdkLoaded) return;
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        if (userMarkerRef.current) {
          userMarkerRef.current.setPosition(coords);
        } else {
          userMarkerRef.current = new window.google.maps.Marker({
            position: coords, 
            map, 
            title: "Your Location",
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#58a6ff", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 }
          });
          map.panTo(coords);
          map.setZoom(13);
        }
      }, (err) => console.warn(err), { enableHighAccuracy: true });
    }
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [map, isSdkLoaded]);

  // Dynamically Plot Interactive Markers Based on Current Filters
  useEffect(() => {
    if (!map || !isSdkLoaded) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    filteredStations.forEach(station => {
      const marker = new window.google.maps.Marker({
        position: { lat: Number(station.lat), lng: Number(station.lng) },
        map: map,
        title: station.name,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#2ea44f", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 }
      });
      
      marker.addListener('click', () => {
        setSelectedStation(station);
        map.panTo({ lat: Number(station.lat), lng: Number(station.lng) });
        map.setZoom(14);
      });
      markersRef.current.push(marker);
    });
  }, [map, filteredStations, isSdkLoaded]);

  // Calculate Routes In-App
  const calculateInAppRoute = (station) => {
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;
    const startPoint = userLocation || { lat: 28.6139, lng: 77.2090 };

    directionsServiceRef.current.route(
      {
        origin: startPoint,
        destination: { lat: Number(station.lat), lng: Number(station.lng) },
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
          alert('Routing calculation error: ' + status);
        }
      }
    );
  };

  // Center Camera Focus back to User Coords
  const handleRecenter = () => {
    if (!map || !userLocation) {
      alert("GPS tracking active, waiting for precise coordinates...");
      return;
    }
    map.panTo(userLocation);
    map.setZoom(15);
  };

  // Handle Peer Host Submissions directly to Cloud Database Storage
  const handleHostSubmission = async (e) => {
    e.preventDefault();
    if (!newStationName || !newStationAddress) {
      alert("Please fill out all fields before publishing.");
      return;
    }

    // Capture user's exact coordinate location if available, otherwise drop a marker in Central Delhi
    const targetLat = userLocation?.lat || 28.6139;
    const targetLng = userLocation?.lng || 77.2090;

    const stationPayload = {
      name: newStationName,
      address: newStationAddress,
      type: newStationType,
      speed: newStationSpeed,
      lat: targetLat,
      lng: targetLng,
      isPeerHost: true,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "stations"), stationPayload);
      alert("Success! Your charger is now live on the chargeapp network grid!");
      
      setNewStationName('');
      setNewStationAddress('');
      setShowHostForm(false);
      fetchDatabaseStations(); // Force reload collection state from database
    } catch (err) {
      alert("Database writing fault: " + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      
      {/* Structural Control Sidebar Layout Panel */}
      <div className="sidebar" style={{ width: isMobile ? '100%' : '360px', height: isMobile ? '45vh' : '100%' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #30363d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="branding-header">chargeapp.in</h1>
            <span style={{ fontSize: '0.75rem', color: '#8b949e', background: '#21262d', padding: '4px 8px', borderRadius: '12px', border: '1px solid #30363d' }}>
              {filteredStations.length} visible
            </span>
          </div>
          
          <button 
            onClick={() => {
              setShowHostForm(!showHostForm);
              setRouteInfo(null);
            }}
            style={{ width: '100%', marginTop: '12px', padding: '10px', background: showHostForm ? '#30363d' : '#58a6ff', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}
          >
            {showHostForm ? '← Back to Stations Grid' : '🔌 List Your Home Charger'}
          </button>
        </div>

        {/* Conditional Flow Content Router: Form vs Collection List */}
        {showHostForm ? (
          <form onSubmit={handleHostSubmission} style={{ padding: '16px', overflowY: 'auto', flex: 1, boxSizing: 'border-box' }}>
            <h3 style={{ color: '#c9d1d9', margin: '0 0 12px 0', fontSize: '1.1rem' }}>List Private Charging Node</h3>
            
            <label style={{ color: '#8b949e', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Station Title or Host Name</label>
            <input type="text" value={newStationName} onChange={e => setNewStationName(e.target.value)} placeholder="e.g. Neha's 11kW Wallbox" style={{ width: '100%', padding: '10px', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />

            <label style={{ color: '#8b949e', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Full Street Address</label>
            <input type="text" value={newStationAddress} onChange={e => setNewStationAddress(e.target.value)} placeholder="Sector-21, Pocket B, near..." style={{ width: '100%', padding: '10px', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />

            <label style={{ color: '#8b949e', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Port Hardware Interface Design</label>
            <select value={newStationType} onChange={e => setNewStationType(e.target.value)} style={{ width: '100%', padding: '10px', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }}>
              <option value="CCS2">CCS2 (DC Fast Terminal)</option>
              <option value="AC Type 2">AC Type 2 (Standard Connector)</option>
            </select>

            <label style={{ color: '#8b949e', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Charging Velocity Class</label>
            <select value={newStationSpeed} onChange={e => setNewStationSpeed(e.target.value)} style={{ width: '100%', padding: '10px', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', marginBottom: '16px', boxSizing: 'border-box' }}>
              <option value="FAST">Fast Charging (DC)</option>
              <option value="REGULAR">Regular Speed (AC)</option>
            </select>

            <button type="submit" style={{ width: '100%', padding: '12px', background: '#2ea44f', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Publish Charger Online</button>
          </form>
        ) : (
          <>
            {/* Real-time Dynamic Filter Switch Control Panel */}
            <div style={{ padding: '12px 16px', background: '#21262d', borderBottom: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b949e', fontSize: '0.75rem', width: '45px' }}>Plug:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['ALL', 'CCS2', 'AC Type 2'].map(t => (
                    <button key={t} type="button" onClick={() => setTypeFilter(t)} style={{ padding: '4px 8px', fontSize: '0.7rem', background: typeFilter === t ? '#58a6ff' : '#30363d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#8b949e', fontSize: '0.75rem', width: '45px' }}>Rate:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['ALL', 'FAST', 'REGULAR'].map(s => (
                    <button key={s} type="button" onClick={() => setSpeedFilter(s)} style={{ padding: '4px 8px', fontSize: '0.7rem', background: speedFilter === s ? '#2ea44f' : '#30363d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rendered Filtration Cards Result List Container */}
            <div className="station-list-container">
              {filteredStations.map((station) => {
                const isActive = selectedStation?.id === station.id;
                return (
                  <div key={station.id} className={`station-card ${isActive ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
                    <h3 className="station-title">
                      {station.name} {station.isPeerHost && '🏠'}
                    </h3>
                    <p className="station-address">{station.address}</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: isActive ? '12px' : '0' }}>
                      <span className="badge">{station.type}</span>
                      <span className="badge" style={{ color: '#2ea44f', borderColor: 'rgba(46,164,79,0.15)' }}>{station.speed}</span>
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
              {filteredStations.length === 0 && (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#8b949e', fontSize: '0.9rem' }}>
                  No charging stations match your active filters.
                </div>
              )}
            </div>
          </>
        )}

        {/* Runtime Navigation Metrics Floating Card Overlay Panel */}
        {routeInfo && !showHostForm && (
          <div className="route-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span>⏱️ ETA: <strong style={{ color: '#58a6ff' }}>{routeInfo.duration}</strong></span>
              <span>📍 Dist: <strong style={{ color: '#2ea44f' }}>{routeInfo.distance}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Main Map Box Canvas View Context Area */}
      {mapError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', backgroundColor: '#0d1117' }}>
          <h3>Google Maps Configuration Initialization Fault</h3>
        </div>
      ) : (
        <div style={{ flex: 1, height: '100%', position: 'relative', backgroundColor: '#0d1117' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Floating Aesthetic Target Recenter Overlay UI Button */}
          {isSdkLoaded && (
            <button 
              onClick={handleRecenter}
              type="button"
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
                fontSize: '1.4rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 99,
                transition: 'all 0.2s ease',
              }}
            >
              🎯
            </button>
          )}

          {!isSdkLoaded && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#58a6ff', fontSize: '1rem', fontWeight: '600', backgroundColor: '#0d1117' }}>
              connecting to secure map engine instances...
            </div>
          )}
        </div>
      )}
    </div>
  );
}