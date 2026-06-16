import { useState } from "react";

import Navbar from "../components/Navbar";
import Map from "../components/Map";

import stations from "../data/Stations";

export default function Home() {
  const [selectedCity, setSelectedCity] = useState("All");

  const filteredStations =
    selectedCity === "All"
      ? stations
      : stations.filter(
          (station) => station.city === selectedCity
        );

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <Navbar />


      <select
        value={selectedCity}
        onChange={(e) =>
          setSelectedCity(e.target.value)
        }
        style={{
          padding: "10px",
          fontSize: "16px",
          marginBottom: "15px",
          borderRadius: "8px",
        }}
      >
        <option value="All">All Cities</option>
        <option value="Delhi">Delhi</option>
        <option value="Noida">Noida</option>
        <option value="Faridabad">Faridabad</option>
        <option value="Ghaziabad">Ghaziabad</option>
        <option value="Gurugram">Gurugram</option>
      </select>

    

      <Map stations={filteredStations} />
    </div>
  );
}