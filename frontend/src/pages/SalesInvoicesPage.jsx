import { useEffect, useState } from "react";
import { buildApiUrl } from "../lib/api";
import DateInput from "../components/DateInput";
import { displayCode, formatCode } from "../lib/displayCodes";
import { formatCurrency, formatQuantity, escapeHtml, toIsoDate } from "../lib/formatters";
import useDebouncedValue from "../lib/useDebouncedValue";

const emptyLineItem = () => ({
    productid: "",
    quantity: "1",
    sellingprice: "",
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

function SalesInvoicesPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [view, setView] = useState("list");
    const [invoices, setInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebouncedValue(searchTerm);
    const [customerFilter, setCustomerFilter] = useState("all");
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
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
        const [invoiceResult, customerResult, productResult] = await Promise.allSettled([
            fetchJson("/invoices/sales"),
            fetchJson("/customers"),
            fetchJson("/products"),
        ]);

        if (invoiceResult.status === "fulfilled") {
            setInvoices(invoiceResult.value || []);
        }

        if (customerResult.status === "fulfilled") {
            setCustomers(customerResult.value || []);
        }

        if (productResult.status === "fulfilled") {
            setProducts(productResult.value || []);
        }

        const firstError = [invoiceResult, customerResult, productResult].find((result) => result.status === "rejected");
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
                setErrorMessage(error.message || "Không thể tải dữ liệu phiếu bán");
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
                <td>${escapeHtml(`${formatCurrency(detail.sellingprice)} đ`)}</td>
                <td>${escapeHtml(`${formatCurrency(detail.totalamount)} đ`)}</td>
            </tr>
        `).join("");

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Phiếu bán hàng ${escapeHtml(displayCode(invoice, "invoicecode", "HD", "invoiceid"))}</title>
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
    <h1>PHIẾU BÁN HÀNG</h1>
    <div class="meta">
        <div>Mã phiếu: ${escapeHtml(displayCode(invoice, "invoicecode", "HD", "invoiceid"))}</div>
        <div>Ngày lập: ${escapeHtml(new Date(invoice.invoicedate).toLocaleDateString("vi-VN"))}</div>
        <div>Khách hàng: ${escapeHtml(invoice.customername || displayCode(invoice, "customercode", "KH", "customerid"))}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Sản phẩm</th>
                <th>Loại sản phẩm</th>
                <th>Số lượng</th>
                <th>Đơn vị tính</th>
                <th>Đơn giá</th>
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
        setCustomerMode("existing");
        setNewCustomer(emptyNewCustomer());
        setErrorMessage("");
        setView("create");
    };

    const openDetailView = async (invoiceId) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const invoice = await fetchJson(`/invoices/sales/${invoiceId}`);
            setSelectedInvoice(invoice);
            setView("detail");
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải chi tiết phiếu bán");
        } finally {
            setLoading(false);
        }
    };

    const openEditView = async (invoiceId) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const invoice = await fetchJson(`/invoices/sales/${invoiceId}`);
            setEditingInvoiceId(invoiceId);
            setSelectedInvoice(invoice);
            setForm({
                customerid: String(invoice.customerid),
                createddate: invoice.invoicedate,
                items: invoice.details.map((detail) => ({
                    productid: String(detail.productid),
                    quantity: String(detail.quantity),
                    sellingprice: String(detail.sellingprice),
                })),
            });
            setCustomerMode("existing");
            setNewCustomer(emptyNewCustomer());
            setView("edit");
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải phiếu bán để chỉnh sửa");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (invoiceId) => {
        const accepted = window.confirm(`Bạn có chắc chắn muốn xóa phiếu bán ${formatCode("HD", invoiceId)}?`);
        if (!accepted) return;

        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/invoices/sales/${invoiceId}`, { method: "DELETE" });
            await loadBaseData();
            if (selectedInvoice?.invoiceid === invoiceId) {
                setSelectedInvoice(null);
            }
            setView("list");
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa phiếu bán");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = async (invoiceId) => {
        try {
            const invoice = selectedInvoice?.invoiceid === invoiceId
                ? selectedInvoice
                : await fetchJson(`/invoices/sales/${invoiceId}`);
            const html = buildInvoiceHtml(invoice);
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `phieu-ban-${displayCode(invoice, "invoicecode", "HD", "invoiceid")}.html`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải biểu mẫu phiếu bán");
        }
    };

    const handlePrintTemplate = async (invoiceId) => {
        try {
            const invoice = selectedInvoice?.invoiceid === invoiceId
                ? selectedInvoice
                : await fetchJson(`/invoices/sales/${invoiceId}`);
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
            setErrorMessage(error.message || "Không thể in phiếu bán");
        }
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
        setForm((current) => {
            const nextItems = current.items.map((item, itemIndex) => {
                if (itemIndex !== index) return item;

                if (field === "productid") {
                    const nextProduct = getProductById(value);
                    return {
                        ...item,
                        productid: value,
                        sellingprice: nextProduct ? String(nextProduct.recommendedprice || nextProduct.purchaseprice || "") : "",
                    };
                }

                if (field === "sellingprice") {
                    return item;
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

    const getLineTotal = (item) => Number(item.quantity || 0) * Number(item.sellingprice || 0);

    const getAvailableQuantityForSale = (productId) => {
        const product = getProductById(productId);
        const currentQuantity = Number(product?.currentquantity || 0);
        const originalInvoiceQuantity = view === "edit"
            ? (selectedInvoice?.details || [])
                .filter((detail) => String(detail.productid) === String(productId))
                .reduce((sum, detail) => sum + Number(detail.quantity || 0), 0)
            : 0;
        return currentQuantity + originalInvoiceQuantity;
    };

    const formTotal = form.items.reduce((sum, item) => sum + getLineTotal(item), 0);

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const filteredInvoices = invoices.filter((invoice) => {
        const matchesSearch = !normalizedSearchTerm || [
            String(invoice.invoiceid || ""),
            invoice.invoicecode || "",
            invoice.customername || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));

        const matchesCustomer = customerFilter === "all" || String(invoice.customerid) === customerFilter;
        return matchesSearch && matchesCustomer;
    });

    const clearFilters = () => {
        setSearchTerm("");
        setCustomerFilter("all");
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
            setErrorMessage(error.message || "Không thể tải lại danh sách phiếu bán");
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

        const createdDate = toIsoDate(form.createddate);
        if (!createdDate) {
            setErrorMessage("Vui lòng chọn ngày lập phiếu");
            return;
        }

        if (form.items.length === 0) {
            setErrorMessage("Phiếu bán phải có ít nhất 1 dòng hàng");
            return;
        }

        const hasInvalidRow = form.items.some((item) => !item.productid || Number(item.quantity) <= 0 || Number(item.sellingprice) <= 0);
        if (hasInvalidRow) {
            setErrorMessage("Vui lòng điền đầy đủ sản phẩm, số lượng và đơn giá hợp lệ");
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

        for (let index = 0; index < form.items.length; index += 1) {
            const item = form.items[index];
            const product = getProductById(item.productid);
            if (!product) continue;

            const availableQuantity = getAvailableQuantityForSale(item.productid);
            const requestedQuantity = Number(item.quantity || 0);
            if (requestedQuantity > availableQuantity) {
                setErrorMessage(`Dòng ${index + 1} - ${displayCode(product, "productcode", "SP", "productid")} ${product.productname}: Không đủ tồn kho. Tồn hiện tại: ${availableQuantity}, số lượng bán: ${requestedQuantity}.`);
                return;
            }
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
                createddate: createdDate,
                items: form.items.map((item) => ({
                    productid: Number(item.productid),
                    quantity: Number.parseInt(item.quantity, 10),
                    sellingprice: Number(item.sellingprice),
                })),
            };

            if (view === "edit" && editingInvoiceId) {
                await fetchJson(`/invoices/sales/${editingInvoiceId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/invoices/sales", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            await resetToList();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu phiếu bán");
        } finally {
            setSubmitting(false);
        }
    };

    const renderListView = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-semibold text-stone-800">Danh sách phiếu bán</h3>
                    <p className="mt-1 text-sm text-stone-500">Quản lý, xem chi tiết, chỉnh sửa, xóa và in biểu mẫu phiếu bán hàng.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreateView}
                    className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
                >
                    Tạo phiếu bán
                </button>
            </div>

            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_240px_auto_auto] md:items-end">
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Tìm kiếm</span>
                    <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo mã phiếu, khách hàng hoặc ngày lập" className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-stone-700">Lọc khách hàng</span>
                    <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400">
                        <option value="all">Tất cả khách hàng</option>
                        {customers.map((customer) => <option key={customer.customerid} value={customer.customerid}>{customer.customername}</option>)}
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Khách hàng</th>
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
                                <tr><td colSpan="6" className="px-6 py-5 text-center text-stone-400">Không có phiếu bán phù hợp bộ lọc</td></tr>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <tr key={invoice.invoiceid} className="hover:bg-stone-50 align-top">
                                        <td className="px-6 py-4 text-sm font-semibold text-stone-800">{displayCode(invoice, "invoicecode", "HD", "invoiceid")}</td>
                                        <td className="px-6 py-4 text-sm text-stone-600">{invoice.customername || displayCode(invoice, "customercode", "KH", "customerid")}</td>
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
                    <h3 className="mt-3 text-2xl font-semibold text-stone-800">{view === "edit" ? `Chỉnh sửa phiếu bán ${formatCode("HD", editingInvoiceId)}` : "Tạo phiếu bán mới"}</h3>
                    <p className="mt-1 text-sm text-stone-500">Mẫu tạo phiếu được tách riêng khỏi danh sách theo yêu cầu.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                ) : null}

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
                                <p className="text-xs text-stone-500">Khách hàng sẽ được tạo tự động khi lưu phiếu bán.</p>
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
                        <DateInput
                            value={form.createddate}
                            onChange={(value) => updateFormField("createddate", value)}
                            className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                        />
                    </label>
                </div>

                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                        <div>
                            <h4 className="text-base font-semibold text-stone-800">Chi tiết sản phẩm</h4>
                            <p className="mt-1 text-sm text-stone-500">Biểu mẫu in sẽ hiển thị đúng các cột STT, Sản phẩm, Loại sản phẩm, Số lượng, Đơn vị tính, Đơn giá, Thành tiền.</p>
                        </div>
                        <button type="button" onClick={addLineItem} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Thêm dòng</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px]">
                            <thead className="bg-stone-50 border-b border-stone-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">STT</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Sản phẩm</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Loại sản phẩm</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Số lượng</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn vị tính</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá</th>
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
                                                            {displayCode(productOption, "productcode", "SP", "productid")} - {productOption.productname}
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
                                                <div className="w-36 rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700">
                                                    {item.sellingprice ? `${formatCurrency(item.sellingprice)}đ` : "-"}
                                                </div>
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
                        {submitting ? "Đang lưu..." : view === "edit" ? "Cập nhật phiếu bán" : "Lưu phiếu bán"}
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
                    <h3 className="mt-3 text-2xl font-semibold text-stone-800">Chi tiết phiếu bán {displayCode(selectedInvoice, "invoicecode", "HD", "invoiceid")}</h3>
                    <p className="mt-1 text-sm text-stone-500">Xem dữ liệu đầy đủ và thao tác in/tải biểu mẫu phiếu bán hàng.</p>
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
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Khách hàng</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{selectedInvoice.customername || displayCode(selectedInvoice, "customercode", "KH", "customerid")}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Ngày lập</div>
                            <div className="mt-2 text-lg font-semibold text-stone-800">{new Date(selectedInvoice.invoicedate).toLocaleDateString("vi-VN")}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                            <div className="text-sm text-stone-500">Tổng tiền</div>
                            <div className="mt-2 text-lg font-semibold text-amber-600">{formatCurrency(selectedInvoice.totalamount)}đ</div>
                        </div>
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
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Đơn giá</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {selectedInvoice.details.map((detail, index) => (
                                        <tr key={detail.salesinvoicedetailid || `${detail.productid}-${index}`}>
                                            <td className="px-4 py-4 text-sm text-stone-700">{index + 1}</td>
                                            <td className="px-4 py-4 text-sm text-stone-700">{detail.productname}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{detail.categoryname || "-"}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatQuantity(detail.quantity)}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{detail.unitofmeasure || "-"}</td>
                                            <td className="px-4 py-4 text-sm text-stone-600">{formatCurrency(detail.sellingprice)}đ</td>
                                            <td className="px-4 py-4 text-sm font-medium text-stone-800">{formatCurrency(detail.totalamount)}đ</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-400">Không có dữ liệu phiếu bán.</div>
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

export default SalesInvoicesPage;


