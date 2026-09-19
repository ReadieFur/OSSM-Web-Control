import type { Component } from 'svelte';

type ViewChangeEventArgs = 'beforeviewchange' | 'viewchange';

export interface ViewManagerProps extends Record<string, unknown> {
    readonly viewManager: ViewManager;
}

export class ViewChangeEvent extends Event {
    constructor(
        type: ViewChangeEventArgs,
        public readonly from: Component<ViewManagerProps> | null,
        public readonly to: Component<ViewManagerProps> | null,
        options?: EventInit
    ) {
        super(type, options);
    }
}

export type ViewManagerEventMap = {
    [key in ViewChangeEventArgs]: ViewChangeEvent;
};

export type ViewManagerComponent = Component<ViewManagerProps>;

export class ViewManager extends EventTarget {
    // The # here declares the property as "private/hidden" and requires the use of a "get" keyword to access it.
    #view = $state<ViewManagerComponent | null>(null);
    public get view() { return this.#view; }
    public set view(view: ViewManagerComponent | null) { this.setViewAndProps(view, this.viewProps); } // Maintain the same props when changing views (unless explicitly overridden)

    viewProps = $state<Record<string, unknown>>({});

    public setViewAndProps(view: ViewManagerComponent | null, props?: Record<string, unknown>) {
        const previousView = this.#view;
        if (previousView === view) return;

        const beforeEvent = new ViewChangeEvent('beforeviewchange', previousView, view, { cancelable: true });
        this.dispatchEvent(beforeEvent);

        // Abort if a listener called e.preventDefault()
        if (beforeEvent.defaultPrevented) return;

        this.viewProps = props ?? {};
        this.#view = view;

        this.dispatchEvent(new ViewChangeEvent('viewchange', previousView, view));
    }

    constructor(initialView: ViewManagerComponent | null = null, initialProps?: Record<string, unknown>) {
        super();
        this.viewProps = initialProps ?? {};
        this.#view = initialView;
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
