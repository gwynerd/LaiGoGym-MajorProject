import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";

export function calculateAgeFromDob(dob) {
  if (!dob) return null;

  const birthDate = dob?.toDate ? dob.toDate() : new Date(dob);

  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!birthdayPassed) age--;

  return age;
}

const normaliseUser = (docItem) => {
  const data = docItem.data();

  const fullDisplayName =
    `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
    data.name ||
    "Unknown";

  return {
    id: docItem.id,
    ...data,
    name: fullDisplayName,
    age: data.age || calculateAgeFromDob(data.dob),
    fullName: data.fullName || fullDisplayName,
    lastName: data.lastName || "",
    rank: data.rank || "N/A",
    address: data.address || "N/A",
    vocation: data.unit || "N/A",
  };
};

export const getCurrentUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const getUserById = async (userID) => {
  const q = query(collection(db, "users"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return normaliseUser(snapshot.docs[0]);
};

export const getCommanderById = async (commanderID) => {
  const q = query(
    collection(db, "users"),
    where("userID", "==", commanderID),
    where("role", "==", "Commander")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return normaliseUser(snapshot.docs[0]);
};

export const getPersonnelByCommanderId = async (commanderID) => {
  const q = query(
    collection(db, "users"),
    where("commanderID", "==", commanderID),
    where("role", "==", "Personnel")
  );

  const snapshot = await getDocs(q);

  const personnel = snapshot.docs.map((docItem) => normaliseUser(docItem));

  personnel.sort(
    (a, b) => Number(b.readiness || 0) - Number(a.readiness || 0)
  );

  return personnel;
};

export const updateTeamReadiness = async (commanderID, personnel) => {
  const totalPersonnel = personnel.length;

  const avgReadinessScore =
    totalPersonnel === 0
      ? 0
      : Math.round(
          personnel.reduce(
            (sum, person) => sum + Number(person.readiness || 0),
            0
          ) / totalPersonnel
        );

  const readinessLevel =
    avgReadinessScore >= 80
      ? "High"
      : avgReadinessScore >= 60
      ? "Moderate"
      : "Low";

  const readinessData = {
    commanderID,
    totalPersonnel,
    avgReadinessScore,
    readinessLevel,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "teamReadiness", "readiness1"), readinessData, {
    merge: true,
  });

  return readinessData;
};

export const updateTeamStatistics = async (personnel) => {
  const latestOfficialResults = [];

  for (const person of personnel) {
    const userID = person.userID || person.id;

    const q = query(
      collection(db, "officialIPPT"),
      where("userID", "==", userID)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) continue;

    const records = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    records.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.createdAt);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    });

    latestOfficialResults.push(records[0]);
  }

  const totalPersonnel = latestOfficialResults.length;

  const failCount = latestOfficialResults.filter(
    (r) => r.result?.toLowerCase() === "fail"
  ).length;

  const silverCount = latestOfficialResults.filter(
    (r) => r.result?.toLowerCase() === "silver"
  ).length;

  const goldCount = latestOfficialResults.filter(
    (r) => r.result?.toLowerCase() === "gold"
  ).length;

  const passCount = latestOfficialResults.filter(
    (r) => r.result?.toLowerCase() !== "fail"
  ).length;

  const calculateRate = (count) =>
    totalPersonnel === 0 ? 0 : Math.round((count / totalPersonnel) * 100);

  const statisticsData = {
    readinessID: "readiness1",
    source: "officialIPPT",
    totalPersonnel,
    passRate: calculateRate(passCount),
    failRate: calculateRate(failCount),
    silverRate: calculateRate(silverCount),
    goldRate: calculateRate(goldCount),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "teamStatistics", "statistic1"), statisticsData, {
    merge: true,
  });

  return statisticsData;
};

export const updateUserAge = async (userID, age) => {
  const q = query(collection(db, "users"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  await setDoc(
    doc(db, "users", snapshot.docs[0].id),
    { age: Number(age) },
    { merge: true }
  );
};

export const updateUserReadinessAndIPPT = async (
  userID,
  readinessScore,
  result
) => {
  const q = query(collection(db, "users"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  await setDoc(
    doc(db, "users", snapshot.docs[0].id),
    {
      readiness: Number(readinessScore),
      ippt: result,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const getPastOfficialIPPTRecordsByUserId = async (userID) => {
  const q = query(
    collection(db, "officialIPPT"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ref: docItem.ref,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.createdAt);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  });

  return records.slice(0, 5).reverse();
};

export const getPastOfficialIPPTRecordsForPersonnel = async (personnel) => {
  const data = {};

  for (const person of personnel) {
    const userID = person.userID || person.id;
    data[userID] = await getPastOfficialIPPTRecordsByUserId(userID);
  }

  return data;
};

export const keepLatestFiveOfficialIPPTRecords = async (userID) => {
  const q = query(
    collection(db, "officialIPPT"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ref: docItem.ref,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.createdAt);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  });

  const latestFive = records.slice(0, 5);
  const oldRecords = records.slice(5);

  for (const record of oldRecords) {
    await deleteDoc(doc(db, "officialIPPT", record.id));
  }

  const orderedOldToNew = [...latestFive].reverse();

  for (let i = 0; i < orderedOldToNew.length; i++) {
    await updateDoc(orderedOldToNew[i].ref, {
      recordID: `official${i + 1}`,
    });
  }
};

export const getPastIPPTRecordsByUserId = async (userID) => {
  const q = query(
    collection(db, "ipptRecords"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return dateB - dateA;
  });

  return records.slice(0, 5).reverse();
};

export const getPastIPPTRecordsForPersonnel = async (personnel) => {
  const data = {};

  for (const person of personnel) {
    const userID = person.userID || person.id;
    data[userID] = await getPastIPPTRecordsByUserId(userID);
  }

  return data;
};

export const updateUserPhoto = async (userID, photoURL) => {
  const q = query(collection(db, "users"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  await updateDoc(doc(db, "users", snapshot.docs[0].id), {
    photoURL,
    updatedAt: serverTimestamp(),
  });
};

export const addIPPTRecordAndKeepLatestFive = async (recordData) => {
  await addDoc(collection(db, "ipptRecords"), {
    ...recordData,
    date: serverTimestamp(),
    createdAt: new Date().toISOString(),
  });

  const q = query(
    collection(db, "ipptRecords"),
    where("userID", "==", recordData.userID)
  );

  const snapshot = await getDocs(q);

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ref: docItem.ref,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.createdAt);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  });

  const latestFive = records.slice(0, 5);
  const oldRecords = records.slice(5);

  for (const record of oldRecords) {
    await deleteDoc(doc(db, "ipptRecords", record.id));
  }

  const orderedOldToNew = [...latestFive].reverse();

  for (let i = 0; i < orderedOldToNew.length; i++) {
    await updateDoc(orderedOldToNew[i].ref, {
      recordID: `record${i + 1}`,
    });
  }
};

export const getLatestIPPTRecordByUserId = async (userID) => {
  const q = query(collection(db, "ipptRecords"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return dateB - dateA;
  });

  return records[0];
};

export const getLatestOfficialIPPTRecordByUserId = async (userID) => {
  const q = query(
    collection(db, "officialIPPT"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate?.() || new Date(a.createdAt || a.date);
    const dateB = b.date?.toDate?.() || new Date(b.createdAt || b.date);
    return dateB - dateA;
  });

  return records[0];
};

export const getLatestSmartHealthByUserId = async (userID) => {
  const q = query(collection(db, "smartHealth"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  records.sort((a, b) => {
    const dateA = a.date?.toDate?.() || new Date(a.createdAt || a.date);
    const dateB = b.date?.toDate?.() || new Date(b.createdAt || b.date);
    return dateB - dateA;
  });

  return records[0];
};

export const getLatestHealthDataByUserId = async (userID) => {
  if (!userID) return null;

  // Only use a health document when it belongs to the logged-in user.
  // This prevents AI prompts from consuming mismatched healthData rows.
  const q = query(
    collection(db, "healthData"),
    where("userID", "==", userID),
    where("healthID", "==", userID)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
};

export const getLatestTrainingPlanByUserId = async (userID) => {
  const q = query(
    collection(db, "trainingPlans"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const plans = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  plans.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return dateB - dateA;
  });

  return plans[0];
};

export const getLatestMealPlanByUserId = async (userID) => {
  const q = query(collection(db, "mealPlans"), where("userID", "==", userID));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const plans = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  plans.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return dateB - dateA;
  });

  return plans[0];
};

export const getTrainingBenchmarks = async () => {
  const snapshot = await getDocs(collection(db, "trainingBenchmarks"));

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
};

export const getLatestRecommendationByUserId = async (userID) => {
  const q = query(
    collection(db, "aiCoachRecommendations"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const recommendations = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  recommendations.sort((a, b) => {
    const dateA = a.generatedAt?.toDate
      ? a.generatedAt.toDate()
      : new Date(a.generatedAt);
    const dateB = b.generatedAt?.toDate
      ? b.generatedAt.toDate()
      : new Date(b.generatedAt);
    return dateB - dateA;
  });

  return recommendations[0];
};

export const getRecommendationHistoryByUserId = async (userID) => {
  const q = query(
    collection(db, "aiCoachRecommendations"),
    where("userID", "==", userID)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return [];

  const recommendations = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  recommendations.sort((a, b) => {
    const dateA = a.generatedAt?.toDate
      ? a.generatedAt.toDate()
      : new Date(a.generatedAt);
    const dateB = b.generatedAt?.toDate
      ? b.generatedAt.toDate()
      : new Date(b.generatedAt);
    return dateB - dateA;
  });

  return recommendations;
};

export const saveRecommendation = async (payload) => {
  const docRef = await addDoc(collection(db, "aiCoachRecommendations"), {
    ...payload,
    generatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...payload,
    generatedAt: new Date().toISOString(),
  };
};

export const getCoachChatHistoryByUserId = async (userID) => {
  const snapshot = await getDoc(doc(db, "aiCoachChats", userID));

  if (!snapshot.exists()) return [];

  const data = snapshot.data();
  return Array.isArray(data.messages) ? data.messages : [];
};

export const saveCoachChatHistory = async (userID, messages) => {
  await setDoc(
    doc(db, "aiCoachChats", userID),
    {
      userID,
      messages,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return messages;
};

export const clearCoachChatHistoryByUserId = async (userID) => {
  await deleteDoc(doc(db, "aiCoachChats", userID));
};

export const getTrainingContextByUserId = async (userID) => {
  const [
    user,
    latestIppt,
    pastIpptRecords,
    latestHealth,
    latestTrainingPlan,
    latestMealPlan,
    benchmarks,
  ] = await Promise.all([
    getUserById(userID),
    getLatestIPPTRecordByUserId(userID),
    getPastIPPTRecordsByUserId(userID),
    getLatestHealthDataByUserId(userID),
    getLatestTrainingPlanByUserId(userID),
    getLatestMealPlanByUserId(userID),
    getTrainingBenchmarks(),
  ]);

  return {
    user,
    latestIppt,
    pastIpptRecords,
    latestHealth,
    latestTrainingPlan,
    latestMealPlan,
    benchmarks,
  };
};