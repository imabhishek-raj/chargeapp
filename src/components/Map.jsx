import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";

import {
  useState,
  useEffect,
  useMemo,
} from "react";

const containerStyle = {
  width: "100%",
  height: "500px",
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.209,
};

export default function Map({ stations }) {
  const [selectedStation, setSelectedStation] =
    useState(null);

  const [userLocation, setUserLocation] =
    useState(null);

  const [mapCenter, setMapCenter] =
    useState(defaultCenter);

  const [showNearbyStations, setShowNearbyStations] =
    useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.log(
        "Geolocation is not supported"
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(currentLocation);
        setMapCenter(currentLocation);
      },
      (error) => {
        console.log(
          "Location error:",
          error
        );
      }
    );
  }, []);

  const handleDirections = (station) => {
    const confirmed = window.confirm(
      `Open navigation to ${station.name}?`
    );

    if (confirmed) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
      window.open(url, "_blank");
    }
  };

  const goToMyLocation = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setSelectedStation(null);
    }
  };

  const calculateDistance = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {
    const R = 6371;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return (R * c).toFixed(1);
  };

  const stationsWithDistance = useMemo(() => {
    if (!userLocation) return [];

    return stations
      .map((station) => ({
        ...station,
        distance: Number(
          calculateDistance(
            userLocation.lat,
            userLocation.lng,
            station.lat,
            station.lng
          )
        ),
      }))
      .sort(
        (a, b) =>
          a.distance - b.distance
      );
  }, [stations, userLocation]);

  const goToStation = (station) => {
    setMapCenter({
      lat: station.lat,
      lng: station.lng,
    });

    setSelectedStation(station);
  };

  return (
    <>
      {userLocation && (
        <div
          style={{
            marginBottom: "15px",
          }}
        >
          <button
            onClick={() =>
              setShowNearbyStations(
                !showNearbyStations
              )
            }
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            {showNearbyStations
              ? "▲ Hide Nearby Charging Stations"
              : "▼ Nearby Charging Stations"}
          </button>

          {showNearbyStations && (
            <div
              style={{
                backgroundColor:
                  "#f8fafc",
                border:
                  "1px solid #ddd",
                borderRadius: "10px",
                padding: "15px",
                marginTop: "10px",
              }}
            >
              {stationsWithDistance.map(
                (station) => (
                  <div
                    key={station.id}
                    onClick={() =>
                      goToStation(
                        station
                      )
                    }
                    style={{
                      padding: "10px",
                      marginBottom:
                        "8px",
                      border:
                        "1px solid #eee",
                      borderRadius:
                        "6px",
                      cursor:
                        "pointer",
                      backgroundColor:
                        "white",
                    }}
                  >
                    <strong>
                      {station.name}
                    </strong>

                    <div>
                      📍{" "}
                      {
                        station.distance
                      }{" "}
                      km away
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={goToMyLocation}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          padding: "10px 15px",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "12px",
          fontSize: "15px",
        }}
      >
        📍 My Location
      </button>

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={
            containerStyle
          }
          center={mapCenter}
          zoom={11}
          onClick={() =>
            setSelectedStation(null)
          }
        >
          {userLocation && (
            <Marker
              position={userLocation}
              label="You"
              title="Your Current Location"
            />
          )}

          {stations.map((station) => (
            <Marker
              key={station.id}
              position={{
                lat: station.lat,
                lng: station.lng,
              }}
              label={
                userLocation
                  ? {
                      text: `${calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        station.lat,
                        station.lng
                      )} km`,
                      fontSize:
                        "12px",
                    }
                  : undefined
              }
              onClick={() =>
                setSelectedStation(
                  station
                )
              }
            />
          ))}

          {selectedStation && (
            <InfoWindow
              position={{
                lat:
                  selectedStation.lat,
                lng:
                  selectedStation.lng,
              }}
              onCloseClick={() =>
                setSelectedStation(
                  null
                )
              }
            >
              <div
                style={{
                  minWidth: "220px",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                  }}
                >
                  {selectedStation.name}
                </h3>

                <p>
                  {
                    selectedStation.address
                  }
                </p>

                <p>
                  <strong>
                    Connector:
                  </strong>{" "}
                  {
                    selectedStation.connector
                  }
                </p>

                <p>
                  <strong>
                    Status:
                  </strong>{" "}
                  {
                    selectedStation.status
                  }
                </p>

                {userLocation && (
                  <p>
                    <strong>
                      Distance:
                    </strong>{" "}
                    {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      selectedStation.lat,
                      selectedStation.lng
                    )}{" "}
                    km
                  </p>
                )}

                <button
                  onClick={() =>
                    handleDirections(
                      selectedStation
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor:
                      "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius:
                      "6px",
                    cursor:
                      "pointer",
                    fontWeight:
                      "bold",
                  }}
                >
                  🚗 Get Directions
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
    </>
  );
}