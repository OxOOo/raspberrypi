
import { Log, SERVER } from './config';
import { app, io } from './server';

async function startup() {
	SERVER.net.on('request', app.callback());
	io.listen(SERVER.net);

	SERVER.net.on('listening', () => {
		let address = SERVER.net.address();
		console.log(`listening on http://${address.address}:${address.port}`);
	});
}

async function run() {
	try {
		await startup();
	} catch (e) {
		Log.fatal(e);
		Log.fatal('Exiting');
		process.exit(1);
		return;
	}
	Log.info('WebServer Started');
}

run();