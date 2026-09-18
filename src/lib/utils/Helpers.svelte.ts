export const isDevMode = Boolean(
    import.meta.env?.DEV ||
    import.meta.env?.VITE_DEBUG_LOGGING ||
    globalThis.location?.hostname === "localhost" ||
    (globalThis.location?.hostname && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(globalThis.location.hostname)) ||
    (globalThis.location?.search && new URLSearchParams(globalThis.location.search).has("dev"))
);

export async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function debugLog(...args: unknown[]): void {
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

export function mediaQuery(query: string) {
    let matches = $state(false);

    $effect(() => {
        const media = window.matchMedia(query);
        matches = media.matches;

        const onChange = (e: MediaQueryListEvent) => { matches = e.matches; };

        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    });

    return {
        get matches() {
            return matches;
        }
    };
}
