import { Firmwares, type FirmwaresManifest } from "$lib/assets/Firmwares";
import type { ViewManager, ViewManagerProps } from "$lib/services/ViewManager.svelte";
import { fetchWithProgress, isDevMode } from "$lib/utils/Helpers.svelte";
import { ESPLoader, Transport, type LoaderOptions, type FlashOptions, type FlashModeValues, type FlashFreqValues, type FlashSizeValues, type IEspLoaderTerminal, } from "esptool-js";
import LandingView from "./LandingView.svelte";
import { SvelteMap } from "svelte/reactivity";

export type FirmwareFlasherParams = {
    readonly transport: Transport;
    readonly espLoader: ESPLoader;
};

export type FirmwareFlasherProps = ViewManagerProps & FirmwareFlasherParams;

export class FirmwareFlasher implements Disposable {
    // #region Static helpers
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
    // #endregion

    selectedFirmware = $state("");
    eraseFlash = $state(false);
    readonly firmwaresManifest: SvelteMap<string, FirmwaresManifest[string]> = new SvelteMap();
    readonly deviceInfo: SvelteMap<string, string> = new SvelteMap();
    readonly terminalOutput: SvelteMap<number, string> = new SvelteMap();

    get props() { return this.getProps(); }
    get viewManager() { return this.getProps().viewManager; }
    get transport() { return this.getProps().transport; }
    get espLoader() { return this.getProps().espLoader; }

    constructor(private getProps: () => FirmwareFlasherProps) {
        this.#fetchDeviceInfo();
        this.#fetchManifests();
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    async dispose(): Promise<void> {
        this.transport.disconnect();
    }

    async exit(): Promise<void> {
        await this.dispose();
        this.viewManager.setViewAndProps(LandingView);
    }

    async #fetchDeviceInfo() {
        const tasks: ((() => [string, string?]) | (() => Promise<[string, string?]>))[] = [
            () => ["Chip", this.espLoader.chip.CHIP_NAME],
            async () => ["Mac", await this.espLoader.chip.readMac(this.espLoader)],
            async () => ["Flash size", await this.espLoader.detectFlashSize()],
        ];
        for (const task of tasks) {
            try {
                const [key, value] = await task();
                if (value === undefined) throw new DOMException(`Value for '${key}' was undefined`, "NotFoundError");
                this.deviceInfo.set(key, value);
                this.#log(`[Device] ${key}: ${value}`);
            } catch (err) {
                console.warn("[Device] Error while fetching device data", err);
            }
        }
    }

    async #fetchManifests(): Promise<void> {
        const manifest = await Firmwares.fetchManifest();
        if (isDevMode) console.log("Fetched firmwares: ", manifest); // This logs weirdly if I log the $state object

        // Remove old entries, leaving existing ones present as to not break active user selection
        this.firmwaresManifest.keys().forEach(k => { if (k in manifest) this.firmwaresManifest.delete(k) });

        for (const [key, value] of Object.entries(manifest)) {
            this.#log(`[Firmware] ${Firmwares.sourceToString(value.source)}`);
            this.firmwaresManifest.set(key, value);
        }

        if (this.selectedFirmware === "") this.selectedFirmware = this.firmwaresManifest.keys().next().value ?? "";
    }

    #log(text: string, id?: number): void {
        if (text.trim() === "") return;
        this.terminalOutput.set(id ?? this.#generateLogId(), text);
    }

    #generateLogId(): number {
        let timestamp: number;
        do { timestamp = performance.now(); }
        while (this.terminalOutput.has(timestamp));
        return timestamp;
    }

    async onFlashButtonClicked() {
        const sourceKey = this.selectedFirmware;
        const manifest = this.firmwaresManifest.get(this.selectedFirmware);
        if (!manifest) return;

        // Setup initial flash options, this object gets completed over the next two steps
        const flashOptions: FlashOptions & {
            // Extend the base type's fileArray property to hold additional data for our logging
            fileArray: (FlashOptions["fileArray"][number] & {
                readonly md5: string,
                readonly logId: number,
                logText: string
            })[]
        } = {
            fileArray: [],
            flashMode: manifest.flashMode,
            flashFreq: manifest.flashFreq,
            flashSize: manifest.flashSize,
            eraseAll: this.eraseFlash,
            compress: true,
            reportProgress: (fileIndex, written, total) => {
                const fileEntry = flashOptions.fileArray[fileIndex]!;
                fileEntry.logText += ` ${Math.round((written / total) * 100)}`;
                this.#log(fileEntry.logText, fileEntry.logId);                
            },
            calculateMD5Hash: (image) => {
                const fileEntry = flashOptions.fileArray.find((f): f is typeof flashOptions.fileArray[number] => f.data === image);
                if (!fileEntry) throw new DOMException("MD5 verification failed, received unknown binary", "DataError"); // Shouldn't occur
                return fileEntry.md5;
            }
        };

        // Process the selected manifest
        for (const [binary, metadata] of Object.entries(manifest.binaries)) {
            const logTag = this.#generateLogId();
            let logString = `[Download] ${binary}:`;

            // Download the binary
            const data = await fetchWithProgress(Firmwares.getBinaryUri(sourceKey, binary), (total, received) => {
                if (Number.isNaN(total)) return;
                logString += ` ${Math.round((received / total) * 100)}%`;
                this.#log(logString, logTag);
            });

            if (!logString.endsWith(" 100%")) {
                logString += " 100%";
                this.#log(logString, logTag);
            }

            // Validate the data
            if (Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>)))
                .map(b => b.toString(16).padStart(2, '0')).join('')
                != metadata.sha256
            ) throw new DOMException("The downloaded file did not match the expected checksum", "DataError");

            // Add the downloaded file to the esp file list
            flashOptions.fileArray.push({
                data,
                address: metadata.offset,
                md5: metadata.md5,
                logId: this.#generateLogId(),
                logText: `[Flash] ${binary}:`,
            });
        }

        // Flash binaries in order
        flashOptions.fileArray.sort((a, b) => a.address - b.address);

        // Flash the firmware!
        await this.espLoader.writeFlash(flashOptions);
        await this.espLoader.after("hard_reset");
    }
}
