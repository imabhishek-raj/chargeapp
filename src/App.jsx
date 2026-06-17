import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { db, collection, addDoc, getDocs, auth, RecaptchaVerifier, signInWithPhoneNumber } from './firebase';

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
  const [typeFilter, setTypeFilter] = useState('ALL'); 
  const [speedFilter, setSpeedFilter] = useState('ALL'); 

  // Host Input Form Display Toggle States
  const [showHostForm, setShowHostForm] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationType, setNewStationType] = useState('CCS2');
  const [newStationSpeed, setNewStationSpeed] = useState('FAST');

  // Phone Verification OTP System States
  const [currentUser, setCurrentUser] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('+91'); 
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  // Monitor Authentication Session Persistence
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

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
      
      if (items.length === 0) {
        setStations([
          { id: 'm1', name: 'Kashmere Gate EV Hub', address: 'Metro Gate 1, Delhi', type: 'CCS2', speed: 'FAST', lat: 28.6675, lng: 77.2282 },
          { id: 'm2', name: 'Connaught Place Station', address: 'Block E, New Delhi', type: 'AC Type 2', speed: 'REGULAR', lat: 28.6304, lng: 77.2177 }
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
    if (typeFilter !== 'ALL') result = result.filter(s => s.type === typeFilter);
    if (speedFilter !== 'ALL') result = result.filter(s => s.speed === speedFilter);
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
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#30363d" }] },
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
        polylineOptions: { strokeColor: "#58a6ff", strokeWeight: 5 }
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
            position: coords, map, icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#58a6ff", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 }
          });
        }
      }, null, { enableHighAccuracy: true });
    }
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [map, isSdkLoaded]);

  // Plot Interactive Markers Based on Filters
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
      });
      markersRef.current.push(marker);
    });
  }, [map, filteredStations, isSdkLoaded]);

  const calculateInAppRoute = (station) => {
    if (!directionsServiceRef.current || !directionsRendererRef.current) return;
    const startPoint = userLocation || { lat: 28.6139, lng: 77.2090 };
    directionsServiceRef.current.route(
      { origin: startPoint, destination: { lat: Number(station.lat), lng: Number(station.lng) }, travelMode: window.google.maps.TravelMode.DRIVING },
      (response, status) => {
        if (status === 'OK') {
          directionsRendererRef.current.setDirections(response);
          const leg = response.routes[0].legs[0];
          setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text });
        }
      }
    );
  };

  // --- OTP Verification Logic ---
  const initRecaptcha = () => {
    if (recaptchaVerifierRef.current) return;
    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => { console.log('reCAPTCHA security cleared.'); }
      });
    } catch (err) {
      console.error("reCAPTCHA configuration error: ", err);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      alert("Please enter a valid phone number with your country code.");
      return;
    }
    setIsSendingOtp(true);
    initRecaptcha();

    try {
      const appVerifier = recaptchaVerifierRef.current;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      alert("A 6-digit OTP passcode was sent to your phone!");
    } catch (err) {
      alert("Failed to send verification SMS: " + err.message);
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      alert("Please enter the complete 6-digit OTP passcode.");
      return;
    }
    try {
      const result = await confirmationResult.confirm(otpCode);
      setCurrentUser(result.user);
      alert("Phone number verified successfully! You can now publish your charger.");
    } catch (err) {
      alert("Incorrect or expired OTP verification token. Try again.");
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setConfirmationResult(null);
    setOtpCode('');
  };

  // --- Secure Host Grid Node Submissions ---
  const handleHostSubmission = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Security Error: You must complete the OTP authentication step before listing a charger.");
      return;
    }
    if (!newStationName || !newStationAddress) {
      alert("Please complete all property fields before continuing.");
      return;
    }

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
      verifiedHostUid: currentUser.uid, 
      hostPhone: currentUser.phoneNumber,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "stations"), stationPayload);
      alert("Success! Your verified charger node is now live on the map grid!");
      setNewStationName('');
      setNewStationAddress('');
      setShowHostForm(false);
      fetchDatabaseStations();
    } catch (err) {
      alert("Database writing error occurred: " + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      
      {/* Required reCAPTCHA anchor container */}
      <div id="recaptcha-container"></div>

      {/* Control Sidebar Layout Panel */}
      <div className="sidebar" style={{ width: isMobile ? '100%' : '360px', height: isMobile ? '45vh' : '100%' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #30363d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="branding-header">chargeapp.in</h1>
            <span style={{ fontSize: '0.75rem', color: '#8b949e', background: '#21262d', padding: '4px 8px', borderRadius: '12px', border: '1px solid #30363d' }}>
              {filteredStations.length} stations
            </span>
          </div>
          
          <button 
            onClick={() => { setShowHostForm(!showHostForm); setRouteInfo(null); }}
            style={{ width: '100%', marginTop: '12px', padding: '10px', background: showHostForm ? '#30363d' : '#2ea44f', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {showHostForm ? '← Back to Map View' : '🔌 List Your Home Charger'}
          </button>
        </div>

        {/* Form Drawer Interface Flow Controller */}
        {showHostForm ? (
          <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            
            {/* GATEWAY LEVEL 1: If User is unverified, show the OTP layout screen */}
            {!currentUser ? (
              <div style={{ background: '#21262d', border: '1px solid #30363d', padding: '16px', borderRadius: '8px' }}>
                <h4 style={{ color: '#fff', margin: '0 0 6px 0' }}>🔐 Verification Required</h4>
                <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 12px 0', lineHeight: '1.3' }}>To prevent spam listings, you must verify your phone connection via a 6-digit SMS OTP passcode before listing chargers.</p>

                {!confirmationResult ? (
                  <form onSubmit={handleSendOtp}>
                    <label style={{ color: '#c9d1d9', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Phone Number (with Country Code Prefix)</label>
                    <input type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="e.g. +919876543210" style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', marginBottom: '10px', boxSizing: 'border-box' }} />
                    <button type="submit" disabled={isSendingOtp} style={{ width: '100%', padding: '10px', background: '#58a6ff', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {isSendingOtp ? 'Sending SMS...' : 'Send Verification OTP'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp}>
                    <p style={{ color: '#58a6ff', fontSize: '0.75rem', margin: '0 0 8px 0' }}>Code sent to {phoneNumber}</p>
                    <label style={{ color: '#c9d1d9', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Enter 6-Digit OTP</label>
                    <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="123456" maxLength={6} style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', marginBottom: '10px', boxSizing: 'border-box', letterSpacing: '4px', textAlign: 'center' }} />
                    <button type="submit" style={{ width: '100%', padding: '10px', background: '#2ea44f', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Confirm OTP Code</button>
                  </form>
                )}
              </div>
            ) : (
              /* GATEWAY LEVEL 2: User successfully verified. Show the real charger entry form fields */
              <form onSubmit={handleHostSubmission} style={{ width: '100%' }}>
                <div style={{ background: 'rgba(46,164,79,0.1)', border: '1px solid #2ea44f', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#58a6ff', fontSize: '0.75rem', fontWeight: '600' }}>✓ Verified: {currentUser.phoneNumber}</span>
                  <button type="button" onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#f85149', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>Disconnect</button>
                </div>

                <h3 style={{ color: '#c9d1d9', margin: '0 0 12px 0', fontSize: '1rem' }}>List Private Charging Node</h3>
                
                <label style={{ color: '#8b949e', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Station Title / Host Name</label>
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

                <button type="submit" style={{ width: '100%', padding: '12px', background: '#2ea44f', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Publish Verified Charger</button>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Real-time Filter Panels */}
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

            {/* Rendered Cards Container */}
            <div className="station-list-container">
              {filteredStations.map((station) => {
                const isActive = selectedStation?.id === station.id;
                return (
                  <div key={station.id} className={`station-card ${isActive ? 'active' : ''}`} onClick={() => setSelectedStation(station)}>
                    <h3 className="station-title">
                      {station.name} {station.isPeerHost && '🏠'} {station.verifiedHostUid && '🔒'}
                    </h3>
                    <p className="station-address">{station.address}</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: isActive ? '12px' : '0' }}>
                      <span className="badge">{station.type}</span>
                      <span className="badge" style={{ color: '#2ea44f', borderColor: 'rgba(46,164,79,0.15)' }}>{station.speed}</span>
                    </div>

                    {isActive && (
                      <button className="nav-button" onClick={(e) => { e.stopPropagation(); calculateInAppRoute(station); }}>
                        Start In-App Navigation
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Main Map Box Context Layout Canvas */}
      <div style={{ flex: 1, height: '100%', position: 'relative', backgroundColor: '#0d1117' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

    </div>
  );
}