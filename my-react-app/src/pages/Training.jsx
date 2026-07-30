import { useEffect, useRef, useState } from "react";
import BottomNav from "../components/BottomNav";
import { generateTrainingRecommendation } from "../services/geminiService";
import {
  getCurrentUser,
  getTrainingContextByUserId,
  getRecommendationHistoryByUserId,
  saveRecommendation,
} from "../services/firestoreService";
/**
 * The Training page now owns the plan-generation workflow.
 *
 * This is the user-facing agentic experience: Firestore evidence is collected,
 * Gemini generates a plan, and the result is stored back into Firestore with a
 * timestamp so the user can revisit previous training plans later.
 */
const SYSTEM_PROMPT = `You are a Singaporean Civil Defence Force instructor specializing in personalized physical training regimens, exercise physiology, and muscle development.

CRITICAL ANALYSIS INSTRUCTIONS:
1. ANALYZE HISTORICAL TRENDS: Review all past IPPT records to identify performance patterns (improving/declining in specific components)
2. IDENTIFY WEAK AREAS: Determine which muscle groups or fitness components need improvement based on:
   - Consistently low scores in specific events (e.g., 2.4km run indicates poor leg endurance)
   - Performance trends over time
   - Comparison to benchmarks
3. DESIGN TARGETED EXERCISES: Select specific exercises that directly target identified weak muscle areas
4. CREATE WEEKLY STRUCTURE: Organize exercises day-by-day (Monday-Sunday) with:
   - Specific exercise name
   - Number of sets and reps
   - Muscle group(s) targeted
   - Brief form cue or modification

RESPONSE REQUIREMENTS:
- Use ONLY supplied training data
- Treat latestHealth as a first-class signal when it exists. Use heart rate, sleep amount, running distance, and run time to adjust workout intensity and stamina work.
- If the supplied recoveryAssessment says recoveryRisk is high or moderate, reduce volume, choose lighter conditioning, and emphasize recovery over hard work.
- If the supplied recoveryAssessment says recoveryRisk is low and the stamina signal looks strong, you may keep or slightly increase endurance-focused work.
- If heart rate is elevated or sleep is low, recommend lighter intensity, more recovery, or shorter conditioning work.
- If running distance or run time suggest strong endurance, keep or increase stamina-focused work; if the data is limited or poor, keep the plan conservative and note uncertainty.
- Never invent metrics, dates, or medical claims
- Be specific about exercise names, reps, sets, and muscle targets
- If data is incomplete, state limitations clearly
- Keep all advice conservative and injury-aware
- Return ONLY valid JSON with no markdown, code fences, or extra text

Respond with this JSON structure only:
{
  "summary": "Specific 2-3 sentence assessment of weak areas identified and training focus",
  "weakAreasIdentified": ["muscle group 1", "muscle group 2"],
  "weeklyPlan": {
    "Monday": {
      "focus": "muscle group targeted",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 3,
          "reps": "12-15",
          "muscleGroups": ["quadriceps", "glutes"],
          "formCue": "Keep chest up, knees tracking over toes"
        }
      ]
    },
    "Tuesday": {
      "focus": "muscle group targeted",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 3,
          "reps": "8-10",
          "muscleGroups": ["chest", "triceps"],
          "formCue": "Control the descent, full range of motion"
        }
      ]
    },
    "Wednesday": {
      "focus": "rest or light activity",
      "exercises": [
        {
          "name": "Light stretching and mobility work",
          "duration": "15-20 minutes",
          "muscleGroups": ["full body"],
          "formCue": "Hold each stretch for 30 seconds, no bouncing"
        }
      ]
    },
    "Thursday": {
      "focus": "muscle group targeted",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 3,
          "reps": "10-12",
          "muscleGroups": ["hamstrings", "lower back"],
          "formCue": "Hinge at hips, maintain neutral spine"
        }
      ]
    },
    "Friday": {
      "focus": "muscle group targeted",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": 3,
          "reps": "12-15",
          "muscleGroups": ["shoulders", "back"],
          "formCue": "Scapula retraction, full range of motion"
        }
      ]
    },
    "Saturday": {
      "focus": "endurance or sport-specific",
      "exercises": [
        {
          "name": "2.4km run or interval training",
          "duration": "30-40 minutes",
          "muscleGroups": ["legs", "cardiovascular"],
          "formCue": "Maintain steady pace, controlled breathing"
        }
      ]
    },
    "Sunday": {
      "focus": "active recovery",
      "exercises": [
        {
          "name": "Yoga or light walking",
          "duration": "20-30 minutes",
          "muscleGroups": ["full body"],
          "formCue": "Focus on breathing and flexibility"
        }
      ]
    }
  },
  "recovery": ["recovery tip 1", "recovery tip 2", "recovery tip 3"],
  "nextCheckIn": "7 days",
  "confidence": "high/moderate/low"
}

User training data:
`;

