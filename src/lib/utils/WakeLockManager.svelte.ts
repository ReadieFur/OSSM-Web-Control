import { SvelteSet } from "svelte/reactivity";

class WakeLockManagerImpl {
    static #instance: WakeLockManagerImpl | null = null;
    static get instance(): WakeLockManagerImpl {
        if (!WakeLockManagerImpl.#instance)
            WakeLockManagerImpl.#instance = new WakeLockManagerImpl();
        return WakeLockManagerImpl.#instance;
    }

    #isAcquired = $state(false);
    #handles = new SvelteSet<number>();
    #wakeLock: WakeLockSentinel | null = null;

    constructor() {
        // This effect lives independently of it's callers lifecycle
        $effect.root(() => {
            // React to when the number of handles change
            $effect(() => {
                if (this.#handles.size > 0)
                    this.#requestWakeLock();
                else
                    this.#releaseHardwareLock();
            });

            $effect(() => {
                const onVisibilityChange = () => {
                    if (document.visibilityState === "visible" && this.#handles.size > 0 && !this.#wakeLock) {
                        this.#requestWakeLock();
                    }
                };

                document.addEventListener("visibilitychange", onVisibilityChange);

                return () => {
                    document.removeEventListener("visibilitychange", onVisibilityChange);
                    this.#releaseHardwareLock();
                };
            });
            
        });
    }

    get isAcquired(): boolean {
        return this.#isAcquired;
    }

    acquire(): number {
        let id: number;
        do { id = crypto.getRandomValues(new Uint32Array(1))[0]; }
        while (this.#handles.has(id));
        this.#handles.add(id);
        return id;
    }

    release(handle: number): void {
        this.#handles.delete(handle);
    }

    async #requestWakeLock(): Promise<void> {
        if (!("wakeLock" in navigator) || this.#wakeLock) return;
        
        try {
            this.#wakeLock = await navigator.wakeLock.request("screen");
            this.#isAcquired = true;

            this.#wakeLock.addEventListener("release", () => {
                this.#wakeLock = null;
                this.#isAcquired = false;
            }, { once: true });
        } catch (err) {
            console.warn("[WakeLockManager] Failed to acquire screen lock:", err);
            this.#isAcquired = false;
        }
    }

    async #releaseHardwareLock(): Promise<void> {
        if (this.#wakeLock) {
            await this.#wakeLock.release().catch(() => {});
            this.#wakeLock = null;
        }
        this.#isAcquired = false;
    }
}

// Singleton instance
export const WakeLockManager = WakeLockManagerImpl.instance;

// Svelte component lifecycle bound instance
export class SvelteWakeLockSentinel implements Disposable {
    #handle: number | null = null;

    constructor() {
        // Acquire the handle immediately upon instantiation
        this.#handle = WakeLockManager.acquire();

        $effect(() => {
            return () => this.dispose();
        });
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    dispose(): void {
        if (this.#handle !== null) {
            WakeLockManager.release(this.#handle);
            this.#handle = null;
        }
    }
}
