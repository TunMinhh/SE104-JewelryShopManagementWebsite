export function formatCurrency(value) {
    return Number(value || 0).toLocaleString("vi-VN");
}

export function formatQuantity(value) {
    return Number(value || 0).toLocaleString("vi-VN");
}

export function toIsoDate(value) {
    if (!value) return "";

    const rawValue = String(value).trim();
    const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const displayMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!displayMatch) return "";

    const day = Number(displayMatch[1]);
    const month = Number(displayMatch[2]);
    const year = Number(displayMatch[3]);
    const candidate = new Date(year, month - 1, day);

    if (
        candidate.getFullYear() !== year
        || candidate.getMonth() !== month - 1
        || candidate.getDate() !== day
    ) {
        return "";
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDate(value) {
    if (!value) return "-";
    const isoDate = toIsoDate(value);
    if (isoDate) {
        const [year, month, day] = isoDate.split("-");
        return `${day}/${month}/${year}`;
    }

    return new Date(value).toLocaleDateString("vi-VN");
}

export function formatDateInput(value) {
    if (!value) return "";
    return toIsoDate(value) ? formatDate(value) : String(value);
}

export function parseDateInput(value) {
    const rawValue = String(value ?? "");
    const digits = rawValue.replace(/\D/g, "").slice(0, 8);
    const normalizedValue = rawValue.includes("/")
        ? rawValue.replace(/[^\d/]/g, "").slice(0, 10)
        : [
            digits.slice(0, 2),
            digits.slice(2, 4),
            digits.slice(4, 8),
        ].filter(Boolean).join("/");

    return toIsoDate(normalizedValue) || normalizedValue;
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