const buildHealthContextPayload = (latestHealth) => {
  if (!latestHealth || typeof latestHealth !== "object") {
    return null;
  }

  const parsedSleep = Number.isFinite(Number(latestHealth.sleep))
    ? Number(latestHealth.sleep)
    : null;
  const parsedSleepMinutes = Number.isFinite(Number(latestHealth.sleepMinutes))
    ? Number(latestHealth.sleepMinutes)
    : 0;
  const normalizedSleepHours =
    latestHealth.sleepHours != null
      ? Number(latestHealth.sleepHours)
      : parsedSleep != null
        ? parsedSleep + parsedSleepMinutes / 60
        : null;
  const heartRate = latestHealth.heartRate ?? latestHealth.restingHeartRate ?? null;
  const runningDistance = latestHealth.runningDistance ?? latestHealth.distance ?? null;
  const runTime = latestHealth.runTime ?? latestHealth.runtime ?? null;

  const lowSleep = normalizedSleepHours != null && normalizedSleepHours < 6.5;
  const elevatedHeartRate = heartRate != null && heartRate >= 85;
  const staminaDataAvailable = runningDistance != null || runTime != null;

  const recoveryRisk = lowSleep && elevatedHeartRate
    ? "high"
    : lowSleep || elevatedHeartRate
      ? "moderate"
      : "low";

  const recoveryInstruction = recoveryRisk === "high"
    ? "Recovery looks poor; keep the session light, reduce volume, and prioritise rest."
    : recoveryRisk === "moderate"
      ? "Recovery is mixed; keep intensity moderate and avoid extra hard conditioning."
      : "Recovery looks acceptable; normal training intensity is suitable.";

  const staminaInstruction = staminaDataAvailable
    ? "Recent running context is available and should be used to judge endurance capacity."
    : "No recent running context is available; keep stamina advice conservative.";

  return {
    heartRate,
    sleepHours: normalizedSleepHours,
    sleepMinutes: parsedSleepMinutes || latestHealth.sleepMinutes || null,
    runningDistance,
    runTime,
    distance: latestHealth.distance ?? null,
    notes: latestHealth.notes ?? null,
    injury: latestHealth.injury ?? latestHealth.pain ?? null,
    recoveryAssessment: {
      recoveryRisk,
      instruction: recoveryInstruction,
    },
    staminaAssessment: {
      available: staminaDataAvailable,
      instruction: staminaInstruction,
    },
  };
};

