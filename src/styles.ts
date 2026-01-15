// Attach to window to allow global usage and avoid multiple injections
type WindowWithStyles = Window & typeof globalThis & {
    StylesScript?: typeof StylesScript;
};

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
        direction: "in" | "out" | "both";
        duration: number | {
            in?: number;
            out?: number;
            delay?: number;
        };
        addedClasses?: string[];
        removedClasses?: string[];
    }): Promise<void> {
        const isDirectionBoth = data.direction === "both";

        let parsedDuration: { in?: number; out?: number; delay?: number; };
        if (typeof data.duration === "number") {
            const durationTemp = isDirectionBoth ? data.duration / 2 : data.duration;
            parsedDuration = {
                in: durationTemp,
                out: durationTemp,
            };
        }
        else {
            parsedDuration = data.duration;
        }

        const modifyClasses = () => {
            if (data.removedClasses)
                data.element.classList.remove(...data.removedClasses);

            if (data.addedClasses)
                data.element.classList.add(...data.addedClasses);
        };

        const transitionOut = async () => {
            if (parsedDuration.out === undefined)
                throw new Error("Transition out duration is not defined.");

            data.element.classList.add("transition-fade");
            data.element.dataset.transitionFade = "out";
            data.element.style.setProperty("--transition-fade-duration", `${parsedDuration.out}ms`);

            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    data.element.style.removeProperty("--transition-fade-duration");
                    resolve();
                }, parsedDuration.out);
            });
        };

        const transitionIn = async () => {
            if (parsedDuration.in === undefined)
                throw new Error("Transition in duration is not defined.");

            data.element.classList.add("transition-fade");
            data.element.dataset.transitionFade = "in";
            data.element.style.setProperty("--transition-fade-duration", `${parsedDuration.in}ms`);

            await new Promise<void>((resolve) => {
                // data.element.addEventListener("transitionend", () => {
                setTimeout(() => {
                    data.element.classList.remove("transition-fade");
                    delete data.element.dataset.transitionFade;
                    data.element.style.removeProperty("--transition-fade-duration");
                    resolve();
                // }, { once: true });
                }, parsedDuration.in);
            });
        };

        if (data.direction === "in") {
            modifyClasses();
            await transitionIn();
        } else if (data.direction === "out") {
            modifyClasses();
            await transitionOut();
        } else if (isDirectionBoth) {
            // transitionend event is not reliable in this context since the events fire eso close together they can trigger the animation to end prematurely
            // Using setTimeout instead and setting the duration property in script
            await transitionOut();
            modifyClasses();
            if (parsedDuration.delay)
                await new Promise<void>((resolve) => setTimeout(() => resolve(), parsedDuration.delay));
            await transitionIn();
        }
    }
}

class StylesScriptPrivate {
    static inputTypeNumber(numberElement: HTMLInputElement) {
        numberElement.dataset.styled = "true";

        const container = document.createElement("span");
        container.classList.add("number-input-container");
            
        const downButton = document.createElement("button");
        downButton.type = "button";
        downButton.innerHTML = "&#8722;"; // Minus sign
        downButton.addEventListener("click", () => {
            numberElement.stepDown();
            numberElement.dispatchEvent(new Event("input", { bubbles: true }));
        });

        const upButton = document.createElement("button");
        upButton.type = "button";
        upButton.innerHTML = "&#43;"; // Plus sign
        upButton.addEventListener("click", () => {
            numberElement.stepUp();
            numberElement.dispatchEvent(new Event("input", { bubbles: true }));
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

    static inputTypeRangeOld(rangeElement: HTMLInputElement) {
        rangeElement.dataset.styled = "true";

        const container = document.createElement("span");
        container.classList.add("range-input-container");

        const wrapObserver = StylesScript.wrapElement(rangeElement, container);

        const updateValue = () => {
            const valuePercent = ((Number(rangeElement.value) - Number(rangeElement.min)) / (Number(rangeElement.max) - Number(rangeElement.min))) * 100;
            rangeElement.style.setProperty("--value", `${valuePercent}%`);
        }
        rangeElement.addEventListener("input", updateValue);
        updateValue();

        let resizeObserver: ResizeObserver;
        const resizeCallback = () => {
            resizeObserver.disconnect();

            if (rangeElement.getAttribute("orientation") === "vertical") {
                const width = rangeElement.offsetWidth;
                const height = rangeElement.offsetHeight;

                // Check if the thumb is larger than the track thickness
                const thumbSize = parseFloat(getComputedStyle(rangeElement).getPropertyValue("--thumb-size"));
                const trackThickness = parseFloat(getComputedStyle(rangeElement).getPropertyValue("--track-thickness"));

                console.log(rangeElement.getBoundingClientRect());
                console.table({width, height, thumbSize, trackThickness});

                container.style.setProperty("--range-width", `${rangeElement.offsetWidth}px`);
                container.style.setProperty("--range-height", `${rangeElement.offsetHeight}px`);
            } else {
                container.style.removeProperty("--range-width");
                container.style.removeProperty("--range-height");
            }

            // resizeObserver.observe(rangeElement);
        }
        resizeObserver = new ResizeObserver(resizeCallback);
        resizeCallback();
    }

    static inputTypeRange(rangeElement: HTMLInputElement) {
        rangeElement.dataset.styled = "true";

        // const container = document.createElement("span");
        // container.classList.add("range-input-container");
        // wrapElement(rangeElement, container);

        const updateValue = () => {
            const valuePercent = ((Number(rangeElement.value) - Number(rangeElement.min)) / (Number(rangeElement.max) - Number(rangeElement.min))) * 100;
            rangeElement.style.setProperty("--range-value", `${valuePercent}%`);
        };
        rangeElement.addEventListener("input", updateValue);
        updateValue();
    }
}

function processNode(node: HTMLElement) {
    if (node.dataset.styled === "true")
        return;

    if (node.dataset.no_style !== undefined) {
        delete node.dataset.no_style;
        node.dataset.styled = "false";
        return;
    }

    if (node instanceof HTMLInputElement) {
        const input = node as HTMLInputElement;
        switch (input.type) {
            case "number":
                StylesScriptPrivate.inputTypeNumber(input);
                break;
            case "range":
                StylesScriptPrivate.inputTypeRange(input);
                break;
            default:
                break;
        }
    }
}

if (!(window as WindowWithStyles).StylesScript) {
    (window as WindowWithStyles).StylesScript = StylesScript;

    // Watch for element creations
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations)
            for (const node of mutation.addedNodes)
                if (node instanceof HTMLElement)
                    processNode(node);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Process all existing elements
    document.addEventListener("DOMContentLoaded", () => {
        for (const element of document.querySelectorAll<HTMLElement>("*"))
            processNode(element);
    });
}
