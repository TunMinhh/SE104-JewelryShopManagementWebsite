import { useState } from "react";

function App() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkBackend = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/ping");
      const data = await res.json();
      setStatus(data.message);
    } catch (err) {
      setStatus("Backend is offline ❌");
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>💎 Jewelry Manage App</h1>
        <p style={styles.subtitle}>
          Fullstack App with FastAPI + React
        </p>

        <button style={styles.button} onClick={checkBackend}>
          {loading ? "Checking..." : "Check Backend Status"}
        </button>

        {status && <p style={styles.status}>{status}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1e3c72, #2a5298)",
    fontFamily: "Arial, sans-serif",
    padding: "20px"  // ensure some padding on small viewports
  },
  card: {
    background: "white",
    padding: "40px",
    borderRadius: "15px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    textAlign: "center",
    width: "90%",
    maxWidth: "500px",
    color: "#333"  // dark text for visibility on white card
  },
  title: {
    marginBottom: "10px",
  },
  subtitle: {
    color: "gray",
    marginBottom: "20px",
  },
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    background: "#2a5298",
    color: "white",
    cursor: "pointer",
    fontSize: "16px",
  },
  status: {
    marginTop: "20px",
    fontWeight: "bold",
  },
};

export default App;