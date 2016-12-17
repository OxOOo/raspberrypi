/*
 * 这个文件写socket.io响应
 */

import Server = require('socket.io');
import { Log } from './config';

export const io = Server();

io.on('connection', (socket) => {
	socket.emit('greeting', 'hello');
	Log.info('socket.io connection from:', socket.handshake.address);
});
