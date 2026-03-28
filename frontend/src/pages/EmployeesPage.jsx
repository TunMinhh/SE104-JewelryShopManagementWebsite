import { useEffect, useState } from "react";
import { fetchJson as _fetchJson } from "../lib/fetchJson";
import useDebouncedValue from "../lib/useDebouncedValue";

const emptyForm = () => ({
    employeename: "",
    username: "",
    roleid: "",
    password: "",
});

function EmployeesPage({ token }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebouncedValue(searchTerm);
    const [roleFilter, setRoleFilter] = useState("all");
    const [view, setView] = useState("list");
    const [editingEmployeeId, setEditingEmployeeId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchJson = (path, options) => _fetchJson(authToken, path, options);

    const loadBaseData = async () => {
        const [employeeData, roleData] = await Promise.all([
            fetchJson("/employees"),
            fetchJson("/roles"),
        ]);
        setEmployees(employeeData || []);
        setRoles(roleData || []);
    };

    useEffect(() => {
        if (!authToken) return;
        const run = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                await loadBaseData();
            } catch (error) {
                setErrorMessage(error.message || "Không thể tải dữ liệu nhân viên");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [authToken]);

    const openCreateView = () => {
        setEditingEmployeeId(null);
        setForm(emptyForm());
        setErrorMessage("");
        setView("form");
    };

    const openEditView = (employee) => {
        setEditingEmployeeId(employee.employeeid);
        setForm({
            employeename: employee.employeename || "",
            username: employee.username || "",
            roleid: String(employee.roleid || ""),
            password: "",
        });
        setErrorMessage("");
        setView("form");
    };

    const resetToList = async () => {
        setView("list");
        setEditingEmployeeId(null);
        setForm(emptyForm());
        setLoading(true);
        setErrorMessage("");
        try {
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải lại nhân viên");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (employeeId) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân viên #${employeeId}?`)) return;
        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/employees/${employeeId}`, { method: "DELETE" });
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa nhân viên");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if (!form.employeename.trim() || !form.username.trim() || !form.roleid) {
            setErrorMessage("Vui lòng nhập tên nhân viên, username và vai trò");
            return;
        }

        if (!editingEmployeeId && !form.password.trim()) {
            setErrorMessage("Vui lòng nhập mật khẩu cho nhân viên mới");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                employeename: form.employeename.trim(),
                username: form.username.trim(),
                roleid: Number(form.roleid),
                password: form.password,
            };

            if (editingEmployeeId) {
                await fetchJson(`/employees/${editingEmployeeId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/employees", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            await resetToList();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu nhân viên");
        } finally {
            setSubmitting(false);
        }
    };

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const filteredEmployees = employees.filter((employee) => {
        const matchesSearch = !normalizedSearchTerm || [
            String(employee.employeeid || ""),
            employee.employeename || "",
            employee.username || "",
            employee.rolename || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));

        const matchesRole = roleFilter === "all" || String(employee.roleid) === roleFilter;
        return matchesSearch && matchesRole;
    });

    const clearFilters = () => {
        setSearchTerm("");
        setRoleFilter("all");
    };

    return (
        <div className="space-y-4">
            {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

            {view === "list" ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-2xl font-semibold text-stone-800">Quản lý nhân viên</h3>
                            <p className="mt-1 text-sm text-stone-500">CRUD cơ bản cho hồ sơ nhân viên và tài khoản đăng nhập.</p>
                        </div>
                        <button type="button" onClick={openCreateView} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400">Thêm nhân viên</button>
                    </div>

                    <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_auto_auto] md:items-end">
                        <label className="block">
                            <span className="text-sm font-medium text-stone-700">Tìm kiếm</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Tìm theo ID, tên nhân viên, username hoặc vai trò"
                                className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-stone-700">Lọc vai trò</span>
                            <select
                                value={roleFilter}
                                onChange={(event) => setRoleFilter(event.target.value)}
                                className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                            >
                                <option value="all">Tất cả vai trò</option>
                                {roles.map((role) => <option key={role.roleid} value={role.roleid}>{role.rolename}</option>)}
                            </select>
                        </label>
                        <div className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                            Hiển thị {filteredEmployees.length}/{employees.length} nhân viên
                        </div>
                        <button type="button" onClick={clearFilters} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">Xóa bộ lọc</button>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px]">
                                <thead className="bg-stone-50 border-b border-stone-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Tên nhân viên</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Username</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Vai trò</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-stone-600">Tác vụ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-5 text-center text-stone-400">Đang tải...</td></tr>
                                    ) : filteredEmployees.length === 0 ? (
                                        <tr><td colSpan="5" className="px-6 py-5 text-center text-stone-400">Không có nhân viên phù hợp bộ lọc</td></tr>
                                    ) : filteredEmployees.map((employee) => (
                                        <tr key={employee.employeeid} className="hover:bg-stone-50">
                                            <td className="px-6 py-4 text-sm text-stone-800">{employee.employeeid}</td>
                                            <td className="px-6 py-4 text-sm text-stone-800">{employee.employeename}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{employee.username}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{employee.rolename || `Role ${employee.roleid}`}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => openEditView(employee)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                    <button type="button" onClick={() => handleDelete(employee.employeeid)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Xóa</button>
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
                        <h3 className="mt-3 text-2xl font-semibold text-stone-800">{editingEmployeeId ? `Chỉnh sửa nhân viên #${editingEmployeeId}` : "Tạo nhân viên mới"}</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Tên nhân viên</span>
                                <input type="text" value={form.employeename} onChange={(event) => setForm((current) => ({ ...current, employeename: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Username</span>
                                <input type="text" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Vai trò</span>
                                <select value={form.roleid} onChange={(event) => setForm((current) => ({ ...current, roleid: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400">
                                    <option value="">Chọn vai trò</option>
                                    {roles.map((role) => <option key={role.roleid} value={role.roleid}>{role.rolename}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">{editingEmployeeId ? "Mật khẩu mới (không bắt buộc)" : "Mật khẩu"}</span>
                                <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={resetToList} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Hủy</button>
                            <button type="submit" disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-60">{submitting ? "Đang lưu..." : editingEmployeeId ? "Cập nhật nhân viên" : "Lưu nhân viên"}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default EmployeesPage;