import React, { useEffect, useMemo, useState } from "react";

import CommanderNav from "../components/CommanderNav";

import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";

import {
  calculateAgeFromDob,
  getCommanderById,
  getCurrentUser,
  getPastIPPTRecordsForPersonnel,
  getPastOfficialIPPTRecordsForPersonnel,
  getPersonnelByCommanderId,
} from "../services/firestoreService";

import { calculateIPPT } from "../services/ipptCalculator";

import { generateCommanderTrainingBrief } from "../services/geminiService";

const TOTAL_STEPS = 5;

const STEP_INFORMATION = [
  {
    number: 1,
    shortLabel: "Readiness",
    title: "Review Section Readiness",
    description:
      "Understand your section’s current fitness status and identify weak areas.",
  },
  {
    number: 2,
    shortLabel: "Priority",
    title: "Identify Priority Personnel",
    description:
      "Review personnel who require the most immediate training attention.",
  },
  {
    number: 3,
    shortLabel: "AI Brief",
    title: "AI Decision Brief",
    description:
      "Summarise section performance, concerns and recommended actions.",
  },
  {
    number: 4,
    shortLabel: "Plan",
    title: "Training Plan",
    description:
      "Review a suggested weekly focus based on the section’s weakest components.",
  },
  {
    number: 5,
    shortLabel: "Follow-Up",
    title: "Commander Follow-Up",
    description:
      "Complete recommended actions and review the section again when needed.",
  },
];

const getPersonID = (person) => {
  return person?.userID || person?.id || "";
};

const getPersonName = (person) => {
  if (!person) return "Unknown";

  return (
    person.fullName ||
    person.name ||
    `${person.firstName || ""} ${person.lastName || ""}`.trim() ||
    "Unknown"
  );
};

