const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const five = require("johnny-five");
const board = new five.Board();
// For serving static assets

app.use(express.static(path.join(__dirname, '/public')));

app.use('/css', express.static(__dirname + '/css'));

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: (__dirname + '/public')
  });
});

io.on('connection', (socket) => {
  console.log('a user connected');
});

board.on("ready", function() {
    console.log('board is ready')
    const sens0 = new five.Sensor.Digital(0);
    const sens1 = new five.Sensor.Digital(1);
    var a = sens0.value;
    var b = sens1.value;
    var counter = 0;
    sens0.on("change", function() {
	counter += (this.value - a) * (sens1.value == 1 ? (-1) : 1)
	io.emit('rotary', counter)
	a = this.value;
    });
    sens1.on("change", function() {
	counter += (this.value - b) * (sens0.value == 1 ? 1 : (-1))
	io.emit('rotary', counter)
	b = this.value
    });
})


server.listen(3000, () => {
  console.log('listening on *:3000');
});

