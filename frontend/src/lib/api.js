const rawBaseUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = rawBaseUrl || "/api";

export function buildApiUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}