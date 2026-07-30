import { useState, useEffect } from "react";
import { db } from "./src/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export function useFitbitApi(userId) {

  const getStoredTokens = () => {
    const stored = localStorage.getItem(`google_health_token_${userId}`);
    if (!stored) return { access: "", refresh: "" };
    try {
      return JSON.parse(stored);
    } catch (e) {
      return { access: stored, refresh: "" };
    }
  };

  const [accessToken, setAccessToken] = useState(() => {
    const tokens = getStoredTokens();
    return tokens.access || "";
  });

  const [loading, setLoading] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [currentSyncDate, setCurrentSyncDate] = useState(new Date().toDateString());

  const [healthData, setHealthData] = useState({
    steps: 0,
    heartRate: 0,
    calories: 0,
    distance: 0,
    runningDistance: 0,
    runTime: 0,
    avgExerciseHr: 0, // ✅ Clean, single average for all workouts combined
    avgRunningHr: 0,  // ✅ NEW: Average specifically for running
    sleep: 0, 
    sleepMinutes: 0,
  });

  const CLIENT_ID = "1092209529245-d792ks4c83it85ji1tv781mf5p508o15.apps.googleusercontent.com";
  const BACKEND_URL = "http://localhost:3000"; 

  const SCOPES = [
    "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
    "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
    "https://www.googleapis.com/auth/googlehealth.sleep.readonly"
  ].join(" ");

  const getLocalISOString = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    const timezoneOffset = -date.getTimezoneOffset();
    const sign = timezoneOffset >= 0 ? "+" : "-";
    const offsetHours = pad(Math.floor(Math.abs(timezoneOffset) / 60));
    const offsetMins = pad(Math.abs(timezoneOffset) % 60);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offsetHours}:${offsetMins}`;
  };

  useEffect(() => {
    if (!userId) return;

    const fetchFromFirebase = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "healthData", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHealthData({
            steps: data.steps || 0,
            heartRate: data.heartRate || 0,
            calories: data.calories || 0,
            distance: data.distance || 0,
            runningDistance: data.runningDistance || 0,
            runTime: data.runTime || 0,
            avgExerciseHr: data.avgExerciseHr || 0, 
            avgRunningHr: data.avgRunningHr || 0, // ✅ Pull new running HR from Firebase
            sleep: data.sleep || 0,
            sleepMinutes: data.sleepMinutes || 0,
          });
        }
      } catch (error) {
        console.error("Firebase fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFromFirebase();
  }, [userId]);

  useEffect(() => {
    if (window.google) {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        access_type: 'offline', 
        prompt: 'consent', 
        callback: async (response) => {
          if (response.code) {
            console.log("🔐 Got Auth Code from Google! Sending to backend...");
            try {
              const res = await fetch(`${BACKEND_URL}/api/exchange-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: response.code, userId: userId })
              });
              
              const data = await res.json();
              if (data.accessToken) {
                setAccessToken(data.accessToken);
                
                const tokenBundle = {
                  access: data.accessToken,
                  refresh: data.refreshToken || getStoredTokens().refresh 
                };
                localStorage.setItem(`google_health_token_${userId}`, JSON.stringify(tokenBundle));
                
                syncRealGoogleHealthData(data.accessToken);
              }
            } catch (err) {
              console.error("❌ Failed to exchange code with backend:", err);
            }
          }
        },
      });
      setTokenClient(client);
    }
  }, [userId]);

  useEffect(() => {
    if (!accessToken) return;

    syncRealGoogleHealthData(accessToken);

    // Interval is currently set to 5 minutes for testing.
    // To change back to 1 minute, use 60000.
    const syncInterval = 300000; // 5 minutes in milliseconds
    console.log(`⏰ Auto-sync interval initialized. Will update every ${syncInterval / 60000} minutes.`);

    const intervalId = setInterval(() => {
      const todayString = new Date().toDateString();

      if (todayString !== currentSyncDate) {
        console.log("🌙 [MIDNIGHT ROLLOVER] Wiping state to 0 for the new day...");
        setCurrentSyncDate(todayString);
        setHealthData({
          steps: 0, heartRate: 0, calories: 0, distance: 0, runningDistance: 0, runTime: 0, avgExerciseHr: 0, avgRunningHr: 0, sleep: 0, sleepMinutes: 0
        });
      }

      console.log("🔄 Auto-refresh triggered: Fetching latest live data...");
      syncRealGoogleHealthData(accessToken);
    }, syncInterval);

    return () => clearInterval(intervalId);
  }, [accessToken, currentSyncDate]);

  const handleFitbitClick = () => {
    if (!accessToken && tokenClient) {
      tokenClient.requestCode(); 
    } else {
      syncRealGoogleHealthData(accessToken);
    }
  };

  const refreshExpiredToken = async () => {
    console.log("🔄 Attempting to refresh token via backend...");
    try {
      const { refresh } = getStoredTokens();
      
      if (!refresh) {
        console.error("❌ No refresh token found in the bundle.");
        return null;
      }

      const res = await fetch(`${BACKEND_URL}/api/get-fresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }) 
      });
      
      const data = await res.json();
      if (data.accessToken) {
        console.log("✅ Token successfully refreshed!");
        setAccessToken(data.accessToken);
        
        const updatedBundle = { access: data.accessToken, refresh: refresh };
        localStorage.setItem(`google_health_token_${userId}`, JSON.stringify(updatedBundle));
        
        return data.accessToken;
      }
    } catch (err) {
      console.error("❌ Backend failed to refresh token:", err);
    }
    return null;
  };

  const syncRealGoogleHealthData = async (token) => {
    if (!token || !userId) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const now = new Date();
      const startDoc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endDoc = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

      const startOfDay = getLocalISOString(startDoc);
      const endOfDay = getLocalISOString(endDoc);

      const localY = now.getFullYear();
      const localM = String(now.getMonth() + 1).padStart(2, '0');
      const localD = String(now.getDate()).padStart(2, '0');
      const civilToday = `${localY}-${localM}-${localD}`;

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const civilTomorrow = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      const heartFilter = encodeURIComponent(`heart_rate.sample_time.physical_time >= "${startOfDay}" AND heart_rate.sample_time.physical_time < "${endOfDay}"`);
      const sleepFilter = encodeURIComponent(`sleep.interval.civil_end_time >= "${civilToday}" AND sleep.interval.civil_end_time < "${civilTomorrow}"`);
      const exerciseFilter = encodeURIComponent(`exercise.interval.civil_start_time >= "${civilToday}" AND exercise.interval.civil_start_time < "${civilTomorrow}"`);

      const [stepsRes, heartRes, calRes, sleepRes, exerciseRes, distRes] = await Promise.all([
        fetch(`https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:rollUp`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ range: { startTime: startOfDay, endTime: endOfDay }, windowSize: "86400s" })
        }),
        fetch(`https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints?filter=${heartFilter}&pageSize=1000`, { headers }),
        fetch(`https://health.googleapis.com/v4/users/me/dataTypes/total-calories/dataPoints:rollUp`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ range: { startTime: startOfDay, endTime: endOfDay }, windowSize: "86400s" })
        }),
        fetch(`https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter=${sleepFilter}&pageSize=1000`, { headers }),
        fetch(`https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints?filter=${exerciseFilter}&pageSize=1000`, { headers }),
        fetch(`https://health.googleapis.com/v4/users/me/dataTypes/distance/dataPoints:rollUp`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ range: { startTime: startOfDay, endTime: endOfDay }, windowSize: "86400s" })
        })
      ]);

      if (stepsRes.status === 401 || heartRes.status === 401) {
        console.warn("⚠️ Google token expired! Asking backend for a new one...");
        const newToken = await refreshExpiredToken();
        
        if (newToken) {
          return syncRealGoogleHealthData(newToken);
        } else {
          console.error("❌ Could not refresh token. Falling back to manual mode.");
          localStorage.removeItem(`google_health_token_${userId}`);
          setAccessToken(""); 
          return;
        }
      }

      const stepsData = await stepsRes.json();
      const heartData = await heartRes.json();
      const calData = await calRes.json();
      const sleepData = await sleepRes.json();
      const exerciseData = await exerciseRes.json();
      const distData = await distRes.json();

      console.log("--------------------------------------------------");
      console.log("📊 [RAW API RESPONSE COPIES]");
      console.log(`🌍 BOUNDARIES APPLIED (LOCAL): ${startOfDay} TO ${endOfDay}`);
      console.log("➡️ STEPS ROLLUP OBJ:", stepsData);
      console.log("➡️ HEART RATE OBJ:", heartData);
      console.log("➡️ CALORIES ROLLUP OBJ:", calData);
      console.log("➡️ SLEEP OBJ:", sleepData);
      console.log("➡️ EXERCISE (WORKOUTS) OBJ:", exerciseData);
      console.log("➡️ TODAY'S CURRENT DISTANCE OBJ:", distData);
      console.log("--------------------------------------------------");

      console.log("⚙️ Starting Calculation Loop Engine...");

      console.log("🧮 [MATH LOG] -> STEPS EXTRACTION START:");
      let totalStepsDeduplicated = 0;
      if (stepsData && stepsData.rollupDataPoints && stepsData.rollupDataPoints.length > 0) {
        const rollupPoint = stepsData.rollupDataPoints[0];
        if (rollupPoint.steps && typeof rollupPoint.steps === 'object') {
          for (let key in rollupPoint.steps) {
            const val = Number(rollupPoint.steps[key]);
            if (!isNaN(val)) {
              totalStepsDeduplicated = val;
              console.log(`   -> SUCCESS! Extracted step total via key (${key}): ${totalStepsDeduplicated}`);
            }
          }
        }
      }

      console.log("🧮 [MATH LOG] -> REAL-TIME LATEST HEART RATE EXTRACTION START:");
      let computedHeart = 0;
      if (heartData && heartData.dataPoints && heartData.dataPoints.length > 0) {
        const latestPoint = heartData.dataPoints.reduce((latest, current) => {
          const latestTime = new Date(latest.startTime || latest.sampleTime || 0).getTime();
          const currentTime = new Date(current.startTime || current.sampleTime || 0).getTime();
          return currentTime > latestTime ? current : latest;
        });

        if (latestPoint && latestPoint.heartRate) {
          for (let key in latestPoint.heartRate) {
            if (key !== "interval" && key !== "sampleTime" && key !== "dataSource" && key !== "name") {
              const val = Number(latestPoint.heartRate[key]);
              if (!isNaN(val)) {
                computedHeart = Math.round(val);
                console.log(`   -> SUCCESS! Extracted OVERALL real-time heart rate: ${computedHeart} bpm`);
                break;
              }
            }
          }
        }
      } else {
        console.log("   -> No heart rate data points found for today yet.");
      }

      console.log("🧮 [MATH LOG] -> CALORIES EXTRACTION START:");
      let totalCaloriesBurned = 0;
      if (calData && calData.rollupDataPoints && calData.rollupDataPoints.length > 0) {
        const rollupPoint = calData.rollupDataPoints[0];
        if (rollupPoint.totalCalories && rollupPoint.totalCalories.kcalSum) {
          totalCaloriesBurned = Math.round(rollupPoint.totalCalories.kcalSum);
          console.log(`   -> SUCCESS! Extracted raw total-burn value: ${totalCaloriesBurned} kcal`);
        }
      }

      console.log("🧮 [MATH LOG] -> SLEEP EXTRACTION START:");
      let totalSleepDurationMinutes = 0;
      if (sleepData && sleepData.dataPoints && sleepData.dataPoints.length > 0) {
        sleepData.dataPoints.forEach((point) => {
          const start = point?.sleep?.interval?.startTime || point?.interval?.startTime || point?.startTime || point?.sessionTimeInterval?.startTime;
          const end = point?.sleep?.interval?.endTime || point?.interval?.endTime || point?.endTime || point?.sessionTimeInterval?.endTime;
          if (start && end) {
            const diffInMilliseconds = new Date(end) - new Date(start);
            if (!isNaN(diffInMilliseconds) && diffInMilliseconds > 0) {
              totalSleepDurationMinutes += (diffInMilliseconds / (1000 * 60));
              console.log(`   -> Found valid sleep block: ${diffInMilliseconds / (1000 * 60)} minutes.`);
            }
          }
        });
      }
      const sleepHours = Math.floor(totalSleepDurationMinutes / 60);
      const sleepMins = Math.round(totalSleepDurationMinutes % 60);
      console.log(`   -> SUCCESS! Calculated total aggregated sleep time: ${sleepHours} hours and ${sleepMins} mins`);

      console.log("🧮 [MATH LOG] -> TODAY'S CURRENT DISTANCE EXTRACTION START:");
      let todayCurrentDistanceMeters = 0;
      if (distData && distData.rollupDataPoints && distData.rollupDataPoints.length > 0) {
        const rollupPoint = distData.rollupDataPoints[0];
        if (rollupPoint.distance && typeof rollupPoint.distance === 'object') {
          for (let key in rollupPoint.distance) {
            const val = Number(rollupPoint.distance[key]);
            if (!isNaN(val)) {
              todayCurrentDistanceMeters = val;
              console.log(`   -> SUCCESS! Extracted today's current meters: ${todayCurrentDistanceMeters}`);
            }
          }
        }
      }
      const todayCurrentDistanceKm = todayCurrentDistanceMeters > 0 ? Number((todayCurrentDistanceMeters / 1000000).toFixed(2)) : 0;

      console.log("🧮 [MATH LOG] -> COMBINED EXERCISE AVERAGE HR CALCULATION:");
      
      let totalExerciseHrSum = 0;
      let totalExerciseHrCount = 0;
      let totalRunningHrSum = 0;   // ✅ NEW: Sum for running only
      let totalRunningHrCount = 0; // ✅ NEW: Count for running only

      // Find the latest run session for today
      let latestRunSession = null;
      if (exerciseData && exerciseData.dataPoints && exerciseData.dataPoints.length > 0) {
        console.log("   -> All exercise sessions found for today:", exerciseData.dataPoints);

        const runSessions = exerciseData.dataPoints.filter(session => {
          const type = session.exercise?.exerciseType || session.exercise?.activityType || session.activityType || "";
          return String(type).toLowerCase().includes("run") || type === 8;
        });

        console.log("   -> Filtered down to just run sessions:", runSessions);

        if (runSessions.length > 0) {
          latestRunSession = runSessions.reduce((latest, current) => {
            if (!latest) return current; // Handle the first item
            const latestTime = new Date(latest.exercise?.interval?.startTime || latest.interval?.startTime || 0).getTime();
            const currentTime = new Date(current.exercise?.interval?.startTime || current.interval?.startTime || 0).getTime();
            return currentTime > latestTime ? current : latest;
          }, null);
        } else {
          console.log("   -> No activities matched the 'run' filter.");
        }
      }

      let calculatedRunTimeSeconds = 0;
      let specificRunDistanceMeters = 0;

      if (latestRunSession) {
        console.log("🏃‍♂️ [MATH LOG] -> LATEST RUN SESSION FOUND:", latestRunSession);
        const runStartTimeString = latestRunSession.exercise?.interval?.startTime || latestRunSession.interval?.startTime;
        const runEndTimeString = latestRunSession.exercise?.interval?.endTime || latestRunSession.interval?.endTime;

        if (runStartTimeString && runEndTimeString) {
          const runStartTimeMs = new Date(runStartTimeString).getTime();
          const runEndTimeMs = new Date(runEndTimeString).getTime();
          calculatedRunTimeSeconds = Math.floor((runEndTimeMs - runStartTimeMs) / 1000);
          console.log(`   -> Calculated run time for latest run: ${calculatedRunTimeSeconds} seconds`);

          const runStartISO = new Date(runStartTimeMs - 60000).toISOString();
          const runEndISO = new Date(runEndTimeMs + 60000).toISOString();

          // Fetch distance specifically for the latest run
          console.log(`   -> Fetching distance for time range: ${runStartISO} to ${runEndISO}`);
          const runDistRes = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/distance/dataPoints:rollUp`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ range: { startTime: runStartISO, endTime: runEndISO }, windowSize: "86400s" })
          });
          const runDistData = await runDistRes.json();
          if (runDistData && runDistData.rollupDataPoints && runDistData.rollupDataPoints.length > 0) {
            console.log("   -> Raw distance response for latest run:", runDistData);
            const rp = runDistData.rollupDataPoints[0];
            if (rp.distance && typeof rp.distance === 'object') {
              for (let key in rp.distance) {
                const val = Number(rp.distance[key]);
                if (!isNaN(val)) {
                  specificRunDistanceMeters = val / 1000000; // Convert from micrometers to meters
                  console.log(`   -> SUCCESS! Extracted latest run distance: ${specificRunDistanceMeters} meters (from ${val} micrometers)`);
                }
              }
            }
          }
        }
      } else {
        console.log("   -> No run sessions found for today.");
      }

      // ✅ NEW: Calculate average HR across ALL exercises for the day using Rollup API
      if (exerciseData && exerciseData.dataPoints && exerciseData.dataPoints.length > 0) {
        for (const session of exerciseData.dataPoints) {
          const type = session.exercise?.exerciseType || session.exercise?.activityType || session.activityType || "";
          const isRun = String(type).toLowerCase().includes("run") || type === 8;

          const startTimeString = session.exercise?.interval?.startTime || session.interval?.startTime || session.startTime;
          const endTimeString = session.exercise?.interval?.endTime || session.interval?.endTime || session.endTime;

          if (startTimeString && endTimeString) {
            const startTimeMs = new Date(startTimeString).getTime();
            const endTimeMs = new Date(endTimeString).getTime();
            
            const sessionStartISO = new Date(startTimeMs - 60000).toISOString();
            const sessionEndISO = new Date(endTimeMs + 60000).toISOString();

            try {
              console.log(`   -> 💓 Fetching API HR Rollup for window: ${sessionStartISO} to ${sessionEndISO}`);
              const hrRollupRes = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints:rollUp`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  range: { startTime: sessionStartISO, endTime: sessionEndISO }, 
                  windowSize: "86400s" 
                })
              });
              
              const hrRollupData = await hrRollupRes.json();
              
              if (hrRollupData && hrRollupData.rollupDataPoints && hrRollupData.rollupDataPoints.length > 0) {
                const hrRollup = hrRollupData.rollupDataPoints[0];
                let sessionAvgHr = 0;

                if (hrRollup.heartRate && hrRollup.heartRate.beatsPerMinuteAvg) {
                   sessionAvgHr = Number(hrRollup.heartRate.beatsPerMinuteAvg);
                } else if (hrRollup.heartRate) {
                   for (const key in hrRollup.heartRate) {
                      const val = Number(hrRollup.heartRate[key]);
                      if (!isNaN(val) && val > 30 && val < 250) {
                          sessionAvgHr = val;
                          break;
                      }
                   }
                } else {
                   for (let key in hrRollup) {
                     if (typeof hrRollup[key] === 'object') {
                       for (let subKey in hrRollup[key]) {
                          const val = Number(hrRollup[key][subKey]);
                          if (!isNaN(val) && val > 30 && val < 250) {
                              sessionAvgHr = val;
                              break;
                          }
                       }
                     }
                   }
                }

                if (sessionAvgHr > 0) {
                  totalExerciseHrSum += sessionAvgHr;
                  totalExerciseHrCount++;
                  
                  // ✅ NEW: Add specifically to the running HR count if this was a run
                  if (isRun) {
                    totalRunningHrSum += sessionAvgHr;
                    totalRunningHrCount++;
                  }

                  console.log(`   -> 💓 Found API Rolled-Up Average HR point: ${Math.round(sessionAvgHr)} bpm (Is Run: ${isRun})`);
                }
              }
            } catch (hrError) {
              console.error("   -> Error fetching exercise HR rollup:", hrError);
            }
          }
        }
      }

      const finalAvgExerciseHr = totalExerciseHrCount > 0 ? Math.round(totalExerciseHrSum / totalExerciseHrCount) : 0;
      const finalAvgRunningHr = totalRunningHrCount > 0 ? Math.round(totalRunningHrSum / totalRunningHrCount) : 0;

      console.log(`   -> SUCCESS! Compiled global average exercise HR: ${finalAvgExerciseHr} bpm (over ${totalExerciseHrCount} points)`);
      console.log(`   -> SUCCESS! Compiled average RUNNING HR: ${finalAvgRunningHr} bpm (over ${totalRunningHrCount} sessions)`);

      const finalRunDistanceKm = specificRunDistanceMeters > 0 ? Number(specificRunDistanceMeters.toFixed(2)) : 0;
      console.log(`   -> Final RAW run distance in METERS to be saved: ${finalRunDistanceKm}`);

      const freshData = {
        steps: totalStepsDeduplicated,
        heartRate: computedHeart,
        calories: totalCaloriesBurned,
        distance: todayCurrentDistanceKm,
        runningDistance: finalRunDistanceKm,
        runTime: calculatedRunTimeSeconds,
        avgExerciseHr: finalAvgExerciseHr, 
        avgRunningHr: finalAvgRunningHr, // ✅ Save new running-only value
        sleep: sleepHours,
        sleepMinutes: sleepMins
      };

      console.log("⭐ [FINAL ENGAGEMENT] Clean Metrics Object Saved to State:", freshData);
      setHealthData(freshData);

      await setDoc(doc(db, "healthData", userId), {
        healthID: userId,
        userID: userId,
        ...freshData,
        lastSynced: new Date().toISOString()
      }, { merge: true });

      console.log(`🎉 [AUTO] Firestore updated cleanly for user: ${userId}!`);
      console.log("--------------------------------------------------");

    } catch (error) {
      console.error("Auto-sync background processing failed: ", error);
    }
  };

  return { healthData, loading, accessToken, handleFitbitClick };
}