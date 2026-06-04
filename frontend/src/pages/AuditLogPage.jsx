import { useEffect, useState } from "react";
import { formatCode } from "../lib/displayCodes";
import { fetchJson as _fetchJson } from "../lib/fetchJson";

function AuditLogPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchJson = (path, options) => _fetchJson(authToken, path, options);

    useEffect(() => {
        if (!authToken) return;
        const run = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                const data = await fetchJson("/audit-logs?limit=200");
                setLogs(data || []);
            } catch (error) {
                setErrorMessage(error.message || "Không thể tải nhật ký hoạt động");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [authToken]);

    const formatTimestamp = (iso) => {
        if (!iso) return "-";
        const d = new Date(iso);
        return d.toLocaleString("vi-VN");
    };

    const formatResourceCode = (log) => {
        if (!log.resourceid) return "-";
        const prefixes = {
            Customer: "KH",
            Employee: "NV",
            Product: "SP",
            Supplier: "NCC",
            SalesInvoice: "HD",
            PurchaseInvoice: "PM",
            ServiceInvoice: "PDV",
        };
        return formatCode(prefixes[log.resource], log.resourceid);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-semibold text-stone-800">Nhật ký hoạt động</h3>
                <p className="mt-1 text-sm text-stone-500">Lịch sử thao tác của nhân viên trên hệ thống.</p>
            </div>

            {errorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Mã log</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Nhân viên</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Hành động</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Tài nguyên</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Mã TN</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Chi tiết</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                            {loading ? (
                                <tr><td colSpan="7" className="px-6 py-5 text-center text-stone-400">Đang tải...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-5 text-center text-stone-400">Chưa có nhật ký hoạt động nào</td></tr>
                            ) : logs.map((log) => (
                                <tr key={log.logid} className="hover:bg-stone-50">
                                    <td className="px-6 py-4 text-sm text-stone-800">{log.logcode || formatCode("LOG", log.logid)}</td>
                                    <td className="px-6 py-4 text-sm text-stone-700">{log.employeename || log.employeecode || formatCode("NV", log.employeeid)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                            log.action === "CREATE" ? "bg-emerald-50 text-emerald-700" :
                                            log.action === "UPDATE" ? "bg-amber-50 text-amber-700" :
                                            log.action === "DELETE" ? "bg-red-50 text-red-700" :
                                            "bg-stone-100 text-stone-600"
                                        }`}>{log.action}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-stone-600">{log.resource}</td>
                                    <td className="px-6 py-4 text-sm text-stone-600">{formatResourceCode(log)}</td>
                                    <td className="px-6 py-4 text-sm text-stone-600 max-w-xs truncate">{log.detail || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-stone-500">{formatTimestamp(log.timestamp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default AuditLogPage;
