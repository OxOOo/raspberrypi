/**
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 * @module xterm/addons/attach/attach
 * @license MIT
 */
(function (attach) {
    if (typeof exports === 'object' && typeof module === 'object') {
        /*
         * CommonJS environment
         */
        module.exports = attach(require('../../xterm'));
    }
    else if (typeof define == 'function') {
        /*
         * Require.js is available
         */
        define(['../../xterm'], attach);
    }
    else {
        /*
         * Plain browser environment
         */
        attach(window.Terminal);
    }
})(function (Xterm) {
    'use strict';
    var exports = {};
    /**
     * Attaches the given terminal to the given socket.
     *
     * @param {Xterm} term - The terminal to be attached to the given socket.
     * @param {Socket.IO} socket - The socket to attach the current terminal.
     */
    exports.attach = function (term, socket) {
        term.socket = socket;
        socket.on('message', function(data) {
            term.write(data);
        });
        term.on('data', function (data) {
            socket.send(data);
        });
    };
    /**
     * Attaches the current terminal to the given socket
     *
     * @param {Socket.IO} socket - The socket to attach the current terminal.
     */
    Xterm.prototype.attach = function (socket) {
        return exports.attach(this, socket);
    };
    return exports;
});