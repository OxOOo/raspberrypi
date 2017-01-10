import path = require('path');
import http = require('http');
import fs = require('fs');
import log4js = require('log4js');
const yaml = require('js-yaml');
const doc = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'config.yml'), 'utf8'));
let cfg: any = null;

// 运行版本
export let env_test = process.env.NODE_ENV == 'test';
export let env_production = process.env.NODE_ENV == 'production';
export let env_development = !env_test && !env_production;
if (env_test) cfg = doc['test'];
if (env_production) cfg = doc['production'];
if (env_development) cfg = doc['development'];

// 日志相关
log4js.configure({
	appenders: [
		{ type: 'console' }
	]
});
export const Log = log4js.getLogger();

export let AUTH = {
	EMAIL: <string>cfg['ss_email'],
	PASSWD: <string>cfg['ss_passwd']
}