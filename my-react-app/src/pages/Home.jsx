import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Watch, Activity, Save, ChevronRight, X, Info, RefreshCw } from "lucide-react";
import BottomNav from "../components/BottomNav";
import {
  addIPPTRecordAndKeepLatestFive,
  updateUserReadinessAndIPPT,
  getUserById,
  calculateAgeFromDob,
} from "../services/firestoreService";
import { calculateIPPT } from "../services/ipptCalculator";
import { useFitbitApi } from "/useFitbitApi";

function formatRuntimeToColon(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const stringValue = String(value).trim();

  // Already in valid minutes:seconds format
  if (/^\d{1,2}:[0-5]\d$/.test(stringValue)) {
    return stringValue;
  }

  // Device value is assumed to be total seconds
  const totalSeconds = Number(stringValue);

  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isValidRuntime(value) {
  if (typeof value !== "string") return false;

  // Accepts:
  // 9:00
  // 10:00
  // 13:45
  //
  // Rejects:
  // 10
  // 10.00
  // 10:0
  // 10:60
  // 1000
  const runtimePattern = /^\d{1,2}:[0-5]\d$/;

  return runtimePattern.test(value.trim());
}

function Home() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user"));

  const [userProfile, setUserProfile] = useState(currentUser || null);
  const [pushups, setPushups] = useState("");
  const [situps, setSitups] = useState("");

  const [runtime, setRuntime] = useState("");
  const [runningDistance, setRunningDistance] = useState("");
  
  // ✅ Both state variables exist independently now
  const [heartRate, setHeartRate] = useState(""); 
  const [avgExerciseHr, setAvgExerciseHr] = useState("");
  
  const [sleepHours, setSleepHours] = useState("");

  const [wantedGoal, setWantedGoal] = useState("Pass");
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const userID = currentUser?.userID || currentUser?.id;
  const dateOfBirth = userProfile?.dateOfBirth || userProfile?.dob || "";
  const userAge = calculateAgeFromDob(dateOfBirth);

  const { healthData, loading, accessToken, handleFitbitClick } = useFitbitApi(userID);
  const isDeviceConnected = !!accessToken;

  useEffect(() => {
    if (!healthData) return;

    if (isDeviceConnected) {
      setRuntime(formatRuntimeToColon(healthData.runTime));

      const distanceInKm = healthData.runningDistance > 0 ? healthData.runningDistance : "";
      setRunningDistance(distanceInKm);
      setHeartRate(healthData.heartRate); // Sets daily HR
      setAvgExerciseHr(healthData.avgExerciseHr); // Sets workout HR

      setSleepHours(
        healthData.sleep !== undefined ||
          healthData.sleepMinutes !== undefined
          ? `${healthData.sleep || 0}.${healthData.sleepMinutes || 0}`
          : ""
      );
    } else {
      if (runtime === "" && healthData.runTime !== undefined) {
        setRuntime(formatRuntimeToColon(healthData.runTime));
      }

      if (
        runningDistance === "" &&
        healthData.runningDistance !== undefined
      ) {
        const distanceInKm = healthData.runningDistance > 0 ? healthData.runningDistance : "";
        setRunningDistance(distanceInKm);
      }

      if (heartRate === "" && healthData.heartRate !== undefined) {
        setHeartRate(healthData.heartRate);
      }

      if (avgExerciseHr === "" && healthData.avgExerciseHr !== undefined) {
        setAvgExerciseHr(healthData.avgExerciseHr);
      }

      if (
        sleepHours === "" &&
        (healthData.sleep !== undefined ||
          healthData.sleepMinutes !== undefined)
      ) {
        setSleepHours(
          `${healthData.sleep || 0}.${healthData.sleepMinutes || 0}`
        );
      }
    }
  }, [healthData, isDeviceConnected]);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!currentUser) return;

      try {
        const id = currentUser.userID || currentUser.id;
        const freshUser = await getUserById(id);

        const mergedUser = {
          ...currentUser,
          ...(freshUser || {}),
        };

        setUserProfile(mergedUser);
        localStorage.setItem("user", JSON.stringify(mergedUser));
      } catch (error) {
        console.error("Error loading user profile:", error);
      }
    };

    loadUserProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveMessage("");
    setErrorMessage("");

    if (!currentUser) {
      setErrorMessage("Please login first.");
      setTimeout(() => navigate("/login"), 1000);
      return;
    }

    if (!userID) {
      setErrorMessage("User ID missing. Please contact admin.");
      return;
    }

    if (!dateOfBirth || !userAge) {
      setErrorMessage(
        "Date of birth missing. Please ask admin to update your profile."
      );
      return;
    }

    if (!runtime || !avgExerciseHr || !sleepHours) {
      setErrorMessage(
        "Please enter practice run, heart rate and sleep data first."
      );
      return;
    }

    if (!isValidRuntime(runtime)) {
      setErrorMessage(
        "Please enter the run time in minutes:seconds format, for example 9:00 or 10:00."
      );
      return;
    }

    try {
      const validRuntime = runtime.trim();

      const ippt = calculateIPPT({
        age: userAge,
        pushups: Number(pushups),
        situps: Number(situps),
        runtime: validRuntime,
        wantedGoal,
      });
      await addIPPTRecordAndKeepLatestFive({
        userID,
        personnelDocID: userID,

        firstName: userProfile?.firstName || "",
        lastName: userProfile?.lastName || "",
        name:
          userProfile?.name ||
          `${userProfile?.firstName || ""} ${userProfile?.lastName || ""
          }`.trim(),

        dob: dateOfBirth,
        dateOfBirth,
        gender: userProfile?.gender || currentUser.gender || "Male",
        rank: userProfile?.rank || "N/A",
        unit: userProfile?.unit || "N/A",
        commanderID: userProfile?.commanderID || "N/A",

        recordType: "Practice",
        source: isDeviceConnected
          ? "Fitbit + Manual Practice"
          : "Manual Practice",

        pushups: Number(pushups),
        situps: Number(situps),
        runtime: validRuntime,
        heartRate: Number(heartRate), // Saves latest HR
        avgExerciseHr: Number(avgExerciseHr), // Saves workout HR
        sleepHours: Number(sleepHours),

        pushupScore: ippt.pushupScore,
        situpScore: ippt.situpScore,
        runScore: ippt.runScore,
        totalscore: ippt.totalscore,
        totalScore: ippt.totalscore,
        ipptScore: ippt.ipptScore,
        result: ippt.result,

        readinessScore: ippt.totalscore,
        fitnessReadiness: ippt.totalscore,
        readinessLevel: ippt.readinessLevel,

        fitbitData: isDeviceConnected ? "Connected" : "Not Connected",

        wantedGoal: ippt.wantedGoal,
        goalScore: ippt.goalScore,
        pointsToGoal: ippt.pointsToGoal,
        goalAchieved: ippt.goalAchieved,

        createdAt: new Date().toISOString(),
      });

      await updateUserReadinessAndIPPT(userID, ippt.totalscore, ippt.result);

      setSaveMessage(
        `Practice saved! Fitness Readiness: ${ippt.totalscore}% (${ippt.result})`
      );

      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (error) {
      console.error(error);
      setErrorMessage("Unable to save practice record. Please try again.");
    }
  };

  const formatData = (value, unit = "") => {
    if (loading) return "Syncing...";
    if (accessToken) {
      return `${value} ${unit}`.trim();
    }
    return `-- ${unit}`.trim();
  };

  const currentSteps = loading
    ? "Syncing..."
    : accessToken
      ? Number(healthData.steps).toLocaleString()
      : "--";

  const displaySleep = loading
    ? "Syncing..."
    : accessToken
      ? `${healthData.sleep} hrs ${healthData.sleepMinutes} mins`
      : "-- hrs -- mins";

  return (
    <main className="app">
      <section className="phone" style={{ position: "relative" }}>
        <div className="phone-content home-modern-page">
          <div className="status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <section className="home-modern-hero">
            <div className="home-modern-top">
              <div className="home-modern-avatar">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="Profile" />
                ) : (
                  <User size={34} />
                )}
              </div>

              <div>
                <h1>Hi, {userProfile?.firstName || "Personnel"} 👋</h1>
                <p>
                  {userProfile?.rank || "Rank N/A"} •{" "}
                  {userProfile?.unit || "Firefighter"}
                </p>
              </div>
            </div>

            <p className="home-modern-subtitle">
              Ready to improve your IPPT practice today?
            </p>

            <div className="home-modern-stats">
              <div>
                <span>Age</span>
                <strong>{userAge || "N/A"}</strong>
              </div>

              <div>
                <span>Goal</span>
                <strong>{wantedGoal}</strong>
              </div>
            </div>
          </section>

          {saveMessage && (
            <div className="app-success-message">{saveMessage}</div>
          )}

          {errorMessage && (
            <div className="app-error-message">{errorMessage}</div>
          )}

          <section className="home-modern-card">
            <div className="home-modern-title-row">
              {/* ✅ Added extra spacing/margin around the watch and info icon wrapper */}
              <div style={{ position: "relative", display: "inline-block", marginRight: "6px" }}>
                <Info 
                  size={20} 
                  color="#64748b" 
                  style={{ 
                    position: "absolute", 
                    top: "-10px", 
                    left: "-10px", 
                    cursor: "pointer", 
                    background: "#ffffff", 
                    borderRadius: "50%",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }} 
                  onClick={() => setShowInfoModal(true)} 
                />
                <div className="home-modern-icon">
                  <Watch size={18} />
                </div>
              </div>

              <div style={{ flex: 1, marginLeft: "6px" }}>
                <h2 style={{ margin: 0 }}>Device Sync</h2>
              </div>

              {/* ✅ Refresh and Sync buttons side-by-side on the right */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isDeviceConnected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleFitbitClick(); 
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Refresh Data"
                  >
                    <RefreshCw size={18} color={loading ? "#cbd5e1" : "#0ea5e9"} />
                  </button>
                )}

                <button
                  type="button"
                  className="home-connect-btn"
                  onClick={() => setShowDeviceModal(true)}
                >
                  {isDeviceConnected ? "Connected" : "Add Device"}{" "}
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="home-health-grid" style={{ maxHeight: "400px", overflowY: "auto" }}>
              <div>
                <span>Run</span>
                <strong>{formatData(healthData?.distance, "km")}</strong>
              </div>

              {/* ✅ Uses daily heartRate as requested */}
              <div>
                <span>Heart</span>
                <strong>{formatData(healthData?.heartRate, "bpm")}</strong>
              </div>

              <div>
                <span>Step</span>
                <strong>{currentSteps}</strong>
              </div>
              <div>
                <span>Cal Burn</span>
                <strong>{formatData(healthData?.calories, "")}</strong>
              </div>
              <div>
                <span>Sleep</span>
                <strong>{displaySleep}</strong>
              </div>
            </div>
          </section>

          <form
            className="home-modern-card home-practice-modern"
            onSubmit={handleSubmit}
          >
            <div className="home-modern-title-row simple">
              <div className="home-modern-icon">
                <Activity size={18} />
              </div>

              <div>
                <h2>Today’s Practice</h2>
                <p>
                  {isDeviceConnected
                    ? "Device synced. Values are auto-filled, but you can edit them manually."
                    : "No device connected, so you can enter all values manually."}
                </p>
              </div>
            </div>

            <div className="home-modern-input-grid">
              <div className="home-modern-field">
                <label>Push-Ups</label>
                <input
                  type="number"
                  value={pushups}
                  onChange={(e) => setPushups(e.target.value)}
                  placeholder="e.g. 30"
                  required
                />
              </div>

              <div className="home-modern-field">
                <label>Sit-Ups</label>
                <input
                  type="number"
                  value={situps}
                  onChange={(e) => setSitups(e.target.value)}
                  placeholder="e.g. 30"
                  required
                />
              </div>
            </div>

            <div className="home-modern-input-grid">
              <div className="home-modern-field">
                <label>Run Time</label>

                <input
                  type="text"
                  value={runtime}
                  onChange={(e) => {
                    let value = e.target.value;

                    // Allow only digits and one colon.
                    // A dot is not converted into a colon.
                    value = value.replace(/[^0-9:]/g, "");

                    const colonIndex = value.indexOf(":");

                    if (colonIndex !== -1) {
                      // Remove any additional colons
                      const minutes = value
                        .slice(0, colonIndex)
                        .replace(/:/g, "")
                        .slice(0, 2);

                      const seconds = value
                        .slice(colonIndex + 1)
                        .replace(/:/g, "")
                        .slice(0, 2);

                      value = `${minutes}:${seconds}`;
                    } else {
                      // Allow at most 2 minute digits before the colon
                      value = value.slice(0, 2);
                    }

                    setRuntime(value);
                    setErrorMessage("");
                  }}
                  placeholder="e.g. 10:00"
                  inputMode="numeric"
                  maxLength={5}
                  pattern="\d{1,2}:[0-5]\d"
                  title="Enter the time in minutes:seconds format, for example 9:00 or 10:00."
                  required
                />
              </div>
              <div className="home-modern-field">
                <label>Run Distance</label>
                <input
                  type="number"
                  step="0.01"
                  value={runningDistance} // This is now in KM
                  onChange={(e) => setRunningDistance(e.target.value)}
                  placeholder="e.g. 2.4"
                  required
                />
              </div>
            </div>

            <div className="home-modern-input-grid">
              {/* ✅ Uses avgExerciseHr as requested */}
              <div className="home-modern-field">
                <label>Average Exercise HR</label>
                <input
                  type="number"
                  value={avgExerciseHr}
                  onChange={(e) => setAvgExerciseHr(e.target.value)}
                  placeholder="e.g. 120"
                  required
                />
              </div>

              <div className="home-modern-field">
                <label>Sleep Hours</label>
                <input
                  type="number"
                  step="0.1"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  placeholder="e.g. 7.5"
                  required
                />
              </div>
            </div>

            <div className="home-modern-field">
              <label>Goal</label>
              <select
                value={wantedGoal}
                onChange={(e) => setWantedGoal(e.target.value)}
              >
                <option value="Pass">Pass</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
              </select>
            </div>

            <button className="home-save-btn" type="submit">
              <Save size={16} />
              Save Practice Record
            </button>
          </form>

          <button
            className="home-secondary-btn"
            type="button"
            onClick={() => navigate("/unit-readiness")}
          >
            View Unit Readiness
          </button>
        </div>

        <BottomNav activePage="home" />

        {/* ✅ NEW: Info Modal explaining the Sync process */}
        {showInfoModal && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 1001, // Slightly higher than device modal
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backdropFilter: "blur(2px)",
            borderRadius: "40px"
          }}>
            <div style={{
              background: "white",
              padding: "24px",
              borderRadius: "24px",
              width: "85%",
              maxWidth: "320px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Info size={20} color="#0ea5e9" /> About Device Sync
                </h3>
                <X size={20} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setShowInfoModal(false)} />
              </div>
              <p style={{ margin: 0, fontSize: "0.95rem", color: "#475569", lineHeight: "1.5" }}>
                Connecting your device securely links your Google Health account to automatically pull in your latest <strong>Run Distance</strong>, <strong>Run Time</strong>, <strong>Heart Rate</strong>, and <strong>Sleep Hours</strong>.
              </p>
              <p style={{ margin: 0, fontSize: "0.95rem", color: "#475569", lineHeight: "1.5" }}>
                Tap the <RefreshCw size={14} color="#0ea5e9" style={{ verticalAlign: "middle", margin: "0 2px" }}/> refresh icon to manually update the data right now. You can still manually edit any auto-filled numbers before saving your practice.
              </p>
              <button
                style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: "#f1f5f9", color: "#334155", fontWeight: "bold", cursor: "pointer", marginTop: "6px" }}
                onClick={() => setShowInfoModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {showDeviceModal && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backdropFilter: "blur(2px)",
            borderRadius: "40px"
          }}>
            <div style={{
              background: "white",
              padding: "24px",
              borderRadius: "24px",
              width: "85%",
              maxWidth: "320px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b" }}>Device Sync</h3>
                <X size={20} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setShowDeviceModal(false)} />
              </div>

              <p style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#64748b" }}>
                Manage your live fitness data connection.
              </p>

              {isDeviceConnected ? (
                <button
                  style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #fecaca", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "1rem", fontWeight: "bold", color: "#ef4444", cursor: "pointer", transition: "0.2s" }}
                  onClick={() => {
                    localStorage.removeItem(`google_health_token_${userID}`);
                    window.location.reload();
                  }}
                >
                  <X size={20} color="#ef4444" /> Disconnect Google Fit
                </button>
              ) : (
                <button
                  style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "1rem", fontWeight: "bold", color: "#334155", cursor: "pointer", transition: "0.2s" }}
                  onClick={() => {
                    handleFitbitClick();
                    setShowDeviceModal(false);
                  }}
                >
                  <Activity size={20} color="#0ea5e9" /> Connect Google Fit
                </button>
              )}

            </div>
          </div>
        )}

      </section>
    </main>
  );
}

export default Home;