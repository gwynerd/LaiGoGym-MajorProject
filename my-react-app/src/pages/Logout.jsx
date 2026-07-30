import { useNavigate } from "react-router-dom";

function Logout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 1. Remove the user profile data
    localStorage.removeItem("user");

    // ✅ 2. THE FIX: Wipe the Google Health token to completely disconnect the device
    //sessionStorage.removeItem("google_health_token");

    // 3. Send them back to the login screen
    navigate("/login");
  };

  return (
    <main className="login-page">
      <section className="login-phone">
        <div className="login-status">
          <span>9:41</span>
          <span>● ● ● WiFi 🔋</span>
        </div>

        <div className="login-content">
          <div className="login-header">
            <h1>LAIGoGym</h1>
            <p>Logout Confirmation</p>
          </div>

          <div className="login-card">
            <h2>Logout</h2>
            <p className="login-subtitle">
              Are you sure you want to logout?
            </p>

            <button onClick={handleLogout}>Logout</button>

            <button
              type="button"
              onClick={() => navigate("/profile")}
              style={{ background: "#6b7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Logout;