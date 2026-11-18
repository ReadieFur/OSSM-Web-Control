import { CancellationToken, type ICancellationToken } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { SvelteURLSearchParams } from "svelte/reactivity";

export const isDevMode = Boolean(
    import.meta.env?.DEV ||
    import.meta.env?.VITE_DEBUG_LOGGING ||
    globalThis.location?.hostname === "localhost" ||
    (globalThis.location?.hostname && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(globalThis.location.hostname)) ||
    (globalThis.location?.search && new SvelteURLSearchParams(globalThis.location.search).has("dev"))
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

export function mediaQuery(query: string) {
    let matches = $state(false);

    $effect(() => {
        const media = window.matchMedia(query);
        matches = media.matches;

        const onChange = (e: MediaQueryListEvent) => { matches = e.matches; };

        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    });

    return {
        get matches() {
            return matches;
        }
    };
}

export type ResolveReject<T = unknown> = {
    resolve: [T] extends [unknown] ? (value?: T) => void : (value: T) => void;
    reject: (reason?: Error) => void;
};

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export async function *streamedFetch(
    url: string,
    onProgress: (((total: number, received: number) => void) | undefined) = undefined,
    cancellationToken: ICancellationToken = CancellationToken.None
): AsyncGenerator<Uint8Array, void, unknown> {
    const response = await fetch(url); // Only initiates the request, doesn't actually wait for all data to be received
    if (!response.ok) throw new DOMException(`HTTP error: ${response.status}`, "NetworkError");

    const reader = response.body?.getReader();
    if (!reader) throw new DOMException("Response body reader not available", "NetworkError");

    const contentLength = response.headers.has("content-length") ? parseInt(response.headers.get("content-length")!, 10) : Number.NaN;
    let receivedLength = 0;

    try {
        while (true) {
            cancellationToken.throwIfCancellationRequested();
    
            const { done, value } = await reader.read();
            if (done) break;
    
            yield value;
            receivedLength += value.length;
    
            if (onProgress) {
                try { onProgress(contentLength, receivedLength); }
                catch { /* Ignore */ }
            }
        }
    } catch (error) {
        await reader.cancel();
        throw error;
    }
}

export async function fetchWithProgress(...args: Parameters<typeof streamedFetch>): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    // Fetch chunks
    for await (const chunk of streamedFetch(...args)) {
        chunks.push(chunk);
        totalLength += chunk.length;
    }

    // Combine all chunks into one
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}
