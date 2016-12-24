import { DB, Log } from '../config';

import mongoose = require('mongoose');
(<any>mongoose).Promise = global.Promise;

let db = `mongodb://${DB.HOSTNAME}/${DB.DATABASE}`;

mongoose.connect(db, {
	server: { poolSize: 20 }
}, function (err) {
	if (err) {
		Log.fatal('connect to %s error: ', db, err.message);
		process.exit(1);
	}
});

import download = require('./download');
export type IDownload = download.IDownload;
export let Download = download.Download;
