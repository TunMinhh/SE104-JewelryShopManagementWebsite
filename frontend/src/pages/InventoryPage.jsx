import { useEffect, useState } from "react";
import { fetchJson as _fetchJson } from "../lib/fetchJson";
import { formatCurrency, formatQuantity } from "../lib/formatters";
import useDebouncedValue from "../lib/useDebouncedValue";

const emptyForm = () => ({
    productname: "",
    categoryid: "",
    purchaseprice: "",
    unitofmeasure: "",
    description: "",
});

function InventoryPage({ token, readOnly = false }) {
    const authToken = token?.trim() || localStorage.getItem("access_token")?.trim() || "";
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebouncedValue(searchTerm);
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [view, setView] = useState("list");
    const [editingProductId, setEditingProductId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchJson = (path, options) => _fetchJson(authToken, path, options);

    const loadBaseData = async () => {
        const [productData, categoryData] = await Promise.all([
            fetchJson("/products"),
            fetchJson("/product-categories"),
        ]);
        setProducts(productData || []);
        setCategories(categoryData || []);
    };

    useEffect(() => {
        if (!authToken) return;
        const run = async () => {
            setLoading(true);
            setErrorMessage("");
            try {
                await loadBaseData();
            } catch (error) {
                setErrorMessage(error.message || "Không thể tải dữ liệu kho hàng");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [authToken]);

    const openCreateView = () => {
        setEditingProductId(null);
        setForm(emptyForm());
        setErrorMessage("");
        setView("form");
    };

    const openEditView = (product) => {
        setEditingProductId(product.productid);
        setForm({
            productname: product.productname || "",
            categoryid: String(product.categoryid || ""),
            purchaseprice: String(product.purchaseprice || ""),
            unitofmeasure: product.unitofmeasure || "",
            description: product.description || "",
        });
        setErrorMessage("");
        setView("form");
    };

    const resetToList = async () => {
        setView("list");
        setEditingProductId(null);
        setForm(emptyForm());
        setLoading(true);
        setErrorMessage("");
        try {
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể tải lại kho hàng");
        } finally {
            setLoading(false);
        }
    };


    const handleDelete = async (productId) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm #${productId}?`)) return;
        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/products/${productId}`, { method: "DELETE" });
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa sản phẩm");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if (!form.productname.trim() || !form.categoryid || !form.unitofmeasure.trim()) {
            setErrorMessage("Vui lòng nhập tên sản phẩm, danh mục và đơn vị tính");
            return;
        }

        if (Number(form.purchaseprice) < 0) {
            setErrorMessage("Giá mua không hợp lệ");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                productname: form.productname.trim(),
                categoryid: Number(form.categoryid),
                purchaseprice: Number(form.purchaseprice || 0),
                unitofmeasure: form.unitofmeasure.trim(),
                description: form.description.trim(),
            };

            if (editingProductId) {
                await fetchJson(`/products/${editingProductId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/products", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            await resetToList();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu sản phẩm");
        } finally {
            setSubmitting(false);
        }
    };

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const filteredProducts = products.filter((product) => {
        const matchesSearch = !normalizedSearchTerm || [
            String(product.productid || ""),
            product.productname || "",
            product.categoryname || "",
            String(product.currentquantity || ""),
            product.unitofmeasure || "",
            product.description || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));

        const matchesCategory = categoryFilter === "all" || String(product.categoryid) === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const clearFilters = () => {
        setSearchTerm("");
        setCategoryFilter("all");
    };

    return (
        <div className="space-y-4">
            {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

            {view === "list" ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-2xl font-semibold text-stone-800">Quản lý kho trang sức</h3>
                            <p className="mt-1 text-sm text-stone-500">CRUD cơ bản cho sản phẩm đang có trong kho.</p>
                        </div>
                        <button type="button" onClick={openCreateView} className={`rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400${readOnly ? " hidden" : ""}`}>Thêm sản phẩm</button>
                    </div>

                    <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_240px_auto_auto] md:items-end">
                        <label className="block">
                            <span className="text-sm font-medium text-stone-700">Tìm kiếm</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Tìm theo ID, tên sản phẩm, danh mục, ĐVT hoặc mô tả"
                                className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-stone-700">Lọc danh mục</span>
                            <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                                className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400"
                            >
                                <option value="all">Tất cả danh mục</option>
                                {categories.map((category) => <option key={category.categoryid} value={category.categoryid}>{category.categoryname}</option>)}
                            </select>
                        </label>
                        <div className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                            Hiển thị {filteredProducts.length}/{products.length} sản phẩm
                        </div>
                        <button type="button" onClick={clearFilters} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">Xóa bộ lọc</button>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1180px]">
                                <thead className="bg-stone-50 border-b border-stone-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Tên sản phẩm</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Danh mục</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Số lượng</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Giá mua</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">ĐVT</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Mô tả</th>
                                        {!readOnly && <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-stone-600">Tác vụ</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {loading ? (
                                        <tr><td colSpan={readOnly ? "7" : "8"} className="px-6 py-5 text-center text-stone-400">Đang tải...</td></tr>
                                    ) : filteredProducts.length === 0 ? (
                                        <tr><td colSpan={readOnly ? "7" : "8"} className="px-6 py-5 text-center text-stone-400">Không có sản phẩm phù hợp bộ lọc</td></tr>
                                    ) : filteredProducts.map((product) => (
                                        <tr key={product.productid} className="hover:bg-stone-50">
                                            <td className="px-6 py-4 text-sm text-stone-800">{product.productid}</td>
                                            <td className="px-6 py-4 text-sm text-stone-800">{product.productname}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{product.categoryname || "-"}</td>
                                            <td className={`px-6 py-4 text-sm font-medium ${Number(product.currentquantity || 0) < 0 ? "text-red-600" : "text-stone-800"}`}>{formatQuantity(product.currentquantity)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{formatCurrency(product.purchaseprice)}đ</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{product.unitofmeasure || "-"}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{product.description || "-"}</td>
                                            {!readOnly && <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => openEditView(product)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                    <button type="button" onClick={() => handleDelete(product.productid)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Xóa</button>
                                                </div>
                                            </td>}
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
                        <h3 className="mt-3 text-2xl font-semibold text-stone-800">{editingProductId ? `Chỉnh sửa sản phẩm #${editingProductId}` : "Tạo sản phẩm mới"}</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Tên sản phẩm</span>
                                <input type="text" value={form.productname} onChange={(event) => setForm((current) => ({ ...current, productname: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Danh mục</span>
                                <select value={form.categoryid} onChange={(event) => setForm((current) => ({ ...current, categoryid: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400">
                                    <option value="">Chọn danh mục</option>
                                    {categories.map((category) => <option key={category.categoryid} value={category.categoryid}>{category.categoryname}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Giá mua</span>
                                <input type="number" min="0" step="0.01" value={form.purchaseprice} onChange={(event) => setForm((current) => ({ ...current, purchaseprice: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Đơn vị tính</span>
                                <input type="text" value={form.unitofmeasure} onChange={(event) => setForm((current) => ({ ...current, unitofmeasure: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-sm font-medium text-stone-700">Mô tả</span>
                            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="4" className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                        </label>

                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={resetToList} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Hủy</button>
                            <button type="submit" disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-60">{submitting ? "Đang lưu..." : editingProductId ? "Cập nhật sản phẩm" : "Lưu sản phẩm"}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default InventoryPage;