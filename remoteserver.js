const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
// const osc = require('osc');
// //const board = new five.Board();

// For serving static assets
app.use(express.static(path.join(__dirname, '/')));

app.use('/css', express.static(__dirname + '/css'));

app.get('/', (req, res) => {
    res.sendFile('index.html', {
	root: (__dirname + '/public')
    });
});

io.on('connection', (socket) => {
    console.log('a user connected');
});

server.listen(3000, () => {
    console.log("listening on *:3000");
})

var net = require('net');

var tcpserv = net.createServer(function(socket) {
    console.log("connected")
    socket.write('conection established\r\n');
    socket.pipe(socket);
    socket.on('data', function(data) {
	console.log('received ' + data);
	io.emit("gyro", JSON.parse(data));
    })
    socket.on('close', function() {
	console.log('disconnect');
    })
});

tcpserv.listen(1337, '127.0.0.1');
