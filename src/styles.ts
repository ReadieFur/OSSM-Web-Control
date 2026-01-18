// Attach to window to allow global usage and avoid multiple injections
type WindowWithStyles = Window & typeof globalThis & {
    StylesScript?: typeof StylesScript;
    __inputRangeDoubleInstances?: Map<HTMLElement, InputRangeDouble>;
};
const windowWithStyles = window as WindowWithStyles;

export enum TransitionDirection {
    In = "in",
    Out = "out",
}

export enum InfoContainerState {
    Success = "success",
    Error = "error",
    Warning = "warning",
}

export class InputRangeDouble {
    private static getInstances() {
        if (!windowWithStyles.__inputRangeDoubleInstances)
            windowWithStyles.__inputRangeDoubleInstances = new Map<HTMLElement, InputRangeDouble>();
        return windowWithStyles.__inputRangeDoubleInstances;
    };
    
    static getInstance(container: HTMLElement): InputRangeDouble | undefined {
        return InputRangeDouble.getInstances().get(container);
    }

    static getOrCreateInstance(container: HTMLElement, data?: {
        min?: number;
        max?: number;
        from?: number;
        to?: number;
        step?: number;
    }): InputRangeDouble {
        let instance = InputRangeDouble.getInstances().get(container);
        if (instance)
            return instance;
        return this.createInstance(container, data);
    }

    static createInstance(
        container: HTMLElement,
        data?: {
            min?: number;
            max?: number;
            from?: number;
            to?: number;
            step?: number;
        }
    ): InputRangeDouble {
        if (InputRangeDouble.getInstances().has(container))
            throw new Error("InputRangeDouble instance already exists for this container");

        container.classList.add("input-container-range-double");

        const fromInput = document.createElement("input");
        fromInput.type = "range";
        fromInput.dataset.component = "from";

        const toInput = document.createElement("input");
        toInput.type = "range";
        toInput.dataset.component = "to";

        container.appendChild(fromInput);
        container.appendChild(toInput);

        const instance = new InputRangeDouble(container);
        instance.setMinMax({
            min: data?.min ?? 0,
            max: data?.max ?? 100
        });
        instance.setValues({
            from: data?.from ?? data?.min ?? 0,
            to: data?.to ?? data?.max ?? 100
        });
        instance.setStep(data?.step ?? 1);

        return instance;
    }

    static removeInstance(container: HTMLElement): void {
        const instance = InputRangeDouble.getInstances().get(container);
        if (instance)
            instance.dispose();
    }
    
    //Based on: https://troll-winner.com/blog/one-more-dual-range-slider
    private readonly containerObserver = new MutationObserver(this.onContainerMutated.bind(this));
    private readonly fromSlider: HTMLInputElement;
    private readonly toSlider: HTMLInputElement;
    private readonly externalCallbacks: Map<string, Array<(sender?: any) => void>> = new Map();

    constructor(
        private readonly container: HTMLElement
    ){
        if (InputRangeDouble.getInstances().has(container))
            throw new Error("InputRangeDouble instance already exists for this container");

        if (!container.classList.contains("input-container-range-double"))
            throw new Error("Container element does not have the required class 'input-container-range-double'");

        const fromSlider = container.querySelector<HTMLInputElement>("input[type='range'][data-component='from']");
        const toSlider = container.querySelector<HTMLInputElement>("input[type='range'][data-component='to']");
        if (!fromSlider || !toSlider)
            throw new Error("InputRangeDouble: Could not find required range input elements");

        InputRangeDouble.getInstances().set(container, this);

        this.fromSlider = fromSlider;
        this.toSlider = toSlider;

        this.containerObserver.observe(document.body, { attributes: false, childList: true, subtree: true });
        this.bindEvents();

        this.updateStyles();
    }

    private dispose(): void {
        this.containerObserver.disconnect();
        InputRangeDouble.removeInstance(this.container);
        this.unbindEvents();
    }

