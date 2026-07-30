import { useEffect, useState } from "react";
import CommanderNav from "../components/CommanderNav";
import { generatePassingProbability } from "../services/geminiService";
import { Search, User } from "lucide-react";
import {
  getCommanderById,
  getPersonnelByCommanderId,
  updateTeamReadiness,
  updateTeamStatistics,
  getPastOfficialIPPTRecordsForPersonnel,
} from "../services/firestoreService";

export default function Commander() {
  const [commander, setCommander] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ipptHistory, setIpptHistory] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [passPrediction, setPassPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("user")) || {};
  const commanderID = currentUser.userID || currentUser.id;

  const handleGeneratePassingProbability = async () => {
    try {
      setPredictionLoading(true);
      setPredictionError("");

      const result = await generatePassingProbability(personnel, ipptHistory);

      setPassPrediction(result);
    } catch (error) {
      console.error("Passing probability error:", error);
      setPredictionError("Unable to generate passing probability.");
    } finally {
      setPredictionLoading(false);
    }
  };

  useEffect(() => {
    const loadCommanderData = async () => {
      try {
        const commanderData = await getCommanderById(commanderID);
        const personnelData = await getPersonnelByCommanderId(commanderID);

        const updatedReadiness = await updateTeamReadiness(
          commanderID,
          personnelData
        );

        const statisticsData = await updateTeamStatistics(personnelData);

        const historyData =
          await getPastOfficialIPPTRecordsForPersonnel(personnelData);

        setCommander(commanderData);
        setPersonnel(personnelData);
        setReadiness(updatedReadiness);
        setStatistics(statisticsData);
        setIpptHistory(historyData);
      } catch (error) {
        console.error("Error loading commander dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCommanderData();
  }, [commanderID]);

  if (loading) {
    return (
      <div className="commander-page">
        <div className="commander-phone">
          <div className="commander-status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <header className="commander-header">
            <h2 className="commander-header-title">Commander Dashboard</h2>
          </header>

          <main className="commander-content commander-loading-content">
            <div className="commander-loading-circle"></div>
            <p>Loading Commander Dashboard...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!commander) {
    return <div className="commander-page">Commander not found.</div>;
  }

  const totalPersonnel = readiness?.totalPersonnel ?? personnel.length ?? 0;

  const avgReadinessScore =
    readiness?.avgReadinessScore ??
    (personnel.length === 0
      ? 0
      : Math.round(
        personnel.reduce(
          (sum, p) => sum + Number(p.readiness || 0),
          0
        ) / personnel.length
      ));

  const readinessLevel =
    readiness?.readinessLevel ??
    (avgReadinessScore >= 80
      ? "High"
      : avgReadinessScore >= 60
        ? "Moderate"
        : "Low");

  const passRate = statistics?.passRate ?? 0;
  const failRate = statistics?.failRate ?? 0;
  const silverRate = statistics?.silverRate ?? 0;
  const goldRate = statistics?.goldRate ?? 0;




  const filteredPersonnel = personnel.filter((p) =>
    getDisplayName(p).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stationType =
    commander?.unit?.toLowerCase() === "paramedic"
      ? "Medical Centre"
      : commander?.unit?.toLowerCase() === "firefighter"
        ? "Fire Station"
        : "";

  const stationName = commander?.address
    ? `${commander.address}${stationType ? ` ${stationType}` : ""}`
    : "Address N/A";


  return (
    <div className="commander-page">
      <div className="commander-phone">
        <div className="commander-status-bar">
          <span>9:41</span>
          <span>● ● ● WiFi 🔋</span>
        </div>

        <header className="commander-header">
          <h2 className="commander-header-title">Commander Dashboard</h2>

          <div className="commander-profile-mini">
            <User size={16} />
            <span>{getDisplayName(commander)}</span>
          </div>
        </header>

        <main className="commander-content">
          <section className="commander-profile-card">
            <div className="commander-avatar">
              {commander?.photoURL ? (
                <img
                  src={commander.photoURL}
                  alt={`${getDisplayName(commander)} profile`}
                  className="commander-avatar-image"
                />
              ) : (
                <User size={42} />
              )}
            </div>

            <div>
              <h3 className="commander-card-title">Commander Profile</h3>
              <p className="commander-text">
                <b>Name:</b> {getDisplayName(commander)}
              </p>
              <p className="commander-text">
                <b>Rank:</b> {commander.rank || "N/A"}
              </p>
              
              <p className="commander-text">
                <b>Unit:</b> {commander.unit || "N/A"}
              </p>
              <p className="commander-text">
                <b>Station:</b> {stationName}
              </p>
            </div>
          </section>

          

          <section className="commander-card">
            <h3 className="commander-card-title">Official IPPT Statistics</h3>

            <div className="commander-stats-grid">
              <div className="commander-stat-box">
                <h2 className="commander-pass">{passRate}%</h2>
                <p>Pass Rate</p>
              </div>

              <div className="commander-stat-box">
                <h2 className="commander-fail">{failRate}%</h2>
                <p>Fail Rate</p>
              </div>

              <div className="commander-stat-box">
                <h2 className="commander-silver">{silverRate}%</h2>
                <p>Silver Rate</p>
              </div>

              <div className="commander-stat-box">
                <h2 className="commander-gold">{goldRate}%</h2>
                <p>Gold Rate</p>
              </div>
            </div>
          </section>

          <section className="commander-card">
            <div className="commander-section-header">
              <h3 className="commander-card-title">
                Section Official IPPT Report
              </h3>
            </div>

            <div className="commander-search-box">
              <Search size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search personnel"
                className="commander-search-input"
              />
            </div>

            {filteredPersonnel.length === 0 && (
              <p className="commander-text">No personnel found.</p>
            )}

            <div className="commander-table">
              <div className="commander-table-header official-table-three-columns">
                <span>Name</span>
                <span>Official Result</span>
                <span>Score</span>
              </div>

              {filteredPersonnel.map((p) => {
                const records = ipptHistory[p.userID || p.id] || [];
                const latestOfficial = records[records.length - 1];

                return (
                  <div
                    className="commander-table-row official-table-row official-table-three-columns"
                    key={p.id}
                  >
                    <span>{getDisplayName(p)}</span>

                    <span className={getResultClass(latestOfficial?.result)}>
                      {latestOfficial?.result || "N/A"}
                    </span>

                    <span
                      style={{
                        color: getScoreColor(latestOfficial?.totalScore),
                        fontWeight: 600,
                      }}
                    >
                      {latestOfficial?.totalScore ?? "N/A"}
                    </span>
                  </div>
                );
              })}
            </div>

            <h4 className="commander-sub-title">
              Past 5 Official IPPT Records
            </h4>

            {filteredPersonnel.map((person) => (
              <div
                key={person.userID || person.id}
                className="commander-history-card"
              >
                <p className="commander-text">
                  <b>{getDisplayName(person)}</b>
                </p>

                <IPPTMiniGraph
                  records={ipptHistory[person.userID || person.id] || []}
                />
              </div>
            ))}
          </section>


          <section className="commander-card">
            <h3 className="commander-card-title">AI Passing Probability</h3>

            <p className="commander-text">
              Estimate each personnel's chance of passing the next official IPPT.
            </p>

            <button
              type="button"
              className="coach-btn"
              onClick={handleGeneratePassingProbability}
              disabled={predictionLoading}
            >
              {predictionLoading ? (
                <>
                  Generating<span className="loading-dots"></span>
                </>
              ) : (
                "Generate Prediction"
              )}
            </button>

            {predictionError && <p className="ai-error">{predictionError}</p>}

            {passPrediction && (
              <div className="commander-ai-output">
                <p className="commander-ai-summary">{passPrediction.summary}</p>

                {passPrediction.predictions?.map((item, index) => (
                  <div className="commander-ai-group-card" key={index}>
                    <h4>{item.name}</h4>

                    <p>
                      <b>Passing Probability:</b> {item.passingProbability}%
                    </p>

                    <p>
                      <b>Risk Level:</b> {item.riskLevel}
                    </p>

                    <p>
                      <b>Reason:</b> {item.reason}
                    </p>

                    <p>
                      <b>Recommended Action:</b> {item.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        <CommanderNav activePage="dashboard" />
      </div>
    </div>
  );
}

function getDisplayName(user) {
  return (
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "N/A"
  );
}

function getResultClass(result) {
  if (result === "Gold") return "commander-gold";
  if (result === "Silver") return "commander-silver";
  if (result === "Fail") return "commander-fail";
  return "commander-pass";
}

function getScoreColor(score) {
  const value = Number(score);

  if (value >= 85) return "#d4a100";
  if (value >= 75) return "#6b7280";
  if (value >= 61) return "#188038";
  return "#d93025";
}

function IPPTMiniGraph({ records }) {
  const width = 300;
  const height = 150;
  const padding = 30;

  const scores = records.map((r) => Number(r.totalScore || r.totalscore || 0));
  const maxScore = 100;

  const points = scores.map((score, index) => {
    const x =
      padding +
      (index * (width - padding * 2)) / Math.max(records.length - 1, 1);

    const y =
      height -
      padding -
      (score / maxScore) * (height - padding * 2);

    return { x, y, score };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const formatDate = (date) => {
    const d = date?.toDate ? date.toDate() : new Date(date);

    if (isNaN(d.getTime())) return "No Date";

    return d.toLocaleDateString("en-SG", {
      day: "numeric",
      month: "short",
    });
  };

  if (records.length === 0) {
    return <p className="commander-text">No IPPT records available.</p>;
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="#94a3b8"
      />

      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#94a3b8"
      />

      <text x="5" y="18" fontSize="10" fill="#062b55">
        IPPT Score
      </text>

      <polyline
        points={linePoints}
        fill="none"
        stroke="#0b4f8a"
        strokeWidth="3"
      />

      {points.map((p, index) => (
        <g key={index}>
          <circle cx={p.x} cy={p.y} r="4" fill="#0b4f8a" />

          <text x={p.x - 8} y={p.y - 8} fontSize="10" fill="#062b55">
            {p.score}
          </text>

          <text x={p.x - 18} y={height - 8} fontSize="9" fill="#475569">
            {formatDate(records[index].date)}
          </text>
        </g>
      ))}
    </svg>
  );
}

