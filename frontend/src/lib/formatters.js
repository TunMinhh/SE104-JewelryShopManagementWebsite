export function formatCurrency(value) {
    return Number(value || 0).toLocaleString("vi-VN");
}

export function formatQuantity(value) {
    return Number(value || 0).toLocaleString("vi-VN");
}

export function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
