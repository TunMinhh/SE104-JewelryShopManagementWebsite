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
    // Background với dải màu hiện đại và hiệu ứng hạt (nếu có thể)
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-slate-800 to-blue-900 p-6">
      
      {/* Card theo phong cách Glassmorphism (Kính mờ) */}
      <div className="relative group w-full max-w-md">
        {/* Lớp nền phát sáng phía sau card (Glow effect) */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        
        <div className="relative bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-8 rounded-2xl shadow-2xl text-center">
          
          {/* Biểu tượng kim cương có hiệu ứng đập nhẹ */}
          <div className="text-6xl mb-4 animate-bounce">💎</div>
          
          <h1 className="text-3xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
            JEWELRY MANAGER
          </h1>
          
          <p className="text-slate-400 text-sm mb-8 font-medium tracking-wide uppercase">
            FastAPI + React Enterprise
          </p>

          {/* Button thiết kế tinh tế hơn */}
          <button 
            className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 shadow-lg active:scale-95 flex items-center justify-center gap-2
              ${loading 
                ? 'bg-slate-700 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-cyan-500/25 hover:scale-[1.02]'}`}
            onClick={checkBackend}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Checking...
              </>
            ) : (
              "Check System Status"
            )}
          </button>

          {/* Hiển thị Status với hiệu ứng Fade In */}
          {status && (
            <div className={`mt-6 p-4 rounded-lg border animate-in fade-in zoom-in duration-300 ${
              status.includes('❌') 
              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <span className="text-sm font-semibold tracking-wider italic uppercase">Result:</span>
              <p className="text-lg font-bold mt-1">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;