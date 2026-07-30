import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.jpg";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Personnel");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setError("");

      const q = query(
        collection(db, "users"),
        where("email", "==", email.trim().toLowerCase())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("Email not found.");
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password !== password) {
        setError("Incorrect password.");
        return;
      }

      if (userData.role.toLowerCase() !== role.toLowerCase()) {
        setError(`Wrong role selected. This account is registered as ${userData.role}.`);
        return;
      }

      localStorage.setItem(
        "user",
        JSON.stringify({
          id: userDoc.id,
          ...userData,
        })
      );

      if (userData.role.toLowerCase() === "commander") {
        navigate("/commander-home");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error(err);
      setError("Login failed.");
    }
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
            <img src={logo}
                alt="LAIGoGym Logo"
                className="login-logo"
            />
            <h1>LAIGoGym</h1>
            <p>AI Powered IPPT Training Platform</p>
            </div>

          <form className="login-card" onSubmit={handleLogin}>
            <h2>Sign In</h2>

            <p className="login-subtitle">
              Login to access your training dashboard
            </p>

            <label>Email</label>
            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              required
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Personnel">Personnel</option>
              <option value="Commander">Commander</option>
            </select>

            <button type="submit">Login</button>

            

            {error && (
              <p
                style={{
                  color: "#d93025",
                  marginTop: "12px",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                {error}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}

export default Login;