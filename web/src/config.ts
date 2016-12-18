import path = require('path');
import http = require('http');
import fs = require('fs');
import log4js = require('log4js');

// 运行版本
export let env_test = process.env.NODE_ENV == 'test';
export let env_production = process.env.NODE_ENV == 'production';
export let env_development = !env_test && !env_production;

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
	cookie_keys: ['raspberry pi 2333'], // cookie签名
};
SERVER.net.listen(8000, env_production ? '0.0.0.0' : '127.0.0.1');

// 数据库相关
export const DB = {
	HOSTNAME: "127.0.0.1",
	DATABASE: env_production ? "raspberry" : "raspberry_test"
};

// TTY相关
export const TTY = {
	SCAN_INTERVAL: 2*1000,
	MAX_CONNECT_TIME: 30*1000,
	SHELL: 'fish',
	SHELL_COLS: 80,
	SHELL_ROWS: 24
}