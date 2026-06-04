import { useEffect, useState } from "react";
import { buildApiUrl } from "../lib/api";
import { displayCode } from "../lib/displayCodes";
import { formatQuantity, escapeHtml } from "../lib/formatters";

function getCurrentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildStockReportHtml(reportMonth, reportItems) {
    const [year, month] = reportMonth.split("-");
    const rows = [...reportItems];
    while (rows.length < 2) {
        rows.push(null);
    }

    const rowsHtml = rows.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item ? escapeHtml(displayCode(item, "productcode", "SP", "productid")) : ""}</td>
            <td>${item ? escapeHtml(item.productname) : ""}</td>
            <td>${item ? escapeHtml(formatQuantity(item.openingquantity)) : ""}</td>
            <td>${item ? escapeHtml(formatQuantity(item.purchasedquantity)) : ""}</td>
            <td>${item ? escapeHtml(formatQuantity(item.soldquantity)) : ""}</td>
            <td>${item ? escapeHtml(formatQuantity(item.closingquantity)) : ""}</td>
            <td>${item ? escapeHtml(item.unitofmeasure || "") : ""}</td>
        </tr>
    `).join("");

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Báo cáo tồn kho ${month}/${year}</title>
    <style>
        body { font-family: "Times New Roman", serif; margin: 0; padding: 6px; color: #000; }
        table { width: 1020px; max-width: 100%; border-collapse: collapse; margin: 0 auto; }
        th, td { border: 1px solid #000; padding: 10px 8px; font-size: 16px; }
        th { font-weight: 700; }
        .top-left { width: 120px; text-align: left; vertical-align: top; }
        .title { text-align: center; font-size: 24px; font-weight: 700; }
        .month-row { text-align: center; font-size: 18px; }
        .center { text-align: center; }
        .product-col { min-width: 220px; }
        .qty-col { min-width: 120px; }
        .unit-col { min-width: 110px; }
    </style>
</head>
<body>
    <table>
        <tr>
            <td colspan="8" class="title">BÁO CÁO TỒN KHO</td>
        </tr>
        <tr>
            <td colspan="8" class="month-row"><strong>Tháng:</strong> ${escapeHtml(`${month}/${year}`)}</td>
        </tr>
        <tr>
            <th class="center">Stt</th>
            <th class="center">Mã SP</th>
            <th class="center product-col">Sản phẩm</th>
            <th class="center qty-col">Tồn đầu</th>
            <th class="center qty-col">Số lượng mua vào</th>
            <th class="center qty-col">Số lượng bán ra</th>
            <th class="center qty-col">Tồn cuối</th>
            <th class="center unit-col">Đơn vị tính</th>
        </tr>
        ${rowsHtml}
    </table>
</body>
</html>`;
}

function InventoryReportPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [reportMonth, setReportMonth] = useState(getCurrentMonthValue);
    const [reportItems, setReportItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchJson = async (path, options = {}) => {
        const response = await fetch(buildApiUrl(path), {
            ...options,
            headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            let detail = "Yêu cầu thất bại";
            try {
                const payload = await response.json();
                detail = payload.detail || detail;
            } catch {
                detail = response.statusText || detail;
            }
            throw new Error(detail);
        }

        if (response.status === 204) return null;
        return response.json();
    };

    const loadReport = async (monthValue = reportMonth) => {
        const [year, month] = monthValue.split("-");
        if (!year || !month) {
            throw new Error("Vui lòng chọn tháng báo cáo hợp lệ");
        }

        const report = await fetchJson(`/inventory-reports/stock?year=${year}&month=${month}`);
        setReportItems(report.items || []);
    };

    useEffect(() => {
        if (!authToken || !reportMonth) return;

        const run = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                await loadReport(reportMonth);
            } catch (error) {
                setErrorMessage(error.message || "Không thể tải báo cáo tồn kho");
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [authToken, reportMonth]);

    const handleRefreshReport = async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            await loadReport(reportMonth);
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải báo cáo tồn kho");
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReport = () => {
        const html = buildStockReportHtml(reportMonth, reportItems);
        const printWindow = window.open("", "_blank", "width=1200,height=900");
        if (!printWindow) {
            setErrorMessage("Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up.");
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const handleDownloadReport = () => {
        const html = buildStockReportHtml(reportMonth, reportItems);
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `bao-cao-ton-kho-${reportMonth}.html`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="space-y-6">
            {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-2xl font-semibold text-stone-800">Báo cáo tồn kho</h3>
                    <p className="mt-1 text-sm text-stone-500">Tổng hợp tồn đầu, nhập, xuất và tồn cuối theo tháng để in theo mẫu BM5.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={handleDownloadReport} className="rounded-xl border border-sky-200 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50">Tải báo cáo</button>
                    <button type="button" onClick={handlePrintReport} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">In báo cáo</button>
                </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[240px_auto] md:items-end">
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Tháng báo cáo</span>
                    <input
                        type="month"
                        value={reportMonth}
                        onChange={(event) => setReportMonth(event.target.value)}
                        className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                    />
                </label>
                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={handleRefreshReport} disabled={loading} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-60">{loading ? "Đang tải..." : "Tải lại báo cáo"}</button>
                    <div className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">Hiển thị {reportItems.length} sản phẩm trong kỳ</div>
                </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] border-collapse border border-stone-900 text-sm">
                        <thead>
                            <tr>
                                <th colSpan="8" className="border border-stone-900 px-4 py-4 text-center text-2xl font-bold text-stone-900">BÁO CÁO TỒN KHO</th>
                            </tr>
                            <tr>
                                <th colSpan="8" className="border border-stone-900 px-4 py-4 text-center text-lg font-semibold text-stone-900">Tháng: {reportMonth ? `${reportMonth.slice(5, 7)}/${reportMonth.slice(0, 4)}` : "-"}</th>
                            </tr>
                            <tr>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Stt</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Mã SP</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Sản phẩm</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Tồn đầu</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Số lượng mua vào</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Số lượng bán ra</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Tồn cuối</th>
                                <th className="border border-stone-900 px-4 py-3 text-center font-semibold text-stone-900">Đơn vị tính</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="border border-stone-900 px-4 py-5 text-center text-stone-400">Đang tải báo cáo tồn kho...</td>
                                </tr>
                            ) : reportItems.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="border border-stone-900 px-4 py-5 text-center text-stone-400">Không có dữ liệu tồn kho trong kỳ đã chọn</td>
                                </tr>
                            ) : reportItems.map((item, index) => (
                                <tr key={item.productid}>
                                    <td className="border border-stone-900 px-4 py-4 text-right text-stone-800">{index + 1}</td>
                                    <td className="border border-stone-900 px-4 py-4 font-semibold text-stone-800">{displayCode(item, "productcode", "SP", "productid")}</td>
                                    <td className="border border-stone-900 px-4 py-4 text-stone-800">{item.productname}</td>
                                    <td className="border border-stone-900 px-4 py-4 text-right text-stone-700">{formatQuantity(item.openingquantity)}</td>
                                    <td className="border border-stone-900 px-4 py-4 text-right text-stone-700">{formatQuantity(item.purchasedquantity)}</td>
                                    <td className="border border-stone-900 px-4 py-4 text-right text-stone-700">{formatQuantity(item.soldquantity)}</td>
                                    <td className="border border-stone-900 px-4 py-4 text-right font-medium text-stone-800">{formatQuantity(item.closingquantity)}</td>
                                    <td className="border border-stone-900 px-4 py-4 text-stone-700">{item.unitofmeasure || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default InventoryReportPage;

