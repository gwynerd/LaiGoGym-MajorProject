import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router";

import CommanderNav from "../components/CommanderNav";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  Home,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  UserRound,
  Users,
} from "lucide-react";

import {
  getCurrentUser,
  getCommanderById,
  getPersonnelByCommanderId,
  getPastIPPTRecordsForPersonnel,
  getPastOfficialIPPTRecordsForPersonnel,
} from "../services/firestoreService";

import {
  calculateAgeFromDob,
} from "../services/firestoreService";

import {
  calculateIPPT,
} from "../services/ipptCalculator";

import {
  generateCommanderTrainingBrief,
} from "../services/geminiService";

const getPersonID = (person) => {
  return person?.userID || person?.id || "";
};

const getPersonName = (person) => {
  if (!person) return "Unknown";

  return (
    person.fullName ||
    person.name ||
    `${person.firstName || ""} ${person.lastName || ""
      }`.trim() ||
    "Unknown"
  );
};

const getPersonAge = (person) => {
  const storedAge = Number(person?.age);

  if (
    Number.isFinite(storedAge) &&
    storedAge > 0
  ) {
    return storedAge;
  }

  return calculateAgeFromDob(person?.dob) || 18;
};

const getRecordTimestamp = (record) => {
  const value =
    record?.date ??
    record?.createdAt ??
    record?.updatedAt ??
    null;

  if (!value) return 0;

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value).getTime();

  return Number.isNaN(parsedDate)
    ? 0
    : parsedDate;
};

