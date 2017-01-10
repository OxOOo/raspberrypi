
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as serve from 'koa-static';
import * as mount from 'koa-mount';
import * as socket_io from 'socket.io';
import * as rq from 'request';
import * as rp from 'request-promise';
import mzfs = require('mz/fs');
import cheerio = require('cheerio');
import path = require('path');
import url = require('url');
import qs = require('querystring');
import async = require('async');
import del = require('del');
import { DOWNLOAD, Log } from '../config';
import { IDownload, Download } from '../models';

const utils = require('utility');
const progress = require('request-progress');

function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

class D {
    request = rp.defaults({jar: rq.jar()});

    constructor(private download: IDownload) {
        this.download.download9_name = utils.randomString(12, '1234567890');
    }

    async start() {
        Log.info('start download:', this.download.origin_url);
        try {
            // init db
            this.download.error_info = '';
            this.download.finished = false;
            await this.download.save();
            await this.download9();
        } catch(err) {
            this.download.error_info = err.message;
            this.download.status = '下载失败';
            Log.error(err.message);
            await this.download.save();
        }
        Log.info('end download:', this.download.origin_url);
    }

    async download9() {
        this.download.status = '正在登录download9';
        await this.download.save();
        await this.loginDownload9();

        this.download.status = '正在删除不必要的文件';
        await this.download.save();
        while(true)
        {
            let c = await this.getCapacity();
            if (c.capacity_now >= c.capacity_max || c.tasks_now >= c.tasks_max)
            {
                if (!await this.deleteRemoteLastFile()) {
                    throw new Error('删除远程文件失败');
                }
            } else break;
        }

        this.download.status = '正在添加任务';
        await this.download.save();
        await this.addRemoteTask(this.download.origin_url);

        await this.waitForDownloadOK();
        await this.downloadToLocal();
    }

    private async loginDownload9() {
        let html = await this.request.get('https://download.net9.org/login/');
        let oauth_url = cheerio.load(html)('.buttom-reg-right').parent().attr('href');
        html = await this.request.get(oauth_url);
        let data: {[index:string]:string} = {};
        cheerio.load(html)('form input').each((index, ele) => {
            data[(<any>ele.attribs).name] = (<any>ele.attribs).value;
        });
        data['username'] = DOWNLOAD.A9_NAME;
        data['password'] = DOWNLOAD.A9_PASS;
        let rst: string = await this.request.post({url: 'https://accounts.net9.org/login?'+qs.stringify({'returnto': data['returnto']}), form: data, followAllRedirects: true});
        if (rst.indexOf('Download9') == -1) {
            throw new Error('download9登录失败');
        }
    }

    private async getCapacity() {
        let html = await this.request.get('https://download.net9.org/');
        let $ = cheerio.load(html)('ul.navbar-right a').last();
        let d1 = / (-?\d+)\/(-?\d+) /.exec($.text());
        let d2 = / (-?\d+)\/(-?\d+)MB/.exec($.text());
        return {
            tasks_now: Math.max(0, Number(d1[1])),
            tasks_max: Math.max(0, Number(d1[2])),
            capacity_now: Math.max(0, Number(d2[1])),
            capacity_max: Math.max(0, Number(d2[2]))
        }
    }

    private async deleteRemoteLastFile() { // 删除已经下载成功的最早的文件
        let html = await this.request.get('https://download.net9.org/');
        let $ = cheerio.load(html)('table tbody tr');
        for(let i = 0; i < $.length; i ++) {
            let ele = $[i];
            let tr = cheerio.load(ele).root();
            if (tr.find('td[name=status]').text().strip == 'complete') {
                await this.request.get('https://download.net9.org/del?taskID='+(<any>ele.attribs).id);
                return true;
            }
        }
        return false;
    }

    private async addRemoteTask(url: string) {
        let html = await this.request.get('https://download.net9.org/');
        let $ = cheerio.load(html)('#newbyurlform');
        let data: {[index:string]:string} = {};
        $.find('input').each((index, ele) => {
            data[(<any>ele.attribs).name] = (<any>ele.attribs).value;
        });
        $.find('textarea').each((index, ele) => {
            data[(<any>ele.attribs).name] = (<any>ele.attribs).value;
        });
        data['name'] = this.download.download9_name;
        data['url'] = url;
        let rst = JSON.parse(await this.request.post({url: 'https://download.net9.org/new2/', form: data}));
        if (rst.content != 'success') {
            throw new Error('添加远程任务失败：' + rst.content);
        }
    }

