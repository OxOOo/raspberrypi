
import { Log, AUTH } from './config';
import * as rp from 'request-promise';
import * as rq from 'request';

function sleep(ms: number) {
	return new Promise<void>((resolve, reject) => {
		setTimeout(resolve, ms);
	});
}

async function login() {
	let http = rp.defaults({jar: rq.jar()});
	let res = JSON.parse(await http.post({url: 'https://ss.blink.moe/auth/login', form: {email: AUTH.EMAIL, passwd: AUTH.PASSWD, remember_me:'week'}}));
	if (res.ret == 0) {
		throw res;
	}
	return http;
}

async function process() {
	let http = await login();
	let checkin = JSON.parse(await http.post('https://ss.blink.moe/user/checkin'));
	Log.info(checkin.msg);
}

async function nextCheckinSleep() {
	let http = await login();
	let html = await http.get('https://ss.blink.moe/user');
	let d = /上次签到时间：<code>(.*?)<\/code>/.exec(html);
	if (d) {
		let date = new Date(d[1]);
		return 24*60*60*1000 - (Date.now() - Number(date)) + 60*1000;
	}
	return 1000;
}

async function main() {
	Log.info('started');

	try {
		for(let i = 0; i < 3; i ++) {
			await process();
			await sleep(1000*3);
		}
		while(1) {
			let ms = await nextCheckinSleep();
			Log.info('等待时间：', (ms/1000/60/60).toFixed(2), '小时');
			await sleep(ms);
			await process();
		}
	} catch(err) {
		if (err.ret) Log.error(err);
		else Log.error(err.message);
	}
}

main();