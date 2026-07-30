import React from "react";
import { Play, Square, Timer, Activity, ChevronLeft, MapPin } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { useLocationTracker } from "/useLocationTracker"; 

// ✅ LEAFLET IMPORTS (This CSS line stops the map from looking shattered)
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css"; 

export default function RunTracker() {
  const { 
    isTracking, 
    path, 
    distanceKm, 
    formattedTime, 
    currentPace, 
    startTracking, 
    stopTracking 
  } = useLocationTracker();

  // ✅ SAFETY NET: Center the map on Singapore until GPS locks on
  const currentPosition = path && path.length > 0 
    ? [path[path.length - 1].lat, path[path.length - 1].lng] 
    : [1.3521, 103.8198]; 

  return (
    <main className="app">
      <section className="phone">
        <div className="phone-content" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          
          {/* Top Bar */}
          <div className="status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          {/* Header */}
          <header className="dashboard-header" style={{ paddingBottom: "10px" }}>
            <div className="header-left" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ChevronLeft size={24} style={{ cursor: "pointer" }} />
              <div>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Run Tracker</h1>
                <p style={{ margin: 0, opacity: 0.7 }}>GPS Activity</p>
              </div>
            </div>
          </header>

          {/* 🗺️ THE LIVE INTERACTIVE MAP */}
          <div 
            className="map-container" 
            style={{ 
              flex: 1,                 // ⬅️ Tells the map to grow and fill empty vertical space
              minHeight: "350px",      // ⬅️ Forces it to never shrink smaller than this on tiny screens
              margin: "0 20px 20px 20px",
              borderRadius: "20px",
              overflow: "hidden", 
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            }}
          >
            <MapContainer 
              center={currentPosition} 
              zoom={16} 
              scrollWheelZoom={true} 
              dragging={true}        
              style={{ height: "100%", width: "100%", zIndex: 0 }}
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {/* Draws the blue line behind you */}
              {path.length > 0 && (
                <Polyline positions={path} color="#3b82f6" weight={6} opacity={0.8} />
              )}

              {/* Drops a pulsing red dot on your exact current location */}
              {path.length > 0 && (
                <CircleMarker 
                  center={currentPosition} 
                  radius={8} 
                  pathOptions={{ color: "white", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }} 
                />
              )}
            </MapContainer>
          </div>
          
          {/* Live Stats Overlay */}
          <section className="ippt-grid" style={{ padding: "0 20px" }}>
            
            <div className="ippt-card blue" style={{ textAlign: "center" }}>
              <Timer size={20} style={{ margin: "0 auto 5px auto", color: "#3b82f6" }} />
              <h3 style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Time</h3>
              <strong style={{ fontSize: "1.5rem" }}>{formattedTime}</strong>
            </div>

            <div className="ippt-card purple" style={{ textAlign: "center" }}>
              <MapPin size={20} style={{ margin: "0 auto 5px auto", color: "#8b5cf6" }} />
              <h3 style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Distance</h3>
              <strong style={{ fontSize: "1.5rem" }}>{distanceKm} <span style={{ fontSize: "1rem" }}>km</span></strong>
            </div>

            <div className="ippt-card pink" style={{ textAlign: "center" }}>
              <Activity size={20} style={{ margin: "0 auto 5px auto", color: "#ec4899" }} />
              <h3 style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Avg Pace</h3>
              <strong style={{ fontSize: "1.5rem" }}>{currentPace}</strong>
            </div>

          </section>

          {/* Action Controls */}
          <div style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
            <button 
              onClick={isTracking ? stopTracking : startTracking} 
              style={{
                backgroundColor: isTracking ? "#ef4444" : "#10b981",
                color: "white",
                border: "none",
                borderRadius: "50px",
                padding: "15px 40px",
                fontSize: "1.2rem",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                transition: "all 0.3s ease",
                width: "100%",
                justifyContent: "center"
              }}
            >
              {isTracking ? <Square fill="currentColor" /> : <Play fill="currentColor" />}
              {isTracking ? "STOP RUN" : "START RUN"}
            </button>
          </div>

        </div>
        <BottomNav />
      </section>
    </main>
  );
}