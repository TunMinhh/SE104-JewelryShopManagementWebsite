import { useRef } from "react";
import { formatDateInput, parseDateInput, toIsoDate } from "../lib/formatters";

function DateInput({ value, onChange, disabled = false, className = "" }) {
    const pickerRef = useRef(null);
    const isoValue = toIsoDate(value);

    const openPicker = () => {
        const picker = pickerRef.current;
        if (!picker || disabled) return;

        if (typeof picker.showPicker === "function") {
            picker.showPicker();
            return;
        }

        picker.focus();
        picker.click();
    };

    return (
        <div className="relative">
            <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/yyyy"
                value={formatDateInput(value)}
                onChange={(event) => onChange(parseDateInput(event.target.value))}
                disabled={disabled}
                className={`${className} pr-11`}
            />
            <input
                ref={pickerRef}
                type="date"
                value={isoValue}
                onChange={(event) => onChange(event.target.value)}
                tabIndex={-1}
                className="pointer-events-none absolute right-0 top-0 h-full w-12 opacity-0"
            />
            <button
                type="button"
                aria-label="Chọn ngày"
                title="Chọn ngày"
                onClick={openPicker}
                disabled={disabled}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M7 2v3M17 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
        </div>
    );
}

export default DateInput;
