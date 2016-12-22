/*
 * 这个文件记录所有脚本相关的信息
 */

import cp = require('child_process');

export async function poweroff() {
    setTimeout(() => {
        cp.exec('sudo poweroff');
    }, 1000);
}

export async function restart() {
    setTimeout(() => {
        cp.exec('sudo reboot');
    }, 1000);
}