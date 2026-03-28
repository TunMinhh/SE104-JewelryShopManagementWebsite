import { useEffect, useState } from "react";
import { buildApiUrl } from "../lib/api";
import { formatCurrency, formatQuantity, escapeHtml } from "../lib/formatters";
import useDebouncedValue from "../lib/useDebouncedValue";

const emptyLineItem = () => ({
    productid: "",
    quantity: "1",
    purchaseprice: "",
});

const emptyForm = () => ({
    supplierid: "",
    createddate: new Date().toISOString().slice(0, 10),
    items: [emptyLineItem()],
});

const emptyNewSupplier = () => ({
    suppliername: "",
    address: "",
    phonenumber: "",
});

function PurchaseInvoicesPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [view, setView] = useState("list");
    const [invoices, setInvoices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebouncedValue(searchTerm);
    const [supplierFilter, setSupplierFilter] = useState("all");
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [supplierMode, setSupplierMode] = useState("existing");
    const [newSupplier, setNewSupplier] = useState(emptyNewSupplier);
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
        const [invoiceResult, supplierResult, productResult] = await Promise.allSettled([
            fetchJson("/invoices/purchases"),
            fetchJson("/suppliers"),
            fetchJson("/products"),
        ]);

        if (invoiceResult.status === "fulfilled") {
            setInvoices(invoiceResult.value || []);
        }

        if (supplierResult.status === "fulfilled") {
            setSuppliers(supplierResult.value || []);
        }

        if (productResult.status === "fulfilled") {
            setProducts(productResult.value || []);
        }

        const firstError = [invoiceResult, supplierResult, productResult].find((result) => result.status === "rejected");
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
                setErrorMessage(error.message || "Không thể tải dữ liệu phiếu mua");
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [authToken]);

    const getProductById = (productId) => products.find((product) => String(product.productid) === String(productId));

    const buildInvoiceHtml = (invoice) => {
        const rowsHtml = invoice.details.map((detail, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(detail.productname)}</td>
                <td>${escapeHtml(detail.categoryname)}</td>
                <td>${escapeHtml(formatQuantity(detail.quantity))}</td>
                <td>${escapeHtml(detail.unitofmeasure || "-")}</td>
                <td>${escapeHtml(`${formatCurrency(detail.purchaseprice)} đ`)}</td>
                <td>${escapeHtml(`${formatCurrency(detail.totalamount)} đ`)}</td>
            </tr>
        `).join("");

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Phiếu mua hàng ${invoice.invoiceid}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #1c1917; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        .meta { margin-bottom: 24px; line-height: 1.8; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d6d3d1; padding: 10px 12px; font-size: 14px; }
        th { background: #f5f5f4; text-align: left; }
        .total { margin-top: 16px; text-align: right; font-weight: 700; font-size: 18px; }
    </style>
</head>
<body>
    <h1>PHIẾU MUA HÀNG</h1>
    <div class="meta">
        <div>Mã phiếu: ${escapeHtml(invoice.invoiceid)}</div>
        <div>Ngày lập: ${escapeHtml(new Date(invoice.invoicedate).toLocaleDateString("vi-VN"))}</div>
        <div>Nhà cung cấp: ${escapeHtml(invoice.suppliername || `NCC ${invoice.supplierid}`)}</div>
        <div>Địa chỉ: ${escapeHtml(invoice.supplieraddress || "-")}</div>
        <div>Số điện thoại: ${escapeHtml(invoice.supplierphonenumber || "-")}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Sản phẩm</th>
                <th>Loại sản phẩm</th>
                <th>Số lượng</th>
                <th>Đơn vị tính</th>
                <th>Đơn giá nhập</th>
                <th>Thành tiền</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>
    <div class="total">Tổng tiền: ${escapeHtml(formatCurrency(invoice.totalamount))} đ</div>
</body>
</html>`;
    };

    const openCreateView = () => {
        setEditingInvoiceId(null);
        setSelectedInvoice(null);
        setForm(emptyForm());
        setSupplierMode("existing");
        setNewSupplier(emptyNewSupplier());
        setErrorMessage("");
        setView("create");
    };

    const openDetailView = async (invoiceId) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const invoice = await fetchJson(`/invoices/purchases/${invoiceId}`);
            setSelectedInvoice(invoice);
            setView("detail");
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải chi tiết phiếu mua");
        } finally {
            setLoading(false);
        }
    };

    const openEditView = async (invoiceId) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const invoice = await fetchJson(`/invoices/purchases/${invoiceId}`);
            setEditingInvoiceId(invoiceId);
            setSelectedInvoice(invoice);
            setForm({
                supplierid: String(invoice.supplierid),
                createddate: invoice.invoicedate,
                items: invoice.details.map((detail) => ({
                    productid: String(detail.productid),
                    quantity: String(detail.quantity),
                    purchaseprice: String(detail.purchaseprice),
                })),
            });
            setSupplierMode("existing");
            setNewSupplier(emptyNewSupplier());
            setView("edit");
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải phiếu mua để chỉnh sửa");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (invoiceId) => {
        const accepted = window.confirm(`Bạn có chắc chắn muốn xóa phiếu mua #${invoiceId}?`);
        if (!accepted) return;

        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/invoices/purchases/${invoiceId}`, { method: "DELETE" });
            await loadBaseData();
            if (selectedInvoice?.invoiceid === invoiceId) {
                setSelectedInvoice(null);
            }
            setView("list");
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa phiếu mua");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = async (invoiceId) => {
        try {
            const invoice = selectedInvoice?.invoiceid === invoiceId
                ? selectedInvoice
                : await fetchJson(`/invoices/purchases/${invoiceId}`);
            const html = buildInvoiceHtml(invoice);
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `phieu-mua-${invoice.invoiceid}.html`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải biểu mẫu phiếu mua");
        }
    };

    const handlePrintTemplate = async (invoiceId) => {
        try {
            const invoice = selectedInvoice?.invoiceid === invoiceId
                ? selectedInvoice
                : await fetchJson(`/invoices/purchases/${invoiceId}`);
            const printWindow = window.open("", "_blank", "width=1000,height=800");
            if (!printWindow) {
                throw new Error("Trình duyệt đang chặn cửa sổ in");
            }
            printWindow.document.open();
            printWindow.document.write(buildInvoiceHtml(invoice));
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        } catch (error) {
            setErrorMessage(error.message || "Không thể in phiếu mua");
        }
    };

    const updateFormField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const updateNewSupplierField = (field, value) => {
        setNewSupplier((current) => ({ ...current, [field]: value }));
    };

    const upsertSupplier = (supplier) => {
        setSuppliers((current) => {
            const hasSupplier = current.some((item) => String(item.supplierid) === String(supplier.supplierid));
            if (hasSupplier) {
                return current.map((item) => (String(item.supplierid) === String(supplier.supplierid) ? supplier : item));
            }
            return [...current, supplier];
        });
    };

    const updateLineItem = (index, field, value) => {
        setForm((current) => {
            const nextItems = current.items.map((item, itemIndex) => {
                if (itemIndex !== index) return item;

                if (field === "productid") {
                    const nextProduct = getProductById(value);
                    return {
                        ...item,
                        productid: value,
                        purchaseprice: nextProduct ? String(nextProduct.purchaseprice || "") : "",
                    };
                }

                return {
                    ...item,
                    [field]: value,
                };
            });

            return {
                ...current,
                items: nextItems,
            };
        });
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

    const getLineTotal = (item) => Number(item.quantity || 0) * Number(item.purchaseprice || 0);

    const formTotal = form.items.reduce((sum, item) => sum + getLineTotal(item), 0);

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const filteredInvoices = invoices.filter((invoice) => {
        const matchesSearch = !normalizedSearchTerm || [
            String(invoice.invoiceid || ""),
            invoice.suppliername || "",
            invoice.invoicedate || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));

        const matchesSupplier = supplierFilter === "all" || String(invoice.supplierid) === supplierFilter;
        return matchesSearch && matchesSupplier;
    });

    const clearFilters = () => {
        setSearchTerm("");
        setSupplierFilter("all");
    };

    const resetToList = async () => {
        setView("list");
        setEditingInvoiceId(null);
        setSelectedInvoice(null);
        setForm(emptyForm());
        setSupplierMode("existing");
        setNewSupplier(emptyNewSupplier());
        setErrorMessage("");
        setLoading(true);
        try {
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải lại danh sách phiếu mua");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if (view === "create" && supplierMode === "new") {
            if (!newSupplier.suppliername.trim()) {
                setErrorMessage("Vui lòng nhập tên nhà cung cấp mới");
                return;
            }
        } else if (!form.supplierid) {
            setErrorMessage("Vui lòng chọn nhà cung cấp");
            return;
        }

        if (!form.createddate) {
            setErrorMessage("Vui lòng chọn ngày lập phiếu");
            return;
        }

        if (form.items.length === 0) {
            setErrorMessage("Phiếu mua phải có ít nhất 1 dòng hàng");
            return;
        }

        const hasInvalidRow = form.items.some((item) => !item.productid || Number(item.quantity) <= 0 || Number(item.purchaseprice) <= 0);
        if (hasInvalidRow) {
            setErrorMessage("Vui lòng điền đầy đủ sản phẩm, số lượng và đơn giá nhập hợp lệ");
            return;
        }

        const hasNonIntegerQuantity = form.items.some((item) => !Number.isInteger(Number(item.quantity)));
        if (hasNonIntegerQuantity) {
            setErrorMessage("Số lượng phải là số nguyên dương");
            return;
        }

        const productIds = form.items.map((item) => item.productid);
        if (new Set(productIds).size !== productIds.length) {
            setErrorMessage("Mỗi sản phẩm chỉ được xuất hiện 1 lần trong cùng phiếu");
            return;
        }

        setSubmitting(true);
        try {
            let supplierId = Number(form.supplierid);

            if (view === "create" && supplierMode === "new") {
                const createdSupplier = await fetchJson("/suppliers", {
                    method: "POST",
                    body: JSON.stringify({
                        suppliername: newSupplier.suppliername.trim(),
                        address: newSupplier.address.trim(),
                        phonenumber: newSupplier.phonenumber.trim(),
                    }),
                });

                upsertSupplier(createdSupplier);
                supplierId = Number(createdSupplier.supplierid);
                setForm((current) => ({ ...current, supplierid: String(createdSupplier.supplierid) }));
                setSupplierMode("existing");
                setNewSupplier(emptyNewSupplier());
            }

            const payload = {
                supplierid: supplierId,
                createddate: form.createddate,
                items: form.items.map((item) => ({
                    productid: Number(item.productid),
                    quantity: Number.parseInt(item.quantity, 10),
                    purchaseprice: Number(item.purchaseprice),
                })),
            };

            if (view === "edit" && editingInvoiceId) {
                await fetchJson(`/invoices/purchases/${editingInvoiceId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/invoices/purchases", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            await resetToList();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu phiếu mua");
        } finally {
            setSubmitting(false);
        }
    };

    const renderListView = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-semibold text-stone-800">Danh sách phiếu mua</h3>
                    <p className="mt-1 text-sm text-stone-500">Quản lý, xem chi tiết, chỉnh sửa, xóa và in biểu mẫu phiếu mua hàng.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreateView}
                    className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
                >
                    Tạo phiếu mua
                </button>
            </div>

            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_240px_auto_auto] md:items-end">
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Tìm kiếm</span>
                    <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo mã phiếu, nhà cung cấp hoặc ngày lập" className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Lọc nhà cung cấp</span>
                    <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400">
                        <option value="all">Tất cả nhà cung cấp</option>
                        {suppliers.map((supplier) => <option key={supplier.supplierid} value={supplier.supplierid}>{supplier.suppliername}</option>)}
                    </select>
                </label>
                <div className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">Hiển thị {filteredInvoices.length}/{invoices.length} phiếu</div>
                <button type="button" onClick={clearFilters} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">Xóa bộ lọc</button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px]">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Mã phiếu</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Nhà cung cấp</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Ngày lập</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số mặt hàng</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Tổng tiền</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-stone-600 uppercase">Tác vụ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-5 text-center text-stone-400">Đang tải dữ liệu...</td></tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-5 text-center text-stone-400">Không có phiếu mua phù hợp bộ lọc</td></tr>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <tr key={invoice.invoiceid} className="hover:bg-stone-50 align-top">
                                        <td className="px-6 py-4 text-sm font-semibold text-stone-800">#{invoice.invoiceid}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{invoice.suppliername || `NCC ${invoice.supplierid}`}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{new Date(invoice.invoicedate).toLocaleDateString("vi-VN")}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{invoice.itemcount}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{formatCurrency(invoice.totalamount)}đ</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <button type="button" onClick={() => openDetailView(invoice.invoiceid)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100">Xem</button>
                                                <button type="button" onClick={() => openEditView(invoice.invoiceid)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                <button type="button" onClick={() => handlePrintTemplate(invoice.invoiceid)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50">In</button>
                                                <button type="button" onClick={() => handleDownloadTemplate(invoice.invoiceid)} className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50">Tải mẫu</button>
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
                    <h3 className="mt-3 text-2xl font-semibold text-stone-800">{view === "edit" ? `Chỉnh sửa phiếu mua #${editingInvoiceId}` : "Tạo phiếu mua mới"}</h3>
                    <p className="mt-1 text-sm text-stone-500">Mẫu tạo phiếu được tách riêng khỏi danh sách theo cùng cách với phiếu bán.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-stone-700">Nhà cung cấp</span>
                            {view === "create" ? (
                                <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-medium text-stone-600">
                                    <button
                                        type="button"
                                        onClick={() => setSupplierMode("existing")}
                                        className={`rounded-lg px-3 py-2 transition ${supplierMode === "existing" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                                    >
                                        Chọn sẵn
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSupplierMode("new")}
                                        className={`rounded-lg px-3 py-2 transition ${supplierMode === "new" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                                    >
                                        Nhập NCC mới
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {view === "create" && supplierMode === "new" ? (
                            <div className="mt-3 grid gap-3">
                                <input
                                    type="text"
                                    value={newSupplier.suppliername}
                                    onChange={(event) => updateNewSupplierField("suppliername", event.target.value)}
                                    placeholder="Tên nhà cung cấp mới"
                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                />
                                <input
                                    type="text"
                                    value={newSupplier.address}
                                    onChange={(event) => updateNewSupplierField("address", event.target.value)}
                                    placeholder="Địa chỉ (không bắt buộc)"
                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                />
                                <input
                                    type="text"
                                    value={newSupplier.phonenumber}
                                    onChange={(event) => updateNewSupplierField("phonenumber", event.target.value)}
                                    placeholder="Số điện thoại (không bắt buộc)"
                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                />
                                <p className="text-xs text-stone-500">Nhà cung cấp sẽ được tạo tự động khi lưu phiếu mua.</p>
                            </div>
                        ) : (
                            <>
                                <select
                                    value={form.supplierid}
                                    onChange={(event) => updateFormField("supplierid", event.target.value)}
                                    className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                                >
                                    <option value="">Chọn nhà cung cấp</option>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.supplierid} value={supplier.supplierid}>
                                            {supplier.suppliername} - {supplier.phonenumber || "Không có SĐT"}
                                        </option>
                                    ))}
                                </select>
                                {view === "create" ? (
                                    <p className="mt-3 text-xs text-stone-500">Nếu nhà cung cấp chưa có trong hệ thống, chuyển sang tab Nhập NCC mới.</p>
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

                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                        <div>
                            <h4 className="text-base font-semibold text-stone-800">Chi tiết sản phẩm</h4>
                            <p className="mt-1 text-sm text-stone-500">Biểu mẫu in hiển thị STT, Sản phẩm, Loại sản phẩm, Số lượng, Đơn vị tính, Đơn giá nhập và Thành tiền.</p>
                        </div>
                        <button type="button" onClick={addLineItem} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Thêm dòng</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1040px]">
                            <thead className="bg-stone-50 border-b border-stone-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">STT</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Sản phẩm</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Loại sản phẩm</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số lượng</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn vị tính</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá nhập</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Thành tiền</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 uppercase">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {form.items.map((item, index) => {
                                    const product = getProductById(item.productid);
                                    return (
                                        <tr key={`${index}-${item.productid || "new"}`} className="align-top">
                                            <td className="px-4 py-4 text-sm text-stone-700">{index + 1}</td>
                                            <td className="px-4 py-4">
                                                <select
                                                    value={item.productid}
                                                    onChange={(event) => updateLineItem(index, "productid", event.target.value)}
                                                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                                >
                                                    <option value="">Chọn sản phẩm</option>
                                                    {products.map((productOption) => (
                                                        <option key={productOption.productid} value={productOption.productid}>
                                                            {productOption.productname}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{product?.categoryname || "-"}</td>
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
                                            <td className="px-4 py-4 text-sm text-stone-600">{product?.unitofmeasure || "-"}</td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.purchaseprice}
                                                    onChange={(event) => updateLineItem(index, "purchaseprice", event.target.value)}
                                                    className="w-36 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-400"
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-stone-800">{formatCurrency(getLineTotal(item))}đ</td>
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-end border-t border-stone-200 px-6 py-4">
                        <div className="rounded-2xl bg-stone-900 px-5 py-4 text-right text-white">
                            <div className="text-xs uppercase tracking-wide text-stone-400">Tổng thanh toán</div>
                            <div className="mt-1 text-2xl font-semibold text-amber-400">{formatCurrency(formTotal)}đ</div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <button type="button" onClick={resetToList} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Hủy</button>
                    <button type="submit" disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? "Đang lưu..." : view === "edit" ? "Cập nhật phiếu mua" : "Lưu phiếu mua"}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderDetailView = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button type="button" onClick={resetToList} className="text-sm font-medium text-amber-700 hover:text-amber-600">← Quay lại danh sách</button>
                    <h3 className="mt-3 text-2xl font-semibold text-stone-800">Chi tiết phiếu mua #{selectedInvoice?.invoiceid}</h3>
                    <p className="mt-1 text-sm text-stone-500">Xem dữ liệu đầy đủ và thao tác in/tải biểu mẫu phiếu mua hàng.</p>
                </div>
                {selectedInvoice ? (
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => openEditView(selectedInvoice.invoiceid)} className="rounded-xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50">Chỉnh sửa</button>
                        <button type="button" onClick={() => handlePrintTemplate(selectedInvoice.invoiceid)} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">In phiếu</button>
                        <button type="button" onClick={() => handleDownloadTemplate(selectedInvoice.invoiceid)} className="rounded-xl border border-sky-200 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50">Tải biểu mẫu</button>
                    </div>
                ) : null}
            </div>

            {selectedInvoice ? (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Nhà cung cấp</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{selectedInvoice.suppliername || `NCC ${selectedInvoice.supplierid}`}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Ngày lập</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{new Date(selectedInvoice.invoicedate).toLocaleDateString("vi-VN")}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Số điện thoại NCC</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{selectedInvoice.supplierphonenumber || "-"}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Tổng tiền</div>
                            <div className="mt-2 text-lg font-semibold text-amber-600">{formatCurrency(selectedInvoice.totalamount)}đ</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="text-sm text-stone-500">Địa chỉ nhà cung cấp</div>
                        <div className="mt-2 text-base font-medium text-stone-800">{selectedInvoice.supplieraddress || "-"}</div>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px]">
                                <thead className="bg-stone-50 border-b border-stone-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">STT</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Sản phẩm</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Loại sản phẩm</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số lượng</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn vị tính</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá nhập</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {selectedInvoice.details.map((detail, index) => (
                                        <tr key={detail.purchaseinvoicedetailid || `${detail.productid}-${index}`}>
                                            <td className="px-4 py-4 text-sm text-stone-700">{index + 1}</td>
                                            <td className="px-4 py-4 text-sm text-stone-700">{detail.productname}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{detail.categoryname || "-"}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatQuantity(detail.quantity)}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{detail.unitofmeasure || "-"}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.purchaseprice)}đ</td>
                                            <td className="px-4 py-4 text-sm font-medium text-stone-800">{formatCurrency(detail.totalamount)}đ</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-400">Không có dữ liệu phiếu mua.</div>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            {errorMessage ? (
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

export default PurchaseInvoicesPage;