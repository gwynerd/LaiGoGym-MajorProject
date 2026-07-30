import { useEffect, useState } from "react";
import {
    User,
    Users,
    Trophy,
    TrendingUp,
    AlertTriangle,
    ShieldCheck,
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

    const currentUser = JSON.parse(localStorage.getItem("user")) || {};
    const commanderID = currentUser.userID || currentUser.id;

    useEffect(() => {
        const loadHomeData = async () => {
            try {
                const commanderData = await getCommanderById(commanderID);

                const personnelData =
                    await getPersonnelByCommanderId(commanderID);

                const readinessData = await updateTeamReadiness(
                    commanderID,
                    personnelData
                );

                const statisticsData =
                    await updateTeamStatistics(personnelData);

                const officialData =
                    await getPastOfficialIPPTRecordsForPersonnel(personnelData);

                setCommander(commanderData);
                setPersonnel(personnelData);
                setReadiness(readinessData);
                setStatistics(statisticsData);
                setOfficialHistory(officialData);
            } catch (error) {
                console.error("Error loading Commander Home:", error);
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
        (person) => Number(person.readiness || 0) < 60
    );

    const lowReadinessCount =
        lowReadinessPersonnel.length;

    const latestOfficialRecords = personnel
        .map((person) => {
            const userID = person.userID || person.id;
            const records = officialHistory[userID] || [];

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

    const goldCount = latestOfficialRecords.filter(
        ({ record }) =>
            record.result?.toLowerCase() === "gold"
    ).length;

    const silverCount = latestOfficialRecords.filter(
        ({ record }) =>
            record.result?.toLowerCase() === "silver"
    ).length;

    const passCount = latestOfficialRecords.filter(
        ({ record }) =>
            record.result?.toLowerCase() === "pass"
    ).length;

    const failCount = latestOfficialRecords.filter(
        ({ record }) =>
            record.result?.toLowerCase() === "fail"
    ).length;

    const alerts = [];

    lowReadinessPersonnel.forEach((person) => {
        alerts.push({
            type: "warning",
            text: `${getDisplayName(person)} - Low readiness (${Number(
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
    const stationType =
        commander?.unit === "Paramedic" ? "Medical Centre" : "Fire Station";

    const stationName = commander?.address
        ? `${commander.address} ${stationType}`
        : "Station N/A";
    return (
        <div className="commander-page">
            <div className="commander-phone">

                {/* STATUS BAR */}

                <div className="commander-status-bar">
                    <span>9:41</span>
                    <span>● ● ● WiFi 🔋</span>
                </div>


                {/* WELCOME HEADER */}
                <div className="commander-home-scroll">
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
                            <div>
                                <h1>
                                    Hi, {getDisplayName(commander)}!
                                </h1>

                                <p>
                                    {commander?.rank || "Commander"} • {commander?.unit || "N/A"}
                                </p>

                                <div className="commander-home-station">
                                    {stationName}
                                </div>
                            </div>

                        </div>

                        <p className="commander-home-welcome-text">
                            Here's your section overview for today.
                        </p>

                        <div className="commander-home-hero-stats">

                            <div>
                                <span>Personnel</span>
                                <strong>{totalPersonnel}</strong>
                            </div>

                            <div>
                                <span>Team Readiness</span>
                                <strong>{avgReadinessScore}%</strong>
                            </div>

                        </div>

                    </section>


                    <main className="commander-home-content">


                        {/* QUICK STATISTICS */}

                        <section className="commander-card">

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
                                        <strong>{totalPersonnel}</strong>
                                    </div>

                                </div>


                                <div className="commander-home-stat-card">

                                    <div className="commander-home-stat-icon pass">
                                        <Trophy size={21} />
                                    </div>

                                    <div>
                                        <span>Official Pass Rate</span>
                                        <strong>{passRate}%</strong>
                                    </div>

                                </div>


                                <div className="commander-home-stat-card">

                                    <div className="commander-home-stat-icon readiness">
                                        <TrendingUp size={21} />
                                    </div>

                                    <div>
                                        <span>Team Readiness</span>
                                        <strong>{avgReadinessScore}%</strong>
                                    </div>

                                </div>


                                <div className="commander-home-stat-card">

                                    <div className="commander-home-stat-icon warning">
                                        <AlertTriangle size={21} />
                                    </div>

                                    <div>
                                        <span>Low Readiness</span>
                                        <strong>{lowReadinessCount}</strong>
                                    </div>

                                </div>

                            </div>

                        </section>


                        {/* TODAY'S ALERTS */}

                        <section className="commander-card">

                            <div className="commander-section-header">

                                <h3 className="commander-card-title">
                                    Today's Alerts
                                </h3>

                                <AlertTriangle
                                    size={20}
                                    color="#d97706"
                                />

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

                                    {alerts.slice(0, 5).map((alert, index) => (

                                        <div
                                            className={`commander-home-alert ${alert.type}`}
                                            key={index}
                                        >

                                            {alert.type === "achievement" ? (

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


                        {/* OFFICIAL IPPT SUMMARY */}

                        <section className="commander-card">

                            <h3 className="commander-card-title">
                                Official IPPT Results
                            </h3>

                            <div className="commander-home-ippt-layout">

                                <IPPTDonut
                                    gold={goldCount}
                                    silver={silverCount}
                                    pass={passCount}
                                    fail={failCount}
                                />

                                <div className="commander-home-ippt-legend">

                                    <div>
                                        <span className="ippt-dot gold"></span>
                                        <p>Gold</p>
                                        <strong>{goldCount}</strong>
                                    </div>

                                    <div>
                                        <span className="ippt-dot silver"></span>
                                        <p>Silver</p>
                                        <strong>{silverCount}</strong>
                                    </div>

                                    <div>
                                        <span className="ippt-dot pass"></span>
                                        <p>Pass</p>
                                        <strong>{passCount}</strong>
                                    </div>

                                    <div>
                                        <span className="ippt-dot fail"></span>
                                        <p>Fail</p>
                                        <strong>{failCount}</strong>
                                    </div>

                                </div>

                            </div>

                        </section>


                        {/* PRACTICE READINESS */}

                        <section className="commander-card">

                            <h3 className="commander-card-title">
                                Team Practice Readiness
                            </h3>

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
                      ${getReadinessColor(avgReadinessScore)}
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
                                                    getReadinessColor(avgReadinessScore),
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
                                        Based on the latest personnel practice IPPT
                                        performance.
                                    </p>

                                    <strong
                                        style={{
                                            color:
                                                getReadinessColor(avgReadinessScore),
                                        }}
                                    >
                                        {getReadinessLevel(avgReadinessScore)}
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


function IPPTDonut({ gold, silver, pass, fail }) {
    const total = gold + silver + pass + fail;

    if (total === 0) {
        return (
            <div className="commander-home-empty-donut">
                <span>No Data</span>
            </div>
        );
    }

    const goldPercent = (gold / total) * 100;
    const silverPercent = (silver / total) * 100;
    const passPercent = (pass / total) * 100;

    const goldEnd = goldPercent;
    const silverEnd = goldEnd + silverPercent;
    const passEnd = silverEnd + passPercent;
    return (
        <div
            className="commander-home-donut"
            style={{
                background: `
          radial-gradient(
            circle,
            white 57%,
            transparent 58%
          ),
          conic-gradient(
            #d4a100 0% ${goldEnd}%,
            #94a3b8 ${goldEnd}% ${silverEnd}%,
            #188038 ${silverEnd}% ${passEnd}%,
            #d93025 ${passEnd}% 100%
          )
        `,
            }}
        >
            <div>
                <strong>{total}</strong>
                <span>Personnel</span>
            </div>
        </div>
    );
}


function getDisplayName(user) {
    return (
        user?.name ||
        `${user?.firstName || ""} ${user?.lastName || ""
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

    if (value >= 80) return "High Readiness";
    if (value >= 60) return "Moderate Readiness";

    return "Low Readiness";
}