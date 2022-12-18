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
	root: (__dirname)
    });
});

let mice = new Map();
let wind = 2;
let gravity = 0.00004;

io.on('connection', (socket) => {
    io.emit("wind", wind);
    io.emit("gravity", gravity);
    let rgb;
    console.log('usr connected')
    socket.on("mouse", function(mx, my, r, g, b) {
	rgb = r + g + b;
	// Just add the rbg values as index,
	// not exactly correct but good enough...
	mice.set(r + g + b, {"mx": mx, "my": my, "r": r, "g": g, "b": b})
	io.emit("mice", JSON.stringify(mice, replacer))
    })
    socket.on('disconnect', function () {
	mice.delete(rgb);
    });

    socket.on("windchange", function(newVal) {
	wind = newVal;
	io.emit("wind", newVal);
    })
    socket.on("gravitychange", function(newVal) {
	gravity = newVal;
	io.emit("gravity", newVal);
    })
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


//utils:
function replacer(key, value) {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}
