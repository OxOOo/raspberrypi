
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as serve from 'koa-static';
import * as mount from 'koa-mount';
import * as socket_io from 'socket.io';
import * as mzfs from 'mz/fs';
import path = require('path');
import async = require('async');
import del = require('del');
import { DOWNLOAD, Log } from '../config';
import { IDownload, Download } from '../models';
import { D } from './D';
import P = require('./P');

const body = require('koa-convert')(require('koa-better-body')({fields: 'body'}));
const sendfile = require('koa-sendfile');

function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

async function wakeupIn() {
    Log.info('WAKEUP');
    let tasks = await Download.find({type: 'normal', deleted: false, finished: false}).sort({date: -1});
    for(let i = 0; i < tasks.length; i ++) {
        let d = new D(tasks[i]);
        await d.start();
    }
}

async function autoupdateIn() {
    Log.info('AUTOUPDATE');
    let tasks = await Download.find({type: 'autoupdate', deleted: false});
    for(let i = 0; i < tasks.length; i ++) {
        let t = tasks[i];
        try {
            let info = JSON.parse(await P.runPython(path.join(DOWNLOAD.PATH, String(t._id), 'script.py')));
            if (info.status == 'success') {
                if (info.version != t.version || !t.finished || (t.error_info && t.error_info.length)) {
                    t.date = new Date();
                    t.version = info.version;
                    t.origin_url = info.link;
                    await t.save();
                    await (new D(t)).start();
                }
            } else if (info.status == 'error') {
                t.error_info = info.error_message;
                t.status = '获取版本信息失败';
                await t.save();
            } else {
                t.error_info = '脚本返回信息不合规范';
                t.status = '脚本返回信息不合规范';
                await t.save();
            }
        } catch(err) {
            t.error_info = err.message;
            t.status = '运行脚本失败';
            await t.save();
        }
    }
}

let que = async.queue<'normal' | 'autoupdate',any>(async (task, callback) => {
    try {
        if (task == 'normal') {
            await wakeupIn();
        } else if (task == 'autoupdate') {
            await autoupdateIn();
        }
        callback();
    } catch(err) {
        callback(err);
    }
}, 1);

// 唤醒
function wakeup() {
    que.push('normal');
}

// 自动更新
function autoupdate() {
    que.push('autoupdate');
}

// 处理已经删除的数据
async function rubbish() {
    let tasks = await Download.find({deleted: true});
    for(let i = 0; i < tasks.length; i ++) {
        await del(path.join(DOWNLOAD.PATH, String(tasks[i]._id)), {force: true});
        await tasks[i].remove();
    }
}

export function setup(app: Koa, router: Router, io: SocketIO.Server) {
    let gerror: string = null;
    (async () => {
        try {
            await rubbish();
        } catch(err) {
            gerror = err.message;
        }
        wakeup();
        autoupdate();
        while(1) {
            if (que.idle())autoupdate();
            await sleep(30*60*1000); // 30mins
        }
    })();

    router.get('/downloads', async (ctx, next) => {
        if (gerror) ctx.state.flash.error = gerror;
        let ndownloads = await Download.find({type: 'normal', deleted: false}).sort({date: -1});
        let adownloads = await Download.find({type: 'autoupdate', deleted: false}).sort({date: -1});
        await (<any>ctx).render('downloads', { tab: 'downloads', ndownloads: ndownloads, adownloads: adownloads });
    });
    router.post('/downloads', body, async (ctx, next) => {
        if (ctx.request.body.type == 'normal') {
            let task = new Download();
            task.type = 'normal';
            task.name = ctx.request.body.name;
            task.origin_url = ctx.request.body.link;
            task.status = '等待中。。。';
            await task.save();
            wakeup();

        } else if (ctx.request.body.type == 'autoupdate') {
            let task = new Download();
            task.type = 'autoupdate';
            task.name = ctx.request.body.name;
            task.status = '等待中。。。';
            await task.save();
            let pathname = path.join(DOWNLOAD.PATH, String(task._id));
            await mzfs.mkdir(pathname);
            let content = await mzfs.readFile(ctx.request.body.script[0].path);
            await mzfs.writeFile(path.join(pathname, 'script.py'), content);
            autoupdate();

        } else ctx.throw('unknow type');
        ctx.redirect('/downloads');
    });
    router.get('/downloads/delete/:sid', async (ctx, next) => {
        let task = await Download.findById(ctx.params.sid);
        ctx.assert(task, '下载不存在');
        task.deleted = true;
        await task.save();
        ctx.state.flash.success = '删除成功，将在下一次启动的时候对磁盘进行实际上的删除。';
        ctx.redirect('/downloads');
    });
    router.get('/downloads/info/:sid', async (ctx, next) => {
        let task = await Download.findById(ctx.params.sid);
        ctx.assert(task, '下载不存在');
        ctx.body = task.toObject();
    });
    router.get('/downloads/:sid/script.py', async (ctx, next) => {
        const script = 'script.py';
        let task = await Download.findById(ctx.params.sid);
        ctx.assert(task, '下载不存在');
        await sendfile(ctx, path.join(DOWNLOAD.PATH, String(task._id), script));
    });

    app.use(mount('/downloads/static/', serve(DOWNLOAD.PATH)));
}