    private onContainerMutated(mutations: MutationRecord[]): void {
        // Detect if the container has been deleted.

        let removed = false;

        for (const mutation of mutations) {
            for (const removedNode of mutation.removedNodes) {
                if (removedNode === this.container) {
                    removed = true;
                    break;
                }
            }

            // Currently not watching for attribute changes, but leaving this here for future reference
            // if (mutation.target === this.container && mutation.type === "attributes" && mutation.attributeName === "class") {
            //     if (!this.container.classList.contains("input-container-range-double")) {
            //         removed = true;
            //         break;
            //     }
            // }
        }

        if (removed)
            this.dispose();
    }

    private bindEvents(): void {
        this.fromSlider.addEventListener("input", this.onMinSliderInput.bind(this));
        this.fromSlider.addEventListener("change", this.onMinSliderChange.bind(this));
        this.toSlider.addEventListener("input", this.onMaxSliderInput.bind(this));
        this.toSlider.addEventListener("change", this.onMaxSliderChange.bind(this));
    }

    private unbindEvents(): void {
        this.fromSlider.removeEventListener("input", this.onMinSliderInput.bind(this));
        this.fromSlider.removeEventListener("change", this.onMinSliderChange.bind(this));
        this.toSlider.removeEventListener("input", this.onMaxSliderInput.bind(this));
        this.toSlider.removeEventListener("change", this.onMaxSliderChange.bind(this));
    }

    private onMinSliderInput(): void {
        const values = this.getValues();
        if (values.from > values.to)
            this.fromSlider.value = values.to.toString();

        this.updateStyles();
        
        this.dispatchEvent("input", this.fromSlider);
    }

    private onMaxSliderInput(): void {
        const values = this.getValues();
        if (values.from > values.to)
            this.toSlider.value = values.from.toString();
        
        this.updateStyles();

        this.dispatchEvent("input", this.toSlider);
    }

    private onMinSliderChange(): void {
        this.dispatchEvent("change", this.fromSlider);
    }
    
    private onMaxSliderChange(): void {
        this.dispatchEvent("change", this.toSlider);
    }

    private updateStyles(): void {
        const values = this.getValues();
        const toMinMax = {
            min: Number(this.toSlider.min),
            max: Number(this.toSlider.max),
        };
        const fromMinMax = {
            min: Number(this.fromSlider.min),
            max: Number(this.fromSlider.max),
        };

        const rangeDistance = toMinMax.max - toMinMax.min;
        const fromPositionPercent = (values.from - toMinMax.min) / rangeDistance * 100;
        const toPositionPercent = (values.to - toMinMax.min) / rangeDistance * 100;

        this.container.style.setProperty("--range-from-value", `${fromPositionPercent}%`);
        this.container.style.setProperty("--range-to-value", `${toPositionPercent}%`);
    }

    private dispatchEvent(event: "input" | "change", sender?: any): void {
        const callbacks = this.externalCallbacks.get(event);
        if (!callbacks)
            return;
        for (const callback of callbacks)
            callback(sender);
    }

    getValues(): { from: number; to: number } {
        return {
            from: Number(this.fromSlider.value),
            to: Number(this.toSlider.value),
        };
    }

    setValues(data: { from?: number; to?: number }): void {
        // Validate values
        const min = Number(this.fromSlider.min);
        const max = Number(this.fromSlider.max);
        if (data.from !== undefined && data.from < min)
            throw new Error(`From value ${data.from} is less than minimum value ${min}`);
        if (data.to !== undefined && data.to > max)
            throw new Error(`To value ${data.to} is greater than maximum value ${max}`);

        // Avoid unnecessary updates
        const oldValues = this.getValues();
        if (oldValues.from === data.from && oldValues.to === data.to)
            return;

        if (data.from !== undefined && oldValues.from !== data.from)
            this.fromSlider.value = data.from.toString();
        if (data.to !== undefined && oldValues.to !== data.to)
            this.toSlider.value = data.to.toString();

        this.updateStyles();

        this.dispatchEvent("input", this);
        this.dispatchEvent("change", this);
    }

