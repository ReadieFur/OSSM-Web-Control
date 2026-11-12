import type { ViewManager, ViewManagerProps } from "$lib/services/ViewManager.svelte";
import { isDevMode } from "$lib/utils/Helpers.svelte";
import { ESPLoader, Transport, type LoaderOptions, type FlashOptions, type FlashModeValues, type FlashFreqValues, type FlashSizeValues, type IEspLoaderTerminal, } from "esptool-js";

export type FirmwareFlasherParams = {
    readonly transport: Transport;
    readonly espLoader: ESPLoader;
};

export type FirmwareFlasherProps = ViewManagerProps & FirmwareFlasherParams;

export class FirmwareFlasher implements Disposable {
    static isSupported(): boolean {
        return "serial" in navigator;
    }

    /** To be consumed immediately by FirmwareFlasher.svelte */
    static async bootstrap(): Promise<FirmwareFlasherParams> {
        const port = await navigator.serial.requestPort({
            filters: [{
                // Silicon Labs CP210x (common driver for the esp32)
                usbVendorId: 0x10c4,
                usbProductId: 0xea60
            }]
        });

        let transport: Transport;
        let espLoader: ESPLoader;
        try {
            transport = new Transport(port, isDevMode);
            const loaderOptions: LoaderOptions = {
                transport: transport,
                baudrate: 115200,
                terminal: isDevMode ? {
                    clean: () => {},
                    writeLine: data => console.log("[Serial]", data),
                    write: data => console.log("[Serial]", data),
                } : undefined,
                debugLogging: isDevMode
            };
            espLoader = new ESPLoader(loaderOptions);
            await espLoader.main();
        } catch (err) {
            await port.close();
            throw err;
        }

        return { transport, espLoader };
    }

    constructor(private getProps: () => FirmwareFlasherProps) {
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    async dispose() {
        this.getProps().transport.disconnect();
    }
}
