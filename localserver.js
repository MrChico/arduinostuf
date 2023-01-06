const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const net = require('net');
const osc = require('osc');

// For serving static assets
app.use(express.static(path.join(__dirname, '/')));

app.use('/css', express.static(__dirname + '/css'));

app.get('/', (req, res) => {
    res.sendFile('index.html')
});

io.on('connection', (socket) => {
    console.log('a user connected');
});

server.listen(3000, () => {
    console.log("listening on *:3000");
})
var udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 5000,
    metadata: true
});

// Open the socket.
udpPort.open();

// arduino -> websocket connection
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

var client = new net.Socket();
function tryToConnect() {
    client.connect(1025, '127.0.0.1', sendData).on('error', (err) => {
	console.log('disconnected... trying to reconnect')
	tryToConnect();
    })
}

sendData();


let mice = new Map();
let wind = 2;
let gravity = 0.00004;
let calibrated = false;
let calibration = 0;
let yawVar = 126;
let yawDrift = 0;
let pitchLPF = 0;
let rollLPF = 0;
let yawLPF = 0;

function sendData() {
    console.log("connection to remote server established")
    
    udpPort.on("message", function (oscMsg, timeTag, info) {
	i++;
//	console.log("osc msg received")
	if (!initialized) {
	    initialized = true;
	    currentTime = Date.now();
	} else {
	    if (calibrated) {
		q = oscMsg.args.map(s => s.value);
//		console.log(q);
		previousTime = currentTime;
		currentTime = Date.now();
		elapsedTime = (currentTime - previousTime) / 1000;
		if (elapsedTime > 200) {
		    // disregard messages with too long delay
		    console.log("oh shit")
		}

		pitch = Math.atan2(- q[0] , q[2]) * 57.3;
		roll = Math.atan2(q[1] , q[2]) * 57.3;

		// currently not in use...
		gyroAngleX = (gyroAngleX + (q[3] * elapsedTime) / yawVar - gyroXdrift + 180) % 360 - 180;
		gyroAngleY = (gyroAngleY + (q[4] * elapsedTime) / yawVar - gyroYdrift + 180) % 360 - 180;
		
		yaw = yaw + (q[5] * elapsedTime) / yawVar - yawDrift;

		lpfCoeff = 0.05;
		pitchLPF = pitch * lpfCoeff + pitchLPF * (1 - lpfCoeff);
		rollLPF = roll * lpfCoeff + rollLPF * (1 - lpfCoeff);
		yawLPF = yaw * lpfCoeff + yawLPF * (1 - lpfCoeff);
		// console.log("gyroAngleX: " + gyroAngleX);
		// console.log("gyroAngleY: " + gyroAngleY);
		// console.log("pitch: " + pitch);
		// console.log("roll: " + roll);
//		let info = {pitch: pitch, roll: rol, yaw: 0};
//		let info = {pitch: pitch, roll: roll, yaw: yaw};
		let infoLPF = {pitch: pitchLPF, roll: rollLPF, yaw: yawLPF};
		// console.log(info);
		// console.log("low passed")
		// console.log(infoLPF);
		
		// send to our local web instance
		if (i % 20 == 0) {
		    io.emit('gyro', infoLPF);
		    let data = Buffer.from(JSON.stringify(infoLPF))
		}
		
		// // send to remote server
		// if (i % 20 == 0) {
		// 	client.write(data, error => {
		// 	    if (error) {
		// 		console.log('not sent')
		// 	    } else {
		// 		console.log('Data sent !!!')
		// 	    }
		// 	})
		    // }
	    } else {
		if (calibration == 0) {
		    console.log("calculating yaw drift... hold the device still for the next 3 seconds")
		    calibrationStart = Date.now();
		    calibration++;
		}
		if (calibration < 1001) {
		    q = oscMsg.args.map(s => s.value);
		    previousTime = currentTime;
		    currentTime = Date.now();
		    elapsedTime = (currentTime - previousTime) / 1000;
		    gyroAngleX = gyroAngleX + (q[3] * elapsedTime) / yawVar + 180 % 360 - 180;
		    gyroAngleY = gyroAngleY + (q[4] * elapsedTime) / yawVar + 180 % 360 - 180;
		    yaw = yaw + (q[5] * elapsedTime) / yawVar;
		    
		    calibration++;
		} else {
		    pitch = Math.atan2(- q[0] , q[2]) * 57.3;
		    roll = Math.atan2(q[1] , q[2]) * 57.3;

		    console.log("calibration complete")
		    gyroXdrift = gyroAngleX / 1000;
		    gyroYdrift = gyroAngleY / 1000;
		    yawDrift = yaw / 1000;
		    console.log("yaw drift: " + yawDrift);
		    yaw = 0;
		    gyroAngleX = roll
		    gyroAngleY = pitch;
		    calibrated = true;
		}
	    }
	}
    });
}

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
