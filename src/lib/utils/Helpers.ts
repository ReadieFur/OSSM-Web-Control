export const isDevMode =
    import.meta.env.DEV ||
    import.meta.env.VITE_DEBUG_LOGGING ||
    window.location.hostname === "localhost" ||
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname) ||
    new URLSearchParams(window.location.search).has("dev");

export async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function debugLog(...args: any[]): void {
    if (isDevMode) {
        console.log(`[DEBUG]`, ...args);
    }
}

export function prefersReducedMotion(): boolean {
    return typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export enum DOMExceptionError {
    InvalidState = "InvalidStateError",
    NetworkError = "NetworkError",
    Timeout = "TimeoutError",
    TypeError = "TypeError",
    OperationError = "OperationError",
    DataError = "DataError",
    AbortError = "AbortError",
    NotFoundError = "NotFoundError",
}
