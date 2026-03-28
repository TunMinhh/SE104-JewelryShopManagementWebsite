import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { buildApiUrl } from "./lib/api";

function App() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("access_token") || "");
  const [employeeName, setEmployeeName] = useState(() => localStorage.getItem("employee_name") || "");
  const [roleName, setRoleName] = useState(() => localStorage.getItem("role_name") || "");

  const checkProfile = async () => {
    if (!token) {
      setAuthChecked(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/auth/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = new Error("Unauthorized");
        error.status = res.status;
        throw error;
      }

      const data = await res.json();
      setEmployeeName(data.employeename || "");
      localStorage.setItem("employee_name", data.employeename || "");
      const role = data.rolename || "Employee";
      setRoleName(role);
      localStorage.setItem("role_name", role);
      setStatus(`Xin chào ${data.employeename} (role ${data.roleid})`);
    } catch (err) {
      if (err.status === 401) {
        setStatus("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("employee_name");
        localStorage.removeItem("role_name");
        setToken("");
        setEmployeeName("");
        setRoleName("");
      } else {
        setStatus("Không thể xác thực phiên với máy chủ. Dữ liệu có thể chưa tải được.");
      }
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    checkProfile();
  }, [token]);

  const handleLoginSuccess = ({ accessToken, employeeName: name, roleName: role }) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("employee_name", name);
    localStorage.setItem("role_name", role || "Employee");
    setToken(accessToken);
    setEmployeeName(name);
    setRoleName(role || "Employee");
    setStatus("Đăng nhập thành công");
    setAuthChecked(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("employee_name");
    localStorage.removeItem("role_name");
    setToken("");
    setEmployeeName("");
    setRoleName("");
    setStatus(null);
    setAuthChecked(true);
  };

  if (token && (!authChecked || loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        Đang xác thực phiên đăng nhập...
      </div>
    );
  }

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard token={token} employeeName={employeeName} roleName={roleName} onLogout={handleLogout} onAuthError={handleLogout} />;
}

export default App;