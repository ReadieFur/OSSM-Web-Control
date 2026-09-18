import { delay, prefersReducedMotion } from "./Helpers.svelte.ts";
import type { TransitionConfig } from 'svelte/transition';

export async function transitionFade(element: HTMLElement | null, direction: 'in' | 'out', durationMs: number): Promise<void> {
    if (!element || prefersReducedMotion()) return;

    // Uses the CSS keyframe animation and data attributes from your styles [1]
    element.dataset.transitionFade = direction;
    element.style.setProperty("--transition-fade-duration", `${durationMs}ms`);
    element.classList.add("transition-fade");

    // Wait for the duration of the animation to complete
    await delay(durationMs);

    // Cleanup classes and properties after animation completes
    element.classList.remove("transition-fade");
    delete element.dataset.transitionFade;
    element.style.removeProperty("--transition-fade-duration");
}

export function svelteFade(
    node: HTMLElement, 
    { duration = 300, delay = 0, switching = false }: { duration?: number; delay?: number; switching?: boolean } = {}, 
    { direction }: { direction?: 'in' | 'out' | 'both' } = {}
): TransitionConfig {
    if (prefersReducedMotion())
        return { duration: 0, delay: 0 };

    let started = false;

    if (direction === 'both')
    {
        direction = node.hasAttribute("inert") ? 'out' : 'in';

        // If the transition is used for switching between nodes, then...
        if (switching) {
            // Add delay on-top of the duration for the "in" transition so that it doesn't start until the "out" transition has completed
            if (direction === 'in')
                delay += duration;
        }
    }

    if (direction === 'in' && delay > 0) {
        node.classList.add('transition-delay-hidden');
    }

    return {
        duration,
        delay,
        tick: (t, u) => {
            const hasStarted = direction === 'in' ? t > 0 : u > 0;

            // 2. Once the delay passes and animation starts, reveal it
            if (!started && hasStarted) {
                started = true;
                if (direction === 'in' && delay > 0) {
                    node.classList.remove('transition-delay-hidden');
                }
                node.classList.add("transition-fade");
                node.style.setProperty("--transition-fade-duration", `${duration}ms`);
                node.dataset.transitionFade = direction;
            }

            // 3. Cleanup on completion
            if ((direction === 'in' && t === 1) || (direction === 'out' && u === 1)) {
                node.classList.remove("transition-fade");
                node.style.removeProperty("--transition-fade-duration");
                delete node.dataset.transitionFade;
            }
        }
    };
}
