import { useEffect, useState } from "react";
import { buildApiUrl } from "../lib/api";
import { displayCode, formatCode } from "../lib/displayCodes";
import { formatCurrency, formatDate, escapeHtml } from "../lib/formatters";
import useDebouncedValue from "../lib/useDebouncedValue";

const emptyLineItem = () => ({
    servicetypeid: "",
    extraamount: "",
    quantity: "1",
    paidamount: "",
    deliverydate: "",
    status: "Chưa giao",
});

const emptyForm = () => ({
    customerid: "",
    createddate: new Date().toISOString().slice(0, 10),
    items: [emptyLineItem()],
});

const emptyNewCustomer = () => ({
    customername: "",
    phonenumber: "",
});

function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function ServiceInvoicesPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [serviceInvoices, setServiceInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [serviceTypes, setServiceTypes] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebouncedValue(searchTerm);
    const [customerFilter, setCustomerFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
    const [view, setView] = useState("list");
    const [form, setForm] = useState(emptyForm);
    const [customerMode, setCustomerMode] = useState("existing");
    const [newCustomer, setNewCustomer] = useState(emptyNewCustomer);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const getHeaders = () => ({
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
    });

    const fetchJson = async (path, options = {}) => {
        if (!authToken) {
            throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }

        const response = await fetch(buildApiUrl(path), {
            ...options,
            headers: {
                ...getHeaders(),
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

            if (response.status === 401) {
                detail = "Phiên đăng nhập đã hết hạn hoặc token không được gửi. Vui lòng đăng nhập lại.";
            }

            throw new Error(detail);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    };

    const loadBaseData = async () => {
        const [invoiceResult, customerResult, serviceTypeResult] = await Promise.allSettled([
            fetchJson("/service-invoices"),
            fetchJson("/customers"),
            fetchJson("/service-types"),
        ]);

        if (invoiceResult.status === "fulfilled") {
            setServiceInvoices(invoiceResult.value || []);
        }

        if (customerResult.status === "fulfilled") {
            setCustomers(customerResult.value || []);
        }

        if (serviceTypeResult.status === "fulfilled") {
            setServiceTypes(serviceTypeResult.value || []);
        }

        const firstError = [invoiceResult, customerResult, serviceTypeResult].find((result) => result.status === "rejected");
        if (firstError) {
            throw firstError.reason;
        }
    };

    useEffect(() => {
        if (!authToken) return;

        const run = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                await loadBaseData();
            } catch (error) {
                setErrorMessage(error.message || "Không thể tải dữ liệu phiếu dịch vụ");
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [authToken]);

    const getServiceTypeById = (serviceTypeId) => serviceTypes.find((serviceType) => String(serviceType.servicetypeid) === String(serviceTypeId));

    const getLineDefaultPrice = (item) => Number(getServiceTypeById(item.servicetypeid)?.defaultserviceprice || 0);

    const getLineExtraAmount = (item) => Number(item.extraamount || 0);

    const getLineActualPrice = (item) => getLineDefaultPrice(item) + getLineExtraAmount(item);

    const getLineTotal = (item) => Number(item.quantity || 0) * getLineActualPrice(item);

    const getLineMinimumPaid = (item) => getLineTotal(item) * 0.5;

    const getLineRemaining = (item) => Math.max(getLineTotal(item) - Number(item.paidamount || 0), 0);

    const getLineStatus = (item) => item.status || (item.deliverydate ? "Đã giao" : "Chưa giao");

    const formTotal = form.items.reduce((sum, item) => sum + getLineTotal(item), 0);
    const formPaidTotal = form.items.reduce((sum, item) => sum + Number(item.paidamount || 0), 0);
    const formRemainingTotal = Math.max(formTotal - formPaidTotal, 0);
    const formStatus = form.items.length > 0 && form.items.every((item) => getLineStatus(item) === "Đã giao") ? "Hoàn thành" : "Chưa hoàn thành";

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const filteredServiceInvoices = serviceInvoices.filter((invoice) => {
        const matchesSearch = !normalizedSearchTerm || [
            String(invoice.invoiceid || ""),
            invoice.invoicecode || "",
            invoice.customername || "",
            invoice.servicenamesummary || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));

        const matchesCustomer = customerFilter === "all" || String(invoice.customerid) === customerFilter;
        const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
        return matchesSearch && matchesCustomer && matchesStatus;
    });

    const clearFilters = () => {
        setSearchTerm("");
        setCustomerFilter("all");
        setStatusFilter("all");
    };

    const buildBm3Html = (invoice) => {
        const details = [...(invoice.details || [])];
        while (details.length < 2) {
            details.push({});
        }

        const rowsHtml = details.map((detail, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(detail.servicename || "")}</td>
                <td>${detail.defaultprice !== undefined ? escapeHtml(`${formatCurrency(detail.defaultprice)} đ`) : ""}</td>
                <td>${detail.actualprice !== undefined ? escapeHtml(`${formatCurrency(detail.actualprice)} đ`) : ""}</td>
                <td>${detail.quantity !== undefined ? escapeHtml(detail.quantity) : ""}</td>
                <td>${detail.totalamount !== undefined ? escapeHtml(`${formatCurrency(detail.totalamount)} đ`) : ""}</td>
                <td>${detail.paidamount !== undefined ? escapeHtml(`${formatCurrency(detail.paidamount)} đ`) : ""}</td>
                <td>${detail.remainingamount !== undefined ? escapeHtml(`${formatCurrency(detail.remainingamount)} đ`) : ""}</td>
                <td>${escapeHtml(detail.deliverydate ? formatDate(detail.deliverydate) : "")}</td>
                <td>${escapeHtml(detail.status || "")}</td>
            </tr>
        `).join("");

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>BM3 - Phiếu dịch vụ ${escapeHtml(displayCode(invoice, "invoicecode", "PDV", "invoiceid"))}</title>
    <style>
        body { font-family: "Times New Roman", serif; padding: 16px; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #111827; padding: 8px; vertical-align: top; }
        .heading td { font-weight: 700; font-size: 18px; }
        .center { text-align: center; }
        .meta-cell { padding: 0; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .meta-item { padding: 8px 12px; min-height: 32px; }
        .meta-item.full { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); }
    </style>
</head>
<body>
    <table>
        <tr class="heading">
            <td style="width: 18%;">BM3:</td>
            <td class="center">PHIẾU DỊCH VỤ</td>
        </tr>
        <tr>
            <td colspan="2" class="meta-cell">
                <div class="meta-grid">
                    <div class="meta-item">Số phiếu: ${escapeHtml(displayCode(invoice, "invoicecode", "PDV", "invoiceid"))}</div>
                    <div class="meta-item">Ngày lập: ${escapeHtml(formatDate(invoice.invoicedate))}</div>
                    <div class="meta-item">Khách hàng: ${escapeHtml(invoice.customername || displayCode(invoice, "customercode", "KH", "customerid"))}</div>
                    <div class="meta-item">Số điện thoại: ${escapeHtml(invoice.customerphonenumber || "-")}</div>
                    <div class="meta-item full">
                        <div>Tổng tiền: ${escapeHtml(`${formatCurrency(invoice.totalamount)} đ`)}</div>
                        <div>Tổng tiền trả trước: ${escapeHtml(`${formatCurrency(invoice.totalpaid)} đ`)}</div>
                        <div>Tổng tiền còn lại: ${escapeHtml(`${formatCurrency(invoice.remainingamount)} đ`)}</div>
                    </div>
                </div>
            </td>
        </tr>
    </table>
    <table style="margin-top: -1px;">
        <thead>
            <tr>
                <th rowspan="2" style="width: 4%;">Stt</th>
                <th rowspan="2" style="width: 16%;">Loại dịch vụ</th>
                <th rowspan="2" style="width: 12%;">Đơn giá dịch vụ</th>
                <th rowspan="2" style="width: 12%;">Đơn giá được tính</th>
                <th rowspan="2" style="width: 8%;">Số lượng</th>
                <th rowspan="2" style="width: 12%;">Thành tiền</th>
                <th colspan="2" style="width: 18%;">Thanh toán</th>
                <th rowspan="2" style="width: 8%;">Ngày giao</th>
                <th rowspan="2" style="width: 10%;">Tình trạng</th>
            </tr>
            <tr>
                <th>Trả trước</th>
                <th>Còn lại</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>
</body>
</html>`;
    };

    const buildBm4Html = (invoices) => {
        const rows = [...invoices];
        while (rows.length < 2) {
            rows.push({});
        }

        const rowsHtml = rows.map((invoice, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(displayCode(invoice, "invoicecode", "PDV", "invoiceid"))}</td>
                <td>${escapeHtml(invoice.invoicedate ? formatDate(invoice.invoicedate) : "")}</td>
                <td>${escapeHtml(invoice.customername || displayCode(invoice, "customercode", "KH", "customerid"))}</td>
                <td>${invoice.totalamount !== undefined ? escapeHtml(`${formatCurrency(invoice.totalamount)} đ`) : ""}</td>
                <td>${invoice.totalpaid !== undefined ? escapeHtml(`${formatCurrency(invoice.totalpaid)} đ`) : ""}</td>
                <td>${invoice.remainingamount !== undefined ? escapeHtml(`${formatCurrency(invoice.remainingamount)} đ`) : ""}</td>
                <td>${escapeHtml(invoice.status || "")}</td>
            </tr>
        `).join("");

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>BM4 - Danh sách phiếu dịch vụ</title>
    <style>
        body { font-family: "Times New Roman", serif; padding: 16px; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #111827; padding: 10px 8px; vertical-align: top; }
        .heading td { font-weight: 700; font-size: 18px; }
        .center { text-align: center; }
    </style>
</head>
<body>
    <table>
        <tr class="heading">
            <td style="width: 18%;">BM4:</td>
            <td class="center">DANH SÁCH PHIẾU DỊCH VỤ</td>
        </tr>
    </table>
    <table style="margin-top: -1px;">
        <thead>
            <tr>
                <th style="width: 6%;">Stt</th>
                <th style="width: 10%;">Số phiếu</th>
                <th style="width: 12%;">Ngày lập</th>
                <th style="width: 18%;">Khách hàng</th>
                <th style="width: 14%;">Tổng tiền</th>
                <th style="width: 14%;">Trả trước</th>
                <th style="width: 14%;">Còn lại</th>
                <th style="width: 12%;">Tình trạng</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>
</body>
</html>`;
    };

    const openPrintWindow = (html) => {
        const printWindow = window.open("", "_blank", "width=1200,height=900");
        if (!printWindow) {
            throw new Error("Trình duyệt đang chặn cửa sổ in");
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const downloadHtml = (filename, html) => {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const updateFormField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const updateNewCustomerField = (field, value) => {
        setNewCustomer((current) => ({ ...current, [field]: value }));
    };

    const upsertCustomer = (customer) => {
        setCustomers((current) => {
            const hasCustomer = current.some((item) => String(item.customerid) === String(customer.customerid));
            if (hasCustomer) {
                return current.map((item) => (String(item.customerid) === String(customer.customerid) ? customer : item));
            }
            return [...current, customer];
        });
    };

    const updateLineItem = (index, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => {
                if (itemIndex !== index) return item;

                if (field === "servicetypeid") {
                    return {
                        ...item,
                        servicetypeid: value,
                        extraamount: "",
                    };
                }

                if (field === "status") {
                    return {
                        ...item,
                        status: value,
                        deliverydate: value === "Đã giao" ? item.deliverydate || getTodayDateString() : "",
                    };
                }

                if (field === "deliverydate") {
                    return {
                        ...item,
                        deliverydate: value,
                        status: value ? "Đã giao" : "Chưa giao",
                    };
                }

                return {
                    ...item,
                    [field]: value,
                };
            }),
        }));
    };

    const addLineItem = () => {
        setForm((current) => ({
            ...current,
            items: [...current.items, emptyLineItem()],
        }));
    };

    const removeLineItem = (index) => {
        setForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const openCreateView = () => {
        setEditingInvoiceId(null);
        setSelectedInvoice(null);
        setForm(emptyForm());
        setCustomerMode("existing");
        setNewCustomer(emptyNewCustomer());
        setErrorMessage("");
        setView("create");
    };

    const openDetailView = async (invoiceId) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const invoice = await fetchJson(`/service-invoices/${invoiceId}`);
            setSelectedInvoice(invoice);
            setView("detail");
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải chi tiết phiếu dịch vụ");
        } finally {
            setLoading(false);
        }
    };

    const openEditView = async (invoiceId) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const invoice = await fetchJson(`/service-invoices/${invoiceId}`);
            setEditingInvoiceId(invoiceId);
            setSelectedInvoice(invoice);
            setForm({
                customerid: String(invoice.customerid),
                createddate: invoice.invoicedate,
                items: invoice.details.map((detail) => ({
                    servicetypeid: String(detail.servicetypeid),
                    extraamount: String(detail.extraamount ?? Math.max(Number(detail.actualprice || 0) - Number(detail.defaultprice || 0), 0)),
                    quantity: String(detail.quantity),
                    paidamount: String(detail.paidamount),
                    deliverydate: detail.deliverydate || "",
                    status: detail.status || (detail.deliverydate ? "Đã giao" : "Chưa giao"),
                })),
            });
            setCustomerMode("existing");
            setNewCustomer(emptyNewCustomer());
            setView("edit");
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải phiếu dịch vụ để chỉnh sửa");
        } finally {
            setLoading(false);
        }
    };

    const resetToList = async () => {
        setView("list");
        setEditingInvoiceId(null);
        setSelectedInvoice(null);
        setForm(emptyForm());
        setCustomerMode("existing");
        setNewCustomer(emptyNewCustomer());
        setErrorMessage("");
        setLoading(true);
        try {
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải lại danh sách phiếu dịch vụ");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (invoiceId) => {
        const accepted = window.confirm(`Bạn có chắc chắn muốn xóa phiếu dịch vụ ${formatCode("PDV", invoiceId)}?`);
        if (!accepted) return;

        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/service-invoices/${invoiceId}`, { method: "DELETE" });
            await loadBaseData();
            if (selectedInvoice?.invoiceid === invoiceId) {
                setSelectedInvoice(null);
            }
            setView("list");
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa phiếu dịch vụ");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if (view === "create" && customerMode === "new") {
            if (!newCustomer.customername.trim()) {
                setErrorMessage("Vui lòng nhập tên khách hàng mới");
                return;
            }
        } else if (!form.customerid) {
            setErrorMessage("Vui lòng chọn khách hàng");
            return;
        }

        if (!form.createddate) {
            setErrorMessage("Vui lòng chọn ngày lập phiếu");
            return;
        }

        if (form.items.length === 0) {
            setErrorMessage("Phiếu dịch vụ phải có ít nhất 1 dòng chi tiết");
            return;
        }

        for (let index = 0; index < form.items.length; index += 1) {
            const item = form.items[index];
            if (!item.servicetypeid) continue;

            const totalAmount = getLineTotal(item);
            const paidAmount = Number(item.paidamount || 0);
            const minimumPaidAmount = getLineMinimumPaid(item);
            const serviceTypeName = getServiceTypeById(item.servicetypeid)?.servicename || `dòng ${index + 1}`;

            if (totalAmount > 0 && (paidAmount < minimumPaidAmount || paidAmount > totalAmount)) {
                setErrorMessage(`Dòng ${index + 1} - ${serviceTypeName}: Số tiền trả trước phải từ 50% đến 100% giá trị dịch vụ.`);
                return;
            }
        }

        const hasInvalidRow = form.items.some((item) => {
            const totalAmount = getLineTotal(item);
            const minimumPaidAmount = getLineMinimumPaid(item);
            return !item.servicetypeid
                || Number(item.quantity) <= 0
                || !Number.isInteger(Number(item.quantity))
                || getLineActualPrice(item) <= 0
                || Number(item.paidamount || 0) < 0
                || Number(item.paidamount || 0) < minimumPaidAmount
                || Number(item.paidamount || 0) > totalAmount;
        });

        if (hasInvalidRow) {
            setErrorMessage("Vui lòng điền loại dịch vụ, số lượng nguyên dương, đơn giá hợp lệ và số tiền trả trước hợp lệ.");
            return;
        }

        const serviceTypeIds = form.items.map((item) => item.servicetypeid);
        if (new Set(serviceTypeIds).size !== serviceTypeIds.length) {
            setErrorMessage("Mỗi loại dịch vụ chỉ được xuất hiện 1 lần trong cùng phiếu");
            return;
        }

        setSubmitting(true);
        try {
            let customerId = Number(form.customerid);

            if (view === "create" && customerMode === "new") {
                const createdCustomer = await fetchJson("/customers", {
                    method: "POST",
                    body: JSON.stringify({
                        customername: newCustomer.customername.trim(),
                        phonenumber: newCustomer.phonenumber.trim(),
                    }),
                });

                upsertCustomer(createdCustomer);
                customerId = Number(createdCustomer.customerid);
                setForm((current) => ({ ...current, customerid: String(createdCustomer.customerid) }));
                setCustomerMode("existing");
                setNewCustomer(emptyNewCustomer());
            }

            const payload = {
                customerid: customerId,
                createddate: form.createddate,
                items: form.items.map((item) => ({
                    servicetypeid: Number(item.servicetypeid),
                    quantity: Number.parseInt(item.quantity, 10),
                    extraamount: Number(item.extraamount || 0),
                    actualprice: getLineActualPrice(item),
                    paidamount: Number(item.paidamount || 0),
                    deliverydate: getLineStatus(item) === "Đã giao" ? (item.deliverydate || getTodayDateString()) : null,
                })),
            };

            if (view === "edit" && editingInvoiceId) {
                await fetchJson(`/service-invoices/${editingInvoiceId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/service-invoices", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            await resetToList();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu phiếu dịch vụ");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrintBm3 = async (invoiceId) => {
        try {
            const invoice = selectedInvoice?.invoiceid === invoiceId
                ? selectedInvoice
                : await fetchJson(`/service-invoices/${invoiceId}`);
            openPrintWindow(buildBm3Html(invoice));
        } catch (error) {
            setErrorMessage(error.message || "Không thể in phiếu dịch vụ");
        }
    };

    const handleDownloadBm3 = async (invoiceId) => {
        try {
            const invoice = selectedInvoice?.invoiceid === invoiceId
                ? selectedInvoice
                : await fetchJson(`/service-invoices/${invoiceId}`);
            downloadHtml(`bm3-phieu-dich-vu-${displayCode(invoice, "invoicecode", "PDV", "invoiceid")}.html`, buildBm3Html(invoice));
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải phiếu dịch vụ");
        }
    };

    const handlePrintBm4 = () => {
        try {
            openPrintWindow(buildBm4Html(serviceInvoices));
        } catch (error) {
            setErrorMessage(error.message || "Không thể in danh sách phiếu dịch vụ");
        }
    };

    const handleDownloadBm4 = () => {
        try {
            downloadHtml("bm4-danh-sach-phieu-dich-vu.html", buildBm4Html(serviceInvoices));
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải danh sách phiếu dịch vụ");
        }
    };

    const renderListView = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-semibold text-stone-800">Danh sách phiếu dịch vụ</h3>
                    <p className="mt-1 text-sm text-stone-500">Quản lý, xem chi tiết, chỉnh sửa, xóa và in phiếu dịch vụ theo từng phiếu hoặc toàn bộ danh sách.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={handlePrintBm4} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">In danh sách phiếu</button>
                    <button type="button" onClick={handleDownloadBm4} className="rounded-xl border border-sky-200 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50">Tải danh sách phiếu</button>
                    <button type="button" onClick={openCreateView} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400">Tạo phiếu dịch vụ</button>
                </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_180px_auto_auto] md:items-end">
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Tìm kiếm</span>
                    <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo mã phiếu, khách hàng, dịch vụ hoặc ngày lập" className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Lọc khách hàng</span>
                    <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400">
                        <option value="all">Tất cả khách hàng</option>
                        {customers.map((customer) => <option key={customer.customerid} value={customer.customerid}>{customer.customername}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Lọc tình trạng</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400">
                        <option value="all">Tất cả tình trạng</option>
                        <option value="Chưa hoàn thành">Chưa hoàn thành</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                    </select>
                </label>
                <div className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">Hiển thị {filteredServiceInvoices.length}/{serviceInvoices.length} phiếu</div>
                <button type="button" onClick={clearFilters} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">Xóa bộ lọc</button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1280px]">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Mã phiếu</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Khách hàng</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Ngày lập</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Dịch vụ</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số dịch vụ</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tổng tiền</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Trả trước</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Còn lại</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tình trạng</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-stone-600 uppercase">Tác vụ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                            {loading ? (
                                <tr><td colSpan="10" className="px-6 py-5 text-center text-stone-400">Đang tải dữ liệu...</td></tr>
                            ) : filteredServiceInvoices.length === 0 ? (
                                <tr><td colSpan="10" className="px-6 py-5 text-center text-stone-400">Không có phiếu dịch vụ phù hợp bộ lọc</td></tr>
                            ) : (
                                filteredServiceInvoices.map((invoice) => (
                                    <tr key={invoice.invoiceid} className="hover:bg-stone-50 align-top">
                                        <td className="px-6 py-4 text-sm font-semibold text-stone-800">{displayCode(invoice, "invoicecode", "PDV", "invoiceid")}</td>
                                        <td className="px-6 py-4 text-sm text-stone-700">{invoice.customername || displayCode(invoice, "customercode", "KH", "customerid")}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{formatDate(invoice.invoicedate)}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{invoice.servicenamesummary || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{invoice.itemcount}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{formatCurrency(invoice.totalamount)}đ</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{formatCurrency(invoice.totalpaid)}đ</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{formatCurrency(invoice.remainingamount)}đ</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{invoice.status || "-"}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <button type="button" onClick={() => openDetailView(invoice.invoiceid)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100">Xem</button>
                                                <button type="button" onClick={() => openEditView(invoice.invoiceid)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                <button type="button" onClick={() => handlePrintBm3(invoice.invoiceid)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50">In phiếu</button>
                                                <button type="button" onClick={() => handleDownloadBm3(invoice.invoiceid)} className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50">Tải phiếu</button>
                                                <button type="button" onClick={() => handleDelete(invoice.invoiceid)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Xóa</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderFormView = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button type="button" onClick={resetToList} className="text-sm font-medium text-amber-700 hover:text-amber-600">← Quay lại danh sách</button>
                    <h3 className="mt-3 text-2xl font-semibold text-stone-800">{view === "edit" ? `Chỉnh sửa phiếu dịch vụ ${formatCode("PDV", editingInvoiceId)}` : "Tạo phiếu dịch vụ mới"}</h3>
                    <p className="mt-1 text-sm text-stone-500">Có thể chọn khách hàng sẵn có hoặc nhập khách mới ngay trong lúc lập phiếu.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-stone-700">Khách hàng</span>
                            {view === "create" ? (
                                <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-medium text-stone-600">
                                    <button
                                        type="button"
                                        onClick={() => setCustomerMode("existing")}
                                        className={`rounded-lg px-3 py-2 transition ${customerMode === "existing" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                                    >
                                        Chọn sẵn
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCustomerMode("new")}
                                        className={`rounded-lg px-3 py-2 transition ${customerMode === "new" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                                    >
                                        Nhập khách mới
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {view === "create" && customerMode === "new" ? (
                            <div className="mt-3 grid gap-3">
                                <input
                                    type="text"
                                    value={newCustomer.customername}
                                    onChange={(event) => updateNewCustomerField("customername", event.target.value)}
                                    placeholder="Tên khách hàng mới"
                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                />
                                <input
                                    type="text"
                                    value={newCustomer.phonenumber}
                                    onChange={(event) => updateNewCustomerField("phonenumber", event.target.value)}
                                    placeholder="Số điện thoại (không bắt buộc)"
                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                />
                                <p className="text-xs text-stone-500">Khách hàng sẽ được tạo tự động khi lưu phiếu dịch vụ.</p>
                            </div>
                        ) : (
                            <>
                                <select
                                    value={form.customerid}
                                    onChange={(event) => updateFormField("customerid", event.target.value)}
                                    className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                >
                                    <option value="">Chọn khách hàng</option>
                                    {customers.map((customer) => (
                                        <option key={customer.customerid} value={customer.customerid}>
                                            {customer.customername} - {customer.phonenumber || "Không có SĐT"}
                                        </option>
                                    ))}
                                </select>
                                {view === "create" ? (
                                    <p className="mt-3 text-xs text-stone-500">Nếu khách chưa có trong hệ thống, chuyển sang tab Nhập khách mới.</p>
                                ) : null}
                            </>
                        )}
                    </div>

                    <label className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                        <span className="text-sm font-medium text-stone-700">Ngày lập</span>
                        <input
                            type="date"
                            value={form.createddate}
                            onChange={(event) => updateFormField("createddate", event.target.value)}
                            className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                        />
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="text-sm text-stone-500">Tổng tiền</div>
                        <div className="mt-2 text-lg font-semibold text-stone-800">{formatCurrency(formTotal)}đ</div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="text-sm text-stone-500">Trả trước</div>
                        <div className="mt-2 text-lg font-semibold text-stone-800">{formatCurrency(formPaidTotal)}đ</div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="text-sm text-stone-500">Còn lại</div>
                        <div className="mt-2 text-lg font-semibold text-amber-600">{formatCurrency(formRemainingTotal)}đ</div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="text-sm text-stone-500">Tình trạng</div>
                        <div className="mt-2 text-lg font-semibold text-stone-800">{formStatus}</div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                        <div>
                            <h4 className="text-base font-semibold text-stone-800">Chi tiết dịch vụ</h4>
                            <p className="mt-1 text-sm text-stone-500">Mỗi dòng gồm loại dịch vụ, đơn giá mặc định, chi phí riêng, tiền trả trước, ngày giao và trạng thái có thể chỉnh sửa.</p>
                        </div>
                        <button type="button" onClick={addLineItem} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Thêm dòng</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1580px]">
                            <thead className="bg-stone-50 border-b border-stone-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">STT</th>
                                    <th className="w-[280px] px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Loại dịch vụ</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá DV</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Chi phí riêng</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá tính</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số lượng</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Thành tiền</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Trả trước</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Còn lại</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Ngày giao</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tình trạng</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 uppercase">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {form.items.map((item, index) => (
                                    <tr key={`${index}-${item.servicetypeid || "new"}`} className="align-top">
                                        <td className="px-4 py-4 text-sm text-stone-700">{index + 1}</td>
                                        <td className="w-[280px] px-4 py-4">
                                            <select
                                                value={item.servicetypeid}
                                                onChange={(event) => updateLineItem(index, "servicetypeid", event.target.value)}
                                                className="min-w-[240px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                            >
                                                <option value="">Chọn loại dịch vụ</option>
                                                {serviceTypes.map((serviceType) => (
                                                    <option key={serviceType.servicetypeid} value={serviceType.servicetypeid}>
                                                        {displayCode(serviceType, "servicetypecode", "DV", "servicetypeid")} - {serviceType.servicename}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(getLineDefaultPrice(item))}đ</td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.extraamount}
                                                onChange={(event) => updateLineItem(index, "extraamount", event.target.value)}
                                                className="w-36 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-sm font-medium text-stone-800">{formatCurrency(getLineActualPrice(item))}đ</td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={item.quantity}
                                                onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                                                className="w-28 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-sm font-medium text-stone-800">{formatCurrency(getLineTotal(item))}đ</td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.paidamount}
                                                onChange={(event) => updateLineItem(index, "paidamount", event.target.value)}
                                                className="w-36 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(getLineRemaining(item))}đ</td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="date"
                                                value={item.deliverydate}
                                                onChange={(event) => updateLineItem(index, "deliverydate", event.target.value)}
                                                disabled={getLineStatus(item) !== "Đã giao"}
                                                className="w-40 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <select
                                                value={getLineStatus(item)}
                                                onChange={(event) => updateLineItem(index, "status", event.target.value)}
                                                className="w-32 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                            >
                                                <option value="Chưa giao">Chưa giao</option>
                                                <option value="Đã giao">Đã giao</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(index)}
                                                disabled={form.items.length === 1}
                                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Xóa dòng
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <button type="button" onClick={resetToList} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Hủy</button>
                    <button type="submit" disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? "Đang lưu..." : view === "edit" ? "Cập nhật phiếu dịch vụ" : "Lưu phiếu dịch vụ"}
                    </button>
                </div>

                {errorMessage ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                ) : null}
            </form>
        </div>
    );

    const renderDetailView = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button type="button" onClick={resetToList} className="text-sm font-medium text-amber-700 hover:text-amber-600">← Quay lại danh sách</button>
                    <h3 className="mt-3 text-2xl font-semibold text-stone-800">Chi tiết phiếu dịch vụ {displayCode(selectedInvoice, "invoicecode", "PDV", "invoiceid")}</h3>
                    <p className="mt-1 text-sm text-stone-500">Xem dữ liệu đầy đủ, chỉnh sửa, xóa hoặc in phiếu dịch vụ.</p>
                </div>
                {selectedInvoice ? (
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => openEditView(selectedInvoice.invoiceid)} className="rounded-xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50">Chỉnh sửa</button>
                        <button type="button" onClick={() => handlePrintBm3(selectedInvoice.invoiceid)} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">In phiếu</button>
                        <button type="button" onClick={() => handleDownloadBm3(selectedInvoice.invoiceid)} className="rounded-xl border border-sky-200 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50">Tải phiếu</button>
                        <button type="button" onClick={() => handleDelete(selectedInvoice.invoiceid)} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">Xóa phiếu</button>
                    </div>
                ) : null}
            </div>

            {selectedInvoice ? (
                <>
                    <div className="grid gap-4 md:grid-cols-5">
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Khách hàng</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{selectedInvoice.customername || displayCode(selectedInvoice, "customercode", "KH", "customerid")}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Ngày lập</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{formatDate(selectedInvoice.invoicedate)}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Tổng tiền</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{formatCurrency(selectedInvoice.totalamount)}đ</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Tổng trả trước</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{formatCurrency(selectedInvoice.totalpaid)}đ</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Còn lại</div>
                            <div className="mt-2 text-lg font-semibold text-amber-600">{formatCurrency(selectedInvoice.remainingamount)}đ</div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Số điện thoại khách hàng</div>
                            <div className="mt-2 text-base font-medium text-stone-800">{selectedInvoice.customerphonenumber || "-"}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Tình trạng phiếu</div>
                            <div className="mt-2 text-base font-medium text-stone-800">{selectedInvoice.status || "-"}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1220px]">
                                <thead className="bg-stone-50 border-b border-stone-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">STT</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Loại dịch vụ</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá DV</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Chi phí riêng</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá tính</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số lượng</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Thành tiền</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Trả trước</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Còn lại</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Ngày giao</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tình trạng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {selectedInvoice.details.map((detail, index) => (
                                        <tr key={detail.serviceinvoicedetailid || `${detail.servicetypeid}-${index}`}>
                                            <td className="px-4 py-4 text-sm text-stone-700">{index + 1}</td>
                                            <td className="px-4 py-4 text-sm text-stone-700">{detail.servicename}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.defaultprice)}đ</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.extraamount || 0)}đ</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.actualprice)}đ</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{detail.quantity}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.totalamount)}đ</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.paidamount)}đ</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.remainingamount)}đ</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatDate(detail.deliverydate)}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{detail.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-400">Không có dữ liệu phiếu dịch vụ.</div>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            {errorMessage && view !== "create" && view !== "edit" ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            ) : null}

            {view === "list" && renderListView()}
            {(view === "create" || view === "edit") && renderFormView()}
            {view === "detail" && renderDetailView()}
        </div>
    );
}

export default ServiceInvoicesPage;


