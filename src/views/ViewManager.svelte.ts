import { debugLog, delay } from "$lib/utils/helpers";

export type Views = 'landing' | 'control';

export enum TransitionDirection {
    In = "in",
    Out = "out",
}

export class ViewManager {
    private currentView = $state<Views>('landing');
    private containerEl = $state<HTMLElement | null>(null);

    constructor() {
        debugLog(this);
        this.initStartup();
    }

    private async initStartup() {
        await delay(250); // Give the program time to initialize & add a small artificial stylistic delay for a smoother transition
        await transitionFade({
            direction: TransitionDirection.In,
            durationMs: 650
        })
    }

    public async setView(view: Views) {
        if (this.currentView === view) return;
        
        this.isTransitioning = true;
        // Wait for out-animation if desired, then switch view
        await new Promise((resolve) => setTimeout(resolve, 325)); 
        this.currentView = view;
        this.isTransitioning = false;
    }
}
