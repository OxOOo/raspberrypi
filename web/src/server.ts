require('colors');
import * as colors from 'colors';
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as mount from 'koa-mount';
import * as serve from 'koa-static';
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session-minimal';
import * as socket_io from 'socket.io';
import * as rp from 'request-promise';
import mzfs = require('mz/fs');
import flash = require('./middlewares/flash');
import path = require('path');
import stream = require('stream');
import { SERVER, Log, env_production, AUTH } from './config';
import tty = require('./modules/tty');
import download = require('./modules/download');
import script = require('./script');
let render = require('koa-swig');
let body = require('koa-convert')(require('koa-better-body')());
let utils = require('utility');

export const app = new Koa();
export const io = socket_io();
const router = new Router();

app.keys = SERVER.cookie_keys;
app.use(require('koa-logger')());
app.use(session());
app.use(bodyParser());

render.swig.setFilter('ldate', function(input: any) {
	let date = new Date(input);
	return utils.YYYYMMDDHHmmss(date);
});
(<any>app.context).render = require('co').wrap(render({
	root: path.join(__dirname, '..', 'views'),
	cache: env_production ? 'memory' : false, // disable, set to false
	ext: 'html',
	writeBody: true,
}));

// Body Log & 404
app.use(async (ctx, next) => {
	await next();
	console.log('\n===========BODY==============='.green);

	if (ctx.status == 404) {
		await (<any>ctx).render('404');
		ctx.status = 404;
	}

	if (typeof (ctx.body) == 'string') {
		console.log("String:", ctx.body.slice(0, 20));
	} else if (ctx.body instanceof stream.Readable) {
		console.log("Stream:", (<any>ctx.body).path);
	} else {
		console.log(ctx.body);
	}
	console.log('===========BODY END===========\n'.green);
});
// Body Log

// 异常处理
app.on('error', (err: Error, ctx: Koa.Context) => {
	// something
	// 如果不填，也会自动发送
	{
		Log.error('res error:', err.message);
		Log.info('error:', err);
	}
});
// 异常处理

// 中间件
app.use(async (ctx, next) => {
	try {
		await next();
	} catch(err) {
		if ((<any>err).status == 401) {
			ctx.set('WWW-Authenticate', 'Basic');
			ctx.body = 'cant haz that';
			ctx.status = 401;
		} else throw err;
	}
})
app.use(require('koa-basic-auth')({ name: AUTH.name, pass: AUTH.pass }));
router.use(flash);

// 中间件

// 主路由

router.redirect('/', '/index');
router.get('/index', async (ctx, next) => {
	await (<any>ctx).render('index', { tab: 'index' });
});

download.setup(app, router, io);

router.get('/tty', async (ctx, next) => {
	await (<any>ctx).render('tty', { tab: 'tty' });
});
tty.setup(app, router, io);

// 关机
router.get('/poweroff', async (ctx, next) => {
	await script.poweroff();
	ctx.state.flash.success = '正在关机';
	ctx.redirect('/');
});
// 重启
router.get('/restart', async (ctx, next) => {
	await script.restart();
	ctx.state.flash.success = '正在重启';
	ctx.redirect('/');
});

// 主路由

// 静态资源
app.use(mount('/static', serve(path.join(__dirname, '..', 'views', 'static'))));
// 静态资源

app.use(mount(router.routes()));