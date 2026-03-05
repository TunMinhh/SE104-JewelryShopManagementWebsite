import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
                signal: controller.signal,
            });

            const raw = await response.text();
            const data = raw ? JSON.parse(raw) : {};
            if (!response.ok) {
                throw new Error(data.detail || "Đăng nhập thất bại");
            }

            onLoginSuccess({
                accessToken: data.access_token,
                employeeName: data.employeename,
            });
        } catch (err) {
            if (err.name === "AbortError") {
                setError("Hệ thống phản hồi quá chậm. Vui lòng thử lại.");
            } else {
                setError(err.message || "Có lỗi xảy ra");
            }
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-stone-50 font-sans">
            {/* Cột trái: Hình ảnh trang trí (Ẩn trên màn hình điện thoại) */}
            <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden bg-stone-900">
                {/* Ảnh nền mờ (Có thể thay link ảnh trang sức khác) */}
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-50"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2000&auto=format&fit=crop')" }}
                ></div>
                {/* Lớp gradient phủ lên ảnh để chữ dễ đọc */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/60 to-transparent"></div>
                
                <div className="relative z-10 text-center px-12">
                    <h2 className="text-4xl font-serif text-amber-400 mb-4 tracking-wide">Jewelry System</h2>
                    <p className="text-stone-300 text-lg max-w-md mx-auto leading-relaxed">
                        Hệ thống quản lý cửa hàng trang sức cao cấp. Tối ưu hóa quy trình, nâng tầm dịch vụ.
                    </p>
                </div>
            </div>

            {/* Cột phải: Form đăng nhập */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100">
                    <div className="text-center lg:text-left mb-10">
                        <div className="inline-block p-3 bg-amber-50 rounded-2xl mb-4 lg:hidden">
                            {/* Icon nhẫn vàng nhỏ cho mobile */}
                            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-stone-800 tracking-tight">Chào mừng trở lại</h1>
                        <p className="text-sm text-stone-500 mt-2">Vui lòng đăng nhập để tiếp tục làm việc</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2" htmlFor="username">
                                Tên đăng nhập
                            </label>
                            <input
                                id="username"
                                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3.5 text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder="Nhập tên đăng nhập"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2" htmlFor="password">
                                Mật khẩu
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3.5 text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Nhập mật khẩu"
                                required
                            />
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 rounded-xl py-4 font-semibold text-white bg-stone-900 hover:bg-stone-800 shadow-lg shadow-stone-900/20 transition-all active:scale-[0.98] disabled:bg-stone-400 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Đang xác thực...</span>
                                </>
                            ) : (
                                "Đăng nhập hệ thống"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;