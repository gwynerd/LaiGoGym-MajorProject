import { useEffect, useState } from "react";
import { Search, User, AlertTriangle } from "lucide-react";
import { generateCommanderGroupPlan } from "../services/geminiService";
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
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiGroups, setAiGroups] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});

  const currentUser = JSON.parse(localStorage.getItem("user"));
  const commanderID = currentUser?.userID || currentUser?.id;

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
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
      console.error("Unit AI grouping error:", error);
      setAiError(
        "Unable to generate AI official IPPT plan. Please try again later."
      );
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const loadUnitData = async () => {
      try {
        const commanderData = await getCommanderById(commanderID);
        const personnelData = await getPersonnelByCommanderId(commanderID);

        const practiceData =
          await getPastIPPTRecordsForPersonnel(personnelData);

        const officialData =
          await getPastOfficialIPPTRecordsForPersonnel(personnelData);

        setCommander(commanderData);
        setPersonnel(personnelData);
        setPracticeHistory(practiceData);
        setOfficialHistory(officialData);
      } catch (error) {
        console.error("Error loading unit page:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUnitData();
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
            <h2 className="commander-header-title">Section</h2>
          </header>

          <main className="commander-content commander-loading-content">
            <div className="commander-loading-circle"></div>
            <p>Loading Section Page...</p>
          </main>
        </div>
      </div>
    );
  }

  const filteredPersonnel = personnel.filter((person) =>
    getDisplayName(person)
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const activeHistory =
    scoreType === "official" ? officialHistory : practiceHistory;

  const officialFailCount = personnel.filter((person) => {
    const userID = person.userID || person.id;
    const records = officialHistory[userID] || [];
    const latestOfficial = records[records.length - 1];

    return latestOfficial?.result === "Fail";
  }).length;

  return (
    <div className="commander-page">
      <div className="commander-phone">
        <div className="commander-status-bar">
          <span>9:41</span>
          <span>● ● ● WiFi 🔋</span>
        </div>

        <header className="commander-header">
          <h2 className="commander-header-title">Section</h2>

          <div className="commander-profile-mini">
            <User size={16} />
            <span>{getDisplayName(commander)}</span>
          </div>
        </header>

        <main className="commander-content">
          <section className="commander-card">
            <h3 className="commander-card-title">
              Personnel Management
            </h3>

            <div className="unit-total-responders">
              <h2>{personnel.length}</h2>
              <p>Total Personnel</p>
            </div>

            <p className="commander-text">
              View personnel under {commander?.unit}.
            </p>

            <div className="unit-toggle-row">
              <button
                type="button"
                className={
                  scoreType === "official"
                    ? "unit-toggle-active"
                    : "unit-toggle-btn"
                }
                onClick={() => setScoreType("official")}
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
                onClick={() => setScoreType("practice")}
              >
                Practice IPPT
              </button>
            </div>

            <div className="commander-search-box">
              <Search size={16} />

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search personnel..."
                className="commander-search-input"
              />
            </div>
          </section>

          {filteredPersonnel.length === 0 ? (
            <section className="commander-card">
              <p className="commander-text">No personnel found.</p>
            </section>
          ) : (
            filteredPersonnel.map((person) => {
              const userID = person.userID || person.id;
              const records = activeHistory[userID] || [];
              const latestRecord = records[records.length - 1];

              const displayResult =
                scoreType === "official"
                  ? latestRecord?.result || "N/A"
                  : person.ippt ||
                  latestRecord?.result ||
                  "N/A";

              const displayScore =
                latestRecord?.totalScore ??
                latestRecord?.totalscore ??
                person.readiness ??
                0;

              return (
                <section
                  key={person.id}
                  className="unit-responder-card"
                  onClick={() =>
                    setSelectedPersonnel(
                      selectedPersonnel?.id === person.id
                        ? null
                        : person
                    )
                  }
                >
                  <div className="unit-card-personnel-heading">
                    <h3 className="unit-card-name">
                      {getDisplayName(person)}
                    </h3>

                    <p className="unit-card-rank">
                      {person.rank || "Rank N/A"}
                    </p>
                  </div>

                  <div
                    className="unit-result-circle"
                    style={{
                      background: `radial-gradient(
                          circle,
                          white 58%,
                          transparent 59%
                        ),
                        conic-gradient(
                          ${getIPPTColor(displayResult)}
                          ${Number(displayScore || 0)}%,
                          #d9e2ee 0
                        )`,
                    }}
                  >
                    <div className="unit-circle-content">
                      <strong
                        style={{
                          color: getIPPTColor(displayResult),
                        }}
                      >
                        {displayScore || 0}
                      </strong>

                      <span
                        style={{
                          color: getIPPTColor(displayResult),
                        }}
                      >
                        {displayResult}
                      </span>
                    </div>
                  </div>

                  <p className="unit-expand-text">
                    {selectedPersonnel?.id === person.id
                      ? "Hide details ▲"
                      : "Click to view details ▼"}
                  </p>

                  {selectedPersonnel?.id === person.id && (
                    <PersonnelDetails
                      person={person}
                      records={records}
                      scoreType={scoreType}
                    />
                  )}
                </section>
              );
            })
          )}

          {scoreType === "official" && (
            <section className="commander-card">
              <h3 className="commander-card-title">
                AI Official IPPT Recommendation
              </h3>

              <p className="commander-text">
                Generate group training plans based on official IPPT
                results.
              </p>

              {officialFailCount > 0 && (
                <div className="commander-recommendation">
                  <AlertTriangle size={20} color="#d97706" />

                  <p>
                    {officialFailCount}{" "}
                    {officialFailCount === 1 ? "personnel has" : "personnel have"} failed
                    their latest official IPPT and may need closer training support.
                  </p>
                </div>
              )}

              <button
                type="button"
                className="coach-btn"
                onClick={handleGenerateAIGroupPlan}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    Generating
                    <span className="loading-dots"></span>
                  </>
                ) : (
                  "Generate AI Group Plan"
                )}
              </button>

              {aiError && <p className="ai-error">{aiError}</p>}

              {aiGroups && (
                <div className="commander-ai-output">
                  <h3>AI Group Classification</h3>

                  <p className="commander-ai-summary">
                    {aiGroups.summary}
                  </p>

                  {aiGroups.groups?.map((group, index) => (
                    <div
                      className="commander-ai-group-card"
                      key={index}
                    >
                      <div
                        className="commander-ai-group-header"
                        onClick={() =>
                          toggleGroup(group.groupName)
                        }
                      >
                        <div>
                          <h4>{group.groupName}</h4>

                          <p className="commander-ai-count">
                            {group.personnel?.length || 0} Personnel
                          </p>
                        </div>

                        <span className="commander-expand-btn">
                          {expandedGroups[group.groupName]
                            ? "Hide ▲"
                            : "Click to Expand ▼"}
                        </span>
                      </div>

                      {expandedGroups[group.groupName] && (
                        <div className="commander-ai-details">
                          <p>
                            <b>Personnel:</b>{" "}
                            {group.personnel?.join(", ")}
                          </p>

                          <p>
                            <b>Reason:</b>{" "}
                            {group.classificationReason}
                          </p>

                          <p>
                            <b>Training Focus:</b>{" "}
                            {group.trainingFocus}
                          </p>

                          <div className="commander-ai-plan">
                            <b>Recommended Plan:</b>

                            <ul>
                              {group.recommendedPlan?.map(
                                (item, i) => (
                                  <li key={i}>{item}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        <CommanderNav activePage="section" />
      </div>
    </div>
  );
}

function PersonnelDetails({ person, records, scoreType }) {
  const latestRecord = records[records.length - 1];

  return (
    <div className="unit-details-card">
      <h4>Personnel Details</h4>

      <p>
        <b>Name:</b> {getDisplayName(person)}
      </p>

      <p>
        <b>DOB:</b> {person.dob || "N/A"}
      </p>

      <p>
        <b>Unit:</b> {person.unit || "N/A"}
      </p>

      <p>
        <b>Role:</b> {person.role || "Personnel"}
      </p>

      <p>
        <b>Rank:</b> {person.rank || "N/A"}
      </p>

      <hr />

      <h4>
        {scoreType === "official"
          ? "Latest Official IPPT"
          : "Latest Practice IPPT"}
      </h4>

      {!latestRecord ? (
        <p>
          No {scoreType === "official" ? "official" : "practice"} IPPT
          record available.
        </p>
      ) : (
        <>
          <p>
            <b>Date:</b>{" "}
            {formatDate(
              latestRecord.date || latestRecord.createdAt
            )}
          </p>

          <p>
            <b>Result:</b> {latestRecord.result || "N/A"}
          </p>

          <p>
            <b>Total Score:</b>{" "}
            {latestRecord.totalScore ??
              latestRecord.totalscore ??
              "N/A"}
          </p>

          <p>
            <b>Push-Ups:</b> {latestRecord.pushups ?? 0}
          </p>

          <p>
            <b>Sit-Ups:</b> {latestRecord.situps ?? 0}
          </p>

          <p>
            <b>2.4km Run:</b>{" "}
            {latestRecord.runtime || "N/A"}
          </p>
        </>
      )}
    </div>
  );
}

function getDisplayName(user) {
  return (
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""
      }`.trim() ||
    "N/A"
  );
}

function formatDate(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);

  if (isNaN(d.getTime())) return "No Date";

  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getIPPTColor(result) {
  if (result === "Gold") return "#d4a100";
  if (result === "Silver") return "#6b7280";
  if (result === "Pass") return "#188038";
  if (result === "Fail") return "#d93025";

  return "#0b4f8a";
}

function getResultClass(result) {
  if (result === "Gold") return "unit-gold";
  if (result === "Silver") return "unit-silver";
  if (result === "Fail") return "unit-fail";
  if (result === "Pass") return "unit-pass";

  return "";
}