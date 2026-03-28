import { buildApiUrl } from "./api";

export async function fetchJson(authToken, path, options = {}) {
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

    if (response.status === 204) return null;
    return response.json();
}
