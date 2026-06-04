export function displayCode(entity, codeField, prefix, idField = "id") {
    if (entity?.[codeField]) return entity[codeField];
    const value = entity?.[idField];
    return prefix && value ? `${prefix}${String(value).padStart(3, "0")}` : "-";
}

export function formatCode(prefix, value) {
    return prefix && value ? `${prefix}${String(value).padStart(3, "0")}` : "-";
}
