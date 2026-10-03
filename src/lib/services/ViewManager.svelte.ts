/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Component } from 'svelte';

export interface ViewManagerProps extends Record<string, unknown> {
    readonly viewManager: ViewManager;
}

export type ViewManagerComponent<T extends ViewManagerProps = ViewManagerProps> = Component<T>;

export enum ViewChangeEventArgs {
   BeforeViewChange = "beforeviewchange",
   ViewChange = "viewchange" 
}

export class ViewChangeEvent extends Event {
    constructor(
        type: ViewChangeEventArgs,
        public readonly from: ViewManagerComponent<any> | null,
        public readonly to: ViewManagerComponent<any> | null,
        options?: EventInit
    ) {
        super(type, options);
    }
}

export type ViewManagerEventMap = {
    [key in ViewChangeEventArgs]: ViewChangeEvent;
};

export class ViewManager extends EventTarget {
    // Internal state uses <any> because a ViewManager switches between different view types over time
    #view = $state<ViewManagerComponent<any> | null>(null);
    public get view() { return this.#view; }
    public set view(view: ViewManagerComponent<any> | null) { 
        this.setViewAndProps(view, this.viewProps as any); 
    }

    #viewProps = $state<ViewManagerProps>({ viewManager: this });
    get viewProps() { return this.#viewProps; }
    set viewProps(value: Omit<ViewManagerProps, "viewManager">) {
        this.#viewProps = {
            ...value,
            viewManager: this
        }
    }

    constructor(initialView: ViewManagerComponent<any> | null = null, initialProps?: ViewManagerProps) {
        super();
        this.viewProps = initialProps ?? { viewManager: this };
        this.#view = initialView;
    }

    setViewAndProps<P extends ViewManagerProps>(view: ViewManagerComponent<P> | null, props?: P) {
        const previousView = this.#view;
        if (previousView === view) return;

        const beforeEvent = new ViewChangeEvent(ViewChangeEventArgs.BeforeViewChange, previousView, view, { cancelable: true });
        this.dispatchEvent(beforeEvent);

        // Abort if a listener called e.preventDefault()
        if (beforeEvent.defaultPrevented) return;

        this.viewProps = props ?? ({ viewManager: this } as unknown as P);
        this.#view = view;

        this.dispatchEvent(new ViewChangeEvent(ViewChangeEventArgs.ViewChange, previousView, view));
    }

    // Overloads for ViewManager events
    override addEventListener<K extends keyof ViewManagerEventMap>(
        type: K,
        callback: ((this: ViewManager, ev: ViewManagerEventMap[K]) => void | Promise<void>) | null,
        options?: boolean | AddEventListenerOptions
    ): void;
    override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
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
