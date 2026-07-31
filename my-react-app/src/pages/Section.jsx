import { useEffect, useState } from "react";
import {
  Search,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";

import {
  generateCommanderGroupPlan,
  generatePassingProbability,
} from "../services/geminiService";

import CommanderNav from "../components/CommanderNav";

import {
  getCommanderById,
  getPersonnelByCommanderId,
  getPastIPPTRecordsForPersonnel,
  getPastOfficialIPPTRecordsForPersonnel,
} from "../services/firestoreService";

export default function Section() {
  const [commander, setCommander] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [practiceHistory, setPracticeHistory] = useState({});
  const [officialHistory, setOfficialHistory] = useState({});

  const [scoreType, setScoreType] = useState("official");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPersonnelID, setSelectedPersonnelID] =
    useState("");

  const [loading, setLoading] = useState(true);

  const [aiGroups, setAiGroups] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});

  const [personnelPredictions, setPersonnelPredictions] =
    useState({});

  const [predictionLoading, setPredictionLoading] =
    useState({});

  const [predictionErrors, setPredictionErrors] =
    useState({});

  const currentUser =
    JSON.parse(localStorage.getItem("user")) || {};

  const commanderID =
    currentUser?.userID || currentUser?.id;

  useEffect(() => {
    const loadSectionData = async () => {
      try {
        const commanderData =
          await getCommanderById(commanderID);

        const personnelData =
          await getPersonnelByCommanderId(commanderID);

        const practiceData =
          await getPastIPPTRecordsForPersonnel(
            personnelData
          );

        const officialData =
          await getPastOfficialIPPTRecordsForPersonnel(
            personnelData
          );

        setCommander(commanderData);
        setPersonnel(personnelData || []);
        setPracticeHistory(practiceData || {});
        setOfficialHistory(officialData || {});
      } catch (error) {
        console.error(
          "Error loading section page:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    if (commanderID) {
      loadSectionData();
    } else {
      setLoading(false);
    }
  }, [commanderID]);

  const toggleGroup = (groupName) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupName]: !previous[groupName],
    }));
  };

  const togglePersonnel = (person) => {
    const userID = getPersonID(person);

    setSelectedPersonnelID((current) =>
      current === userID ? "" : userID
    );
  };

  const handleGenerateAIGroupPlan = async () => {
    try {
      setAiLoading(true);
      setAiError("");

      const result = await generateCommanderGroupPlan(
        personnel,
        officialHistory
      );

      setAiGroups(result);
    } catch (error) {
      console.error(
        "Section AI grouping error:",
        error
      );

      setAiError(
        "Unable to generate the AI official IPPT plan. Please try again later."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleGeneratePersonnelPrediction = async (
    person
  ) => {
    const userID = getPersonID(person);

    try {
      setPredictionLoading((previous) => ({
        ...previous,
        [userID]: true,
      }));

      setPredictionErrors((previous) => ({
        ...previous,
        [userID]: "",
      }));

      const result = await generatePassingProbability(
        [person],
        {
          [userID]: officialHistory[userID] || [],
        }
      );

      const prediction =
        result?.predictions?.[0] || null;

      if (!prediction) {
        throw new Error(
          "No prediction was returned for this personnel."
        );
      }

      setPersonnelPredictions((previous) => ({
        ...previous,
        [userID]: prediction,
      }));
    } catch (error) {
      console.error(
        `Passing probability error for ${getDisplayName(
          person
        )}:`,
        error
      );

      setPredictionErrors((previous) => ({
        ...previous,
        [userID]:
          "Unable to generate this personnel's passing probability.",
      }));
    } finally {
      setPredictionLoading((previous) => ({
        ...previous,
        [userID]: false,
      }));
    }
  };

  if (loading) {
    return (
      <div className="commander-page">
        <div className="commander-phone">
          <div className="commander-status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <header className="commander-header">
            <h2 className="commander-header-title">
              Section
            </h2>
          </header>

          <main className="commander-content commander-loading-content">
            <div className="commander-loading-circle" />
            <p>Loading Section Page...</p>
          </main>
        </div>
      </div>
    );
  }

  const filteredPersonnel = personnel.filter(
    (person) =>
      getDisplayName(person)
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const activeHistory =
    scoreType === "official"
      ? officialHistory
      : practiceHistory;

  const officialFailCount = personnel.filter(
    (person) => {
      const userID = getPersonID(person);

      const records =
        officialHistory[userID] || [];

      const latestOfficial =
        getLatestRecord(records);

      return (
        latestOfficial?.result?.toLowerCase() ===
        "fail"
      );
    }
  ).length;

  return (
    <div className="commander-page">
      <div className="commander-phone">
        <div className="commander-status-bar">
          <span>9:41</span>
          <span>● ● ● WiFi 🔋</span>
        </div>

        <header className="commander-header">
          <h2 className="commander-header-title">
            Section
          </h2>
        </header>

        <main className="commander-content section-combined-content">
          {/* PERSONNEL MANAGEMENT */}

          <section className="section-management-section">
            <h3 className="commander-card-title">
              Personnel Management
            </h3>

            <div className="unit-total-responders">
              <h2>{personnel.length}</h2>
              <p>Total Personnel</p>
            </div>

            <p className="commander-text">
              View personnel under{" "}
              {commander?.unit || "your section"}.
            </p>

            <div className="unit-toggle-row">
              <button
                type="button"
                className={
                  scoreType === "official"
                    ? "unit-toggle-active"
                    : "unit-toggle-btn"
                }
                onClick={() =>
                  setScoreType("official")
                }
              >
                Official IPPT
              </button>

              <button
                type="button"
                className={
                  scoreType === "practice"
                    ? "unit-toggle-active"
                    : "unit-toggle-btn"
                }
                onClick={() =>
                  setScoreType("practice")
                }
              >
                Practice IPPT
              </button>
            </div>

            <div className="commander-search-box">
              <Search size={16} />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search personnel..."
                className="commander-search-input"
              />
            </div>
          </section>

          <div className="section-page-divider" />

          {/* PERSONNEL CARDS */}

          <section className="section-personnel-list">
            {filteredPersonnel.length === 0 ? (
              <div className="section-empty-message">
                <p className="commander-text">
                  No personnel found.
                </p>
              </div>
            ) : (
              filteredPersonnel.map((person) => {
                const userID = getPersonID(person);

                const activeRecords =
                  activeHistory[userID] || [];

                const officialRecords =
                  officialHistory[userID] || [];

                const practiceRecords =
                  practiceHistory[userID] || [];

                const latestActiveRecord =
                  getLatestRecord(activeRecords);

                const isExpanded =
                  selectedPersonnelID === userID;

                const displayResult =
                  latestActiveRecord?.result ||
                  (scoreType === "practice"
                    ? person.ippt
                    : null) ||
                  "N/A";

                const displayScore =
                  getRecordScore(
                    latestActiveRecord
                  ) ??
                  (scoreType === "practice"
                    ? Number(
                      person.readiness || 0
                    )
                    : 0);

                return (
                  <section
                    key={userID}
                    className="unit-responder-card section-personnel-card"
                    onClick={() =>
                      togglePersonnel(person)
                    }
                  >
                    <div className="unit-card-personnel-heading">
                      <h3 className="unit-card-name">
                        {getDisplayName(person)}
                      </h3>

                      <p className="unit-card-rank">
                        {person.rank ||
                          "Rank N/A"}
                      </p>
                    </div>

                    <div
                      className="unit-result-circle"
                      style={{
                        background: `
                          radial-gradient(
                            circle,
                            white 58%,
                            transparent 59%
                          ),
                          conic-gradient(
                            ${getIPPTColor(
                          displayResult
                        )}
                            ${clampScore(
                          displayScore
                        )}%,
                            #d9e2ee 0
                          )
                        `,
                      }}
                    >
                      <div className="unit-circle-content">
                        <strong
                          style={{
                            color:
                              getIPPTColor(
                                displayResult
                              ),
                          }}
                        >
                          {displayScore}
                        </strong>

                        <span
                          style={{
                            color:
                              getIPPTColor(
                                displayResult
                              ),
                          }}
                        >
                          {displayResult}
                        </span>
                      </div>
                    </div>

                    <p className="unit-expand-text">
                      {isExpanded
                        ? "Hide details ▲"
                        : "Click to view details ▼"}
                    </p>

                    {isExpanded && (
                      <PersonnelDetails
                        person={person}
                        officialRecords={
                          officialRecords
                        }
                        practiceRecords={
                          practiceRecords
                        }
                        prediction={
                          personnelPredictions[
                          userID
                          ] || null
                        }
                        predictionLoading={Boolean(
                          predictionLoading[userID]
                        )}
                        predictionError={
                          predictionErrors[
                          userID
                          ] || ""
                        }
                        onGeneratePrediction={() =>
                          handleGeneratePersonnelPrediction(
                            person
                          )
                        }
                      />
                    )}
                  </section>
                );
              })
            )}
          </section>

          {/* AI GROUP RECOMMENDATION */}

          {scoreType === "official" && (
            <>
              <div className="section-page-divider section-ai-divider" />

              <section className="section-ai-recommendation-section">
                <h3 className="commander-card-title">
                  AI Official IPPT Recommendation
                </h3>

                <p className="commander-text section-ai-description">
                  Generate section-wide training
                  groups based on the latest official
                  IPPT performance.
                </p>

                {officialFailCount > 0 && (
                  <div className="commander-recommendation">
                    <AlertTriangle
                      size={20}
                      color="#d97706"
                    />

                    <p>
                      {officialFailCount}{" "}
                      {officialFailCount === 1
                        ? "personnel has"
                        : "personnel have"}{" "}
                      failed their latest official
                      IPPT and may need closer
                      training support.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  className="coach-btn"
                  onClick={
                    handleGenerateAIGroupPlan
                  }
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      Generating
                      <span className="loading-dots" />
                    </>
                  ) : (
                    "Generate AI Group Plan"
                  )}
                </button>

                {aiError && (
                  <p className="ai-error">
                    {aiError}
                  </p>
                )}

                {aiGroups && (
                  <div className="commander-ai-output">
                    <h3>
                      AI Group Classification
                    </h3>

                    <p className="commander-ai-summary">
                      {aiGroups.summary}
                    </p>

                    {aiGroups.groups?.map(
                      (group, index) => (
                        <div
                          className="commander-ai-group-card"
                          key={`${group.groupName}-${index}`}
                        >
                          <div
                            className="commander-ai-group-header"
                            onClick={() =>
                              toggleGroup(
                                group.groupName
                              )
                            }
                          >
                            <div>
                              <h4>
                                {group.groupName}
                              </h4>

                              <p className="commander-ai-count">
                                {group.personnel
                                  ?.length || 0}{" "}
                                Personnel
                              </p>
                            </div>

                            <span className="commander-expand-btn">
                              {expandedGroups[
                                group.groupName
                              ]
                                ? "Hide ▲"
                                : "Click to Expand ▼"}
                            </span>
                          </div>

                          {expandedGroups[
                            group.groupName
                          ] && (
                              <div className="commander-ai-details">
                                <p>
                                  <b>
                                    Personnel:
                                  </b>{" "}
                                  {group.personnel?.join(
                                    ", "
                                  ) || "N/A"}
                                </p>

                                <p>
                                  <b>Reason:</b>{" "}
                                  {
                                    group.classificationReason
                                  }
                                </p>

                                <p>
                                  <b>
                                    Training Focus:
                                  </b>{" "}
                                  {
                                    group.trainingFocus
                                  }
                                </p>

                                <div className="commander-ai-plan">
                                  <b>
                                    Recommended Plan:
                                  </b>

                                  <ul>
                                    {group.recommendedPlan?.map(
                                      (
                                        item,
                                        itemIndex
                                      ) => (
                                        <li
                                          key={`${item}-${itemIndex}`}
                                        >
                                          {item}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              </div>
                            )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <CommanderNav activePage="section" />
      </div>
    </div>
  );
}

function PersonnelDetails({
  person,
  officialRecords = [],
  practiceRecords = [],
  prediction,
  predictionLoading,
  predictionError,
  onGeneratePrediction,
}) {
  const latestOfficial =
    getLatestRecord(officialRecords);

  const latestPractice =
    getLatestRecord(practiceRecords);

  const previousPractice =
    getPreviousRecord(practiceRecords);

  const officialScore =
    getRecordScore(latestOfficial);

  const practiceScore =
    getRecordScore(latestPractice);

  const previousPracticeScore =
    getRecordScore(previousPractice);

  const trend = calculateScoreTrend(
    practiceScore,
    previousPracticeScore
  );

  const performanceRecord =
    latestPractice || latestOfficial;

  const stationAnalysis =
    getStationAnalysis(performanceRecord);

  const runtime =
    latestPractice?.runtime ??
    latestPractice?.runTime ??
    latestOfficial?.runtime ??
    latestOfficial?.runTime ??
    "N/A";

  return (
    <div
      className="unit-details-card section-personnel-details"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      {/* PERSONNEL DETAILS */}

      <h4>Personnel Details</h4>

      <div className="section-details-list">
        <p>
          <b>DOB:</b>{" "}
          {formatPersonDOB(person.dob)}
        </p>

        <p>
          <b>Unit:</b>{" "}
          {person.unit || "N/A"}
        </p>

      </div>

      <hr />

      {/* 2 × 3 PERFORMANCE GRID */}

      <div className="section-performance-grid">
        <div className="section-performance-stat">
          <span>Official</span>

          <strong
            style={{
              color: getIPPTColor(
                latestOfficial?.result
              ),
            }}
          >
            {latestOfficial?.result || "N/A"}
          </strong>

          <small>
            {officialScore !== null
              ? `${officialScore} points`
              : "No record"}
          </small>
        </div>

        <div className="section-performance-stat">
          <span>Practice</span>

          <strong>
            {practiceScore !== null
              ? practiceScore
              : "N/A"}
          </strong>

          <small>
            {latestPractice
              ? formatDate(
                latestPractice.date ||
                latestPractice.createdAt
              )
              : "No record"}
          </small>
        </div>

        <div className="section-performance-stat">
          <span>Score change</span>

          <strong
            className={`section-score-change ${trend.className}`}
          >
            {trend.value}
          </strong>

          <small>{trend.label}</small>
        </div>

        <div className="section-performance-stat">
          <span>Runtime</span>

          <strong>{runtime}</strong>

          <small>
            {latestPractice
              ? "Latest practice"
              : latestOfficial
                ? "Latest official"
                : "No record"}
          </small>
        </div>

        <div className="section-performance-stat">
          <span>Strongest</span>

          <strong>
            {stationAnalysis.strongest}
          </strong>

          <small>Calculator-based</small>
        </div>

        <div className="section-performance-stat">
          <span>Needs attention</span>

          <strong>
            {stationAnalysis.weakest}
          </strong>

          <small>Calculator-based</small>
        </div>
      </div>

      {/* OFFICIAL GRAPH */}

      <hr />

      <div className="section-history-heading">
        <h4>
          Past 5 Official IPPT Records
        </h4>

        <span>
          {officialRecords.length}{" "}
          {officialRecords.length === 1
            ? "record"
            : "records"}
        </span>
      </div>

      <IPPTMiniGraph
        records={officialRecords}
      />

      {/* AI PASSING PROBABILITY */}

      <hr />

      <div className="section-personnel-prediction">
        <div className="section-prediction-title">
          <Sparkles size={18} />

          <div>
            <h4>
              AI Passing Probability
            </h4>

            <p>
              Estimate this personnel&apos;s
              chance of passing the next
              official IPPT.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="section-prediction-button"
          onClick={onGeneratePrediction}
          disabled={predictionLoading}
        >
          {predictionLoading ? (
            <>
              <Loader2
                size={17}
                className="section-spin"
              />

              Generating Prediction...
            </>
          ) : prediction ? (
            "Regenerate Prediction"
          ) : (
            "Generate Prediction"
          )}
        </button>

        {predictionError && (
          <p className="ai-error">
            {predictionError}
          </p>
        )}

        {prediction && (
          <div className="section-prediction-result">
            <div className="section-prediction-percentage">
              <strong>
                {clampScore(
                  prediction.passingProbability
                )}
                %
              </strong>

              <span>
                Estimated chance of passing
              </span>
            </div>

            <div className="section-prediction-details">
              <p>
                <b>Risk Level:</b>{" "}
                {prediction.riskLevel ||
                  "N/A"}
              </p>

              <p>
                <b>Reason:</b>{" "}
                {prediction.reason || "N/A"}
              </p>

              <p>
                <b>
                  Recommended Action:
                </b>{" "}
                {prediction.recommendedAction ||
                  "N/A"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IPPTMiniGraph({ records }) {
  const width = 300;
  const height = 160;
  const padding = 32;

  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return (
      <p className="commander-text section-no-history">
        No official IPPT records available.
      </p>
    );
  }

  const scores = records.map((record) =>
    Number(
      record.totalScore ??
      record.totalscore ??
      0
    )
  );

  const points = scores.map(
    (score, index) => {
      const x =
        padding +
        (index *
          (width - padding * 2)) /
        Math.max(
          records.length - 1,
          1
        );

      const y =
        height -
        padding -
        (score / 100) *
        (height - padding * 2);

      return {
        x,
        y,
        score,
      };
    }
  );

  const linePoints = points
    .map(
      (point) =>
        `${point.x},${point.y}`
    )
    .join(" ");

  return (
    <div className="section-ippt-graph-wrap">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Past five official IPPT scores"
      >
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

        <text
          x="4"
          y="18"
          fontSize="10"
          fill="#062b55"
        >
          Score
        </text>

        <polyline
          points={linePoints}
          fill="none"
          stroke="#0b4f8a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map(
          (point, index) => (
            <g
              key={
                records[index].id ||
                index
              }
            >
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#0b4f8a"
              />

              <text
                x={point.x - 8}
                y={point.y - 9}
                fontSize="10"
                fill="#062b55"
              >
                {point.score}
              </text>

              <text
                x={point.x - 18}
                y={height - 8}
                fontSize="8"
                fill="#475569"
              >
                {formatShortDate(
                  records[index].date ||
                  records[index]
                    .createdAt
                )}
              </text>
            </g>
          )
        )}
      </svg>
    </div>
  );
}

function getPersonID(person) {
  return person?.userID || person?.id || "";
}

function getDisplayName(user) {
  return (
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""
      }`.trim() ||
    "N/A"
  );
}

function getLatestRecord(records = []) {
  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return null;
  }

  return records[records.length - 1];
}

function getPreviousRecord(records = []) {
  if (
    !Array.isArray(records) ||
    records.length < 2
  ) {
    return null;
  }

  return records[records.length - 2];
}

function getRecordScore(record) {
  if (!record) return null;

  const score =
    record.totalScore ??
    record.totalscore ??
    record.ipptScore;

  if (
    score === undefined ||
    score === null ||
    score === ""
  ) {
    return null;
  }

  const number = Number(score);

  return Number.isFinite(number)
    ? number
    : null;
}

function calculateScoreTrend(
  latestScore,
  previousScore
) {
  if (
    latestScore === null ||
    previousScore === null
  ) {
    return {
      value: "N/A",
      label: "No trend",
      className: "neutral",
    };
  }

  const difference =
    Number(latestScore) -
    Number(previousScore);

  if (difference >= 3) {
    return {
      value: `+${difference}`,
      label: "Improving",
      className: "improving",
    };
  }

  if (difference <= -3) {
    return {
      value: String(difference),
      label: "Declining",
      className: "declining",
    };
  }

  return {
    value:
      difference > 0
        ? `+${difference}`
        : String(difference),

    label: "Stable",
    className: "stable",
  };
}

function getStationAnalysis(record) {
  if (!record) {
    return {
      strongest: "N/A",
      weakest: "N/A",
    };
  }

  const pushupScore = Number(
    record.pushupScore ?? 0
  );

  const situpScore = Number(
    record.situpScore ?? 0
  );

  const runScore = Number(
    record.runScore ?? 0
  );

  const stations = [
    {
      name: "Push-ups",
      score: pushupScore,
      maximum: 25,
    },
    {
      name: "Sit-ups",
      score: situpScore,
      maximum: 25,
    },
    {
      name: "2.4 km run",
      score: runScore,
      maximum: 50,
    },
  ].map((station) => ({
    ...station,

    percentage:
      station.maximum === 0
        ? 0
        : (station.score /
          station.maximum) *
        100,
  }));

  const hasStationScores =
    stations.some(
      (station) =>
        station.score > 0
    );

  if (!hasStationScores) {
    return {
      strongest: "N/A",
      weakest: "N/A",
    };
  }

  const sorted = [...stations].sort(
    (a, b) =>
      b.percentage - a.percentage
  );

  return {
    strongest:
      sorted[0]?.name || "N/A",

    weakest:
      sorted[sorted.length - 1]
        ?.name || "N/A",
  };
}

function clampScore(value) {
  const number = Number(value || 0);

  return Math.min(
    Math.max(
      Number.isFinite(number)
        ? number
        : 0,
      0
    ),
    100
  );
}

function formatPersonDOB(date) {
  if (!date) return "N/A";

  return formatDate(date);
}

function formatDate(date) {
  if (!date) return "No Date";

  const parsedDate =
    typeof date?.toDate === "function"
      ? date.toDate()
      : new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "No Date";
  }

  return parsedDate.toLocaleDateString(
    "en-SG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function formatShortDate(date) {
  if (!date) return "-";

  const parsedDate =
    typeof date?.toDate === "function"
      ? date.toDate()
      : new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-";
  }

  return parsedDate.toLocaleDateString(
    "en-SG",
    {
      day: "numeric",
      month: "short",
    }
  );
}

function getIPPTColor(result) {
  const normalisedResult =
    String(result || "").toLowerCase();

  if (normalisedResult === "gold") {
    return "#d4a100";
  }

  if (normalisedResult === "silver") {
    return "#6b7280";
  }

  if (normalisedResult === "pass") {
    return "#188038";
  }

  if (normalisedResult === "fail") {
    return "#d93025";
  }

  return "#0b4f8a";
}