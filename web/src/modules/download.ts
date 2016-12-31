
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
import { DOWNLOAD, Log } from '../config';
import { IDownload, Download } from '../models';

const utils = require('utility');
const progress = require('request-progress');

class D {
    request = rp.defaults({jar: rq.jar()});
    logined = false;

    constructor(private download: IDownload) {
        this.download.download9_name = utils.randomString(12, '1234567890');
    }

    async start() {
        Log.info('start download:', this.download.origin_url);
        try {
            await this.download9();
        } catch(err) {
            this.download.error_info = err.message;
            this.download.status = '下载失败';
            await this.download.save();
        }
    }

    async download9() {
        this.download.status = '正在登录download9';
        await this.download.save();
        for(let times=0; times<5; times ++) {
            try {
                if (await this.loginDownload9()) break;
            } catch(err) {
            }
        }
        if (!this.logined) {
            // login fail FIXME
            return;
        }

        this.download.status = '正在删除不必要的文件';
        await this.download.save();
        while(true)
        {
            let c = await this.getCapacity();
            if (c.capacity_now >= c.capacity_max || c.tasks_now >= c.tasks_max)
            {
                if (!await this.deleteRemoteLastFile()) {
                    // download fail FIXME
                    return false;
                }
            } else break;
        }
        this.download.status = '正在添加任务';
        await this.download.save();
        let content = await this.addRemoteTask(this.download.origin_url);
        if (content != 'success') {
            this.download.error_info = content;
            await this.download.save();
            return false;
        }
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
        this.logined = rst.indexOf('Download9') != -1;
        return this.logined;
    }

    private async getCapacity() {
        let html = await this.request.get('https://download.net9.org/');
        let $ = cheerio.load(html)('ul.navbar-right a').last();
        let d1 = / (\d+)\/(\d+) /.exec($.text());
        let d2 = / (\d+)\/(\d+)MB/.exec($.text());
        return {
            tasks_now: Number(d1[1]),
            tasks_max: Number(d1[2]),
            capacity_now: Number(d2[1]),
            capacity_max: Number(d2[2])
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

    private async addRemoteTask(url: string): Promise<string> {
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
        return rst.content;
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

    private sleep(ms: number) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, ms);
        });
    }

    private async waitForDownloadOK() {
        let solve = async () => {
            this.download.status = 'download9正在下载';
            await this.download.save();
            let info = await this.flushStatus();
            if (info) {
                this.download.size = info.size;
                this.download.progress = info.rate;
                this.download.speed = info.speed;
                await this.download.save();
                if (info.status == 'complete') {
                    this.download.status = 'download9下载完成';
                    await this.download.save();
                    return true;
                }
                return false;
            } else {
                throw new Error('不知名原因');
            }
        };
        while(true) {
            if (await solve()) break;
            await this.sleep(500);
        }
    }

    private downloadToLocal() {
        return new Promise(async (resolve, reject) => {
            await this.analysisLocalFilename();
            let info = await this.flushStatus();
            await this.download.save();
            let pathname = path.join(DOWNLOAD.PATH, String(this.download._id));
            await mzfs.mkdir(pathname);
            this.download.status = '正在取回';
            await this.download.save();
            progress(rq('https://download.net9.org' + info.file))
                .on('progress', async (state: any) => {
                    this.download.progress = (state.percent*100).toFixed(1) + '%';
                    this.download.speed = (state.speed/1024/1024).toFixed(2) + ' MB/s';
                    this.download.remaining = state.time.remaining.toFixed(1) + ' s';
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

export function setup(app: Koa, router: Router, io: SocketIO.Server) {
    (async () => {
        let tasks = await Download.find({finished: false});
        for(let i = 0; i < tasks.length; i ++) {
            let d = new D(tasks[i]);
            d.start();
        }
    })();

    router.get('/downloads', async (ctx, next) => {
        let downloads = await Download.find().sort({'date': -1});
        await (<any>ctx).render('downloads', { tab: 'downloads', downloads: downloads });
    });
    router.post('/downloads', async (ctx, next) => {
        let task = new Download();
        task.name = ctx.request.body.name;
        task.origin_url = ctx.request.body.link;
        let d = new D(task);
        d.start();
        ctx.redirect('/downloads');
    });
    app.use(mount('/downloads/static/', serve(DOWNLOAD.PATH)));
}