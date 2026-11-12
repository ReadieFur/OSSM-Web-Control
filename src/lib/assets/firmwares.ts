import { ESPLoader, Transport, type LoaderOptions, type FlashOptions, type FlashModeValues, type FlashFreqValues, type FlashSizeValues, type IEspLoaderTerminal, } from "esptool-js";
import _firmwaresJson from "$lib/assets/firmwares.json";

export const firmwares = _firmwaresJson satisfies Record<string, string>;
