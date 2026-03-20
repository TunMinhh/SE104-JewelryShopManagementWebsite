import { useEffect, useState } from "react";
import { buildApiUrl } from "../lib/api";

const emptyForm = () => ({
    customername: "",
    phonenumber: "",
});

function CustomersPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [customers, setCustomers] = useState([]);
    const [view, setView] = useState("list");
    const [editingCustomerId, setEditingCustomerId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
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

        if (response.status === 204) {
            return null;
        }

        return response.json();
    };

    const loadCustomers = async () => {
        const data = await fetchJson("/customers");
        setCustomers(data || []);
    };

    useEffect(() => {
        if (!authToken) return;

        const run = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                await loadCustomers();
            } catch (error) {
                setErrorMessage(error.message || "Không thể tải khách hàng");
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [authToken]);

    const openCreateView = () => {
        setEditingCustomerId(null);
        setForm(emptyForm());
        setErrorMessage("");
        setView("form");
    };

    const openEditView = (customer) => {
        setEditingCustomerId(customer.customerid);
        setForm({
            customername: customer.customername || "",
            phonenumber: customer.phonenumber || "",
        });
        setErrorMessage("");
        setView("form");
    };

    const resetToList = async () => {
        setView("list");
        setEditingCustomerId(null);
        setForm(emptyForm());
        setLoading(true);
        setErrorMessage("");
        try {
            await loadCustomers();
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải lại khách hàng");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (customerId) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa khách hàng #${customerId}?`)) return;

        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/customers/${customerId}`, { method: "DELETE" });
            await loadCustomers();
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa khách hàng");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if (!form.customername.trim()) {
            setErrorMessage("Vui lòng nhập tên khách hàng");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                customername: form.customername.trim(),
                phonenumber: form.phonenumber.trim(),
            };

            if (editingCustomerId) {
                await fetchJson(`/customers/${editingCustomerId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/customers", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            await resetToList();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu khách hàng");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

            {view === "list" ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-2xl font-semibold text-stone-800">Quản lý khách hàng</h3>
                            <p className="mt-1 text-sm text-stone-500">Tạo, chỉnh sửa và xóa thông tin khách hàng.</p>
                        </div>
                        <button type="button" onClick={openCreateView} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400">Thêm khách hàng</button>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px]">
                                <thead className="bg-stone-50 border-b border-stone-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Tên khách hàng</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Điện thoại</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-stone-600">Tác vụ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-5 text-center text-stone-400">Đang tải...</td></tr>
                                    ) : customers.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-5 text-center text-stone-400">Chưa có khách hàng</td></tr>
                                    ) : customers.map((customer) => (
                                        <tr key={customer.customerid} className="hover:bg-stone-50">
                                            <td className="px-6 py-4 text-sm text-stone-800">{customer.customerid}</td>
                                            <td className="px-6 py-4 text-sm text-stone-800">{customer.customername}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{customer.phonenumber || "-"}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => openEditView(customer)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                    <button type="button" onClick={() => handleDelete(customer.customerid)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <button type="button" onClick={resetToList} className="text-sm font-medium text-amber-700 hover:text-amber-600">← Quay lại danh sách</button>
                        <h3 className="mt-3 text-2xl font-semibold text-stone-800">{editingCustomerId ? `Chỉnh sửa khách hàng #${editingCustomerId}` : "Tạo khách hàng mới"}</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Tên khách hàng</span>
                                <input type="text" value={form.customername} onChange={(event) => setForm((current) => ({ ...current, customername: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Số điện thoại</span>
                                <input type="text" value={form.phonenumber} onChange={(event) => setForm((current) => ({ ...current, phonenumber: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={resetToList} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Hủy</button>
                            <button type="submit" disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-60">{submitting ? "Đang lưu..." : editingCustomerId ? "Cập nhật khách hàng" : "Lưu khách hàng"}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default CustomersPage;