import * as ChildProcess from "child_process";

export function runCmd(cmd: string[], check: boolean): Promise<{ stdout: string; status: number | null }> {
    return new Promise((resolve, reject) => {
        console.log("> " + cmd.join(" "));
        const child = ChildProcess.spawn(cmd[0], cmd.slice(1), { 
            stdio: ["inherit", "pipe", "inherit"] 
        });

        let stdout = "";

        child.stdout?.on("data", (data) => {
            const str = data.toString();
            stdout += str;
            process.stdout.write(str);
        });

        child.on("close", (status) => {
            if (check && status !== 0)
                reject(new Error(`Command ${cmd.join(" ")} failed with exit code ${status}`));
            else
                resolve({ stdout, status });
        });
    });
}
