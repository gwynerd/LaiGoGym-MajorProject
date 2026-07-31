import { useEffect, useState } from "react";
import {
  User,
  Users,
  Trophy,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Info,
} from "lucide-react";

import CommanderNav from "../components/CommanderNav";

import {
  getCommanderById,
  getPersonnelByCommanderId,
  updateTeamReadiness,
  updateTeamStatistics,
  getPastOfficialIPPTRecordsForPersonnel,
} from "../services/firestoreService";

export default function CommanderHome() {
  const [commander, setCommander] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [officialHistory, setOfficialHistory] = useState({});
  const [loading, setLoading] = useState(true);

  const [openInfo, setOpenInfo] = useState("");

  const currentUser =
    JSON.parse(localStorage.getItem("user")) || {};

  const commanderID =
    currentUser.userID || currentUser.id;

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        const commanderData =
          await getCommanderById(commanderID);

        const personnelData =
          await getPersonnelByCommanderId(commanderID);

        const readinessData =
          await updateTeamReadiness(
            commanderID,
            personnelData
          );

        const statisticsData =
          await updateTeamStatistics(personnelData);

        const officialData =
          await getPastOfficialIPPTRecordsForPersonnel(
            personnelData
          );

        setCommander(commanderData);
        setPersonnel(personnelData);
        setReadiness(readinessData);
        setStatistics(statisticsData);
        setOfficialHistory(officialData);
      } catch (error) {
        console.error(
          "Error loading Commander Home:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [commanderID]);

  if (loading) {
    return (
      <div className="commander-page">
        <div className="commander-phone">
          <div className="commander-status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <header className="commander-home-loading-header">
            <h2>Home</h2>
          </header>

          <main className="commander-content commander-loading-content">
            <div className="commander-loading-circle"></div>
            <p>Loading Home Page...</p>
          </main>
        </div>
      </div>
    );
  }

  const totalPersonnel = personnel.length;

  const avgReadinessScore =
    readiness?.avgReadinessScore ?? 0;

  const passRate =
    statistics?.passRate ?? 0;

  const lowReadinessPersonnel = personnel.filter(
    (person) =>
      Number(person.readiness || 0) < 60
  );

  const lowReadinessCount =
    lowReadinessPersonnel.length;

  const latestOfficialRecords = personnel
    .map((person) => {
      const userID =
        person.userID || person.id;

      const records =
        officialHistory[userID] || [];

      const latestRecord =
        records.length > 0
          ? records[records.length - 1]
          : null;

      return {
        person,
        record: latestRecord,
      };
    })
    .filter((item) => item.record);

  const goldCount =
    latestOfficialRecords.filter(
      ({ record }) =>
        record.result?.toLowerCase() === "gold"
    ).length;

  const silverCount =
    latestOfficialRecords.filter(
      ({ record }) =>
        record.result?.toLowerCase() === "silver"
    ).length;

  const passCount =
    latestOfficialRecords.filter(
      ({ record }) =>
        record.result?.toLowerCase() === "pass"
    ).length;

  const failCount =
    latestOfficialRecords.filter(
      ({ record }) =>
        record.result?.toLowerCase() === "fail"
    ).length;

  const alerts = [];

  lowReadinessPersonnel.forEach((person) => {
    alerts.push({
      type: "warning",

      text: `${getDisplayName(
        person
      )} - Low readiness (${Number(
        person.readiness || 0
      )}%)`,
    });
  });

  latestOfficialRecords
    .filter(
      ({ record }) =>
        record.result?.toLowerCase() === "gold"
    )
    .forEach(({ person }) => {
      alerts.push({
        type: "achievement",

        text: `${getDisplayName(
          person
        )} achieved Gold in Official IPPT`,
      });
    });

  const commanderType = (
    commander?.unit ||
    commander?.role ||
    ""
  ).toLowerCase();

  const stationType =
    commanderType === "paramedic"
      ? "Medical Centre"
      : commanderType === "firefighter"
        ? "Fire Station"
        : "Station";

  const stationName = commander?.address
    ? `${commander.address} ${stationType}`
    : "Station N/A";

  return (
    <div className="commander-page">
      <div className="commander-phone">
        <div className="commander-status-bar">
          <span>9:41</span>
          <span>● ● ● WiFi 🔋</span>
        </div>

        <div className="commander-home-scroll">
          {/* WELCOME HEADER */}

          <section className="commander-home-hero">
            <div className="commander-home-profile-row">
              <div className="commander-home-avatar">
                {commander?.photoURL ? (
                  <img
                    src={commander.photoURL}
                    alt="Commander profile"
                    className="commander-home-avatar-img"
                  />
                ) : (
                  <User size={40} />
                )}
              </div>

              <div className="commander-home-profile-details">
                <h1>
                  Hi, {getDisplayName(commander)}!
                </h1>

                <p>
                  {commander?.rank || "Commander"} •{" "}
                  {commander?.unit || "N/A"}
                </p>

                <div className="commander-home-station">
                  {stationName}
                </div>
              </div>
            </div>

            <p className="commander-home-welcome-text">
              Here&apos;s your section overview for
              today.
            </p>

            <div className="commander-home-hero-stats">
              <div>
                <span>Personnel</span>
                <strong>{totalPersonnel}</strong>
              </div>

              <div>
                <span>Team Readiness</span>
                <strong>
                  {avgReadinessScore}%
                </strong>
              </div>
            </div>
          </section>

          <main className="commander-home-content">
            {/* QUICK STATISTICS */}

            <section className="commander-card commander-home-quick-section">
              <h3 className="commander-card-title">
                Quick Statistics
              </h3>

              <div className="commander-home-quick-grid">
                <div className="commander-home-stat-card">
                  <div className="commander-home-stat-icon personnel">
                    <Users size={21} />
                  </div>

                  <div>
                    <span>Personnel</span>
                    <strong>
                      {totalPersonnel}
                    </strong>
                  </div>
                </div>

                <div className="commander-home-stat-card">
                  <div className="commander-home-stat-icon pass">
                    <Trophy size={21} />
                  </div>

                  <div>
                    <span>
                      Official Pass Rate
                    </span>

                    <strong>{passRate}%</strong>
                  </div>
                </div>

                <div className="commander-home-stat-card">
                  <div className="commander-home-stat-icon readiness">
                    <TrendingUp size={21} />
                  </div>

                  <div>
                    <span>Team Readiness</span>

                    <strong>
                      {avgReadinessScore}%
                    </strong>
                  </div>
                </div>

                <div className="commander-home-stat-card">
                  <div className="commander-home-stat-icon warning">
                    <AlertTriangle size={21} />
                  </div>

                  <div>
                    <span>Low Readiness</span>

                    <strong>
                      {lowReadinessCount}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {/* TODAY'S ALERTS */}

            <section className="commander-home-line-section">
              <div className="commander-home-section-title">
                <h3>Today&apos;s Alerts</h3>
              </div>

              {alerts.length === 0 ? (
                <div className="commander-home-no-alerts">
                  <ShieldCheck
                    size={22}
                    color="#188038"
                  />

                  <p>
                    No important alerts for today.
                  </p>
                </div>
              ) : (
                <div className="commander-home-alert-list">
                  {alerts
                    .slice(0, 5)
                    .map((alert, index) => (
                      <div
                        className={`commander-home-alert ${alert.type}`}
                        key={`${alert.text}-${index}`}
                      >
                        {alert.type ===
                        "achievement" ? (
                          <Trophy
                            size={19}
                            color="#d4a100"
                          />
                        ) : (
                          <AlertTriangle
                            size={19}
                            color="#d93025"
                          />
                        )}

                        <p>{alert.text}</p>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* OFFICIAL IPPT RESULTS */}

            <section className="commander-home-line-section">
              <div className="commander-home-section-title">
                <h3>Official IPPT Results</h3>

                <InfoButton
                  id="official"
                  openInfo={openInfo}
                  setOpenInfo={setOpenInfo}
                  message="This is based on the Personnel's Official IPPT Results."
                />
              </div>

              <div className="commander-home-results-grid">
                <div className="commander-home-result-box gold">
                  <strong>{goldCount}</strong>
                  <span>Gold</span>
                </div>

                <div className="commander-home-result-box silver">
                  <strong>{silverCount}</strong>
                  <span>Silver</span>
                </div>

                <div className="commander-home-result-box pass">
                  <strong>{passCount}</strong>
                  <span>Pass</span>
                </div>

                <div className="commander-home-result-box fail">
                  <strong>{failCount}</strong>
                  <span>Fail</span>
                </div>
              </div>

              {latestOfficialRecords.length ===
                0 && (
                <p className="commander-home-no-result-text">
                  No official IPPT results are
                  currently available.
                </p>
              )}
            </section>

            {/* TEAM PRACTICE READINESS */}

            <section className="commander-home-line-section commander-home-readiness-section">
              <div className="commander-home-section-title">
                <h3>
                  Team Practice Readiness
                </h3>

                <InfoButton
                  id="readiness"
                  openInfo={openInfo}
                  setOpenInfo={setOpenInfo}
                  message="This is based on the latest personnel practice IPPT performance, which is keyed in by personnel themselves within the app."
                />
              </div>

              <div className="commander-home-readiness-layout">
                <div
                  className="commander-home-readiness-circle"
                  style={{
                    background: `
                      radial-gradient(
                        circle,
                        white 58%,
                        transparent 59%
                      ),
                      conic-gradient(
                        ${getReadinessColor(
                          avgReadinessScore
                        )}
                        ${avgReadinessScore}%,
                        #e2e8f0 0
                      )
                    `,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        color:
                          getReadinessColor(
                            avgReadinessScore
                          ),
                      }}
                    >
                      {avgReadinessScore}%
                    </strong>

                    <span>Ready</span>
                  </div>
                </div>

                <div className="commander-home-readiness-text">
                  <h3>Team Readiness</h3>

                  <p>
                    Latest self-recorded practice
                    IPPT performance across the
                    section.
                  </p>

                  <strong
                    style={{
                      color:
                        getReadinessColor(
                          avgReadinessScore
                        ),
                    }}
                  >
                    {getReadinessLevel(
                      avgReadinessScore
                    )}
                  </strong>
                </div>
              </div>
            </section>
          </main>
        </div>

        <CommanderNav activePage="home" />
      </div>
    </div>
  );
}

function InfoButton({
  id,
  openInfo,
  setOpenInfo,
  message,
}) {
  const isOpen = openInfo === id;

  const showInfo = () => {
    setOpenInfo(id);
  };

  const hideInfo = () => {
    setOpenInfo("");
  };

  const toggleInfo = () => {
    setOpenInfo((current) =>
      current === id ? "" : id
    );
  };

  return (
    <div
      className="commander-home-info-container"
      onMouseEnter={showInfo}
      onMouseLeave={hideInfo}
    >
      <button
        type="button"
        className="commander-home-info-button"
        onClick={toggleInfo}
        aria-label="View information"
        aria-expanded={isOpen}
      >
        <Info size={16} />
      </button>

      {isOpen && (
        <div
          className="commander-home-info-popup"
          role="tooltip"
        >
          {message}
        </div>
      )}
    </div>
  );
}

function getDisplayName(user) {
  return (
    user?.name ||
    `${user?.firstName || ""} ${
      user?.lastName || ""
    }`.trim() ||
    "Commander"
  );
}

function getReadinessColor(score) {
  const value = Number(score);

  if (value >= 80) return "#188038";
  if (value >= 60) return "#d4a100";

  return "#d93025";
}

function getReadinessLevel(score) {
  const value = Number(score);

  if (value >= 80) {
    return "High Readiness";
  }

  if (value >= 60) {
    return "Moderate Readiness";
  }

  return "Low Readiness";
}