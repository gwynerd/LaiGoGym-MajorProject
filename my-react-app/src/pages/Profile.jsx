import { useState } from "react";
import { User, Mail, Building2, ShieldCheck, LogOut, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import CommanderNav from "../components/CommanderNav";
import { updateUserPhoto } from "../services/firestoreService";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user")) || {}
  );
  const [uploading, setUploading] = useState(false);

  const handleLogout = () => {
    navigate("/logout");
  };
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 300;
          canvas.height = 300;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 300, 300);

          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
          resolve(compressedBase64);
        };

        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    });
  };

  const handleProfileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result;

      const updatedUser = {
        ...user,
        photoURL: base64String,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      setUser(updatedUser);

      await updateUserPhoto(
        user.userID,
        base64String
      );
      if (file.size > 300000) {
        alert("Please upload an image below 500KB.");
        return;
      }

      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  return (
    <main className="app">
      <section className="phone">
        <div className="phone-content">
          <div className="status-bar">
            <span>9:41</span>
            <span>● ● ● WiFi 🔋</span>
          </div>

          <header className="dashboard-header">
            <div className="header-left">
              <h1>Profile</h1>
              <p>Account Information</p>
            </div>
          </header>

          <div className="profile-card">
            <div className="profile-avatar">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="profile-avatar-img"
                />
              ) : (
                <User size={50} />
              )}
            </div>

            <label className="profile-upload-btn">
              <Camera size={16} />
              {uploading ? "Uploading..." : "Change Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileUpload}
                hidden
              />
            </label>

            <h2>{user?.name || "User"}</h2>

            <div className="profile-info-card">
              <User size={18} />
              <span>{user?.name || "N/A"}</span>
            </div>

            <div className="profile-info-card">
              <Mail size={18} />
              <span>{user?.email || "N/A"}</span>
            </div>
            <div className="profile-info-card">
              <ShieldCheck size={18} />
              <span>{user?.rank || "Responder"}</span>
            </div>
            <div className="profile-info-card">
              <ShieldCheck size={18} />
              <span>{user?.role || "Responder"}</span>
            </div>
            <div className="profile-info-card">
              <Building2 size={18} />
              <span>{user?.unit || "N/A"}</span>
            </div>
            <button className="profile-logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>

        {user?.role === "Commander" ? (
          <CommanderNav activePage="profile" />
        ) : (
          <BottomNav activePage="profile" />
        )}
      </section>
    </main>
  );
}