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

client.connect(1025, '127.0.0.1', function() {
    console.log("connection to remote server established")
    
    udpPort.on("message", function (oscMsg, timeTag, info) {
	console.log("osc msg received")
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
	    let info = {pitch: accAngleX, roll: accAngleY, yaw: yaw};
	    // send to our local web instance
	    io.emit('gyro', info);
	    let data = Buffer.from(JSON.stringify(info))
	    
	    // send to remote server
	    client.write(data, 1025, 'localhost', error => {
		if (error) {
		    console.log(error)
		    client.close()
		} else {
		    console.log('Data sent !!!')
		}
	    });
	}
    });
})