    getMinMax(): { min: number; max: number } {
        return {
            min: Number(this.fromSlider.min),
            max: Number(this.fromSlider.max),
        };
    }

    setMinMax(data: { min?: number, max?: number }): void {
        // Set bounds
        if (data.min !== undefined) {
            this.fromSlider.min = data.min.toString();
            this.toSlider.min = data.min.toString();
        }
        if (data.max !== undefined) {
            this.fromSlider.max = data.max.toString();
            this.toSlider.max = data.max.toString();
        }

        // Keep current values within new bounds
        const values = this.getValues();
        const newFrom = Math.max(data?.min ?? values.from, Math.min(values.from, data?.max ?? values.from));
        const newTo = Math.max(data?.min ?? values.to, Math.min(values.to, data?.max ?? values.to));

        if (newFrom === values.from && newTo === values.to)
            return;

        this.setValues({ from: newFrom, to: newTo });
    }

    getStep(): number {
        return Number(this.fromSlider.step);
    }

    setStep(step: number): void {
        this.fromSlider.step = step.toString();
        this.toSlider.step = step.toString();
    }

    addEventListener(event: "input" | "change", callback: (sender?: any) => PromiseLike<void> | void): void {
        if (!this.externalCallbacks.has(event))
            this.externalCallbacks.set(event, []);
        this.externalCallbacks.get(event)?.push(callback);
    }

    removeEventListener(event: "input" | "change", callback: (sender?: any) => PromiseLike<void> | void): void {
        const callbacks = this.externalCallbacks.get(event);
        if (!callbacks)
            return;
        const index = callbacks.indexOf(callback);
        if (index !== -1)
            callbacks.splice(index, 1);
    }
}

export class StylesScript {
    static wrapElement(element: HTMLElement, container: HTMLElement, movedCallback?: () => void): MutationObserver {
        if (element.parentNode === null)
            throw new Error("Element has no parent node to wrap within container.");
        else if (element === container)
            throw new Error("Element cannot be wrapped inside itself.");

        if (element.parentNode !== container) {
            element.parentNode?.insertBefore(container, element);
            container.appendChild(element);
        }

        /* Observe for changes for the following:
        * Input moved: Move container to new parent and place input back inside container
        * Input deleted: Remove container
        */ 
        const treeObserver = new MutationObserver((mutations) => {
            /* Mutation will fire again when if we make any changes here.
            * We can't use a boolean to check against since the mutation is queued as soon as any change is made.
            * Meaning once this method completes and sets the check bool to false again, this callback will be triggered again.
            * So the solution is to unregister this callback first (disconnect the observer), make changes, then re-register it.
            */
            treeObserver.disconnect();

            /* The order that these events are fired is not guaranteed:
            * If moved: A removed event will still occur so check for moved first after scanning mutations
            * If deleted: Only a removed event will occur
            */
            let moved = false;
            let deleted = false;
            for (const mutation of mutations) {
                for (const node of mutation.removedNodes)
                    if (node === element)
                        deleted = true;

                for (const node of mutation.addedNodes)
                    if (node === element)
                        moved = true;
            }

            if (moved) {
                /* Sanity check to avoid throwing error: Make sure inputElement is not already inside container
                * Though through my my testing and validation of how this has been programmed, this should not occur
                */
                if (element.parentNode !== container) {
                    container.remove();
                    element.parentNode?.insertBefore(container, element);
                    if (movedCallback)
                        movedCallback();
                }
            } else if (deleted) {
                /* If the element has been moved but using a call to removeChild and then potentially a call to appendChild later,
                * we won't have a way of detecting that.
                * So instead we will remove the element.dataset.styled property to allow re-styling if it is added back later
                * This works because we still hold a reference to the original element,
                * if the element is truly deleted then it will be dereferenced after this function ends and GC occurs.
                */
                delete element.dataset.styled;
                container.remove();
                return;
            }

            // Reconnect observer
            treeObserver.observe(document.body, { childList: true, subtree: true });
        });

        treeObserver.observe(document.body, { childList: true, subtree: true });
        return treeObserver;
    }

