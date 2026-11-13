#!/usr/bin/env npx ts-node
import * as FS from "fs";
import { runCmd } from "./Common.js";

const JSON_PATH = "src/lib/assets/firmwares.json";

async function getBaseJson(): Promise<Record<string, string>> {
    let baseRev = process.env.ACT ? "HEAD" : "HEAD~1"; // Use uncommitted changes on ACT (HEAD)

    if (process.env.GITHUB_ACTIONS === "true") {
        if (process.env.GITHUB_EVENT_NAME === "pull_request") {
            runCmd(["git", "fetch", "origin", "main"], false);
            baseRev = "origin/main";
        } else if (process.env.GITHUB_EVENT_NAME === "push" && process.env.GITHUB_EVENT_PATH && FS.existsSync(process.env.GITHUB_EVENT_PATH)) {
            const beforeSha = JSON.parse(FS.readFileSync(process.env.GITHUB_EVENT_PATH, "utf-8"))?.before;
            if (beforeSha && beforeSha !== "0000000000000000000000000000000000000000")
                baseRev = beforeSha;
        }
    }

    const result = await runCmd(["git", "show", `${baseRev}:${JSON_PATH}`], true);
    return JSON.parse(result.stdout);
}

export async function main(): Promise<void> {
    if (!FS.existsSync(JSON_PATH)) {
        console.log(`JSON path not found: '${JSON_PATH}'`);
        process.exit(1);
    }

    const currentData: Record<string, string> = JSON.parse(FS.readFileSync(JSON_PATH, "utf-8"));
    let baseData: Record<string, string> = {};
    try { baseData = await getBaseJson(); } catch { /* Ignore */ }

    const resultPayload: {
        changed: string[],
        unchanged: string[],
    } = {
        changed: [],
        unchanged: []
    };
    for (const [name, repoRef] of Object.entries(currentData)) {
        if (!(name in baseData) || baseData[name] !== repoRef)
            resultPayload.changed.push(repoRef);
        else
            resultPayload.unchanged.push(repoRef);
    }

    console.log("Firmware diff result: " + JSON.stringify(resultPayload, null, 2));

    if (process.env.GITHUB_OUTPUT)
        FS.appendFileSync(process.env.GITHUB_OUTPUT, `firmwares_payload=${JSON.stringify(resultPayload)}\n`);
}

if (import.meta.main)
    await main();
