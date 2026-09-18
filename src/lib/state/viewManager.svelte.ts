import type { Component } from 'svelte';

type ViewChangeEventArgs = 'beforeviewchange' | 'viewchange';

export class ViewChangeEvent extends Event {
    constructor(
        type: ViewChangeEventArgs,
        public readonly from: Component | null,
        public readonly to: Component | null,
        options?: EventInit
    ) {
        super(type, options);
    }
}

export type ViewManagerEventMap = {
    [key in ViewChangeEventArgs]: ViewChangeEvent;
};

export interface ViewManagerProps {
    readonly viewManager: ViewManager;
}

export type ViewManagerComponent = Component<ViewManagerProps>;

export class ViewManager extends EventTarget {
    // The # here declares the property as "private/hidden" and requires the use of a "get" keyword to access it.
    #activeView = $state<ViewManagerComponent | null>(null);

    public get activeView() {
        return this.#activeView;
    }

    public set activeView(view: ViewManagerComponent | null) {
        const previousView = this.#activeView;
        if (previousView === view) return;

        // 1. Dispatch Before Event (cancellable)
        const beforeEvent = new ViewChangeEvent('beforeviewchange', previousView, view, { cancelable: true });
        this.dispatchEvent(beforeEvent);

        // Abort if a listener called e.preventDefault()
        if (beforeEvent.defaultPrevented) return;

        // 2. Perform state swap
        this.#activeView = view;

        // 3. Dispatch After Event
        const afterEvent = new ViewChangeEvent('viewchange', previousView, view);
        this.dispatchEvent(afterEvent);
    }

    constructor(initialView: ViewManagerComponent | null = null) {
        super();
        this.#activeView = initialView;
    }

    // Overloads for ViewManager events
    override addEventListener<K extends keyof ViewManagerEventMap>(
        type: K,
        callback: ((this: ViewManager, ev: ViewManagerEventMap[K]) => void | Promise<void>) | null,
        options?: boolean | AddEventListenerOptions
    ): void;
    override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void; // This is needed twice annoyingly.
    override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(type, callback, options);
    }

    override removeEventListener<K extends keyof ViewManagerEventMap>(
        type: K,
        callback: ((this: ViewManager, ev: ViewManagerEventMap[K]) => void | Promise<void>) | null,
        options?: boolean | EventListenerOptions
    ): void;
    override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
    override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
        super.removeEventListener(type, callback, options);
    }
}