const formatRecordDate = (record) => {
  const timestamp = getRecordTimestamp(record);

  if (!timestamp) return "Date unavailable";

  return new Date(timestamp).toLocaleDateString(
    "en-SG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
};

const getTotalScore = (record) => {
  return Number(
    record?.totalScore ??
    record?.totalscore ??
    record?.ipptScore ??
    record?.pointsTotal ??
    0
  );
};

const getPushups = (record) => {
  return Number(
    record?.pushups ??
    record?.pushUps ??
    0
  );
};

const getSitups = (record) => {
  return Number(
    record?.situps ??
    record?.sitUps ??
    0
  );
};

const getRuntime = (record) => {
  const runtime =
    record?.runtime ??
    record?.runTime ??
    "";

  if (
    runtime === null ||
    runtime === undefined ||
    runtime === ""
  ) {
    return "N/A";
  }

  return String(runtime);
};

const getResult = (record) => {
  return (
    record?.result ||
    record?.ippt ||
    "N/A"
  );
};

const isPassingResult = (record) => {
  const result = getResult(record).toLowerCase();

  return (
    result === "pass" ||
    result === "silver" ||
    result === "gold"
  );
};

/*
  Service returns records using:
  records.slice(0, 5).reverse()

  Therefore they are ordered from oldest to newest.
*/
const getLatestRecord = (records = []) => {
  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  return records[records.length - 1];
};

const getPreviousRecord = (records = []) => {
  if (!Array.isArray(records) || records.length < 2) {
    return null;
  }

  return records[records.length - 2];
};

const getDaysSinceRecord = (record) => {
  const timestamp = getRecordTimestamp(record);

  if (!timestamp) return Infinity;

  return Math.floor(
    (Date.now() - timestamp) /
    (1000 * 60 * 60 * 24)
  );
};

const calculateRecordBreakdown = (
  record,
  person
) => {
  if (!record) return null;

  const age = getPersonAge(person);
  const pushups = getPushups(record);
  const situps = getSitups(record);
  const runtime = getRuntime(record);

  if (
    runtime === "N/A" ||
    !String(runtime).includes(":")
  ) {
    return null;
  }

  return calculateIPPT({
    age,
    pushups,
    situps,
    runtime,
    wantedGoal: "Pass",
  });
};

const getComponentAnalysis = (
  record,
  person
) => {
  const breakdown = calculateRecordBreakdown(
    record,
    person
  );

  if (!breakdown) {
    return {
      strongestComponent: "Insufficient data",
      weakestComponent: "Insufficient data",
      components: [],
    };
  }

  const components = [
    {
      name: "Push-ups",
      score: Number(breakdown.pushupScore || 0),
      maximum: 25,
    },
    {
      name: "Sit-ups",
      score: Number(breakdown.situpScore || 0),
      maximum: 25,
    },
    {
      name: "2.4 km run",
      score: Number(breakdown.runScore || 0),
      maximum: 50,
    },
  ].map((component) => ({
    ...component,
    percentage:
      component.maximum === 0
        ? 0
        : Math.round(
          (component.score /
            component.maximum) *
          100
        ),
  }));

  const strongest = [...components].sort(
    (a, b) => b.percentage - a.percentage
  )[0];

  const weakest = [...components].sort(
    (a, b) => a.percentage - b.percentage
  )[0];

  return {
    strongestComponent:
      strongest?.name || "Insufficient data",

    weakestComponent:
      weakest?.name || "Insufficient data",

    components,
  };
};

const calculateTrend = (
  latestPractice,
  previousPractice
) => {
  if (!latestPractice || !previousPractice) {
    return {
      type: "neutral",
      label: "N/A",
      difference: 0,
      description:
        "At least two practice records are required.",
    };
  }

  const latestScore =
    getTotalScore(latestPractice);

  const previousScore =
    getTotalScore(previousPractice);

  const difference =
    latestScore - previousScore;

  if (difference >= 3) {
    return {
      type: "improving",
      label: "Improving",
      difference,
      description: `Improved by ${difference} points.`,
    };
  }

  if (difference <= -3) {
    return {
      type: "declining",
      label: "Declining",
      difference,
      description: `Dropped by ${Math.abs(
        difference
      )} points.`,
    };
  }

  return {
    type: "stable",
    label: "Stable",
    difference,
    description:
      "The latest practice score is relatively unchanged.",
  };
};

const calculatePriority = ({
  latestPractice,
  latestOfficial,
  trend,
}) => {
  let score = 0;
  const reasons = [];

  if (!latestOfficial) {
    score += 2;
    reasons.push(
      "No official IPPT result is available"
    );
  } else if (!isPassingResult(latestOfficial)) {
    score += 4;
    reasons.push(
      "Latest official IPPT result is Fail"
    );
  }

  if (!latestPractice) {
    score += 3;
    reasons.push(
      "No practice IPPT result is available"
    );
  } else {
    const daysSincePractice =
      getDaysSinceRecord(latestPractice);

    if (daysSincePractice > 30) {
      score += 2;
      reasons.push(
        "No practice update within the last 30 days"
      );
    }

    if (getTotalScore(latestPractice) < 61) {
      score += 2;
      reasons.push(
        "Latest practice score is below the Pass requirement"
      );
    }
  }

  if (trend.type === "declining") {
    score += 3;
    reasons.push(
      "Practice score has declined"
    );
  }

  if (score >= 6) {
    return {
      level: "High",
      className: "high",
      score,
      reasons,
    };
  }

  if (score >= 3) {
    return {
      level: "Medium",
      className: "medium",
      score,
      reasons,
    };
  }

  return {
    level: "Low",
    className: "low",
    score,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Current performance is stable"],
  };
};

const getSuggestedAction = ({
  latestPractice,
  latestOfficial,
  trend,
  weakestComponent,
}) => {
  if (!latestPractice) {
    return "Request an updated practice IPPT submission.";
  }

  if (
    getDaysSinceRecord(latestPractice) > 30
  ) {
    return "Follow up and request a new practice IPPT result.";
  }

  if (
    latestOfficial &&
    !isPassingResult(latestOfficial)
  ) {
    return `Prioritise ${weakestComponent.toLowerCase()} improvement and review the next practice result.`;
  }

  if (trend.type === "declining") {
    return `Discuss the recent score decline and monitor ${weakestComponent.toLowerCase()} performance.`;
  }

  if (trend.type === "improving") {
    return "Continue the current approach and acknowledge the recent improvement.";
  }

  return `Continue monitoring and focus on ${weakestComponent.toLowerCase()}.`;
};

function CommanderTraining() {
  const navigate = useNavigate();

  const [commander, setCommander] =
    useState(null);

  const [personnel, setPersonnel] =
    useState([]);

  const [
    practiceHistory,
    setPracticeHistory,
  ] = useState({});

  const [
    officialHistory,
    setOfficialHistory,
  ] = useState({});

  const [
    selectedPersonnelID,
    setSelectedPersonnelID,
  ] = useState("");

  const [aiBrief, setAiBrief] =
    useState(null);

  const [selectedActions, setSelectedActions] =
    useState({});

  const [dismissedActions, setDismissedActions] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [aiError, setAiError] =
    useState("");

  const loadTrainingData = async () => {
    try {
      setLoading(true);
      setError("");

      const currentUser = getCurrentUser();

      if (!currentUser) {
        throw new Error(
          "Logged-in commander information was not found."
        );
      }

      const commanderID =
        currentUser.userID ||
        currentUser.id;

      if (!commanderID) {
        throw new Error(
          "The logged-in commander has no userID."
        );
      }

      const [
        commanderData,
        personnelData,
      ] = await Promise.all([
        getCommanderById(commanderID),
        getPersonnelByCommanderId(
          commanderID
        ),
      ]);

      const resolvedCommander =
        commanderData || currentUser;

      setCommander(resolvedCommander);
      setPersonnel(personnelData);

      if (personnelData.length === 0) {
        setPracticeHistory({});
        setOfficialHistory({});
        setSelectedPersonnelID("");
        return;
      }

      const [
        practiceData,
        officialData,
      ] = await Promise.all([
        getPastIPPTRecordsForPersonnel(
          personnelData
        ),

        getPastOfficialIPPTRecordsForPersonnel(
          personnelData
        ),
      ]);

      setPracticeHistory(
        practiceData || {}
      );

      setOfficialHistory(
        officialData || {}
      );

      setSelectedPersonnelID(
        getPersonID(personnelData[0])
      );
    } catch (loadError) {
      console.error(
        "Commander Training load error:",
        loadError
      );

      setError(
        loadError.message ||
        "Unable to load Training."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrainingData();
  }, []);


  const personnelAnalysis = useMemo(() => {
    return personnel
      .map((person) => {
        const userID = getPersonID(person);

        const practiceRecords =
          practiceHistory[userID] || [];

        const officialRecords =
          officialHistory[userID] || [];

        const latestPractice =
          getLatestRecord(practiceRecords);

        const previousPractice =
          getPreviousRecord(practiceRecords);

        const latestOfficial =
          getLatestRecord(officialRecords);

        const trend = calculateTrend(
          latestPractice,
          previousPractice
        );

        const componentAnalysis =
          getComponentAnalysis(
            latestPractice ||
            latestOfficial,
            person
          );

        const priority =
          calculatePriority({
            latestPractice,
            latestOfficial,
            trend,
          });

        const suggestedAction =
          getSuggestedAction({
            latestPractice,
            latestOfficial,
            trend,
            weakestComponent:
              componentAnalysis.weakestComponent,
          });

        return {
          ...person,

          userID,
          displayName:
            getPersonName(person),

          practiceRecords,
          officialRecords,

          latestPractice,
          previousPractice,
          latestOfficial,

          trend,
          priority,
          suggestedAction,

          strongestComponent:
            componentAnalysis.strongestComponent,

          weakestComponent:
            componentAnalysis.weakestComponent,

          componentScores:
            componentAnalysis.components,
        };
      })
      .sort((a, b) => {
        if (
          b.priority.score !==
          a.priority.score
        ) {
          return (
            b.priority.score -
            a.priority.score
          );
        }

        return a.displayName.localeCompare(
          b.displayName
        );
      });
  }, [
    personnel,
    practiceHistory,
    officialHistory,
  ]);

  const highPriorityPersonnel =
    useMemo(
      () =>
        personnelAnalysis.filter(
          (person) =>
            person.priority.level ===
            "High"
        ),
      [personnelAnalysis]
    );

  const attentionPersonnel =
    useMemo(
      () =>
        personnelAnalysis.filter(
          (person) =>
            person.priority.level ===
            "High" ||
            person.priority.level ===
            "Medium"
        ),
      [personnelAnalysis]
    );

  const improvingPersonnel =
    useMemo(
      () =>
        personnelAnalysis.filter(
          (person) =>
            person.trend.type ===
            "improving"
        ),
      [personnelAnalysis]
    );

  const decliningPersonnel =
    useMemo(
      () =>
        personnelAnalysis.filter(
          (person) =>
            person.trend.type ===
            "declining"
        ),
      [personnelAnalysis]
    );

  const outdatedPersonnel =
    useMemo(
      () =>
        personnelAnalysis.filter(
          (person) =>
            !person.latestPractice ||
            getDaysSinceRecord(
              person.latestPractice
            ) > 30
        ),
      [personnelAnalysis]
    );

  const selectedPersonnel =
    useMemo(
      () =>
        personnelAnalysis.find(
          (person) =>
            person.userID ===
            selectedPersonnelID
        ) ||
        personnelAnalysis[0] ||
        null,
      [
        personnelAnalysis,
        selectedPersonnelID,
      ]
    );

  const localRecommendedActions =
    useMemo(() => {
      const actions = [];

      if (
        highPriorityPersonnel.length > 0
      ) {
        actions.push({
          id: "high-priority",
          title: `Review ${highPriorityPersonnel.length} high-priority personnel`,
          description:
            "Review their latest practice and official IPPT records.",
          icon: AlertTriangle,
        });
      }

      if (
        decliningPersonnel.length > 0
      ) {
        actions.push({
          id: "declining",
          title: `Follow up with ${decliningPersonnel.length} declining personnel`,
          description:
            "Discuss the recent score decline and monitor their next attempt.",
          icon: TrendingDown,
        });
      }

      if (
        outdatedPersonnel.length > 0
      ) {
        actions.push({
          id: "outdated",
          title: `Request ${outdatedPersonnel.length} practice update${outdatedPersonnel.length === 1
            ? ""
            : "s"
            }`,
          description:
            "These personnel have no recent practice result.",
          icon: Clock3,
        });
      }

      if (
        improvingPersonnel.length > 0
      ) {
        actions.push({
          id: "improving",
          title: `Recognise ${improvingPersonnel.length} improving personnel`,
          description:
            "Acknowledge their recent progress and encourage consistency.",
          icon: TrendingUp,
        });
      }

      if (actions.length === 0) {
        actions.push({
          id: "monitor",
          title:
            "Continue monitoring unit progress",
          description:
            "No urgent follow-up action was identified.",
          icon: CheckCircle2,
        });
      }

      return actions;
    }, [
      highPriorityPersonnel,
      decliningPersonnel,
      outdatedPersonnel,
      improvingPersonnel,
    ]);

  const activeRecommendedActions =
    useMemo(() => {
      return localRecommendedActions.filter(
        (action) =>
          !dismissedActions[action.id]
      );
    }, [
      localRecommendedActions,
      dismissedActions,
    ]);

  const selectedActionCount =
    activeRecommendedActions.filter(
      (action) =>
        Boolean(selectedActions[action.id])
    ).length;

  const toggleAction = (actionID) => {
    setSelectedActions((current) => ({
      ...current,
      [actionID]:
        !current[actionID],
    }));
  };

  const completeSelectedActions = () => {
    const selectedIDs =
      activeRecommendedActions
        .filter(
          (action) =>
            selectedActions[action.id]
        )
        .map((action) => action.id);

    if (selectedIDs.length === 0) {
      return;
    }

    setDismissedActions((current) => {
      const updated = { ...current };

      selectedIDs.forEach((actionID) => {
        updated[actionID] = true;
      });

      return updated;
    });

    setSelectedActions((current) => {
      const updated = { ...current };

      selectedIDs.forEach((actionID) => {
        delete updated[actionID];
      });

      return updated;
    });
  };

  const refreshRecommendedActions =
    async () => {
      setSelectedActions({});
      setDismissedActions({});
      await loadTrainingData();
    };

  const generateBrief = async () => {
    try {
      setAiLoading(true);
      setAiError("");

      const aiPersonnelData =
        personnelAnalysis.map(
          (person) => ({
            name: person.displayName,
            rank:
              person.rank || "N/A",

            latestPractice:
              person.latestPractice
                ? {
                  totalScore:
                    getTotalScore(
                      person.latestPractice
                    ),

                  result:
                    getResult(
                      person.latestPractice
                    ),

                  pushups:
                    getPushups(
                      person.latestPractice
                    ),

                  situps:
                    getSitups(
                      person.latestPractice
                    ),

                  runtime:
                    getRuntime(
                      person.latestPractice
                    ),
                }
                : null,

            previousPractice:
              person.previousPractice
                ? {
                  totalScore:
                    getTotalScore(
                      person.previousPractice
                    ),

                  result:
                    getResult(
                      person.previousPractice
                    ),
                }
                : null,

            latestOfficial:
              person.latestOfficial
                ? {
                  totalScore:
                    getTotalScore(
                      person.latestOfficial
                    ),

                  result:
                    getResult(
                      person.latestOfficial
                    ),

                  pushups:
                    getPushups(
                      person.latestOfficial
                    ),

                  situps:
                    getSitups(
                      person.latestOfficial
                    ),

                  runtime:
                    getRuntime(
                      person.latestOfficial
                    ),
                }
                : null,

            trend:
              person.trend.label,

            scoreChange:
              person.trend.difference,

            strongestComponent:
              person.strongestComponent,

            weakestComponent:
              person.weakestComponent,

            priorityLevel:
              person.priority.level,

            priorityReasons:
              person.priority.reasons,

            suggestedAction:
              person.suggestedAction,
          })
        );

      const result =
        await generateCommanderTrainingBrief(
          aiPersonnelData
        );

      setAiBrief(result);
    } catch (briefError) {
      console.error(
        "Commander Training AI error:",
        briefError
      );

      setAiError(
        briefError.message ||
        "Unable to generate the AI brief."
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="commander-page">
        <div className="commander-phone">
          <div className="commander-status-bar">
            <span>9:41</span>
            <span>●●●</span>
          </div>

          <div className="commander-loading-content">
            <div className="commander-loading-circle" />

            <p>
              Loading Training...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="commander-page">
      <div className="commander-phone">
        <div className="commander-status-bar">
          <span>9:41</span>
          <span>●●●</span>
        </div>

        <header className="commander-header">
          <div>
            <h1 className="commander-header-title">
              Training
            </h1>

          </div>

          <div className="training-header-actions">


            <div className="commander-profile-mini">
              <UserRound size={15} />

              <span>
                {commander
                  ? getPersonName(commander)
                  : "Commander"}
              </span>
            </div>
          </div>
        </header>

        <main className="commander-content training-content">
          {error && (
            <div className="training-error-box">
              <AlertTriangle size={18} />
              <p>{error}</p>
            </div>
          )}

          {/* SUMMARY */}

          <section className="training-summary-grid">
            <article className="training-summary-card">
              <AlertTriangle
                size={20}
                className="training-summary-danger"
              />

              <strong>
                {
                  highPriorityPersonnel.length
                }
              </strong>

              <span>High Priority</span>
            </article>

            <article className="training-summary-card">
              <TrendingUp
                size={20}
                className="training-summary-success"
              />

              <strong>
                {
                  improvingPersonnel.length
                }
              </strong>

              <span>Improving</span>
            </article>

            <article className="training-summary-card">
              <TrendingDown
                size={20}
                className="training-summary-warning"
              />

              <strong>
                {
                  decliningPersonnel.length
                }
              </strong>

              <span>Declining</span>
            </article>

            <article className="training-summary-card">
              <Clock3
                size={20}
                className="training-summary-info"
              />

              <strong>
                {
                  outdatedPersonnel.length
                }
              </strong>

              <span>No Update</span>
            </article>
          </section>

          {/* REQUIRES ATTENTION */}

          <section className="commander-card">
            <div className="training-section-heading">
              <div>
                <p className="training-eyebrow">
                  Priority monitoring
                </p>

                <h2 className="commander-card-title training-title-row">
                  <Target size={18} />
                  Requires Attention
                </h2>
              </div>

              <span className="training-count-badge">
                {
                  attentionPersonnel.length
                }
              </span>
            </div>

            {attentionPersonnel.length ===
              0 ? (
              <div className="training-empty-state">
                <CheckCircle2 size={34} />

                <strong>
                  No urgent concerns
                </strong>

                <p>
                  Current records do not
                  identify high- or
                  medium-priority personnel.
                </p>
              </div>
            ) : (
              <div className="training-attention-list">
                {attentionPersonnel.map(
                  (person) => (
                    <article
                      className="training-attention-card"
                      key={person.userID}
                    >
                      <div className="training-person-header">
                        <div className="training-person-main">
                          <div className="training-person-avatar">
                            {person.photoURL ? (
                              <img
                                src={
                                  person.photoURL
                                }
                                alt={`${person.displayName} profile`}
                              />
                            ) : (
                              <UserRound
                                size={21}
                              />
                            )}
                          </div>

                          <div>
                            <h3>
                              {
                                person.displayName
                              }
                            </h3>

                            <p>
                              {person.rank ||
                                "Personnel"}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`training-priority-badge ${person.priority.className}`}
                        >
                          {
                            person.priority
                              .level
                          }
                        </span>
                      </div>

                      <div className="training-person-stats">
                        <div>
                          <span>
                            Official
                          </span>

                          <strong>
                            {person.latestOfficial
                              ? getResult(
                                person.latestOfficial
                              )
                              : "N/A"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Practice
                          </span>

                          <strong>
                            {person.latestPractice
                              ? getTotalScore(
                                person.latestPractice
                              )
                              : "N/A"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Trend
                          </span>

                          <strong
                            className={`training-trend-${person.trend.type}`}
                          >
                            {
                              person.trend
                                .label
                            }
                          </strong>
                        </div>
                      </div>

                      <div className="training-concern-section">
                        <div className="training-concern-heading">
                          <span>Main concern</span>

                          <strong>
                            {person.weakestComponent}
                          </strong>
                        </div>

                        <div className="training-concern-reasons">
                          {person.priority.reasons
                            .slice(0, 3)
                            .map((reason) => (
                              <div
                                className="training-concern-reason"
                                key={reason}
                              >
                                <span className="training-reason-bullet">
                                  •
                                </span>

                                <p>{reason}</p>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="training-follow-up">
                        <Sparkles
                          size={17}
                        />

                        <div>
                          <strong>
                            Suggested
                            Action
                          </strong>

                          <p>
                            {
                              person.suggestedAction
                            }
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>

          {/* AI COMMANDER BRIEF */}

          <section className="commander-card">
            <div className="training-section-heading">
              <div>
                <p className="training-eyebrow">
                  AI decision support
                </p>

                <h2 className="commander-card-title training-title-row">
                  <Brain size={18} />
                  Commander Brief
                </h2>
              </div>
            </div>

            {aiError && (
              <p className="ai-error">
                {aiError}
              </p>
            )}

            {!aiBrief ? (
              <div className="training-ai-empty">
                <Sparkles size={31} />

                <p>
                  Generate a section-level
                  summary based on practice and official IPPT records
                </p>
              </div>
            ) : (
              <div className="training-ai-result">
                <div className="training-ai-label">
                  <Sparkles size={15} />
                  AI analysis
                </div>

                <p className="training-ai-summary">
                  {aiBrief.summary}
                </p>

                <div className="training-ai-insight concern">
                  <span>
                    Main concern
                  </span>

                  <p>
                    {
                      aiBrief.mainConcern
                    }
                  </p>
                </div>

                <div className="training-ai-insight positive">
                  <span>
                    Positive observation
                  </span>

                  <p>
                    {
                      aiBrief.positiveObservation
                    }
                  </p>
                </div>

                {aiBrief.actions?.length >
                  0 && (
                    <div className="training-ai-actions">
                      <strong>
                        AI Recommended
                        Actions
                      </strong>

                      {aiBrief.actions.map(
                        (action, index) => (
                          <div
                            key={`${action.title}-${index}`}
                            className="training-ai-action-row"
                          >
                            <span>
                              {index + 1}
                            </span>

                            <div>
                              <strong>
                                {
                                  action.title
                                }
                              </strong>

                              <p>
                                {
                                  action.description
                                }
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
              </div>
            )}

            <button
              type="button"
              className="training-ai-button"
              onClick={generateBrief}
              disabled={
                aiLoading ||
                personnelAnalysis.length === 0
              }
            >
              {aiLoading ? (
                <>
                  <Loader2
                    size={17}
                    className="training-spin"
                  />
                  Generating...
                </>
              ) : (
                <>
                  

                  {aiBrief
                    ? "Regenerate Brief"
                    : "Generate AI Brief"}
                </>
              )}
            </button>
          </section>

          {/* RECOMMENDED ACTIONS */}

          <section className="commander-card">
            <div className="training-section-heading training-actions-heading">
              <div>
                <p className="training-eyebrow">
                  Commander follow-up
                </p>

                <h2 className="commander-card-title training-title-row">
                  <ClipboardCheck size={18} />
                  Recommended Actions
                </h2>
              </div>

              <button
                type="button"
                className="training-actions-refresh"
                onClick={
                  refreshRecommendedActions
                }
                aria-label="Refresh recommended actions"
                title="Refresh recommended actions"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            {activeRecommendedActions.length >
              0 ? (
              <>
                <div className="training-checklist">
                  {activeRecommendedActions.map(
                    (action) => {
                      const ActionIcon =
                        action.icon;

                      const selected =
                        Boolean(
                          selectedActions[
                          action.id
                          ]
                        );

                      return (
                        <button
                          type="button"
                          key={action.id}
                          className={`training-checklist-item ${selected
                              ? "completed"
                              : ""
                            }`}
                          onClick={() =>
                            toggleAction(
                              action.id
                            )
                          }
                          aria-pressed={
                            selected
                          }
                        >
                          <span className="training-check-box">
                            {selected && (
                              <Check size={15} />
                            )}
                          </span>

                          <span className="training-action-icon">
                            <ActionIcon
                              size={17}
                            />
                          </span>

                          <span className="training-action-copy">
                            <strong>
                              {action.title}
                            </strong>

                            <small>
                              {
                                action.description
                              }
                            </small>
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  type="button"
                  className="training-complete-selected-button"
                  onClick={
                    completeSelectedActions
                  }
                  disabled={
                    selectedActionCount === 0
                  }
                >
                  <CheckCircle2 size={17} />

                  {selectedActionCount > 0
                    ? `Complete Selected (${selectedActionCount})`
                    : "Select an Action to Complete"}
                </button>
              </>
            ) : (
              <div className="training-actions-complete">
                <span className="training-complete-icon">
                  <CheckCircle2 size={30} />
                </span>

                <strong>
                  You&apos;re all set!
                </strong>

                <p>
                  You have completed all the
                  recommended actions for today.
                </p>

                
              </div>
            )}
          </section>

          {/* PROGRESS REVIEW */}

          <section className="commander-card">
            <div className="training-section-heading">
              <div>
                <p className="training-eyebrow">
                  Individual monitoring
                </p>

                <h2 className="commander-card-title training-title-row">
                  <Activity size={18} />
                  Progress Review
                </h2>
              </div>
            </div>

            {personnelAnalysis.length ===
              0 ? (
              <div className="training-empty-state">
                <Users size={32} />

                <strong>
                  No assigned personnel
                </strong>
              </div>
            ) : (
              <>
                <label className="training-select-label">
                  Select personnel
                </label>

                <div className="training-select-wrap">
                  <select
                    value={
                      selectedPersonnel?.userID ||
                      ""
                    }
                    onChange={(event) =>
                      setSelectedPersonnelID(
                        event.target.value
                      )
                    }
                  >
                    {personnelAnalysis.map(
                      (person) => (
                        <option
                          key={
                            person.userID
                          }
                          value={
                            person.userID
                          }
                        >
                          {
                            person.displayName
                          }
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                  />
                </div>

                {selectedPersonnel && (
                  <div className="training-review">
                    <div className="training-review-person">
                      <div className="training-person-main">
                        <div className="training-review-avatar">
                          {selectedPersonnel.photoURL ? (
                            <img
                              src={
                                selectedPersonnel.photoURL
                              }
                              alt={`${selectedPersonnel.displayName} profile`}
                            />
                          ) : (
                            <UserRound
                              size={23}
                            />
                          )}
                        </div>

                        <div>
                          <h3>
                            {
                              selectedPersonnel.displayName
                            }
                          </h3>

                          <p>
                            {selectedPersonnel.rank ||
                              "Personnel"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`training-priority-badge ${selectedPersonnel.priority.className}`}
                      >
                        {
                          selectedPersonnel
                            .priority.level
                        }
                      </span>
                    </div>

                    <div className="training-review-grid">
                      <div>
                        <span>
                          Official
                        </span>

                        <strong>
                          {selectedPersonnel.latestOfficial
                            ? getResult(
                              selectedPersonnel.latestOfficial
                            )
                            : "N/A"}
                        </strong>

                        <small>
                          {selectedPersonnel.latestOfficial
                            ? `${getTotalScore(
                              selectedPersonnel.latestOfficial
                            )} points`
                            : "No record"}
                        </small>
                      </div>

                      <div>
                        <span>
                          Practice
                        </span>

                        <strong>
                          {selectedPersonnel.latestPractice
                            ? getTotalScore(
                              selectedPersonnel.latestPractice
                            )
                            : "N/A"}
                        </strong>

                        <small>
                          {selectedPersonnel.latestPractice
                            ? formatRecordDate(
                              selectedPersonnel.latestPractice
                            )
                            : "No record"}
                        </small>
                      </div>

                      <div>
                        <span>
                          Score change
                        </span>

                        <strong
                          className={`training-trend-${selectedPersonnel.trend.type}`}
                        >
                          {selectedPersonnel.previousPractice
                            ? `${selectedPersonnel
                              .trend
                              .difference >
                              0
                              ? "+"
                              : ""
                            }${selectedPersonnel
                              .trend
                              .difference
                            }`
                            : "N/A"}
                        </strong>

                        <small>
                          {
                            selectedPersonnel
                              .trend.label
                          }
                        </small>
                      </div>

                      <div>
                        <span>
                          Runtime
                        </span>

                        <strong>
                          {selectedPersonnel.latestPractice
                            ? getRuntime(
                              selectedPersonnel.latestPractice
                            )
                            : "N/A"}
                        </strong>

                        <small>
                          Latest practice
                        </small>
                      </div>

                      <div>
                        <span>
                          Strongest
                        </span>

                        <strong>
                          {
                            selectedPersonnel
                              .strongestComponent
                          }
                        </strong>

                        <small>
                          Calculator-based
                        </small>
                      </div>

                      <div>
                        <span>
                          Needs attention
                        </span>

                        <strong>
                          {
                            selectedPersonnel
                              .weakestComponent
                          }
                        </strong>

                        <small>
                          Calculator-based
                        </small>
                      </div>
                    </div>

                    {selectedPersonnel.componentScores
                      .length > 0 && (
                        <div className="training-component-section">
                          <h3>
                            Practice Performance
                          </h3>

                          {selectedPersonnel.componentScores.map(
                            (component) => (
                              <div
                                className="training-component-row"
                                key={
                                  component.name
                                }
                              >
                                <div className="training-component-label">
                                  <span>
                                    {
                                      component.name
                                    }
                                  </span>

                                  <strong>
                                    {
                                      component.score
                                    }
                                    /
                                    {
                                      component.maximum
                                    }
                                  </strong>
                                </div>

                                <div className="training-component-track">
                                  <div
                                    className="training-component-fill"
                                    style={{
                                      width: `${component.percentage}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}

                    <div className="training-selected-action">
                      <Target size={17} />

                      <div>
                        <strong>
                          Suggested action
                        </strong>

                        <p>
                          {
                            selectedPersonnel
                              .suggestedAction
                          }
                        </p>
                      </div>
                    </div>

                    <div className="training-history">
                      <div className="training-history-heading">
                        <h3>
                          Recent Practice
                        </h3>

                        <span>
                          Latest 3
                        </span>
                      </div>

                      {selectedPersonnel
                        .practiceRecords
                        .length === 0 ? (
                        <p className="training-no-history">
                          No practice records
                          available.
                        </p>
                      ) : (
                        selectedPersonnel.practiceRecords
                          .slice(-3)
                          .reverse()
                          .map(
                            (
                              record,
                              index
                            ) => (
                              <div
                                className="training-history-row"
                                key={
                                  record.id ||
                                  index
                                }
                              >
                                <span className="training-history-number">
                                  {
                                    index +
                                    1
                                  }
                                </span>

                                <div className="training-history-info">
                                  <strong>
                                    {formatRecordDate(
                                      record
                                    )}
                                  </strong>

                                  <small>
                                    {getPushups(
                                      record
                                    )}{" "}
                                    push-ups ·{" "}
                                    {getSitups(
                                      record
                                    )}{" "}
                                    sit-ups ·{" "}
                                    {getRuntime(
                                      record
                                    )}
                                  </small>
                                </div>

                                <strong className="training-history-score">
                                  {getTotalScore(
                                    record
                                  )}
                                </strong>
                              </div>
                            )
                          )
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
        <CommanderNav activePage="commander-training" />
      </div>
    </div>
  );
}

export default CommanderTraining;