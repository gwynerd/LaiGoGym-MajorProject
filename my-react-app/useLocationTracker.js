import { useState, useEffect, useRef } from "react";

export function useLocationTracker() {
  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState([]); // Stores {lat, lng} for the map
  const [distance, setDistance] = useState(0); // Raw distance in km
  const [timeElapsed, setTimeElapsed] = useState(0); // Raw time in seconds

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);

  // Math formula to calculate real-world distance between two GPS coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Returns distance in kilometers
  };

  const startTracking = () => {
    setIsTracking(true);
    setPath([]);
    setDistance(0);
    setTimeElapsed(0);

    if ("geolocation" in navigator) {
      // Fires constantly as the user moves
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          setPath((prevPath) => {
            if (prevPath.length > 0) {
              const lastPoint = prevPath[prevPath.length - 1];
              const distAdded = calculateDistance(lastPoint.lat, lastPoint.lng, newPoint.lat, newPoint.lng);
              setDistance((prev) => prev + distAdded);
            }
            return [...prevPath, newPoint];
          });
        },
        (error) => console.error("GPS Error:", error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      alert("GPS tracking is not supported by your browser.");
    }

    // Start the stopwatch
    timerRef.current = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
  };

  const stopTracking = () => {
    setIsTracking(false);
    
    // Kill the GPS radar and the timer to save battery
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
    
    console.log("🏁 Run Complete! Distance:", distance.toFixed(2), "km");
    // TODO: You can push the 'path' array and 'distance' to Firebase here later
  };

  // Cleanup to prevent memory leaks if the user navigates away from the page
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  // --- Formatting Helpers for the UI ---
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const calculatePace = () => {
    if (distance === 0 || timeElapsed === 0) return "--";
    const paceInMinsPerKm = (timeElapsed / 60) / distance;
    const paceMins = Math.floor(paceInMinsPerKm);
    const paceSecs = Math.round((paceInMinsPerKm - paceMins) * 60).toString().padStart(2, "0");
    return `${paceMins}'${paceSecs}"`;
  };

  return {
    isTracking,
    path, // Array of GPS coordinates for Leaflet
    distanceKm: distance.toFixed(2),
    formattedTime: formatTime(timeElapsed),
    currentPace: calculatePace(),
    startTracking,
    stopTracking
  };
}