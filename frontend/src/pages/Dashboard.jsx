import { useState, useEffect } from "react";

const API_URL = "http://127.0.0.1:8000";

function Dashboard({ employeeName = "Nguyễn Văn A", onLogout, token }) {
    // State quản lý tab đang được chọn
    const [activeTab, setActiveTab] = useState("overview");
    // State quản lý đóng/mở sidebar trên mobile
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // State cho dữ liệu từ backend
    const [stats, setStats] = useState({
        salesCount: 0,
        servicesCount: 0,
        customersCount: 0,
        salesTotal: 0,
        trendPeriodDays: 30,
        trends: {
            salesTotal: null,
            salesCount: null,
            servicesCount: null,
            customersCount: null,
        },
    });
    const [employees, setEmployees] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [salesInvoices, setSalesInvoices] = useState([]);
    const [serviceInvoices, setServiceInvoices] = useState([]);
    const [revenueSeries, setRevenueSeries] = useState([]);
    const [loading, setLoading] = useState(false);

    const buildRevenueSeries = (salesData, days = 14) => {
        const dailyTotals = new Map();

        salesData.forEach((inv) => {
            if (!inv?.invoicedate) return;
            const dateKey = inv.invoicedate;
            const amount = Number(inv.totalamount || 0);
            dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + amount);
        });

        const result = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateKey = d.toISOString().slice(0, 10);
            result.push({
                dateKey,
                label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
                value: dailyTotals.get(dateKey) || 0,
            });
        }

        return result;
    };

    // Hàm fetch dữ liệu từ backend
    const fetchData = async () => {
        if (!token) return;
        
        setLoading(true);
        try {
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            // Lấy stats
            const [salesResponse, servicesResponse, customersResponse, trendsResponse] = await Promise.all([
                fetch(`${API_URL}/invoices/sales`, { headers }),
                fetch(`${API_URL}/invoices/services/count`, { headers }),
                fetch(`${API_URL}/customers/count`, { headers }),
                fetch(`${API_URL}/invoices/overview/trends?days=30`, { headers }),
            ]);

            let salesData = [];
            let servicesCount = 0;
            let customersCount = 0;
            let totalSales = 0;
            let trends = {
                salesTotal: null,
                salesCount: null,
                servicesCount: null,
                customersCount: null,
            };
            let trendPeriodDays = 30;

            if (salesResponse.ok) {
                salesData = await salesResponse.json();
                totalSales = salesData.reduce((sum, inv) => sum + (inv.totalamount || 0), 0);
                setRevenueSeries(buildRevenueSeries(salesData, 14));
            }

            if (servicesResponse.ok) {
                const svcData = await servicesResponse.json();
                servicesCount = svcData.count || 0;
            }

            if (customersResponse.ok) {
                const custData = await customersResponse.json();
                customersCount = custData.count || 0;
            }

            if (trendsResponse.ok) {
                const trendData = await trendsResponse.json();
                trendPeriodDays = trendData.period_days || 30;
                trends = {
                    salesTotal: trendData.sales_total?.change_percent ?? null,
                    salesCount: trendData.sales_count?.change_percent ?? null,
                    servicesCount: trendData.services_count?.change_percent ?? null,
                    customersCount: trendData.customers_count?.change_percent ?? null,
                };
            }

            setStats({
                salesCount: salesData.length,
                servicesCount: servicesCount,
                customersCount: customersCount,
                salesTotal: totalSales,
                trendPeriodDays,
                trends,
            });

            // Lấy dữ liệu theo tab
            if (activeTab === "employees") {
                const empResponse = await fetch(`${API_URL}/employees`, { headers });
                if (empResponse.ok) {
                    setEmployees(await empResponse.json());
                }
            } else if (activeTab === "customers") {
                const custResponse = await fetch(`${API_URL}/customers`, { headers });
                if (custResponse.ok) {
                    setCustomers(await custResponse.json());
                }
            } else if (activeTab === "inventory") {
                const prodResponse = await fetch(`${API_URL}/products`, { headers });
                if (prodResponse.ok) {
                    setProducts(await prodResponse.json());
                }
            } else if (activeTab === "purchases") {
                const purchResponse = await fetch(`${API_URL}/invoices/purchases`, { headers });
                if (purchResponse.ok) {
                    // setSalesInvoices(await purchResponse.json());
                }
            } else if (activeTab === "sales") {
                const salesResponse = await fetch(`${API_URL}/invoices/sales`, { headers });
                if (salesResponse.ok) {
                    setSalesInvoices(await salesResponse.json());
                }
            } else if (activeTab === "services") {
                const svcResponse = await fetch(`${API_URL}/invoices/services`, { headers });
                if (svcResponse.ok) {
                    setServiceInvoices(await svcResponse.json());
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data khi component mount hoặc tab thay đổi
    useEffect(() => {
        fetchData();
    }, [activeTab, token]);

    // Danh sách các menu chức năng
    const menuItems = [
        { id: "overview", name: "Tổng quan", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        )},
        { id: "employees", name: "Quản lý nhân viên", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
        )},
        { id: "customers", name: "Quản lý khách hàng", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        )},
        { id: "inventory", name: "Quản lý kho trang sức", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
        )},
        { id: "purchases", name: "Quản lý phiếu mua", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        )},
        { id: "sales", name: "Quản lý phiếu bán", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        )},
        { id: "services", name: "Quản lý phiếu dịch vụ", icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path></svg>
        )}
    ];

    const formatTrendLabel = (trend) => {
        if (trend === null || trend === undefined) return "N/A";
        if (trend === 0) return "0%";
        return `${trend > 0 ? "+" : ""}${trend}%`;
    };

    const getTrendBadgeClass = (trend) => {
        if (trend === null || trend === undefined) {
            return "bg-stone-100 text-stone-500";
        }
        if (trend >= 0) {
            return "bg-emerald-50 text-emerald-700";
        }
        return "bg-red-50 text-red-700";
    };

    const maxRevenueValue = Math.max(...revenueSeries.map((p) => p.value), 0);
    const chartPoints = revenueSeries.map((point, index) => {
        const x = revenueSeries.length > 1 ? (index / (revenueSeries.length - 1)) * 100 : 50;
        const y = maxRevenueValue > 0 ? 100 - (point.value / maxRevenueValue) * 100 : 100;
        return `${x},${y}`;
    }).join(" ");

    return (
        <div className="flex h-screen bg-stone-50 font-sans overflow-hidden">
            {/* Overlay cho Mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-stone-900/50 z-20 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-stone-900 text-stone-300 transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex flex-col`}>
                <div className="flex items-center justify-center h-20 border-b border-stone-800">
                    <h1 className="text-2xl font-serif text-amber-400 tracking-wider">JEWELRY PRO</h1>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveTab(item.id);
                                setIsSidebarOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                activeTab === item.id
                                    ? "bg-amber-500/10 text-amber-400 font-medium"
                                    : "hover:bg-stone-800 hover:text-white"
                            }`}
                        >
                            {item.icon}
                            <span>{item.name}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-stone-800">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-stone-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white border-b border-stone-200 flex items-center justify-between px-6 lg:px-10 z-10">
                    <div className="flex items-center gap-4">
                        <button 
                            className="lg:hidden p-2 text-stone-500 hover:bg-stone-100 rounded-lg"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </button>
                        <h2 className="text-xl font-semibold text-stone-800 hidden sm:block">
                            {menuItems.find(m => m.id === activeTab)?.name}
                        </h2>
                    </div>

                    <div className="flex items-center gap-5">
                        <div className="hidden md:flex items-center px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-full text-stone-500 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-400 transition-all">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input type="text" placeholder="Tìm kiếm nhanh..." className="bg-transparent border-none outline-none text-sm w-48" />
                        </div>
                        
                        <div className="w-px h-8 bg-stone-200 hidden sm:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold border border-amber-200">
                                {employeeName.charAt(0)}
                            </div>
                            <div className="hidden sm:block text-sm">
                                <p className="font-semibold text-stone-800">{employeeName}</p>
                                <p className="text-stone-500 text-xs">Quản lý cửa hàng</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dashboard Body / Content */}
                <main className="flex-1 overflow-y-auto p-6 lg:p-10">
                    {activeTab === "overview" ? (
                        <div className="space-y-6">
                            {/* Thống kê nhanh */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { title: "Tổng doanh thu bán", value: `${(stats.salesTotal / 1000000).toFixed(1)}M`, trend: stats.trends.salesTotal },
                                    { title: "Đơn hàng bán", value: stats.salesCount, trend: stats.trends.salesCount },
                                    { title: "Phiếu dịch vụ", value: stats.servicesCount, trend: stats.trends.servicesCount },
                                    { title: "Khách hàng", value: stats.customersCount, trend: stats.trends.customersCount },
                                ].map((stat, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                                        <h3 className="text-stone-500 text-sm font-medium mb-2">{stat.title}</h3>
                                        <div className="flex items-end justify-between">
                                            <span className="text-2xl font-bold text-stone-800">{loading && activeTab === "overview" ? "..." : stat.value}</span>
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${getTrendBadgeClass(stat.trend)}`}>
                                                {loading && activeTab === "overview" ? "..." : formatTrendLabel(stat.trend)}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs text-stone-400">So với {stats.trendPeriodDays} ngày trước</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm min-h-[300px]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-stone-700 font-semibold">Doanh thu 14 ngày gần nhất</h3>
                                    <span className="text-xs text-stone-400">Đơn vị: VND</span>
                                </div>

                                {loading && activeTab === "overview" ? (
                                    <div className="h-56 flex items-center justify-center text-stone-400">Đang tải biểu đồ...</div>
                                ) : revenueSeries.length === 0 ? (
                                    <div className="h-56 flex items-center justify-center text-stone-400">Không có dữ liệu doanh thu</div>
                                ) : (
                                    <>
                                        <div className="h-56 w-full">
                                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                                                <polyline
                                                    fill="none"
                                                    stroke="#f59e0b"
                                                    strokeWidth="2.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    points={chartPoints}
                                                />
                                            </svg>
                                        </div>
                                        <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] text-stone-400">
                                            {revenueSeries.filter((_, idx) => idx % 2 === 0).map((p) => (
                                                <span key={p.dateKey} className="truncate">{p.label}</span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : activeTab === "employees" ? (
                        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tên nhân viên</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Username</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Role ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Đang tải...</td></tr>
                                        ) : employees.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Không có dữ liệu</td></tr>
                                        ) : (
                                            employees.map((emp) => (
                                                <tr key={emp.employeeid} className="hover:bg-stone-50">
                                                    <td className="px-6 py-4 text-sm text-stone-800">{emp.employeeid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-800">{emp.employeename}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{emp.username}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{emp.roleid}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === "customers" ? (
                        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tên khách hàng</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Điện thoại</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Đang tải...</td></tr>
                                        ) : customers.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Không có dữ liệu</td></tr>
                                        ) : (
                                            customers.map((cust) => (
                                                <tr key={cust.customerid} className="hover:bg-stone-50">
                                                    <td className="px-6 py-4 text-sm text-stone-800">{cust.customerid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-800">{cust.customername}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{cust.phonenumber}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === "inventory" ? (
                        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tên sản phẩm</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Giá mua</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Mô tả</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Đang tải...</td></tr>
                                        ) : products.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Không có dữ liệu</td></tr>
                                        ) : (
                                            products.map((prod) => (
                                                <tr key={prod.productid} className="hover:bg-stone-50">
                                                    <td className="px-6 py-4 text-sm text-stone-800">{prod.productid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-800">{prod.productname}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{(prod.purchaseprice || 0).toLocaleString("vi-VN")}đ</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{prod.description || "N/A"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === "sales" ? (
                        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Khách hàng ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Ngày</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tổng tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Đang tải...</td></tr>
                                        ) : salesInvoices.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Không có dữ liệu</td></tr>
                                        ) : (
                                            salesInvoices.map((inv) => (
                                                <tr key={inv.invoiceid} className="hover:bg-stone-50">
                                                    <td className="px-6 py-4 text-sm text-stone-800">{inv.invoiceid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{inv.customerid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{new Date(inv.invoicedate).toLocaleDateString("vi-VN")}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{(inv.totalamount || 0).toLocaleString("vi-VN")}đ</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === "services" ? (
                        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Khách hàng ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Ngày</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tổng tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200">
                                        {loading ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Đang tải...</td></tr>
                                        ) : serviceInvoices.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-4 text-center text-stone-400">Không có dữ liệu</td></tr>
                                        ) : (
                                            serviceInvoices.map((inv) => (
                                                <tr key={inv.invoiceid} className="hover:bg-stone-50">
                                                    <td className="px-6 py-4 text-sm text-stone-800">{inv.invoiceid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{inv.customerid}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{new Date(inv.invoicedate).toLocaleDateString("vi-VN")}</td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{(inv.totalamount || 0).toLocaleString("vi-VN")}đ</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        // Placeholder cho tab khác (purchases)
                        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm h-full min-h-[500px] flex flex-col items-center justify-center text-stone-400">
                            {menuItems.find(m => m.id === activeTab)?.icon}
                            <h3 className="mt-4 text-lg font-medium text-stone-600">
                                Màn hình {menuItems.find(m => m.id === activeTab)?.name}
                            </h3>
                            <p className="mt-2 text-sm text-stone-400">Component thực tế của bạn sẽ được render tại đây</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default Dashboard;