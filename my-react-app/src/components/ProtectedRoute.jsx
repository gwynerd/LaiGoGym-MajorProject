import { Navigate } from "react-router";

function ProtectedRoute({ children, allowedRole }) {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRole &&
    user.role?.toLowerCase() !== allowedRole.toLowerCase()
  ) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;