// Run this whole guy from within Max
const osc = require('osc');
const WebSocket = require('ws');
const protobuf = require('protobufjs');
const Max = require('max-api');

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
const initialReconnectDelay = 1000;
let currentReconnectDelay = initialReconnectDelay;
const maxReconnectDelay = 16000;

function connect() {
    ws = new WebSocket(url);
    ws.addEventListener('open', onWebsocketOpen);
    ws.addEventListener('close',  onWebsocketClose);
}

function onWebsocketOpen() {
    console.log("connected to websocket!");
    currentReconnectDelay = initialReconnectDelay;
}

function onWebsocketClose() {
    console.log("disconnected.")
    ws = null;
    let delay = currentReconnectDelay + Math.floor(Math.random() * 3000);
    console.log("reconnecting in: " + delay + " ms");
    // Add anything between 0 and 3000 ms to the delay.  
    setTimeout(() => {
        reconnectToWebsocket();
    }, delay)
}

function reconnectToWebsocket() {
    if(currentReconnectDelay < maxReconnectDelay) {
        currentReconnectDelay*=2;
    }
    connect();
}

async function run() {
    root = await protobuf.load('message.proto');
    Timestamp = root.lookupType('Timestamp');
    Payload = root.lookupType('Payload');
    GyroData = root.lookupType('PendulumGyro');
    connect();
}


run().catch(err => console.log(err));


// arduino -> websocket connection
// Listen for incoming OSC messages.
let lastUpdate;
udpPort.on("message", function (oscMsg, timeTag, info) {
    i++;
    if (!initialized) {
	initialized = true;
	currentTime = Date.now();
	lastUpdate = 0;
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
	    let infoLPF = {pitch: pitchLPF, roll: rollLPF, yaw: yawLPF};
//	    console.log(infoLPF);

	    Max.setDict("orientation", {pitch: pitchLPF, roll: rollLPF, yaw: yawLPF});
	    // forward to websocket
	    if (ws !== null && ws.readyState == WebSocket.OPEN && (currentTime - lastUpdate) > 80) {
		lastUpdate = currentTime;
		let gd = {pendulumGyro: 
			  GyroData.create({
			      pitch: Math.floor(pitchLPF),
			      roll: Math.floor(rollLPF),
			      yaw: Math.floor(yawLPF),
			      timestamp: Timestamp.create({seconds: Math.floor(currentTime / 1000),
							   nanos: (currentTime % 1000) * 1000000
							  })
			  })
			 };
		const err = Payload.verify(gd);
		if (!err) {
		    gdinstance = Payload.create(gd);
		    const buf = Payload.encode(gdinstance).finish();
		    console.log("sending...")
		    ws.send(buf);
		} else {
		    console.log("invalid payload...")
		}
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

