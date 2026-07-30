export const GOAL_SCORES = {
  Pass: 61,
  Silver: 75,
  Gold: 85,
};

export function getAgeGroup(age) {
  const n = Number(age);

  if (n < 22) return 1;
  if (n <= 24) return 2;
  if (n <= 27) return 3;
  if (n <= 30) return 4;
  if (n <= 33) return 5;
  if (n <= 36) return 6;
  if (n <= 39) return 7;
  if (n <= 42) return 8;
  if (n <= 45) return 9;
  if (n <= 48) return 10;
  if (n <= 51) return 11;
  if (n <= 54) return 12;
  if (n <= 57) return 13;
  return 14;
}

function runtimeToSeconds(runtime) {
  if (!runtime || typeof runtime !== "string") return null;

  const [min, sec] = runtime.split(":").map(Number);

  if (Number.isNaN(min) || Number.isNaN(sec)) return null;

  return min * 60 + sec;
}

function adjustRepsForAge(reps, age) {
  const group = getAgeGroup(age);

  // Group 1 is base table.
  // Older groups get +1 rep allowance per group.
  const adjustment = group - 1;

  return Number(reps) + adjustment;
}

function adjustRunForAge(seconds, age) {
  const group = getAgeGroup(age);

  // Group 1 is base table.
  // Older groups get +10 sec allowance per group.
  const adjustment = (group - 1) * 10;

  return Number(seconds) - adjustment;
}

const PUSHUP_SCORE_TABLE = {
  60: 25,
  59: 24,
  58: 24,
  57: 24,
  56: 24,
  55: 24,
  54: 23,
  53: 23,
  52: 23,
  51: 22,
  50: 22,
  49: 22,
  48: 21,
  47: 21,
  46: 21,
  45: 21,
  44: 21,
  43: 20,
  42: 20,
  41: 20,
  40: 20,
  39: 19,
  38: 19,
  37: 19,
  36: 18,
  35: 18,
  34: 18,
  33: 17,
  32: 17,
  31: 17,
  30: 16,
  29: 16,
  28: 16,
  27: 16,
  26: 15,
  25: 14,
  24: 13,
  23: 12,
  22: 11,
  21: 10,
  20: 9,
  19: 8,
  18: 6,
  17: 4,
  16: 2,
  15: 1,
};

const SITUP_SCORE_TABLE = {
  60: 25,
  59: 24,
  58: 24,
  57: 24,
  56: 24,
  55: 24,
  54: 23,
  53: 23,
  52: 23,
  51: 22,
  50: 22,
  49: 22,
  48: 21,
  47: 21,
  46: 21,
  45: 21,
  44: 21,
  43: 20,
  42: 20,
  41: 20,
  40: 20,
  39: 19,
  38: 19,
  37: 18,
  36: 18,
  35: 17,
  34: 16,
  33: 15,
  32: 14,
  31: 14,
  30: 13,
  29: 13,
  28: 12,
  27: 11,
  26: 10,
  25: 9,
  24: 8,
  23: 7,
  22: 7,
  21: 6,
  20: 6,
  19: 5,
  18: 4,
  17: 3,
  16: 2,
  15: 1,
};

