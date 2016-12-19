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

// 服务器实例
export const SERVER = {
	net: http.createServer(), // HTTP服务器
	cookie_keys: <string[]>cfg['server_cookie_keys'], // cookie签名
};
SERVER.net.listen(cfg['server_port'], cfg['server_address']);

// 数据库相关
export const DB = {
	HOSTNAME: <string>cfg['mongodb_hostname'],
	DATABASE: <string>cfg['mongodb_database']
};

// 认证
export const AUTH = {
	name: <string>cfg['auth_name'],
	pass: <string>cfg['auth_pass']
}

// TTY相关
export const TTY = {
	SCAN_INTERVAL: <number>cfg['tty_scan_interval'],
	MAX_CONNECT_TIME: <number>cfg['tty_max_time'],
	SHELL: <string>cfg['tty_shell'],
	SHELL_COLS: <number>cfg['tty_cols'],
	SHELL_ROWS: <number>cfg['tty_rows'],
}