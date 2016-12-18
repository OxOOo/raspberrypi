
var terminalContainer = null;
var term = null;
var tty_id = null;

function createTerminal() {
    // Clean terminal
    while (terminalContainer.children.length) {
        terminalContainer.removeChild(terminalContainer.children[0]);
    }
    term = new Terminal({
        cursorBlink: false
    });
    var protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
    var socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/tty';

    term.open(terminalContainer);
    term.fit();

    $.post("/tty/register", {}, function(data) {
        console.log(data);
        var socket = io(socketURL);
        socket.on('connect', function() {
            socket.on('unexpect', function(msg) {
                alert(msg);
            });
            socket.emit('register', data);
            term.attach(socket);
        });
    }, 'text');
}

$(() => {
    terminalContainer = document.getElementById('terminal-container');
    createTerminal();
});