import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Logout from "./pages/Logout";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Commander from "./pages/Commander";
import CommanderHome from "./pages/CommanderHome";
import Section from "./pages/Section";
import CommanderTraining from "./pages/CommanderTraining";
import Training from "./pages/Training";
import AICoach from "./pages/AICoach";
import ProtectedRoute from "./components/ProtectedRoute";
import RunTracker from "./pages/RunTracker";
import Profile from "./pages/Profile";
import UnitReadiness from "./pages/UnitReadiness";

import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import IPPTResults from "./pages/IPPTResults";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />

        <Route
          path="/"
          element={
            <ProtectedRoute allowedRole="Personnel">
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="Personnel">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/training"
          element={
            // Training now owns the plan-generation workflow and history selection.
            <ProtectedRoute allowedRole="Personnel">
              <Training />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-coach"
          element={
            // AI Coach is reserved for the future conversational assistant.
            <ProtectedRoute allowedRole="Personnel">
              <AICoach />
            </ProtectedRoute>
          }
        />

         <Route
          path="/commander-home"
          element={
            <ProtectedRoute allowedRole="Commander">
              <CommanderHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/commander"
          element={
            <ProtectedRoute allowedRole="Commander">
              <Commander />
            </ProtectedRoute>
          }
        />

        <Route
          path="/section"
          element={
            <ProtectedRoute allowedRole="Commander">
              <Section />
            </ProtectedRoute>
          }
        />

        <Route
          path="/commander-training"
          element={
            <ProtectedRoute allowedRole="Commander">
              <CommanderTraining />
            </ProtectedRoute>
          }
        />

        <Route
          path="/RunTracker"
          element={
            <ProtectedRoute allowedRole="Personnel">
              <RunTracker />
            </ProtectedRoute>
          }
        />

        <Route path="/admin-login" element={<AdminLogin />} />

        <Route path="/admin" element={<Admin />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="Admin">
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route path="/ippt-results" element={<IPPTResults />} />

        <Route
          path="/ippt-results"
          element={
            <ProtectedRoute allowedRole="Admin">
              <IPPTResults />
            </ProtectedRoute>
          }
        />

        <Route
          path="/unit-readiness"
          element={
            <ProtectedRoute allowedRole="Personnel">
              <UnitReadiness />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;