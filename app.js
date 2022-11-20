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
    console.log("board online");
  var gyro = new five.Gyro({
      controller: "MPU6050",
  });
  gyro.recalibrate();// Tell the device to recalibrate
    var pitch = gyro.pitch.angle;
    var roll  = gyro.roll.angle;
    var yaw   = gyro.yaw.angle;
    gyro.on("change", function() {
      if (   Math.abs(this.pitch.angle - pitch) > 1
	  || Math.abs(this.roll.angle - roll) > 1
	  || Math.abs(this.yaw.angle - yaw) > 1
	 ) {
	  console.log("gyro");
	  console.log("  x            : ", this.x);
	  console.log("  y            : ", this.y);
	  console.log("  z            : ", this.z);
	  console.log("  pitch        : ", this.pitch);
	  console.log("  roll         : ", this.roll);
	  console.log("  yaw          : ", this.yaw);
	  console.log("  rate         : ", this.rate);
	  pitch = gyro.pitch.angle;
	  roll  = gyro.roll.angle;
	  yaw   = gyro.yaw.angle;
	  io.emit('gyro', {pitch: this.pitch, roll: this.roll, yaw: this.yaw})
      }
  });
})


server.listen(3000, () => {
  console.log('listening on *:3000');
});

