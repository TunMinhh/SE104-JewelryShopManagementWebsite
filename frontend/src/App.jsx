import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("access_token") || "");
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem("employee_name") || "");

  const checkProfile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Unauthorized");
      }

      const data = await res.json();
      setStatus(`Xin chao ${data.employeename} (role ${data.roleid})`);
    } catch (err) {
      setStatus("Token khong hop le. Vui long dang nhap lai.");
      localStorage.removeItem("access_token");
      localStorage.removeItem("employee_name");
      setToken("");
      setEmployeeName("");
    }
    setLoading(false);
  };

  const handleLoginSuccess = ({ accessToken, employeeName: name }) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("employee_name", name);
    setToken(accessToken);
    setEmployeeName(name);
    setStatus("Dang nhap thanh cong");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("employee_name");
    setToken("");
    setEmployeeName("");
    setStatus(null);
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard token={token} employeeName={employeeName} onLogout={handleLogout} />;
}

export default App;