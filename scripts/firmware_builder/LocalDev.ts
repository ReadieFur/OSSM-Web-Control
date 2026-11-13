import * as FS from "fs";
import * as OS from "os";
import path from "path";
import { main as diffChecker } from "./DiffChecker.js";
import { compileFirmware } from "./CompileFirmware.js";

async function main(): Promise<void> {
    const emulatedGitHubOutputPath = path.join(OS.tmpdir(),`${process.pid}-${Date.now()}`);
    let firmwaresDiffResult: { changed: string[], unchanged: string[], all: string[] } | null = null;
    try {
        // Create a temp file to emulate GITHUB_OUTPUT locally
        FS.closeSync(FS.openSync(emulatedGitHubOutputPath, "w"));
        process.env.GITHUB_OUTPUT = emulatedGitHubOutputPath;

        await diffChecker();
    
        if (FS.existsSync(emulatedGitHubOutputPath)) {
            for (const line of FS.readFileSync(emulatedGitHubOutputPath, "utf8").split(/\r?\n/)) {
                if (line.startsWith("firmwares_payload=")) {
                    const json_str = line.split("=", 2)[1].trim();
                    firmwaresDiffResult = JSON.parse(json_str);
                    break;
                }
            }
        }
    } finally {
        if (FS.existsSync(emulatedGitHubOutputPath)) FS.unlinkSync(emulatedGitHubOutputPath);
    }
    if (firmwaresDiffResult === null) throw new Error("No firmware definitions found");

    // Concatenate all firmwares since the build script will use cached files if present when on localdev
    // const firmwareDefinitions = new Set([ ...firmwaresDiffResult.changed, ...firmwaresDiffResult.unchanged ]).values().toArray();
    const firmwareDefinitions = firmwaresDiffResult.all;
    if (firmwareDefinitions.length === 0) throw new Error("No firmware definitions found");
    console.log(`Found the following firmwares to compile:\n`, firmwareDefinitions.join("\n  - "));
    
    /* On localdev start each job sequentially since a single compilation job will likely saturate the CPU.
     * Github actions runs across various VMs so those can run in parallel.
     */
    for (const repoRef of firmwareDefinitions) {
        console.log(`Starting compilation job for: '${repoRef}'`);
        await compileFirmware(repoRef);
    }
}

if (import.meta.main)
    await main();