    private async flushStatus() {
        let html = await this.request.get('https://download.net9.org/');
        let $ = cheerio.load(html)('table tbody tr');
        for(let i = 0; i < $.length; i ++) {
            let ele = $[i];
            let tr = cheerio.load(ele).root();
            let info = {
                id: (<any>ele.attribs).id,
                name: cheerio.load(tr.find('td')[1]).root().text().strip,
                status: tr.find('td[name=status]').text().strip,
                size: tr.find('td[name=size]').text().strip,
                rate: tr.find('td[name=rate]').text().strip,
                speed: tr.find('td[name=speed]').text().strip,
                file: tr.find('td[name=file]').find('a').attr('href'),
            }
            if (this.download.download9_name == info.name) return info;
        }
    }

    private async waitForDownloadOK() {
        let solve = async () => {
            let info = await this.flushStatus();
            if (info) {
                this.download.status = 'download9正在下载|'+info.status;
                this.download.size = info.size;
                this.download.progress = info.rate;
                this.download.speed = info.speed;
                await this.download.save();
                if (info.status == 'complete') {
                    this.download.status = 'download9下载完成';
                    await this.download.save();
                    return true;
                } else if (info.status && info.status.length && info.status != 'active') {
                    throw new Error('download9下载失败');
                }
                return false;
            } else {
                throw new Error('获取download9状态失败');
            }
        };
        while(true) {
            if (await solve()) break;
            await sleep(500);
        }
    }

    private downloadToLocal() {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await this.analysisLocalFilename();
                let info = await this.flushStatus();
                await this.download.save();
                let pathname = path.join(DOWNLOAD.PATH, String(this.download._id));
                if (!await mzfs.exists(pathname)) await mzfs.mkdir(pathname);
                if (await mzfs.exists(path.join(pathname, this.download.local_file))) await mzfs.unlink(path.join(pathname, this.download.local_file));
                this.download.status = '正在取回';
                await this.download.save();
                progress(rq('https://download.net9.org' + info.file))
                    .on('progress', async (state: any) => {
                        this.download.progress = 'x%';
                        this.download.speed = 'x MB/s';
                        this.download.remaining = 'x s';
                        if (state.percent) this.download.progress = (state.percent*100).toFixed(1) + '%';
                        if (state.speed) this.download.speed = (state.speed/1024/1024).toFixed(2) + ' MB/s';
                        if (state.time && state.time.remaining) this.download.remaining = state.time.remaining.toFixed(1) + ' s';
                        await this.download.save();
                    })
                    .on('error', (err: any) => {
                        reject(err);
                    })
                    .on('end', async () => {
                        this.download.progress = '100%';
                        this.download.speed = '0 MB/s';
                        this.download.remaining = '0 s';
                        this.download.finished = true;
                        this.download.status = '下载完成';
                        await this.download.save();
                        resolve();
                    }).pipe(mzfs.createWriteStream(path.join(pathname, this.download.local_file)));
            } catch(err) {
                reject(err);
            }
        });
    }

    private async analysisLocalFilename() {
        let filename = path.basename(url.parse(this.download.origin_url).pathname);
        let head = await rp.head(this.download.origin_url);
        Object.keys(head).forEach((key) => {
        	let line = head[key];
        	let d = /.*filename=(.*)/.exec(line);
        	if (d) filename = d[1];
        });
        this.download.local_file = filename;
        await this.download.save();
    }
}

let que = async.queue<{},any>(async (task, callback) => {
    try {
        let tasks = await Download.find({deleted: false, finished: false}).sort({date: -1});
        for(let i = 0; i < tasks.length; i ++) {
            let d = new D(tasks[i]);
            await d.start();
        }
        callback();
    } catch(err) {
        callback(err);
    }
}, 1);

let gerror: string = null;

function wakeup() {
    que.push({});
}

async function rubbish() {
    let tasks = await Download.find({deleted: true});
    for(let i = 0; i < tasks.length; i ++) {
        await del(path.join(DOWNLOAD.PATH, String(tasks[i]._id)), {force: true});
        await tasks[i].remove();
    }
}


export function setup(app: Koa, router: Router, io: SocketIO.Server) {
    (async () => {
        await rubbish();
        wakeup();
    })();

    router.get('/downloads', async (ctx, next) => {
        if (gerror) ctx.state.flash.error = gerror;
        let downloads = await Download.find({deleted: false}).sort({date: -1});
        await (<any>ctx).render('downloads', { tab: 'downloads', downloads: downloads });
    });
    router.post('/downloads', async (ctx, next) => {
        let task = new Download();
        task.name = ctx.request.body.name;
        task.origin_url = ctx.request.body.link;
        task.status = '等待中。。。';
        await task.save();
        wakeup();
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

    app.use(mount('/downloads/static/', serve(DOWNLOAD.PATH)));
}