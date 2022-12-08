const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
//const five = require("johnny-five");
const osc = require('osc');
//const board = new five.Board();

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

server.listen(3000, () => {
    console.log("listening on *:3000");
})
// board.on("ready", function() {
//     console.log("board online");
//   var gyro = new five.Gyro({
//       controller: "MPU6050",
//   });
//   gyro.recalibrate();// Tell the device to recalibrate
//     var pitch = gyro.pitch.angle;
//     var roll  = gyro.roll.angle;
//     var yaw   = gyro.yaw.angle;
//     gyro.on("change", function() {
//       if (   Math.abs(this.pitch.angle - pitch) > 1
// 	  || Math.abs(this.roll.angle - roll) > 1
// 	  || Math.abs(this.yaw.angle - yaw) > 1
// 	 ) {
// 	  console.log("gyro");
// 	  console.log("  x            : ", this.x);
// 	  console.log("  y            : ", this.y);
// 	  console.log("  z            : ", this.z);
// 	  console.log("  pitch        : ", this.pitch);
// 	  console.log("  roll         : ", this.roll);
// 	  console.log("  yaw          : ", this.yaw);
// 	  console.log("  rate         : ", this.rate);
// 	  pitch = gyro.pitch.angle;
// 	  roll  = gyro.roll.angle;
// 	  yaw   = gyro.yaw.angle;
// 	  io.emit('gyro', {pitch: this.pitch, roll: this.roll, yaw: this.yaw})
//       }
//   });
// })
// Create an osc.js UDP Port listening on port 57121.

var udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    //    localAddress: "127.0.0.1",
    localPort: 5000,
    metadata: true
});

// Listen for incoming OSC messages.
let i = 0;
let pitch;
let roll;
let yaw = 0;
let yawF = 0;
let currentTime = 0;
let previousTime = 0;
let gyroAngleX = 0;
let gyroAngleY = 0
let gyroZ = 0;
let initialized = false;

udpPort.on("message", function (oscMsg, timeTag, info) {
    if (!initialized) {
	initialized = true;
	currentTime = Date.now();
    } else {
	q = oscMsg.args.map(s => s.value);
	previousTime = currentTime;
	currentTime = Date.now();
	elapsedTime = (currentTime - previousTime) / 1000;

	accAngleX = Math.atan(q[1] /   Math.sqrt(q[0] ** 2 + q[2] ** 2)) * 180 / Math.PI;
	accAngleY = Math.atan(- q[0] / Math.sqrt(q[1] ** 2 + q[2] ** 2)) * 180 / Math.PI;

	yaw = yaw + (q[5] * elapsedTime) / 124;

	console.log('roll: ' + accAngleX)
	console.log('pitch: ' + accAngleY)
	console.log('yaw: ' + yaw)
	io.emit('gyro', {pitch: accAngleX, roll: accAngleY, yaw: yaw});
    }
});

// Open the socket.
udpPort.open();