function Training() {
  const [currentUser, setCurrentUser] = useState(null);
  const [trainingContext, setTrainingContext] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationHistory, setRecommendationHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState("");
  const [scrollControlVisible, setScrollControlVisible] = useState(false);
  const [scrollControlDirection, setScrollControlDirection] = useState("down");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const phoneContentRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const scrollHideTimeoutRef = useRef(null);

  const formatRecommendationDate = (generatedAt) => {
    if (!generatedAt) return "Unknown date";

    const dateObject = generatedAt?.toDate ? generatedAt.toDate() : new Date(generatedAt);

    if (Number.isNaN(dateObject.getTime())) {
      return "Unknown date";
    }

    return dateObject.toLocaleString("en-SG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const historyPageSize = 5;
  const totalHistoryPages = Math.max(1, Math.ceil(recommendationHistory.length / historyPageSize));
  const visibleRecommendationHistory = recommendationHistory.slice(
    historyPage * historyPageSize,
    historyPage * historyPageSize + historyPageSize
  );
  const visibleHistoryStart = recommendationHistory.length === 0 ? 0 : historyPage * historyPageSize + 1;
  const visibleHistoryEnd = Math.min(
    recommendationHistory.length,
    (historyPage + 1) * historyPageSize
  );

  const clearScrollControlTimer = () => {
    if (scrollHideTimeoutRef.current) {
      clearTimeout(scrollHideTimeoutRef.current);
      scrollHideTimeoutRef.current = null;
    }
  };

  const scrollToTop = () => {
    const container = phoneContentRef.current;

    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    const container = phoneContentRef.current;

    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      return;
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handlePhoneScroll = () => {
    const container = phoneContentRef.current;

    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const isAtBottom = currentScrollTop >= maxScrollTop - 4;
    const isScrollingDown = currentScrollTop >= lastScrollTopRef.current;

    setScrollControlVisible(true);
    setScrollControlDirection(isAtBottom ? "up" : isScrollingDown ? "down" : "up");
    lastScrollTopRef.current = currentScrollTop;

    clearScrollControlTimer();
    scrollHideTimeoutRef.current = setTimeout(() => {
      setScrollControlVisible(false);
    }, 900);
  };

  const handleScrollControlClick = () => {
    if (scrollControlDirection === "down") {
      scrollToBottom();
      return;
    }

    scrollToTop();
  };

  const handleSelectRecommendation = (recommendationId) => {
    setSelectedRecommendationId(recommendationId);

    if (!recommendationId) {
      setRecommendation(null);
      return;
    }

    const selectedPlan = recommendationHistory.find((item) => item.id === recommendationId) || null;

    if (selectedPlan) {
      const selectedIndex = recommendationHistory.findIndex((item) => item.id === recommendationId);
      if (selectedIndex >= 0) {
        setHistoryPage(Math.floor(selectedIndex / historyPageSize));
      }
    }

    setRecommendation(selectedPlan);
  };

  const handleHistoryPageChange = (nextPage) => {
    const boundedPage = Math.min(Math.max(nextPage, 0), totalHistoryPages - 1);
    setHistoryPage(boundedPage);
    setSelectedRecommendationId("");
    setRecommendation(null);
  };

  useEffect(() => {
    // Load the current session user, then hydrate the screen from Firestore.
    const user = getCurrentUser();
    setCurrentUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        // This bundle is the evidence the model will reason over.
        const context = await getTrainingContextByUserId(user.userID || user.id);
        setTrainingContext(context);

        const history = await getRecommendationHistoryByUserId(user.userID || user.id);
        setRecommendationHistory(history);
        setHistoryPage(0);
        setRecommendation(null);
        setSelectedRecommendationId("");
      } catch (err) {
        console.error(err);
        setError("Unable to load training context right now.");
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      clearScrollControlTimer();
    };
  }, []);

  const handleGenerateRecommendation = async () => {
    if (!currentUser) return;

    setGenerating(true);
    setError("");

    try {
      const userID = currentUser.userID || currentUser.id;
      // Refresh the latest Firestore state before asking the model to reason.
      const context = await getTrainingContextByUserId(userID);
      setTrainingContext(context);

      // Build the payload that will become the model's factual grounding.
      const trainingData = {
        user: context?.user || currentUser,
        latestIppt: context?.latestIppt,
        pastIpptRecords: context?.pastIpptRecords || [],
        latestHealth: buildHealthContextPayload(context?.latestHealth),
        latestTrainingPlan: context?.latestTrainingPlan,
        latestMealPlan: context?.latestMealPlan,
        benchmarks: context?.benchmarks,
      };

      const parsed = await generateTrainingRecommendation(
        trainingData,
        SYSTEM_PROMPT
      );

      // Save the generated recommendation so the UI can resume from the last AI output.
      const saved = await saveRecommendation({
        userID,
        ...parsed,
        source: "gemini",
      });

      setRecommendation(saved);
      setSelectedRecommendationId(saved.id);
      setHistoryPage(0);

      const history = await getRecommendationHistoryByUserId(userID);
      setRecommendationHistory(history);
    } catch (err) {
      console.error(err);
      setError(err.message || "The AI model could not produce a fresh recommendation from the current training data. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="app">
      <section className="phone">
        {/* The content area is scrollable; the saved-plan dropdown and floating scroll button keep navigation obvious. */}
        <div className="phone-content" ref={phoneContentRef} onScroll={handlePhoneScroll}>
          <div className="dashboard-header">
            <div className="header-left">
              <h1>Training</h1>
              <p>Generate and review training plans based on Firestore history</p>
            </div>
          </div>

          <div className="ai-coach-card">
            <div className="coach-title-row">
              <div>
                <p className="goal-text">Training intelligence</p>
                <h2>{currentUser?.name || "Your profile"}</h2>
              </div>
              <button
                className="coach-btn"
                onClick={handleGenerateRecommendation}
                disabled={generating}
              >
                {generating ? (
                  <>
                    Generating<span className="loading-dots"></span>
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>

            {error && <p className="ai-error">{error}</p>}

            {loading ? (
              <p className="ai-muted">Loading your training context...</p>
            ) : (
              <>
                <div className="coach-toolbar">
                  <div className="plan-selector-wrap">
                    <div className="plan-selector-header">
                      <label htmlFor="plan-history-select">Select a previous plan</label>
                      <span className="plan-selector-range">
                        {recommendationHistory.length > 0
                          ? `${visibleHistoryStart}-${visibleHistoryEnd} of ${recommendationHistory.length}`
                          : "No saved plans yet"}
                      </span>
                    </div>

                    <select
                      id="plan-history-select"
                      className="plan-selector"
                      value={selectedRecommendationId}
                      onChange={(event) => handleSelectRecommendation(event.target.value)}
                    >
                      <option value="">Select a previous plan</option>
                      {visibleRecommendationHistory.map((item) => (
                        <option key={item.id} value={item.id}>
                          {formatRecommendationDate(item.generatedAt)}
                        </option>
                      ))}
                    </select>

                    <div className="plan-selector-actions">
                      <button
                        type="button"
                        className="plan-page-btn"
                        onClick={() => handleHistoryPageChange(historyPage - 1)}
                        disabled={historyPage <= 0}
                      >
                        Previous 5
                      </button>
                      <button
                        type="button"
                        className="plan-page-btn"
                        onClick={() => handleHistoryPageChange(historyPage + 1)}
                        disabled={historyPage >= totalHistoryPages - 1}
                      >
                        Next 5
                      </button>
                    </div>
                  </div>
                </div>

                <div className="coach-grid">
                  <div className="coach-metric">
                    <span>Readiness</span>
                    <strong>{trainingContext?.user?.readiness || "—"}</strong>
                  </div>
                  <div className="coach-metric">
                    <span>Latest IPPT</span>
                    <strong>{trainingContext?.latestIppt?.result || "—"}</strong>
                  </div>
                  <div className="coach-metric">
                    <span>Heart rate</span>
                    <strong>{trainingContext?.latestHealth?.heartRate || "—"}</strong>
                  </div>
                  <div className="coach-metric">
                    <span>Benchmarks</span>
                    <strong>{trainingContext?.benchmarks?.focusArea || "Custom"}</strong>
                  </div>
                </div>

                <div className="coach-output">
                  {/* The selected plan banner keeps the generation date visible without forcing the user to scroll. */}
                  <div className="selected-plan-banner">
                    <div>
                      <p className="goal-text">Selected plan</p>
                      <h3>
                        {recommendation
                          ? formatRecommendationDate(recommendation.generatedAt)
                          : "No plan selected"}
                      </h3>
                    </div>
                    <div className="selected-plan-meta">
                      <span>{recommendation ? recommendation.source || "gemini" : "Choose a saved plan or generate a new one"}</span>
                    </div>
                  </div>

                  {recommendation ? (
                    <>
                      {/* The weekly plan is broken into day-level accordions with visible chevrons so users can tell each row expands. */}
                      <details className="coach-section plan-details" open>
                        <summary>Summary and weak areas</summary>
                        <div className="details-body">
                          <p>{recommendation.summary}</p>

                          {recommendation.weakAreasIdentified && (
                            <div className="coach-subsection">
                              <h4>Weak areas identified</h4>
                              <ul>
                                {(recommendation.weakAreasIdentified || []).map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>

                      <details className="coach-section plan-details">
                        <summary>Weekly plan</summary>
                        {recommendation.weeklyPlan ? (
                          <div className="weekly-plan">
                            {Object.entries(recommendation.weeklyPlan).map(([day, dayPlan]) => (
                              <details key={day} className="day-plan">
                                <summary>
                                  <span>{day}</span>
                                  <em>{dayPlan.focus}</em>
                                </summary>
                                <div className="day-plan-body">
                                  <div className="exercises-list">
                                    {(dayPlan.exercises || []).map((exercise, idx) => (
                                      <div key={idx} className="exercise-item">
                                        <p className="exercise-name">
                                          <strong>{exercise.name}</strong>
                                        </p>
                                        {exercise.sets && exercise.reps && (
                                          <p className="exercise-meta">
                                            {exercise.sets} sets × {exercise.reps} reps
                                          </p>
                                        )}
                                        {exercise.duration && (
                                          <p className="exercise-meta">{exercise.duration}</p>
                                        )}
                                        {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                                          <p className="muscle-groups">
                                            Targets: {exercise.muscleGroups.join(", ")}
                                          </p>
                                        )}
                                        {exercise.formCue && (
                                          <p className="form-cue">💡 {exercise.formCue}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </details>
                            ))}
                          </div>
                        ) : (
                          <ul>
                            {(recommendation.weeklyPlan || []).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </details>

                      <details className="coach-section plan-details">
                        <summary>Recovery and follow-up</summary>
                        <div className="details-body">
                          <ul>
                            {(recommendation.recovery || []).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                          <p className="coach-footer">
                            Next check-in: {recommendation.nextCheckIn} • Confidence: {recommendation.confidence}
                          </p>
                        </div>
                      </details>
                    </>
                  ) : (
                    <p className="ai-muted">Generate a recommendation to start coaching. Previous plans are available from the Saved plans dropdown.</p>
                  )}
                </div>

              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`scroll-fab ${scrollControlVisible ? "visible" : ""}`}
          onClick={handleScrollControlClick}
          aria-label={scrollControlDirection === "down" ? "Scroll down" : "Scroll up"}
          title={scrollControlDirection === "down" ? "Scroll down" : "Scroll up"}
        >
          {scrollControlDirection === "down" ? "↓" : "↑"}
        </button>

        <BottomNav activePage="training" />
      </section>
    </main>
  );
}

export default Training;