/*
 * 下载
 */

import { Document, Schema, Model, model } from 'mongoose';

let downloadSchema: Schema = new Schema({
	name: String,
	date: { type: Date, default: Date.now },
	type: { type: String, required: true},
	version: String,
	status: String,
	size: String,
	progress: String,
	speed: String,
	origin_url: String,
	download9_name: String,
	local_file: String,
	remaining: String,
	error_info: String,
	finished: {type: Boolean, default: false},
	deleted: {type: Boolean, default: false},
});

export interface IDownload extends Document {
	name: string,
	date: Date,
	type: 'normal' | 'autoupdate'
	version: string,
	status: string,
	size: string,
	progress: string,
	speed: string,
	origin_url: string,
	download9_name: string,
	local_file: string,
	remaining: string,
	error_info: string,
	finished: boolean,
	deleted: boolean
}

var sid = downloadSchema.virtual('sid');
sid.get(function () {
	let d = eval('this');
	return d._id.toString();
});

export let Download = model<IDownload>("Download", downloadSchema);