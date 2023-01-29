const osc = require('osc');
const WebSocket = require('ws');
const protobuf = require('protobufjs');
const Max = require('max-api');

let root;
let Timestamp;
let Payload;
let GyroData;
let ws;

const url = "wss://swarm.haywirez.xyz";

var initialReconnectDelay = 1000;
var currentReconnectDelay = initialReconnectDelay;
var maxReconnectDelay = 16000;

function connect() {
    ws = new WebSocket(url);
    ws.addEventListener('open', onWebsocketOpen);
    ws.addEventListener(
        "message",
        msgHandler
      );

    ws.addEventListener('close',  onWebsocketClose);
}

function msgHandler(msg) {
    const buf = protobuf.util.newBuffer(msg.data);
    const decoded = Payload.decode(buf);
    console.log("msg received")
    console.log(decoded)
    if (decoded.parameterChange && decoded.parameterChange.instrumentId == "bells") {
        const incomingParameterId = decoded.parameterChange?.parameterId;
        const incomingParameterValue =
              decoded.parameterChange?.parameterValue;
	Max.updateDict("params", incomingParameterId, incomingParameterValue);
	Max.updateDict("params", incomingParameterId, incomingParameterValue);
	Max.updateDict("params", incomingParameterId, incomingParameterValue);
    }
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
