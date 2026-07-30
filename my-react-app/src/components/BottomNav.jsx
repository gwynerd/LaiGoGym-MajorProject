import {
  Home,
  Dumbbell,
  BarChart3,
  Bot,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BottomNav({ activePage }) {
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <div
        className={activePage === "home" ? "active-nav" : "nav-item"}
        onClick={() => navigate("/")}
      >
        <Home size={18} />
        <span>Home</span>
      </div>

      <div
        className={activePage === "training" ? "active-nav" : "nav-item"}
        onClick={() => navigate("/training")}
      >
        <Dumbbell size={18} />
        <span>Training</span>
      </div>

      <div
        className={activePage === "dashboard" ? "active-nav" : "nav-item"}
        onClick={() => navigate("/dashboard")}
      >
        <BarChart3 size={18} />
        <span>Dashboard</span>
      </div>

      <div
        className={activePage === "ai-coach" ? "active-nav" : "nav-item"}
        onClick={() => navigate("/ai-coach")}
      >
        <Bot size={18} />
        <span>AI Coach</span>
      </div>

      <div
        className={activePage === "profile" ? "active-nav" : "nav-item"}
        onClick={() => navigate("/profile")}
      >
        <User size={18} />
        <span>Profile</span>
      </div>
    </nav>
  );
}