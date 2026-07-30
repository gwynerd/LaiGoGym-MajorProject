import { useEffect, useState } from "react";
import { ArrowLeft, Trophy, User, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import {
  getCurrentUser,
  getPersonnelByCommanderId,
} from "../services/firestoreService";

function UnitReadiness() {
  const navigate = useNavigate();
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const currentUser = getCurrentUser();

        if (!currentUser?.commanderID) {
          setPersonnel([]);
          return;
        }

        const data = await getPersonnelByCommanderId(
          currentUser.commanderID
        );

        setPersonnel(data || []);
      } catch (error) {
        console.error("Error loading leaderboard:", error);
        setPersonnel([]);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const getMedal = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return index + 1;
  };

  const getResultClass = (result = "") => {
    const value = result.toLowerCase();

    if (value === "gold") return "gold";
    if (value === "silver") return "silver";
    if (value === "pass") return "pass";
    if (value === "fail") return "fail";
    return "na";
  };

  const clamp = (value) => {
    const num = Number(value || 0);
    return Math.min(Math.max(num, 0), 100);
  };

  return (
    <main className="app">
      <section className="phone">
        <div className="phone-content unit-page-clean">
          <div className="status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <header className="unit-clean-header">
            <button
              type="button"
              className="unit-clean-back"
              onClick={() => navigate("/")}
            >
              <ArrowLeft size={19} />
            </button>

            <div>
              <h1>Unit Leaderboard</h1>
              <p>Compare fitness readiness with your unit</p>
            </div>
          </header>

          <section className="unit-clean-trophy">
            <div className="unit-clean-trophy-icon">
              <Trophy size={36} />
            </div>

            <strong>{personnel.length}</strong>
            <span>Personnel currently in your unit</span>
          </section>

          <section className="unit-clean-card">
            {loading ? (
              <p className="unit-clean-empty">Loading leaderboard...</p>
            ) : personnel.length === 0 ? (
              <p className="unit-clean-empty">No personnel found.</p>
            ) : (
              personnel.map((person, index) => {
                const readiness = clamp(person.readiness);

                const fullName =
                  person.name ||
                  `${person.firstName || ""} ${
                    person.lastName || ""
                  }`.trim() ||
                  "Personnel";

                return (
                  <div
                    className="unit-clean-row"
                    key={person.userID || person.id || index}
                  >
                    <div className="unit-clean-rank">
                      {getMedal(index)}
                    </div>

                    <div className="unit-clean-avatar">
                      {person.photoURL ? (
                        <img src={person.photoURL} alt="profile" />
                      ) : (
                        <User size={20} />
                      )}
                    </div>

                    <div className="unit-clean-main">
                      <div className="unit-clean-name-row">
                        <div>
                          <h3>{fullName}</h3>
                          <p>
                            {person.rank || "N/A"} •{" "}
                            {person.unit || "Personnel"}
                          </p>
                        </div>

                        <strong>{readiness}%</strong>
                      </div>

                      <div className="unit-clean-progress">
                        <div
                          style={{
                            width: `${readiness}%`,
                          }}
                        />
                      </div>

                      <span
                        className={`unit-clean-badge ${getResultClass(
                          person.ippt
                        )}`}
                      >
                        {person.ippt || "N/A"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="unit-clean-info-card">
            <div className="unit-clean-info-icon">
              <Info size={21} />
            </div>

            <div>
              <h3>How is this calculated?</h3>
              <p>
                Fitness Readiness is calculated from the latest IPPT Practice
                record. Rankings update automatically after personnel save a
                new practice attempt.
              </p>
            </div>
          </section>
        </div>

        <BottomNav />
      </section>
    </main>
  );
}

export default UnitReadiness;