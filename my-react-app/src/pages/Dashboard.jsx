import { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import {
  getCurrentUser,
  getUserById,
  getLatestIPPTRecordByUserId,
  getTrainingContextByUserId,
  getLatestOfficialIPPTRecordByUserId,
} from "../services/firestoreService";
import { generateTrainingRecommendation } from "../services/geminiService";
import { User } from "lucide-react";

const DASHBOARD_AI_PROMPT = `
You are an SCDF fitness assistant.

Use only the provided official IPPT, practice IPPT and health data.
Give a short dashboard recommendation.

Return ONLY valid JSON:
{
  "summary": "short recommendation",
  "actions": ["action 1", "action 2", "action 3"],
  "goalPrediction": "short goal prediction"
}
`;

function Dashboard() {
  const [user, setUser] = useState(null);
  const [ipptRecord, setIpptRecord] = useState(null);
  const [officialRecord, setOfficialRecord] = useState(null);
  const [pastRecords, setPastRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const currentUser = getCurrentUser();

        if (!currentUser) {
          setUser(null);
          return;
        }

        const userId = currentUser.userID || currentUser.id;

        let freshUser = null;
        let latestPracticeRecord = null;
        let latestOfficialRecord = null;
        let context = null;

        if (userId) {
          freshUser = await getUserById(userId);
          latestPracticeRecord = await getLatestIPPTRecordByUserId(userId);
          latestOfficialRecord = await getLatestOfficialIPPTRecordByUserId(userId);
          context = await getTrainingContextByUserId(userId);
        }

        const userData = {
          ...currentUser,
          ...(freshUser || {}),
          userID: userId,
          id: userId,
        };

        setUser(userData);
        setIpptRecord(latestPracticeRecord);
        setOfficialRecord(latestOfficialRecord);
        setPastRecords(context?.pastIpptRecords || []);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const getResultClass = (result) => {
    if (result === "Gold") return "result-gold";
    if (result === "Silver" || result === "Pass") return "result-green";
    return "result-red";
  };

  const formatDate = (record) => {
    const dateValue = record?.date || record?.createdAt || record?.timestamp;

    if (!dateValue) return "N/A";

    if (dateValue?.seconds) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString();
    }

    return new Date(dateValue).toLocaleDateString();
  };

  const clampPercent = (value) => {
    const num = Number(value || 0);
    return Math.min(Math.max(num, 0), 100);
  };

  const handleGenerateDashboardAI = async () => {
    if (!user || !ipptRecord) {
      alert("No practice IPPT record found. Please submit your IPPT Practice first.");
      return;
    }

    setGeneratingAI(true);

    try {
      const trainingData = {
        user: {
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          dob: user.dob || user.dateOfBirth,
          gender: user.gender,
          rank: user.rank,
          unit: user.unit,
          commanderID: user.commanderID,
        },
        officialIppt: officialRecord,
        latestPracticeIppt: ipptRecord,
        pastPracticeRecords: pastRecords,
        health: {
          heartRate: ipptRecord.heartRate,
          sleepHours: ipptRecord.sleepHours,
          fitbitData: ipptRecord.fitbitData,
        },
        goal: {
          wantedGoal: ipptRecord.wantedGoal,
          goalScore: ipptRecord.goalScore,
          pointsToGoal: ipptRecord.pointsToGoal,
          goalAchieved: ipptRecord.goalAchieved,
        },
      };

      const result = await generateTrainingRecommendation(
        trainingData,
        DASHBOARD_AI_PROMPT
      );

      setAiRecommendation(result);
    } catch (error) {
      console.error(error);
      setAiRecommendation({
        summary:
          "Based on your latest practice record, focus on improving the weakest IPPT component while maintaining consistent weekly training.",
        actions: [
          "Train your lowest-scoring IPPT station first",
          "Use Fitbit run data to monitor 2.4km timing progress",
          "Use sleep and heart rate data to adjust recovery",
        ],
        goalPrediction: `Current practice result is ${
          ipptRecord?.result || "N/A"
        }. You need ${ipptRecord?.pointsToGoal || 0} more points to reach ${
          ipptRecord?.wantedGoal || "your goal"
        }.`,
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return <main className="app">Loading Dashboard...</main>;
  }

  if (!user) {
    return <main className="app">User not found.</main>;
  }

  const practiceReadiness = Number(
    ipptRecord?.fitnessReadiness ||
      ipptRecord?.readinessScore ||
      ipptRecord?.ipptScore ||
      ipptRecord?.totalscore ||
      user.readiness ||
      0
  );

  const readinessLevel =
    practiceReadiness >= 85
      ? "Excellent"
      : practiceReadiness >= 75
      ? "High"
      : practiceReadiness >= 61
      ? "Moderate"
      : "Low";

  const readinessColor =
    practiceReadiness >= 75
      ? "#188038"
      : practiceReadiness >= 61
      ? "#fbbc04"
      : "#d93025";

  const pushUps = ipptRecord?.pushups ?? ipptRecord?.pushUps ?? 0;
  const sitUps = ipptRecord?.situps ?? ipptRecord?.sitUps ?? 0;
  const runTime = ipptRecord?.runtime ?? ipptRecord?.runTime ?? "N/A";

  const pushupScore = Number(ipptRecord?.pushupScore ?? 0);
  const situpScore = Number(ipptRecord?.situpScore ?? 0);
  const runScore = Number(ipptRecord?.runScore ?? 0);

  const ipptScore = Number(
    ipptRecord?.ipptScore || ipptRecord?.totalscore || ipptRecord?.totalScore || 0
  );

  const result = ipptRecord?.result || "N/A";
  const wantedGoal = ipptRecord?.wantedGoal || "Pass";
  const goalScore = Number(ipptRecord?.goalScore || 61);
  const pointsToGoal =
    ipptRecord?.pointsToGoal ?? Math.max(goalScore - ipptScore, 0);

  const goalAchieved = pointsToGoal === 0;
  const sleepHours = ipptRecord?.sleepHours ?? "N/A";
  const heartRate = ipptRecord?.heartRate ?? "N/A";

  const officialScore = Number(
    officialRecord?.ipptScore ||
      officialRecord?.totalScore ||
      officialRecord?.totalscore ||
      0
  );

  return (
    <main className="app">
      <section className="phone">
        <div className="phone-content">
          <div className="status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <header className="dashboard-header">
            <div className="header-left">
              <h1>User Dashboard</h1>
              <p>Official records, practice progress and AI guidance</p>
            </div>

            <div className="profile-chip">
              <User size={16} />
              <span>{user.name || "User"}</span>
            </div>
          </header>

          <section className="official-ippt-card">
  <div className="official-card-header">
    <div>
      <h2>Official IPPT Record</h2>
      <p>Verified test result from Admin</p>
    </div>

    <span className={getResultClass(officialRecord?.result)}>
      {officialRecord?.result || "N/A"}
    </span>
  </div>

  {!officialRecord ? (
    <p className="empty-text">No official IPPT record found yet.</p>
  ) : (
    <>
      <div className="official-score-box">
        <div>
          <span>Total Score</span>
          <strong>{officialScore}/100</strong>
        </div>

        <div>
          <span>Date</span>
          <strong>{formatDate(officialRecord)}</strong>
        </div>
      </div>

      <div className="official-station-grid">
        <div>
          <span>Push-Up</span>
          <strong>{officialRecord.pushups ?? 0} reps</strong>
          <p>{officialRecord.pushupScore ?? "N/A"} pts</p>
        </div>

        <div>
          <span>Sit-Up</span>
          <strong>{officialRecord.situps ?? 0} reps</strong>
          <p>{officialRecord.situpScore ?? "N/A"} pts</p>
        </div>

        <div>
          <span>2.4km Run</span>
          <strong>{officialRecord.runtime ?? "N/A"}</strong>
          <p>{officialRecord.runScore ?? "N/A"} pts</p>
        </div>
      </div>
    </>
  )}
</section>

          <section className="readiness-card">
            <h2>Fitness Readiness Score</h2>

            <div
              className="score-circle"
              style={{
                background: `radial-gradient(circle, white 58%, transparent 59%), conic-gradient(${readinessColor} ${practiceReadiness}%, #d9e2ee 0)`,
              }}
            >
              <div>
                <strong>{practiceReadiness}%</strong>
                <span style={{ color: readinessColor }}>{readinessLevel}</span>
              </div>
            </div>

            <p style={{ color: readinessColor }}>
              Fitness Readiness is based on your latest IPPT practice score.
            </p>

            <p>
              Practice Score: {ipptScore}/100 | Current Result: {result}
            </p>

            <p>
              Goal: {wantedGoal} ({goalScore} pts) |{" "}
              {goalAchieved ? "Goal achieved." : `${pointsToGoal} pts needed.`}
            </p>

            <p>
              Sleep: {sleepHours} hrs | Heart Rate: {heartRate} bpm
            </p>
          </section>

          <h2 className="section-title">IPPT Practice Progress</h2>

          <section className="ippt-grid">
            <div className="ippt-card green">
              <h3>Push-Up</h3>
              <strong>{pushUps} Reps</strong>
              <span>{pushupScore}/25 points</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${clampPercent((pushupScore / 25) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="ippt-card pink">
              <h3>Sit-Up</h3>
              <strong>{sitUps} Reps</strong>
              <span>{situpScore}/25 points</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${clampPercent((situpScore / 25) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="ippt-card blue">
              <h3>2.4km Run</h3>
              <strong>{runTime}</strong>
              <span>{runScore}/50 points</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${clampPercent((runScore / 50) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="ippt-card light">
              <h3>Practice Result</h3>
              <strong>
                {result} {goalAchieved ? "⭐" : ""}
              </strong>
              <span>Goal: {wantedGoal}</span>
            </div>
          </section>

          <section className="history-card">
            <h2>Past IPPT Practice Records</h2>

            {pastRecords.length === 0 ? (
              <p>No past practice records yet.</p>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>PU</th>
                    <th>SU</th>
                    <th>Run</th>
                    <th>Score</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRecords.slice(0, 5).map((record, index) => (
                    <tr key={index}>
                      <td>{formatDate(record)}</td>
                      <td>{record.pushups ?? record.pushUps ?? 0}</td>
                      <td>{record.situps ?? record.sitUps ?? 0}</td>
                      <td>{record.runtime ?? record.runTime ?? "N/A"}</td>
                      <td>
                        {record.ipptScore ||
                          record.totalscore ||
                          record.totalScore ||
                          0}
                      </td>
                      <td>
                        <span className={getResultClass(record.result)}>
                          {record.result || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="ai-card">
            <div className="coach-title-row">
              <h2>🤖 AI Recommendation</h2>
              <button
                className="coach-btn"
                onClick={handleGenerateDashboardAI}
                disabled={generatingAI}
              >
                {generatingAI ? "Generating..." : "Generate"}
              </button>
            </div>

            {aiRecommendation ? (
              <>
                <p>{aiRecommendation.summary}</p>

                <div className="action-box">
                  <strong>Recommended Actions:</strong>
                  <ul>
                    {(aiRecommendation.actions || []).map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>

                <p className="goal-text">{aiRecommendation.goalPrediction}</p>
              </>
            ) : (
              <>
                <p>
                  Generate an AI recommendation based on your official IPPT,
                  practice record, Fitbit health data and wanted goal.
                </p>

                <div className="action-box">
                  <strong>Current Focus:</strong>
                  <ul>
                    <li>Official result: {officialRecord?.result || "N/A"}</li>
                    <li>Practice readiness: {practiceReadiness}%</li>
                    <li>Practice result: {result}</li>
                    <li>Wanted goal: {wantedGoal}</li>
                    <li>Points needed: {pointsToGoal}</li>
                  </ul>
                </div>
              </>
            )}
          </section>
        </div>

        <BottomNav activePage="dashboard" />
      </section>
    </main>
  );
}

export default Dashboard;