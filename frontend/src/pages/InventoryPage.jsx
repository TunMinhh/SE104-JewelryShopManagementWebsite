import { useEffect, useState } from "react";
import { displayCode, formatCode } from "../lib/displayCodes";
import { fetchJson as _fetchJson } from "../lib/fetchJson";
import { formatCurrency, formatQuantity } from "../lib/formatters";
import useDebouncedValue from "../lib/useDebouncedValue";

const emptyForm = () => ({
    productname: "",
    categoryid: "",
    purchaseprice: "",
    description: "",
});

const emptyCategoryForm = () => ({
    categoryname: "",
    profitpercentage: "",
    unitofmeasure: "",
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
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
    const [categorySubmitting, setCategorySubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchJson = (path, options) => _fetchJson(authToken, path, options);
    const getCategoryById = (categoryId) => categories.find((category) => String(category.categoryid) === String(categoryId));

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

    const openEditCategory = (category) => {
        setEditingCategoryId(category.categoryid);
        setCategoryForm({
            categoryname: category.categoryname || "",
            profitpercentage: String(category.profitpercentage ?? ""),
            unitofmeasure: category.unitofmeasure || "",
        });
        setErrorMessage("");
    };

    const resetCategoryForm = () => {
        setEditingCategoryId(null);
        setCategoryForm(emptyCategoryForm());
    };

    const openEditView = (product) => {
        setEditingProductId(product.productid);
        setForm({
            productname: product.productname || "",
            categoryid: String(product.categoryid || ""),
            purchaseprice: String(product.purchaseprice || ""),
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


    const handleDelete = async (product) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${displayCode(product, "productcode", "SP", "productid")}?`)) return;
        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/products/${product.productid}`, { method: "DELETE" });
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

        if (!form.productname.trim() || !form.categoryid) {
            setErrorMessage("Vui lòng nhập tên sản phẩm và danh mục");
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

    const handleCategorySubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if (!categoryForm.categoryname.trim()) {
            setErrorMessage("Vui lòng nhập tên loại sản phẩm");
            return;
        }

        if (!categoryForm.unitofmeasure.trim()) {
            setErrorMessage("Vui lòng nhập đơn vị tính của loại sản phẩm");
            return;
        }

        if (Number(categoryForm.profitpercentage) < 0) {
            setErrorMessage("Phần trăm lợi nhuận không hợp lệ");
            return;
        }

        setCategorySubmitting(true);
        try {
            const payload = {
                categoryname: categoryForm.categoryname.trim(),
                profitpercentage: Number(categoryForm.profitpercentage || 0),
                unitofmeasure: categoryForm.unitofmeasure.trim(),
            };

            if (editingCategoryId) {
                await fetchJson(`/product-categories/${editingCategoryId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchJson("/product-categories", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            resetCategoryForm();
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể lưu loại sản phẩm");
        } finally {
            setCategorySubmitting(false);
        }
    };

    const handleDeleteCategory = async (category) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa loại sản phẩm ${displayCode(category, "categorycode", "DM", "categoryid")}?`)) return;

        setLoading(true);
        setErrorMessage("");
        try {
            await fetchJson(`/product-categories/${category.categoryid}`, { method: "DELETE" });
            if (editingCategoryId === category.categoryid) resetCategoryForm();
            await loadBaseData();
        } catch (error) {
            setErrorMessage(error.message || "Không thể xóa loại sản phẩm");
        } finally {
            setLoading(false);
        }
    };

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const filteredProducts = products.filter((product) => {
        const matchesSearch = !normalizedSearchTerm || [
            String(product.productid || ""),
            product.productcode || "",
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

                    {!readOnly ? (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                            <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
                                <div className="border-b border-stone-200 px-5 py-4">
                                    <h4 className="text-base font-semibold text-stone-800">Loại sản phẩm</h4>
                                    <p className="mt-1 text-sm text-stone-500">Mỗi loại sản phẩm có đơn vị tính và phần trăm lợi nhuận riêng.</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[680px]">
                                        <thead className="bg-stone-50 border-b border-stone-200">
                                            <tr>
                                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-stone-600">Mã loại</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-stone-600">Tên loại</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-stone-600">ĐVT</th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-stone-600">Lợi nhuận</th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-stone-600">Tác vụ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-200">
                                            {categories.length === 0 ? (
                                                <tr><td colSpan="5" className="px-5 py-5 text-center text-stone-400">Chưa có loại sản phẩm</td></tr>
                                            ) : categories.map((category) => (
                                                <tr key={category.categoryid} className="hover:bg-stone-50">
                                                    <td className="px-5 py-4 text-sm font-semibold text-stone-800">{displayCode(category, "categorycode", "DM", "categoryid")}</td>
                                                    <td className="px-5 py-4 text-sm text-stone-800">{category.categoryname}</td>
                                                    <td className="px-5 py-4 text-sm text-stone-600">{category.unitofmeasure || "-"}</td>
                                                    <td className="px-5 py-4 text-sm text-stone-600">{Number(category.profitpercentage || 0)}%</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <button type="button" onClick={() => openEditCategory(category)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                            <button type="button" onClick={() => handleDeleteCategory(category)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Xóa</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <form onSubmit={handleCategorySubmit} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                <h4 className="text-base font-semibold text-stone-800">{editingCategoryId ? `Sửa loại ${formatCode("DM", editingCategoryId)}` : "Thêm loại sản phẩm"}</h4>
                                <div className="mt-4 grid gap-4">
                                    <label className="block">
                                        <span className="text-sm font-medium text-stone-700">Tên loại sản phẩm</span>
                                        <input type="text" value={categoryForm.categoryname} onChange={(event) => setCategoryForm((current) => ({ ...current, categoryname: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                                    </label>
                                    <label className="block">
                                        <span className="text-sm font-medium text-stone-700">Đơn vị tính</span>
                                        <input type="text" value={categoryForm.unitofmeasure} onChange={(event) => setCategoryForm((current) => ({ ...current, unitofmeasure: event.target.value }))} placeholder="Ví dụ: cái, chỉ, lượng" className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                                    </label>
                                    <label className="block">
                                        <span className="text-sm font-medium text-stone-700">Phần trăm lợi nhuận</span>
                                        <input type="number" min="0" step="0.01" value={categoryForm.profitpercentage} onChange={(event) => setCategoryForm((current) => ({ ...current, profitpercentage: event.target.value }))} placeholder="Ví dụ: 1, 2, 5" className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
                                    </label>
                                </div>
                                <div className="mt-5 flex justify-end gap-3">
                                    {editingCategoryId ? <button type="button" onClick={resetCategoryForm} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Hủy sửa</button> : null}
                                    <button type="submit" disabled={categorySubmitting} className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
                                        {categorySubmitting ? "Đang lưu..." : editingCategoryId ? "Cập nhật loại" : "Lưu loại"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : null}

                    <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_240px_auto_auto] md:items-end">
                        <label className="block">
                            <span className="text-sm font-medium text-stone-700">Tìm kiếm</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Tìm theo mã, tên sản phẩm, danh mục, ĐVT hoặc mô tả"
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
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-stone-600">Mã SP</th>
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
                                            <td className="px-6 py-4 text-sm font-semibold text-stone-800">{displayCode(product, "productcode", "SP", "productid")}</td>
                                            <td className="px-6 py-4 text-sm text-stone-800">{product.productname}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{product.categoryname || "-"}</td>
                                            <td className={`px-6 py-4 text-sm font-medium ${Number(product.currentquantity || 0) < 0 ? "text-red-600" : "text-stone-800"}`}>{formatQuantity(product.currentquantity)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{formatCurrency(product.purchaseprice)}đ</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{product.unitofmeasure || "-"}</td>
                                            <td className="px-6 py-4 text-sm text-stone-600">{product.description || "-"}</td>
                                            {!readOnly && <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => openEditView(product)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Sửa</button>
                                                    <button type="button" onClick={() => handleDelete(product)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Xóa</button>
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
                        <h3 className="mt-3 text-2xl font-semibold text-stone-800">{editingProductId ? `Chỉnh sửa sản phẩm ${formatCode("SP", editingProductId)}` : "Tạo sản phẩm mới"}</h3>
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
                                <div className="mt-2 text-xs text-stone-500">ĐVT: {getCategoryById(form.categoryid)?.unitofmeasure || "-"}</div>
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-stone-700">Giá mua</span>
                                <input type="number" min="0" step="0.01" value={form.purchaseprice} onChange={(event) => setForm((current) => ({ ...current, purchaseprice: event.target.value }))} className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-amber-400" />
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