const RUN_SCORE_TABLE = [
  { seconds: 8 * 60 + 30, score: 50 },
  { seconds: 8 * 60 + 40, score: 49 },
  { seconds: 8 * 60 + 50, score: 48 },
  { seconds: 9 * 60 + 0, score: 47 },
  { seconds: 9 * 60 + 10, score: 46 },
  { seconds: 9 * 60 + 20, score: 45 },
  { seconds: 9 * 60 + 30, score: 44 },
  { seconds: 9 * 60 + 40, score: 43 },
  { seconds: 9 * 60 + 50, score: 42 },
  { seconds: 10 * 60 + 0, score: 41 },
  { seconds: 10 * 60 + 10, score: 40 },
  { seconds: 10 * 60 + 20, score: 39 },
  { seconds: 10 * 60 + 30, score: 38 },
  { seconds: 10 * 60 + 40, score: 38 },
  { seconds: 10 * 60 + 50, score: 37 },
  { seconds: 11 * 60 + 0, score: 37 },
  { seconds: 11 * 60 + 10, score: 36 },
  { seconds: 11 * 60 + 20, score: 36 },
  { seconds: 11 * 60 + 30, score: 35 },
  { seconds: 11 * 60 + 40, score: 35 },
  { seconds: 11 * 60 + 50, score: 34 },
  { seconds: 12 * 60 + 0, score: 33 },
  { seconds: 12 * 60 + 10, score: 32 },
  { seconds: 12 * 60 + 20, score: 31 },
  { seconds: 12 * 60 + 30, score: 30 },
  { seconds: 12 * 60 + 40, score: 29 },
  { seconds: 12 * 60 + 50, score: 28 },
  { seconds: 13 * 60 + 0, score: 27 },
  { seconds: 13 * 60 + 10, score: 26 },
  { seconds: 13 * 60 + 20, score: 25 },
  { seconds: 13 * 60 + 30, score: 24 },
  { seconds: 13 * 60 + 40, score: 23 },
  { seconds: 13 * 60 + 50, score: 22 },
  { seconds: 14 * 60 + 0, score: 21 },
  { seconds: 14 * 60 + 10, score: 20 },
  { seconds: 14 * 60 + 20, score: 19 },
  { seconds: 14 * 60 + 30, score: 18 },
  { seconds: 14 * 60 + 40, score: 16 },
  { seconds: 14 * 60 + 50, score: 14 },
  { seconds: 15 * 60 + 0, score: 12 },
  { seconds: 15 * 60 + 10, score: 10 },
  { seconds: 15 * 60 + 20, score: 8 },
  { seconds: 15 * 60 + 30, score: 6 },
  { seconds: 15 * 60 + 40, score: 4 },
  { seconds: 15 * 60 + 50, score: 2 },
  { seconds: 16 * 60 + 0, score: 1 },
];

export function calculatePushupScore(reps, age) {
  const adjusted = Math.min(Math.floor(adjustRepsForAge(reps, age)), 60);
  return PUSHUP_SCORE_TABLE[adjusted] || 0;
}

export function calculateSitupScore(reps, age) {
  const adjusted = Math.min(Math.floor(adjustRepsForAge(reps, age)), 60);
  return SITUP_SCORE_TABLE[adjusted] || 0;
}

export function calculateRunScore(runtime, age) {
  const seconds = runtimeToSeconds(runtime);
  if (seconds === null) return 0;

  const adjusted = adjustRunForAge(seconds, age);

  for (const row of RUN_SCORE_TABLE) {
    if (adjusted <= row.seconds) {
      return row.score;
    }
  }

  return 0;
}

export function getIPPTResult(score, pushupScore, situpScore, runScore) {
  const total = Number(score);

  // Official rule: must score at least 1 point in each station.
  if (pushupScore < 1 || situpScore < 1 || runScore < 1) return "Fail";

  if (total >= 85) return "Gold";
  if (total >= 75) return "Silver";
  if (total >= 61) return "Pass";
  return "Fail";
}

export function getReadinessLevel(score) {
  const total = Number(score);

  if (total >= 85) return "Excellent";
  if (total >= 75) return "High";
  if (total >= 61) return "Moderate";
  return "Low";
}

export function calculateIPPT({ age, pushups, situps, runtime, wantedGoal }) {
  const pushupScore = calculatePushupScore(pushups, age);
  const situpScore = calculateSitupScore(situps, age);
  const runScore = calculateRunScore(runtime, age);

  const totalscore = pushupScore + situpScore + runScore;

  const result = getIPPTResult(
    totalscore,
    pushupScore,
    situpScore,
    runScore
  );

  const goalScore = GOAL_SCORES[wantedGoal] || 61;
  const pointsToGoal = Math.max(goalScore - totalscore, 0);

  return {
    pushupScore,
    situpScore,
    runScore,

    totalscore,
    ipptScore: totalscore,

    // Fitness Readiness = IPPT score
    readinessScore: totalscore,
    fitnessReadiness: totalscore,
    readinessLevel: getReadinessLevel(totalscore),

    result,
    wantedGoal,
    goalScore,
    pointsToGoal,
    goalAchieved: totalscore >= goalScore,
  };
}

export function calculateFitnessReadiness({ totalscore }) {
  const score = Number(totalscore || 0);

  return {
    fitnessReadiness: score,
    readinessScore: score,
    readinessLevel: getReadinessLevel(score),
    sleepScore: null,
    heartRateScore: null,
  };
}