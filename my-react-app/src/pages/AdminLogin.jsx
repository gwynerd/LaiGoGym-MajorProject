import { useState } from "react";
import { useNavigate } from "react-router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function AdminLogin() {
  const navigate = useNavigate();

  // Store the email and password entered by the admin
  const [adminLogin, setAdminLogin] = useState({
    email: "",
    password: "",
  });

  // Store login error or validation messages
  const [message, setMessage] = useState("");

  // Update the login form whenever the admin types
  const handleChange = (e) => {
    const { name, value } = e.target;

    setAdminLogin({
      ...adminLogin,
      [name]: value,
    });
  };

  // Check admin login details against the Firebase admin collection
  const handleAdminLogin = async (e) => {
    e.preventDefault();

    // Basic validation to make sure both fields are filled in
    if (!adminLogin.email || !adminLogin.password) {
      setMessage("Please enter email and password.");
      return;
    }

    try {
      // Fetch all admin accounts from Firebase
      const querySnapshot = await getDocs(collection(db, "admin"));

      const adminsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Find an admin account with matching email and password
      const matchedAdmin = adminsData.find(
        (admin) =>
          admin.email === adminLogin.email &&
          admin.password === adminLogin.password
      );

      // Show an error if the login details do not match
      if (!matchedAdmin) {
        setMessage("Invalid admin email or password.");
        return;
      }

      // Store the logged-in admin details for the session
      const adminUser = {
        id: matchedAdmin.id,
        adminID: matchedAdmin.adminID || matchedAdmin.id,
        name: matchedAdmin.name,
        email: matchedAdmin.email,
        role: matchedAdmin.role || "Admin",
      };

      localStorage.setItem("currentUser", JSON.stringify(adminUser));

      // Redirect admin to the Admin Management page
      navigate("/admin");
    } catch (error) {
      console.error("Error logging in admin:", error);
      setMessage("Failed to login. Please try again.");
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-container">
        <div className="admin-login-left">
          <h1>Admin Portal</h1>

          <p>
            Sign in to register users, manage roles, and update IPPT records.
          </p>

          <div className="admin-login-info">
            <h3>Admin Access</h3>
            <p>
              Manage Personnel, Commanders, Admins, and IPPT result records.
            </p>
          </div>
        </div>

        <form className="admin-login-card" onSubmit={handleAdminLogin}>
          <h2>Admin Login</h2>
          <p>Enter your admin credentials to continue.</p>

          <label>Email</label>
          <input
            type="email"
            name="email"
            value={adminLogin.email}
            onChange={handleChange}
            placeholder="Enter admin email"
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            value={adminLogin.password}
            onChange={handleChange}
            placeholder="Enter password"
          />

          <button type="submit">Login</button>

          {message && <p className="admin-login-message">{message}</p>}
        </form>
      </section>
    </main>
  );
}

export default AdminLogin;