const getPersonAge = (person) => {
  const storedAge = Number(person?.age);

  if (Number.isFinite(storedAge) && storedAge > 0) {
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

  return Number.isNaN(parsedDate) ? 0 : parsedDate;
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
  return Number(record?.pushups ?? record?.pushUps ?? 0);
};

const getSitups = (record) => {
  return Number(record?.situps ?? record?.sitUps ?? 0);
};

const getRuntime = (record) => {
  const runtime = record?.runtime ?? record?.runTime ?? "";

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
  return record?.result || record?.ippt || "N/A";
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
  The Firestore service returns records from oldest to newest.
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

const calculateRecordBreakdown = (record, person) => {
  if (!record) return null;

  const runtime = getRuntime(record);

  if (
    runtime === "N/A" ||
    !runtime.includes(":")
  ) {
    return null;
  }

  return calculateIPPT({
    age: getPersonAge(person),
    pushups: getPushups(record),
    situps: getSitups(record),
    runtime,
    wantedGoal: "Pass",
  });
};

const getComponentAnalysis = (record, person) => {
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
          (component.score / component.maximum) * 100
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
      label: "No trend",
      difference: 0,
      description:
        "At least two practice records are required.",
    };
  }

  const difference =
    getTotalScore(latestPractice) -
    getTotalScore(previousPractice);

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
    if (getDaysSinceRecord(latestPractice) > 30) {
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
    reasons.push("Practice score has declined");
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
      level: "Moderate",
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

  if (getDaysSinceRecord(latestPractice) > 30) {
    return "Request a new practice IPPT result.";
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

const getReadinessLevel = (score) => {
  const value = Number(score || 0);

  if (value >= 80) {
    return {
      label: "High",
      className: "high",
    };
  }

  if (value >= 60) {
    return {
      label: "Moderate",
      className: "moderate",
    };
  }

  return {
    label: "Low",
    className: "low",
  };
};

function CommanderTraining() {
  const [commander, setCommander] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [practiceHistory, setPracticeHistory] =
    useState({});
  const [officialHistory, setOfficialHistory] =
    useState({});

  const [currentStep, setCurrentStep] = useState(1);

  const [aiBrief, setAiBrief] = useState(null);
  const [selectedActions, setSelectedActions] =
    useState({});
  const [dismissedActions, setDismissedActions] =
    useState({});

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");

  const loadTrainingData = async ({
    showLoading = true,
  } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const currentUser = getCurrentUser();

      if (!currentUser) {
        throw new Error(
          "Logged-in commander information was not found."
        );
      }

      const commanderID =
        currentUser.userID || currentUser.id;

      if (!commanderID) {
        throw new Error(
          "The logged-in commander has no userID."
        );
      }

      const [commanderData, personnelData] =
        await Promise.all([
          getCommanderById(commanderID),
          getPersonnelByCommanderId(commanderID),
        ]);

      setCommander(commanderData || currentUser);
      setPersonnel(personnelData || []);

      if (!personnelData?.length) {
        setPracticeHistory({});
        setOfficialHistory({});
        return;
      }

      const [practiceData, officialData] =
        await Promise.all([
          getPastIPPTRecordsForPersonnel(
            personnelData
          ),
          getPastOfficialIPPTRecordsForPersonnel(
            personnelData
          ),
        ]);

      setPracticeHistory(practiceData || {});
      setOfficialHistory(officialData || {});
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
      if (showLoading) {
        setLoading(false);
      }
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
            latestPractice || latestOfficial,
            person
          );

        const priority = calculatePriority({
          latestPractice,
          latestOfficial,
          trend,
        });

        return {
          ...person,
          userID,
          displayName: getPersonName(person),

          practiceRecords,
          officialRecords,

          latestPractice,
          previousPractice,
          latestOfficial,

          trend,
          priority,

          strongestComponent:
            componentAnalysis.strongestComponent,

          weakestComponent:
            componentAnalysis.weakestComponent,

          componentScores:
            componentAnalysis.components,

          suggestedAction: getSuggestedAction({
            latestPractice,
            latestOfficial,
            trend,
            weakestComponent:
              componentAnalysis.weakestComponent,
          }),
        };
      })
      .sort((a, b) => {
        if (
          b.priority.score !== a.priority.score
        ) {
          return (
            b.priority.score - a.priority.score
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

  const sectionReadinessScore = useMemo(() => {
    if (personnelAnalysis.length === 0) {
      return 0;
    }

    const total = personnelAnalysis.reduce(
      (sum, person) => {
        const score = person.latestPractice
          ? getTotalScore(person.latestPractice)
          : Number(person.readiness || 0);

        return sum + score;
      },
      0
    );

    return Math.round(
      total / personnelAnalysis.length
    );
  }, [personnelAnalysis]);

  const readinessStatus = getReadinessLevel(
    sectionReadinessScore
  );

  const attentionPersonnel = useMemo(
    () =>
      personnelAnalysis.filter(
        (person) =>
          person.priority.level === "High" ||
          person.priority.level === "Moderate"
      ),
    [personnelAnalysis]
  );

  const highPriorityPersonnel = useMemo(
    () =>
      personnelAnalysis.filter(
        (person) =>
          person.priority.level === "High"
      ),
    [personnelAnalysis]
  );

  const decliningPersonnel = useMemo(
    () =>
      personnelAnalysis.filter(
        (person) =>
          person.trend.type === "declining"
      ),
    [personnelAnalysis]
  );

  const improvingPersonnel = useMemo(
    () =>
      personnelAnalysis.filter(
        (person) =>
          person.trend.type === "improving"
      ),
    [personnelAnalysis]
  );

  const outdatedPersonnel = useMemo(
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

  const failedOfficialPersonnel = useMemo(
    () =>
      personnelAnalysis.filter(
        (person) =>
          person.latestOfficial &&
          !isPassingResult(
            person.latestOfficial
          )
      ),
    [personnelAnalysis]
  );

  const weakestStationSummary = useMemo(() => {
    const counts = {
      "2.4 km run": 0,
      "Push-ups": 0,
      "Sit-ups": 0,
    };

    personnelAnalysis.forEach((person) => {
      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          person.weakestComponent
        )
      ) {
        counts[person.weakestComponent] += 1;
      }
    });

    const sortedStations = Object.entries(
      counts
    ).sort((a, b) => b[1] - a[1]);

    return {
      station:
        sortedStations[0]?.[1] > 0
          ? sortedStations[0][0]
          : "Insufficient data",

      counts,
    };
  }, [personnelAnalysis]);

  const weeklyTrainingPlan = useMemo(() => {
    const weakestStation =
      weakestStationSummary.station;

    if (weakestStation === "Push-ups") {
      return [
        {
          day: "Monday",
          title: "Push-Up Technique",
          description:
            "Focus on controlled repetitions and correct form.",
          icon: Dumbbell,
        },
        {
          day: "Wednesday",
          title: "Upper-Body Circuit",
          description:
            "Combine push-ups, planks and shoulder exercises.",
          icon: Activity,
        },
        {
          day: "Friday",
          title: "Timed Push-Up Sets",
          description:
            "Practise timed sets with short recovery periods.",
          icon: Clock3,
        },
        {
          day: "Weekend",
          title: "Recovery Stretch",
          description:
            "Complete light mobility and upper-body recovery.",
          icon: CheckCircle2,
        },
      ];
    }

    if (weakestStation === "Sit-ups") {
      return [
        {
          day: "Monday",
          title: "Core Technique",
          description:
            "Review correct sit-up form and breathing control.",
          icon: Target,
        },
        {
          day: "Wednesday",
          title: "Core Strength Circuit",
          description:
            "Combine sit-ups, planks and controlled leg raises.",
          icon: Activity,
        },
        {
          day: "Friday",
          title: "Timed Sit-Up Sets",
          description:
            "Practise timed repetitions with short recovery periods.",
          icon: Clock3,
        },
        {
          day: "Weekend",
          title: "Recovery Stretch",
          description:
            "Complete light mobility and core recovery.",
          icon: CheckCircle2,
        },
      ];
    }

    return [
      {
        day: "Monday",
        title: "Interval Run",
        description:
          "Use short, controlled intervals to improve running pace.",
        icon: TrendingUp,
      },
      {
        day: "Wednesday",
        title: "Aerobic Endurance",
        description:
          "Complete a steady-paced endurance session.",
        icon: Activity,
      },
      {
        day: "Friday",
        title: "2.4 km Pace Training",
        description:
          "Practise maintaining the required IPPT running pace.",
        icon: Clock3,
      },
      {
        day: "Weekend",
        title: "Recovery Stretch",
        description:
          "Complete light recovery, mobility and stretching.",
        icon: CheckCircle2,
      },
    ];
  }, [weakestStationSummary.station]);

  const localRecommendedActions = useMemo(() => {
    const actions = [];

    if (highPriorityPersonnel.length > 0) {
      actions.push({
        id: "high-priority",
        title: `Review ${highPriorityPersonnel.length} high-priority personnel`,
        description:
          "Check their latest practice and official IPPT results.",
        icon: AlertTriangle,
      });
    }

    if (decliningPersonnel.length > 0) {
      actions.push({
        id: "declining",
        title: `Follow up with ${decliningPersonnel.length} declining personnel`,
        description:
          "Discuss their score decline and monitor their next attempt.",
        icon: TrendingDown,
      });
    }

    if (outdatedPersonnel.length > 0) {
      actions.push({
        id: "outdated",
        title: `Request ${outdatedPersonnel.length} practice update${outdatedPersonnel.length === 1
          ? ""
          : "s"
          }`,
        description:
          "These personnel do not have a recent practice result.",
        icon: Clock3,
      });
    }

    if (improvingPersonnel.length > 0) {
      actions.push({
        id: "improving",
        title: `Recognise ${improvingPersonnel.length} improving personnel`,
        description:
          "Acknowledge their progress and encourage consistency.",
        icon: TrendingUp,
      });
    }

    if (actions.length === 0) {
      actions.push({
        id: "monitor",
        title: "Continue monitoring section progress",
        description:
          "No urgent follow-up action is currently required.",
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

  const activeRecommendedActions = useMemo(
    () =>
      localRecommendedActions.filter(
        (action) =>
          !dismissedActions[action.id]
      ),
    [
      localRecommendedActions,
      dismissedActions,
    ]
  );

  const selectedActionCount =
    activeRecommendedActions.filter(
      (action) =>
        Boolean(selectedActions[action.id])
    ).length;

  const toggleAction = (actionID) => {
    setSelectedActions((current) => ({
      ...current,
      [actionID]: !current[actionID],
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

  const refreshRecommendedActions = async () => {
    try {
      setRefreshing(true);
      setSelectedActions({});
      setDismissedActions({});

      await loadTrainingData({
        showLoading: false,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const generateBrief = async () => {
    try {
      setAiLoading(true);
      setAiError("");

      const aiPersonnelData =
        personnelAnalysis.map((person) => ({
          name: person.displayName,
          rank: person.rank || "N/A",

          latestPractice:
            person.latestPractice
              ? {
                totalScore: getTotalScore(
                  person.latestPractice
                ),
                result: getResult(
                  person.latestPractice
                ),
                pushups: getPushups(
                  person.latestPractice
                ),
                situps: getSitups(
                  person.latestPractice
                ),
                runtime: getRuntime(
                  person.latestPractice
                ),
              }
              : null,

          previousPractice:
            person.previousPractice
              ? {
                totalScore: getTotalScore(
                  person.previousPractice
                ),
                result: getResult(
                  person.previousPractice
                ),
              }
              : null,

          latestOfficial:
            person.latestOfficial
              ? {
                totalScore: getTotalScore(
                  person.latestOfficial
                ),
                result: getResult(
                  person.latestOfficial
                ),
                pushups: getPushups(
                  person.latestOfficial
                ),
                situps: getSitups(
                  person.latestOfficial
                ),
                runtime: getRuntime(
                  person.latestOfficial
                ),
              }
              : null,

          trend: person.trend.label,
          scoreChange: person.trend.difference,

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
        }));

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

  const goToNextStep = () => {
    setCurrentStep((current) =>
      Math.min(current + 1, TOTAL_STEPS)
    );
  };

  const goToPreviousStep = () => {
    setCurrentStep((current) =>
      Math.max(current - 1, 1)
    );
  };

  const goToStep = (stepNumber) => {
    setCurrentStep(stepNumber);
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
            <p>Loading Training...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentStepInformation =
    STEP_INFORMATION[currentStep - 1];

  return (
    <div className="commander-page">
      <div className="commander-phone">
        <div className="commander-status-bar">
          <span>9:41</span>
          <span>●●●</span>
        </div>

        <header className="commander-header training-wizard-header">
          <div>
            <h1 className="commander-header-title">
              Training
            </h1>

      
          </div>

          <div className="commander-profile-mini">
            <UserRound size={15} />

            <span>
              {commander
                ? getPersonName(commander)
                : "Commander"}
            </span>
          </div>
        </header>

        <main className="commander-content training-wizard-content">
          {error && (
            <div className="training-error-box">
              <AlertTriangle size={18} />
              <p>{error}</p>
            </div>
          )}

          <section className="training-wizard-progress">
            <div className="training-wizard-progress-track">
              {STEP_INFORMATION.map(
                (step, index) => (
                  <React.Fragment key={step.number}>
                    <button
                      type="button"
                      className={`training-wizard-step-dot ${currentStep === step.number
                        ? "active"
                        : ""
                        } ${currentStep > step.number
                          ? "completed"
                          : ""
                        }`}
                      onClick={() =>
                        goToStep(step.number)
                      }
                      aria-label={`Go to step ${step.number}: ${step.title}`}
                    >
                      {currentStep > step.number ? (
                        <Check size={14} />
                      ) : (
                        step.number
                      )}
                    </button>

                    {index <
                      STEP_INFORMATION.length -
                      1 && (
                        <span
                          className={`training-wizard-line ${currentStep >
                            step.number
                            ? "completed"
                            : ""
                            }`}
                        />
                      )}
                  </React.Fragment>
                )
              )}
            </div>

            <div className="training-wizard-step-labels">
              {STEP_INFORMATION.map((step) => (
                <span
                  key={step.number}
                  className={
                    currentStep === step.number
                      ? "active"
                      : ""
                  }
                >
                  {step.shortLabel}
                </span>
              ))}
            </div>
          </section>

          <section className="training-wizard-intro">
            <span>
              Step {currentStep} of {TOTAL_STEPS}
            </span>

            <h2>{currentStepInformation.title}</h2>

            <p>
              {currentStepInformation.description}
            </p>
          </section>

          {/* STEP 1 — SECTION READINESS */}

          {currentStep === 1 && (
            <section className="training-wizard-page">
              <div className="training-readiness-overview">
                <div
                  className={`training-readiness-ring ${readinessStatus.className}`}
                  style={{
                    background: `radial-gradient(
                      circle,
                      #ffffff 61%,
                      transparent 62%
                    ),
                    conic-gradient(
                      var(--readiness-colour)
                      ${sectionReadinessScore}%,
                      #e3eaf3 0
                    )`,
                  }}
                >
                  <div>
                    <strong>
                      {sectionReadinessScore}%
                    </strong>

                    <span>
                      {readinessStatus.label}
                    </span>
                  </div>
                </div>

                <div className="training-readiness-summary">
                  <span>Section Readiness</span>

                  <strong>
                    {readinessStatus.label}
                  </strong>

                  <p>
                    Based on the latest practice
                    IPPT score submitted by each
                    personnel.
                  </p>
                </div>
              </div>

              <div className="training-readiness-legend">
                <span>
                  <i className="high" />
                  High
                </span>

                <span>
                  <i className="moderate" />
                  Moderate
                </span>

                <span>
                  <i className="low" />
                  Low
                </span>
              </div>

              <div className="training-simple-summary">
                <div>
                  <span>Total Personnel</span>
                  <strong>
                    {personnelAnalysis.length}
                  </strong>
                </div>

                <div>
                  <span>Requires Attention</span>
                  <strong>
                    {attentionPersonnel.length}
                  </strong>
                </div>
              </div>

              <div className="training-section-list">
                <div className="training-list-heading">
                  <h3>Personnel Overview</h3>
                  
                </div>

                {personnelAnalysis.length === 0 ? (
                  <div className="training-empty-state">
                    <Users size={30} />
                    <strong>
                      No assigned personnel
                    </strong>
                  </div>
                ) : (
                  personnelAnalysis.map((person) => (
                    <article
                      className="training-personnel-row"
                      key={person.userID}
                    >
                      <div className="training-personnel-identity">
                        <div className="training-personnel-avatar">
                          {person.photoURL ? (
                            <img
                              src={person.photoURL}
                              alt={`${person.displayName} profile`}
                            />
                          ) : (
                            <UserRound size={21} />
                          )}
                        </div>

                        <div>
                          <h3>
                            {person.displayName}
                          </h3>

                          <p>
                            {person.rank ||
                              "Personnel"}
                          </p>
                        </div>
                      </div>

                      <div className="training-personnel-values">
                        <div>
                          <span>Practice</span>
                          <strong>
                            {person.latestPractice
                              ? getTotalScore(
                                person.latestPractice
                              )
                              : "N/A"}
                          </strong>
                        </div>

                        <div>
                          <span>Official</span>
                          <strong>
                            {person.latestOfficial
                              ? getResult(
                                person.latestOfficial
                              )
                              : "N/A"}
                          </strong>
                        </div>

                        <div>
                          <span>Trend</span>
                          <strong
                            className={`training-trend-${person.trend.type}`}
                          >
                            {person.trend.label}
                          </strong>
                        </div>
                      </div>

                      <div className="training-personnel-weakness">
                        <span>Lowest station</span>
                        <strong>
                          {person.weakestComponent}
                        </strong>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          )}

          {/* STEP 2 — PRIORITY PERSONNEL */}

          {currentStep === 2 && (
            <section className="training-wizard-page">
              <div className="training-priority-method">
                <Target size={22} />

                <div>
                  <strong>
                    Automatic Priority Ranking
                  </strong>

                  <p>
                    Personnel are prioritised using
                    failed official results,
                    declining practice trends and
                    low readiness scores.
                  </p>
                </div>
              </div>

              <div className="training-priority-summary">
                <div>
                  <AlertTriangle size={18} />
                  <span>Failed Official</span>
                  <strong>
                    {failedOfficialPersonnel.length}
                  </strong>
                </div>

                <div>
                  <TrendingDown size={18} />
                  <span>Declining</span>
                  <strong>
                    {decliningPersonnel.length}
                  </strong>
                </div>

                <div>
                  <Target size={18} />
                  <span>High Priority</span>
                  <strong>
                    {highPriorityPersonnel.length}
                  </strong>
                </div>
              </div>

              <div className="training-section-list">
                <div className="training-list-heading">
                  <h3>Priority Ranking</h3>
                  <span>
                    Highest priority first
                  </span>
                </div>

                {attentionPersonnel.length === 0 ? (
                  <div className="training-empty-state">
                    <CheckCircle2 size={34} />

                    <strong>
                      No urgent concerns
                    </strong>

                    <p>
                      No high- or moderate-priority
                      personnel were identified.
                    </p>
                  </div>
                ) : (
                  attentionPersonnel.map(
                    (person, index) => (
                      <article
                        className="training-priority-row"
                        key={person.userID}
                      >
                        <div className="training-priority-rank">
                          {index + 1}
                        </div>

                        <div className="training-priority-main">
                          <div className="training-priority-top">
                            <div>
                              <h3>
                                {person.displayName}
                              </h3>

                              <p>
                                {person.rank ||
                                  "Personnel"}
                              </p>
                            </div>

                            <span
                              className={`training-priority-badge ${person.priority.className}`}
                            >
                              {person.priority.level}
                            </span>
                          </div>

                          <div className="training-priority-metrics">
                            <span>
                              Readiness{" "}
                              <strong>
                                {person.latestPractice
                                  ? getTotalScore(
                                    person.latestPractice
                                  )
                                  : Number(
                                    person.readiness ||
                                    0
                                  )}
                                %
                              </strong>
                            </span>

                            <span>
                              Official{" "}
                              <strong>
                                {person.latestOfficial
                                  ? getResult(
                                    person.latestOfficial
                                  )
                                  : "N/A"}
                              </strong>
                            </span>

                            <span>
                              Trend{" "}
                              <strong
                                className={`training-trend-${person.trend.type}`}
                              >
                                {person.trend.label}
                              </strong>
                            </span>
                          </div>

                          <div className="training-priority-concern">
                            <span>Main concern</span>

                            <strong>
                              {person.weakestComponent}
                            </strong>
                          </div>

                          <ul className="training-priority-reasons">
                            {person.priority.reasons
                              .slice(0, 3)
                              .map((reason) => (
                                <li key={reason}>
                                  {reason}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </article>
                    )
                  )
                )}
              </div>
            </section>
          )}

          {/* STEP 3 — AI DECISION BRIEF */}

          {currentStep === 3 && (
            <section className="training-wizard-page">
              {aiError && (
                <p className="ai-error">{aiError}</p>
              )}

              {!aiBrief ? (
                <div className="training-ai-start">
                  <span>
                    <Brain size={34} />
                  </span>

                  <h3>
                    Generate Commander Brief
                  </h3>

                  <p>
                    Gemini will analyse the latest
                    practice and official IPPT data
                    and provide a concise
                    section-level summary.
                  </p>

                  <button
                    type="button"
                    className="training-primary-button"
                    onClick={generateBrief}
                    disabled={
                      aiLoading ||
                      personnelAnalysis.length === 0
                    }
                  >
                    {aiLoading ? (
                      <>
                        <Loader2
                          size={18}
                          className="training-spin"
                        />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Generate AI Brief
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="training-ai-brief">
                  <div className="training-ai-section">
                    <span className="training-ai-section-icon summary">
                      <Brain size={18} />
                    </span>

                    <div>
                      <h3>Section Summary</h3>
                      <p>{aiBrief.summary}</p>
                    </div>
                  </div>

                  <div className="training-ai-section positive">
                    <span className="training-ai-section-icon">
                      <TrendingUp size={18} />
                    </span>

                    <div>
                      <h3>
                        Positive Observation
                      </h3>

                      <p>
                        {aiBrief.positiveObservation}
                      </p>
                    </div>
                  </div>

                  <div className="training-ai-section concern">
                    <span className="training-ai-section-icon">
                      <AlertTriangle size={18} />
                    </span>

                    <div>
                      <h3>Main Concern</h3>
                      <p>{aiBrief.mainConcern}</p>
                    </div>
                  </div>

                  {aiBrief.actions?.length > 0 && (
                    <div className="training-ai-recommendations">
                      <h3>AI Recommendations</h3>

                      {aiBrief.actions.map(
                        (action, index) => (
                          <div
                            className="training-ai-recommendation-row"
                            key={`${action.title}-${index}`}
                          >
                            <CheckCircle2 size={18} />

                            <div>
                              <strong>
                                {action.title}
                              </strong>

                              {action.description && (
                                <p>
                                  {action.description}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="training-secondary-button"
                    onClick={generateBrief}
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2
                          size={17}
                          className="training-spin"
                        />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={17} />
                        Regenerate Brief
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* STEP 4 — TRAINING PLAN */}

          {currentStep === 4 && (
            <section className="training-wizard-page">
              <div className="training-plan-focus">
                <span>
                  <Target size={24} />
                </span>

                <div>
                  <p>This Week&apos;s Focus</p>

                  <h3>
                    {weakestStationSummary.station}
                  </h3>

                  <small>
                    Identified as the most common
                    weakest IPPT component in the
                    section.
                  </small>
                </div>
              </div>

              <div className="training-weekly-plan">
                {weeklyTrainingPlan.map(
                  (session, index) => {
                    const SessionIcon =
                      session.icon;

                    return (
                      <article
                        className="training-session-row"
                        key={session.day}
                      >
                        <div className="training-session-marker">
                          <span>{index + 1}</span>

                          {index <
                            weeklyTrainingPlan.length -
                            1 && <i />}
                        </div>

                        <div className="training-session-content">
                          <div className="training-session-day">
                            {session.day}
                          </div>

                          <div className="training-session-heading">
                            <SessionIcon size={19} />

                            <h3>
                              {session.title}
                            </h3>
                          </div>

                          <p>
                            {session.description}
                          </p>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>

              <div className="training-priority-order">
                <h3>Training Priority</h3>

                {Object.entries(
                  weakestStationSummary.counts
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(
                    ([station, count], index) => (
                      <div key={station}>
                        <span>
                          {index === 0
                            ? "🥇"
                            : index === 1
                              ? "🥈"
                              : "🥉"}
                        </span>

                        <p>{station}</p>

                        <strong>
                          {count} personnel
                        </strong>
                      </div>
                    )
                  )}
              </div>
            </section>
          )}

          {/* STEP 5 — COMMANDER FOLLOW-UP */}

          {currentStep === 5 && (
            <section className="training-wizard-page">
              <div className="training-follow-up-heading">
                <div>
                  <ClipboardCheck size={23} />

                  <div>
                    <h3>Recommended Actions</h3>

                    <p>
                      Select completed actions and
                      confirm them using the button
                      below.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="training-refresh-icon-button"
                  onClick={refreshRecommendedActions}
                  disabled={refreshing}
                  aria-label="Refresh recommended actions"
                  title="Refresh recommended actions"
                >
                  <RefreshCw
                    size={18}
                    className={
                      refreshing
                        ? "training-spin"
                        : ""
                    }
                  />
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

                        const selected = Boolean(
                          selectedActions[action.id]
                        );

                        return (
                          <button
                            type="button"
                            className={`training-checklist-item ${selected
                              ? "completed"
                              : ""
                              }`}
                            key={action.id}
                            onClick={() =>
                              toggleAction(action.id)
                            }
                            aria-pressed={selected}
                          >
                            <span className="training-check-box">
                              {selected && (
                                <Check size={15} />
                              )}
                            </span>

                            <span className="training-action-icon">
                              <ActionIcon size={18} />
                            </span>

                            <span className="training-action-copy">
                              <strong>
                                {action.title}
                              </strong>

                              <small>
                                {action.description}
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
                    onClick={completeSelectedActions}
                    disabled={
                      selectedActionCount === 0
                    }
                  >
                    <CheckCircle2 size={18} />

                    {selectedActionCount > 0
                      ? `Complete Selected (${selectedActionCount})`
                      : "Select an Action to Complete"}
                  </button>
                </>
              ) : (
                <div className="training-actions-complete">
                  <span className="training-complete-icon">
                    <CheckCircle2 size={32} />
                  </span>

                  <strong>
                    You&apos;re all set!
                  </strong>

                  <p>
                    All recommended follow-up
                    actions have been completed.
                  </p>

                  
                </div>
              )}
            </section>
          )}
        </main>

        <div className="training-step-navigation">
          <button
            type="button"
            className="training-nav-btn secondary"
            onClick={goToPreviousStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft size={18} />
            Back
          </button>

          <button
            type="button"
            className="training-nav-btn primary"
            onClick={goToNextStep}
            disabled={currentStep === TOTAL_STEPS}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>

        <CommanderNav activePage="commander-training" />
      </div>
    </div>
  );
}

export default CommanderTraining;