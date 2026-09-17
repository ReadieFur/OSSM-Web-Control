import { delay, prefersReducedMotion } from "./helpers";

export enum TransitionDirection {
    In = "in",
    Out = "out",
}

export async function transitionFade(element: HTMLElement | null, direction: TransitionDirection, durationMs: number): Promise<void> {
    if (!element || prefersReducedMotion()) return;

    // Uses the CSS keyframe animation and data attributes from your styles [1]
    element.classList.add("transition-fade");
    element.dataset.transitionFade = direction;
    element.style.setProperty("--transition-fade-duration", `${durationMs}ms`);

    // Wait for the duration of the animation to complete
    await delay(durationMs);

    // Cleanup classes and properties after animation completes
    element.classList.remove("transition-fade");
    delete element.dataset.transitionFade;
    element.style.removeProperty("--transition-fade-duration");
}