    static async transitionFade(data: {
        element: HTMLElement;
        direction: TransitionDirection;
        durationMs: number;
    }): Promise<void> {
        data.element.classList.add("transition-fade");
        data.element.dataset.transitionFade = data.direction;
        data.element.style.setProperty("--transition-fade-duration", `${data.durationMs}ms`);

        await new Promise<void>((resolve) => setTimeout(resolve, data.durationMs));

        data.element.classList.remove("transition-fade");
        delete data.element.dataset.transitionFade;
        data.element.style.removeProperty("--transition-fade-duration");
    }

    static createInfoContainer(data?: {
        state?: InfoContainerState,
        title?: string,
        message?: string,
        extraContent?: HTMLElement | string,
    }): HTMLElement {
        const container = document.createElement("div");
        container.classList.add("info-container");
        if (data?.state)
            container.dataset.state = data.state;

        if (data?.title) {
            const titleElement = document.createElement("p");
            const strongElement = document.createElement("strong");
            strongElement.textContent = data.title;
            titleElement.appendChild(strongElement);
            container.appendChild(titleElement);
        }

        if (data?.message) {
            const messageElement = document.createElement("p");
            messageElement.textContent = data.message;
            container.appendChild(messageElement);
        }

        if (data?.extraContent instanceof HTMLElement) {
            container.appendChild(data.extraContent);
        }
        else if (typeof data?.extraContent === "string") {
            // Assume HTML string
            const extraContentElement = document.createElement("span");
            extraContentElement.innerHTML = data.extraContent;
            container.appendChild(extraContentElement);
        }

        return container;
    }
}

