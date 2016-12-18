
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as socket_io from 'socket.io';
import config = require('../config');
const pty = require('pty.js');
const utils = require('utility');

/// 定期扫描
async function scan() {
	for(var key in TTY.ttys) {
		let tty = TTY.ttys[key];
		if (!tty) continue;
		if (tty.busy) {
			tty.unbusy_time = 0;
		} else {
			tty.unbusy_time += config.TTY.SCAN_INTERVAL;
		}
		if (tty.unbusy_time > config.TTY.MAX_CONNECT_TIME) {
			tty.close();
            delete TTY.ttys[key];
		}
	}
}
setInterval(scan, config.TTY.SCAN_INTERVAL);

class TTY {

    public static ttys: {[index:string]: TTY} = {};
    public static findTTY(id: string) {
        return TTY.ttys[id];
    }
    public static registerTTY() {
        let tty = new TTY();
        TTY.ttys[tty.id] = tty;
        return tty;
    }

    public id: string = null;
    public busy = false;
    public unbusy_time = 0;
    private term: any = null;
    private logs: string = '';
    private ws: SocketIO.Socket = null;

    private constructor() {
        while(true) {
			this.id = String(Date.now()) + utils.randomString(5, '1234567890');
			if (!(this.id in TTY.ttys)) break;
		}
        this.term = pty.spawn(config.TTY.SHELL, [], {
            name: 'xterm-color',
            cols: config.TTY.SHELL_COLS || 80,
            rows: config.TTY.SHELL_ROWS || 24,
            cwd: process.env.HOME,
            env: process.env
        });
        this.term.on('data', (data: any) => {
            this.logs += data;
            if (this.ws) {
                try {
                    this.ws.send(data);
                } catch (ex) {
                    // The WebSocket is not open, ignore
                }
            }
        });
    }
    public open(ws: SocketIO.Socket) {
        this.busy = true;
        this.ws = ws;
        ws.send(this.logs);
        
        ws.on('message', (msg: any) => {
            this.term.write(msg);
        });
        ws.on('dissconnect', () => {
            this.ws = null;
            this.busy = false;
        });
    }
    public close() {
        process.kill(this.term.pid);
        console.log('Closed terminal ' + this.term.pid);
    }
}

export function setup(app: Koa, router: Router, io: SocketIO.Server) {
    router.use(async (ctx, next) => {
        ctx.state.tty = null;
        if (ctx.session.tty_id) ctx.state.tty = TTY.findTTY(ctx.session.tty_id);
        next();
    });
    router.post('/tty/register', async (ctx, next) => {
        if (!ctx.state.tty) {
            let tty = ctx.state.tty = TTY.registerTTY();
            ctx.session.tty_id = tty.id;
        }
        ctx.body = ctx.state.tty.id;
    });
    io.of('/tty').on('connection', (socket) => {
        socket.on('register', (tty_id: string) => {
            let tty = TTY.findTTY(tty_id);
            if (tty) tty.open(socket);
            else socket.emit('unexpect', 'TTY不存在');
        });
    });
}