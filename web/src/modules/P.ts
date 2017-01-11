
import child_process = require('child_process');
import path = require('path');

export async function runPython(script_path: string) {
    return new Promise<string>((resolve, reject) => {
        let p = child_process.exec(`python ${path.basename(script_path)}`, {cwd: path.dirname(script_path)});

        let stdouts: Buffer[] = [];
        p.stdout.on('data', (chunk) => {
            stdouts.push(new Buffer(<any>chunk));
        });
        let stderrs: Buffer[] = [];
        p.stderr.on('data', (chunk) => {
            stderrs.push(new Buffer(<any>chunk));
        });

        p.on('exit', (code) => {
            if (code == 0) {
                resolve(Buffer.concat(stdouts).toString());
            } else {
                reject(new Error(Buffer.concat(stderrs).toString()));
            }
        });
        p.on('error', (err) => { // 进程启动错误
            reject(err);
        });
    });
}