class StylesScriptAuto {
    static initialize(): void {
        // Watch for element creations
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations)
                for (const node of mutation.addedNodes)
                    if (node instanceof HTMLElement)
                        StylesScriptAuto.processNode(node);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Process all existing elements
        document.addEventListener("DOMContentLoaded", () => {
            for (const element of document.querySelectorAll<HTMLElement>("*"))
                StylesScriptAuto.processNode(element);
        });
    }

    static processNode(element: HTMLElement): void {
        if (element.dataset.styled != undefined)
            return;

        if (element.dataset.no_style !== undefined) {
            delete element.dataset.no_style;
            element.dataset.styled = "false";
            return;
        }

        if (element instanceof HTMLInputElement) {
            const input = element as HTMLInputElement;
            switch (input.type) {
                case "number":
                    StylesScriptAuto.inputTypeNumber(input);
                    break;
                case "range":
                    StylesScriptAuto.inputTypeRange(input);
                    break;
                case "text":
                case "password":
                case "email":
                    // StylesScriptAuto.inputTypeText(input);
                    break;
                default:
                    break;
            }
        } else if (element.classList.contains("input-container-range-double")) {
            StylesScriptAuto.inputTypeRangeDouble(element);
        }
    }

    static inputTypeNumber(numberElement: HTMLInputElement): void {
        numberElement.dataset.styled = "true";

        const container = document.createElement("div");
        container.classList.add("input-container-number");
            
        const downButton = document.createElement("button");
        downButton.type = "button";
        downButton.innerHTML = "&#8722;"; // Minus sign
        downButton.addEventListener("click", () => {
            numberElement.stepDown();
            numberElement.dispatchEvent(new Event("input", { bubbles: true }));
            // Since clicking a button is a one-time action (i.e. instantly unfocused) fire the "change" event too.
            numberElement.dispatchEvent(new Event("change", { bubbles: true }));
        });

        const upButton = document.createElement("button");
        upButton.type = "button";
        upButton.innerHTML = "&#43;"; // Plus sign
        upButton.addEventListener("click", () => {
            numberElement.stepUp();
            numberElement.dispatchEvent(new Event("input", { bubbles: true }));
            numberElement.dispatchEvent(new Event("change", { bubbles: true }));
        });

        const reorderElements = () => {
            for (const node of container.childNodes) {
                if (node === numberElement)
                    container.removeChild(node);
                else if (node === upButton)
                    container.removeChild(node);
                else if (node === downButton)
                    container.removeChild(node);
            }

            if (numberElement.classList.contains("spin-left")) {
                container.appendChild(downButton);
                container.appendChild(upButton);
                container.appendChild(numberElement);
            } else if (numberElement.classList.contains("spin-right")) {
                container.appendChild(numberElement);
                container.appendChild(downButton);
                container.appendChild(upButton);
            } else if (numberElement.classList.contains("spin-split")) {
                container.appendChild(downButton);
                container.appendChild(numberElement);
                container.appendChild(upButton);
            } else {
                container.appendChild(numberElement);
            }
        };

        const wrapObserver = StylesScript.wrapElement(numberElement, container, reorderElements);

        // Observe for attribute changes on the input element (class and disabled)
        const attributeObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.target === numberElement && mutation.type === "attributes") {
                    if (mutation.attributeName === "class") {
                        // Wrap observer must be disconnected here as reorderElements modifies the DOM
                        wrapObserver.disconnect();
                        reorderElements();
                        wrapObserver.observe(document.body, { childList: true, subtree: true });
                    } else if (mutation.attributeName === "disabled") {
                        const disabled = numberElement.disabled;
                        upButton.disabled = disabled;
                        downButton.disabled = disabled;
                    }
                }
            }
        });
        attributeObserver.observe(numberElement, { attributes: true });

        reorderElements();
    }

    static inputTypeRange(rangeElement: HTMLInputElement): void {
        // Ignore if the range is a double range (handled elsewhere)
        if (rangeElement.parentElement?.classList.contains("input-container-range-double")) {
            rangeElement.dataset.styled = "false";
            return;
        }

        rangeElement.dataset.styled = "true";

        // const onResize = () => {
        //     if (!rangeElement.isConnected)
        //         return;

        //     let thickness = 0;
        //     if (rangeElement.getAttribute("orientation") === "vertical")
        //         // Get computed height
        //         thickness = rangeElement.clientHeight;
        //     else
        //         thickness = rangeElement.clientWidth;

        //     rangeElement.style.setProperty("--range-track-thickness", `${thickness}px`);
        // };
        // new ResizeObserver(onResize).observe(rangeElement);

        // const container = document.createElement("div");
        // container.classList.add("input-container-range");
        // StylesScript.wrapElement(rangeElement, container);

        const updateValue = () => {
            const valuePercent = ((Number(rangeElement.value) - Number(rangeElement.min)) / (Number(rangeElement.max) - Number(rangeElement.min))) * 100;
            rangeElement.style.setProperty("--range-value", `${valuePercent}%`);
        };
        rangeElement.addEventListener("input", updateValue);
        updateValue();
    }

    static inputTypeRangeDouble(container: HTMLElement): void {
        try {
            let min = container.hasAttribute("min") ? Number(container.getAttribute("min")) : undefined;
            let max = container.hasAttribute("max") ? Number(container.getAttribute("max")) : undefined;
            let from = container.hasAttribute("from") ? Number(container.getAttribute("from")) : undefined;
            let to = container.hasAttribute("to") ? Number(container.getAttribute("to")) : undefined;
            InputRangeDouble.getOrCreateInstance(container, {
                min: min,
                max: max,
                from: from,
                to: to,
            });
        } catch (error) {
            console.error(error);
        }
    }

    static inputTypeText(textElement: HTMLInputElement): void {
        textElement.dataset.styled = "true";
        const container = document.createElement("div");
        container.classList.add("input-container-text");
        StylesScript.wrapElement(textElement, container);
    }
}

if (!windowWithStyles.StylesScript) {
    windowWithStyles.StylesScript = StylesScript;
    StylesScriptAuto.initialize();
}
