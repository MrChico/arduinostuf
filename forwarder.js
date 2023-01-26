const osc = require('osc');
const WebSocket = require('ws');
const protobuf = require('protobufjs');

var udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 5000,
    metadata: true
});

// Open the socket.
udpPort.open();

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

let wind = 2;
let gravity = 0.00004;
let calibrated = false;
let calibration = 0;
let yawVar = 126;
let yawDrift = 0;
let pitchLPF = 0;
let rollLPF = 0;
let yawLPF = 0;

let root;
let Timestamp;
let Payload;
let GyroData;
let ws;

const url = "wss://swarm.haywirez.xyz?source=pendulum";

// arduino -> websocket connection
// Listen for incoming OSC messages.
function receiveOSCAndSend(ws) {
    console.log("waiting for osc messages");
    udpPort.on("message", function (oscMsg, timeTag, info) {
//	console.log("going forward!");
	i++;
//	console.log("osc msg received")
	if (!initialized) {
	    initialized = true;
	    currentTime = Date.now();
	} else {
	    if (calibrated) {
		q = oscMsg.args.map(s => s.value);
		previousTime = currentTime;
		currentTime = Date.now();
		elapsedTime = (currentTime - previousTime) / 1000;
		
		if (elapsedTime > 200) {
		    console.log("Beware: LONG DELAY BETWEEN OSC MESSAGES!")
		}
		
		pitch = Math.atan2(- q[0] , q[2]) * 57.3;
		roll = Math.atan2(q[1] , q[2]) * 57.3;
		
		// currently we are not using these guys...
		gyroAngleX = (gyroAngleX + (q[3] * elapsedTime) / yawVar - gyroXdrift + 180) % 360 - 180;
		gyroAngleY = (gyroAngleY + (q[4] * elapsedTime) / yawVar - gyroYdrift + 180) % 360 - 180;
		
		yaw = yaw + (q[5] * elapsedTime) / yawVar - yawDrift;
		
		lpfCoeff = 0.3;
		pitchLPF = pitch * lpfCoeff + pitchLPF * (1 - lpfCoeff);
		rollLPF = roll * lpfCoeff + rollLPF * (1 - lpfCoeff);
		yawLPF = yaw * lpfCoeff + yawLPF * (1 - lpfCoeff);
		// console.log("gyroAngleX: " + gyroAngleX);
		// console.log("gyroAngleY: " + gyroAngleY);
		// console.log("pitch: " + pitch);
		// console.log("roll: " + roll);
		// let info = {pitch: pitch, roll: roll, yaw: yaw};
		let infoLPF = {pitch: pitchLPF, roll: rollLPF, yaw: yawLPF};
		// console.log(info);
		// console.log("low passed")
		// forward to websocket
		if (ws.readyState == WebSocket.OPEN) {
		    let gd = {pendulumGyro: 
			      GyroData.create({
				  pitch: pitchLPF,
				  roll: rollLPF,
				  yaw: yawLPF,
				  timestamp: Timestamp.create({seconds: currentTime / 1000,
							       nanos: (currentTime % 1000) * 1000000
							      })
			      })
			     };
		    gdinstance = Payload.create(gd);
		    const buf = Payload.encode(gdinstance).finish();
		    ws.send(buf);
		}
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

var openWebSocket = function() {
    var ws = new WebSocket(url);
    ws.on('open', function() {
        console.log('connected');
	receiveOSCAndSend(ws);
    });
    ws.on('close', function() {
        console.log('disconnected');
        openWebSocket();
    });
    ws.on('error', function() {
	console.log("error from the server...");
	openWebSocket();
    })
}


async function run() {
    root = await protobuf.load('message.proto');
    Timestamp = root.lookupType('Timestamp');
    Payload = root.lookupType('Payload');
    GyroData = root.lookupType('PendulumGyro');
    openWebSocket();
}


run().catch(err => console.log(err));
