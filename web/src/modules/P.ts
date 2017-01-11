
import child_process = require('child_process');
import path = require('path');

export async function runPython(script_path: string) {
    return new Promise<string>((resolve, reject) => {
        let p = child_process.exec(`python ${path.basename(script_path)}`, {cwd: path.dirname(script_path)});
        let stdouts: Buffer[] = [];
        p.stdout.on('data', (chunk) => {
            stdouts.push(new Buffer(<any>chunk));
        });
        p.on('exit', () => {
            resolve(Buffer.concat(stdouts).toString());
        });
        p.on('error', (err) => {
            reject(err);
        });
    });
}