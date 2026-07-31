import {
  Home,
  Users,
  Dumbbell,
  User
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CommanderNav({ activePage }) {
  const navigate = useNavigate();

  return (
    <nav className="commander-bottom-nav">
      <div
        className={activePage === "home" ? "commander-active-nav" : "commander-nav-item"}
        onClick={() => navigate("/commander-home")}
      >
        <Home size={18} />
        <span>Home</span>
      </div>

      <div
        className={activePage === "section" ? "commander-active-nav" : "commander-nav-item"}
        onClick={() => navigate("/section")}
      >
        <Users size={18} />
        <span>Section</span>
      </div>

      

      <div
        className={activePage === "commander-training" ? "commander-active-nav" : "commander-nav-item"}
        onClick={() => navigate("/commander-training")}
      >
        <Dumbbell size={18} />
        <span>Training</span>
      </div>

      <div
        className={activePage === "profile" ? "commander-active-nav" : "commander-nav-item"}
        onClick={() => navigate("/profile")}
      >
        <User size={18} />
        <span>Profile</span>
      </div>
    </nav>
  );
}