import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { calculateIPPT } from "../services/ipptCalculator";

function IPPTResults() {
  // Store personnel users fetched from Firebase
  const [personnel, setPersonnel] = useState([]);

  // Store official IPPT results fetched from Firebase
  const [officialResults, setOfficialResults] = useState([]);

  // Store form data for adding a new official IPPT result
  const [ipptResult, setIpptResult] = useState({
    personnelId: "",
    testDate: "",
    pushups: "",
    situps: "",
    runtime: "",
  });

  // Load personnel and official IPPT results when the page first opens
  useEffect(() => {
    fetchPersonnel();
    fetchOfficialResults();
  }, []);

  // Fetch only users with the Personnel role for the dropdown
  const fetchPersonnel = async () => {
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "Personnel")
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setPersonnel(data);
    } catch (error) {
      console.error("Error fetching personnel:", error);
      alert("Failed to load personnel.");
    }
  };

  // Fetch all official IPPT results from Firebase and sort newest first
  const fetchOfficialResults = async () => {
    try {
      const snapshot = await getDocs(collection(db, "officialIPPT"));

      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      data.sort((a, b) => {
        const dateA = getResultDateValue(a);
        const dateB = getResultDateValue(b);
        return dateB - dateA;
      });

      setOfficialResults(data);
    } catch (error) {
      console.error("Error fetching official IPPT results:", error);
      alert("Failed to load official IPPT results.");
    }
  };

  // Update form values when the admin types or selects an option
  const handleChange = (e) => {
    const { name, value } = e.target;

    setIpptResult({
      ...ipptResult,
      [name]: value,
    });
  };

  // Submit and save a new official IPPT result
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check that all IPPT fields are filled in
    if (
      !ipptResult.personnelId ||
      !ipptResult.testDate ||
      !ipptResult.pushups ||
      !ipptResult.situps ||
      !ipptResult.runtime
    ) {
      alert("Please fill in all official IPPT fields.");
      return;
    }

    // Validate the 2.4km runtime format
    if (!isValidRuntime(ipptResult.runtime)) {
      alert(
        "Invalid run timing. Please enter the timing in MM:SS format, for example 10:00 or 13:30."
      );
      return;
    }

    try {
      // Find the selected personnel from the dropdown
      const selectedPersonnel = personnel.find(
        (person) => person.id === ipptResult.personnelId
      );

      if (!selectedPersonnel) {
        alert("Personnel not found.");
        return;
      }

      // Calculate the personnel age using their date of birth
      const age = calculateAgeFromDob(selectedPersonnel.dob);

      // Calculate IPPT score using the IPPT calculator service
      const calculation = calculateIPPT({
        age,
        pushups: Number(ipptResult.pushups),
        situps: Number(ipptResult.situps),
        runtime: ipptResult.runtime,
        wantedGoal: "Pass",
      });

      // Save the official IPPT result into Firebase
      await addDoc(collection(db, "officialIPPT"), {
        userID: selectedPersonnel.userID || selectedPersonnel.id,
        personnelDocID: selectedPersonnel.id,

        firstName: selectedPersonnel.firstName || "",
        lastName: selectedPersonnel.lastName || "",
        name:
          selectedPersonnel.name ||
          `${selectedPersonnel.firstName || ""} ${selectedPersonnel.lastName || ""
            }`.trim(),

        unit: selectedPersonnel.unit || "",
        rank: selectedPersonnel.rank || "",
        gender: selectedPersonnel.gender || "",
        dob: selectedPersonnel.dob || "",
        age:
          selectedPersonnel.age ||
          calculateAgeFromDob(selectedPersonnel.dob),

        pushups: Number(ipptResult.pushups),
        situps: Number(ipptResult.situps),
        runtime: ipptResult.runtime,

        pushupScore: calculation.pushupScore,
        situpScore: calculation.situpScore,
        runScore: calculation.runScore,
        totalScore: calculation.totalscore,
        result: calculation.result,

        recordID: `official-${Date.now()}`,

        // This is the official IPPT date selected by the admin
        date: ipptResult.testDate,

        // This stores when the record was created in Firebase
        createdAt: serverTimestamp(),
      });

      // Clear the form after saving
      setIpptResult({
        personnelId: "",
        testDate: "",
        pushups: "",
        situps: "",
        runtime: "",
      });

      // Reload the results table
      await fetchOfficialResults();

      alert("Official IPPT result saved successfully.");
    } catch (error) {
      console.error("Error saving official IPPT result:", error);
      alert("Failed to save official IPPT result.");
    }
  };

  // Delete an official IPPT result from Firebase
  const handleDeleteIPPTResult = async (result) => {
    const confirmed = window.confirm(
      `Delete the official IPPT result for ${result.name || "this personnel"
      }?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "officialIPPT", result.id));
      await fetchOfficialResults();

      alert("Official IPPT result deleted successfully.");
    } catch (error) {
      console.error("Error deleting official IPPT result:", error);
      alert("Failed to delete official IPPT result.");
    }
  };

  // Return the CSS class based on the IPPT award result
  const getAwardClass = (award) => {
    if (award === "Gold") return "ippt-gold";
    if (award === "Silver") return "ippt-silver";
    if (award === "Pass") return "ippt-pass";
    return "ippt-fail";
  };

  // Keep only the latest official IPPT result for each personnel
  const latestOfficialResults = Object.values(
    officialResults.reduce((acc, result) => {
      const key =
        result.userID ||
        result.personnelDocID ||
        result.responderDocID ||
        result.name;

      if (!acc[key]) {
        acc[key] = result;
        return acc;
      }

      const currentDate = getResultDateValue(result);
      const savedDate = getResultDateValue(acc[key]);

      if (currentDate > savedDate) {
        acc[key] = result;
      }

      return acc;
    }, {})
  );

  return (
    <main className="ippt-page">
      <section className="ippt-container">
        <div className="ippt-header">
          <div>
            <h1>Official IPPT Results</h1>
            <p>
              Add, calculate, and review official personnel IPPT results.
            </p>
          </div>

          <Link to="/admin" className="admin-link-btn">
            Back to Admin
          </Link>
        </div>

        <section className="ippt-grid-layout">
          <form className="admin-card" onSubmit={handleSubmit}>
            <h2>Add Official IPPT Result</h2>

            <label>Select Personnel</label>
            <select
              name="personnelId"
              value={ipptResult.personnelId}
              onChange={handleChange}
            >
              <option value="">Select personnel</option>

              {personnel.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name ||
                    `${person.firstName || ""} ${person.lastName || ""
                    }`}
                </option>
              ))}
            </select>

            <label>Official IPPT Date</label>
            <input
              type="date"
              name="testDate"
              value={ipptResult.testDate}
              onChange={handleChange}
            />

            <label>Push-up Reps</label>
            <input
              type="number"
              name="pushups"
              value={ipptResult.pushups}
              onChange={handleChange}
              placeholder="Example: 50"
            />

            <label>Sit-up Reps</label>
            <input
              type="number"
              name="situps"
              value={ipptResult.situps}
              onChange={handleChange}
              placeholder="Example: 50"
            />

            <label>2.4km Run Timing</label>
            <input
              type="text"
              name="runtime"
              value={ipptResult.runtime}
              onChange={(e) => {
                let value = e.target.value;

                // Allow only numbers and one colon
                value = value.replace(/[^0-9:]/g, "");

                const parts = value.split(":");

                // Prevent more than one colon
                if (parts.length > 2) {
                  value = `${parts[0]}:${parts.slice(1).join("")}`;
                }

                // Limit minutes to 2 digits and seconds to 2 digits
                const [minutes = "", seconds] = value.split(":");

                let formattedValue = minutes.slice(0, 2);

                if (value.includes(":")) {
                  formattedValue += `:${(seconds || "").slice(0, 2)}`;
                }

                setIpptResult((previous) => ({
                  ...previous,
                  runtime: formattedValue,
                }));
              }}
              placeholder="Example: 10:00"
              inputMode="numeric"
              maxLength={5}
            />

            <button type="submit">
              Save Official IPPT Result
            </button>
          </form>

          <section className="admin-card">
            <h2>Official IPPT Guide</h2>

            <div className="award-guide">
              <div>
                <strong className="ippt-gold">Gold</strong>
                <span>85 points and above</span>
              </div>

              <div>
                <strong className="ippt-silver">Silver</strong>
                <span>75 points and above</span>
              </div>

              <div>
                <strong className="ippt-pass">Pass</strong>
                <span>61 points and above</span>
              </div>

              <div>
                <strong className="ippt-fail">Fail</strong>
                <span>
                  Below 61 points or 0 in any station
                </span>
              </div>
            </div>
          </section>
        </section>

        <section className="admin-card user-list">
          <h2>Official IPPT Results Table</h2>

          {officialResults.length === 0 ? (
            <p className="empty-table-text">
              No official IPPT results added yet.
            </p>
          ) : (
            <table className="official-ippt-table">
              <thead>
                <tr>
                  <th>Personnel</th>
                  <th>Unit</th>
                  <th>Date</th>
                  <th>Push-ups</th>
                  <th>Sit-ups</th>
                  <th>Run</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {latestOfficialResults.map((result) => (
                  <tr key={result.id}>
                    <td>{result.name || "-"}</td>
                    <td>{result.unit || "-"}</td>
                    <td>
                      {formatDate(
                        result.date || result.createdAt
                      )}
                    </td>
                    <td>{result.pushups ?? "-"}</td>
                    <td>{result.situps ?? "-"}</td>
                    <td>{result.runtime || "-"}</td>

                    <td>
                      <strong
                        className={getAwardClass(result.result)}
                      >
                        {result.totalScore ?? "-"}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`ippt-badge ${getAwardClass(
                          result.result
                        )}`}
                      >
                        {result.result || "-"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() =>
                          handleDeleteIPPTResult(result)
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </section>
    </main>
  );
}
function isValidRuntime(runtime) {
  // Accepts formats such as:
  // 9:30
  // 10:00
  // 13:45
  //
  // Rejects:
  // 10
  // 10.00
  // 10:5
  // 10:60
  // abc

  const runtimePattern = /^\d{1,2}:[0-5]\d$/;

  return runtimePattern.test(runtime.trim());
}

// Calculate personnel age based on their date of birth
function calculateAgeFromDob(dob) {
  if (!dob) return 22;

  const birthDate = dob?.toDate
    ? dob.toDate()
    : new Date(dob);

  if (Number.isNaN(birthDate.getTime())) return 22;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age--;
  }

  return age;
}

// Format Firebase date or normal date into a readable display format
function formatDate(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);

  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Convert result date into a comparable date value for sorting
function getResultDateValue(result) {
  if (result.date?.toDate) {
    return result.date.toDate();
  }

  if (result.date) {
    const selectedDate = new Date(result.date);

    if (!Number.isNaN(selectedDate.getTime())) {
      return selectedDate;
    }
  }

  if (result.createdAt?.toDate) {
    return result.createdAt.toDate();
  }

  if (result.createdAt) {
    const createdDate = new Date(result.createdAt);

    if (!Number.isNaN(createdDate.getTime())) {
      return createdDate;
    }
  }

  return new Date(0);
}

export default IPPTResults;