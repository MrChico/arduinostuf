let positions = [];
let t = 0;
let num = 400;
let radius = 160;
let wind = 2;
let gravity = 0.00004;
let initialPositions = [];


let pitch = 0;
let roll = 0;
let yaw = 0;
let lastPitch = 0
let lastRoll = 0
let lastFrame = 0;
let lastYaw = 0
//var socket = io();
let kk = 0;
let time = Date.now();

//import("../node_modules//socket.io/dist/socket.js");
//let ws = import('ws');
let ws = new WebSocket("ws://localhost:8001")
ws.addEventListener('open', onWebsocketOpen);
ws.addEventListener('close',  onWebsocketClose);
ws.addEventListener('message', onMsgReceive);

function onWebsocketOpen() {
    console.log("we are connected");
}

function onWebsocketClose() {
    console.log("we were disconnected");
}

function onMsgReceive(msg) {
    let orientation = JSON.parse(msg.data);
    lastPitch = pitch;
    pitch = orientation.pitch;
}

let device;
async function rnbosetup() {
    const patchExportURL = "export2/patch.export.json";
    // Create AudioContext
    const WAContext = window.AudioContext || window.webkitAudioContext;
    const context = new WAContext();

    // Create gain node and connect it to audio output
    const outputNode = context.createGain();
    outputNode.connect(context.destination);
    
    // Fetch the exported patcher
    let response, patcher;
    try {
        response = await fetch(patchExportURL);
        patcher = await response.json();
    
        if (!window.RNBO) {
            // Load RNBO script dynamically
            // Note that you can skip this by knowing the RNBO version of your patch
            // beforehand and just include it using a <script> tag
            await loadRNBOScript(patcher.desc.meta.rnboversion);
        }

    } catch (err) {
        const errorContext = {
            error: err
        };
        if (response && (response.status >= 300 || response.status < 200)) {
            errorContext.header = `Couldn't load patcher export bundle`,
            errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
            ` trying to load "${patchExportURL}". If that doesn't` + 
            ` match the name of the file you exported from RNBO, modify` + 
            ` patchExportURL in app.js.`;
        }
        if (typeof guardrails === "function") {
            guardrails(errorContext);
        } else {
            throw err;
        }
        return;
    }
    
    // (Optional) Fetch the dependencies
    let dependencies = [];
    try {
        const dependenciesResponse = await fetch("export/dependencies.json");
        dependencies = await dependenciesResponse.json();

        // Prepend "export" to any file dependenciies
        dependencies = dependencies.map(d => d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d);
    } catch (e) {}

    // Create the device
    try {
        device = await RNBO.createDevice({ context, patcher });
    } catch (err) {
        if (typeof guardrails === "function") {
            guardrails({ error: err });
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Load the samples
    if (dependencies.length)
        await device.loadDataBufferDependencies(dependencies);

    // Connect the device to the web audio graph
    device.node.connect(outputNode);

    // (Optional) Extract the name and rnbo version of the patcher from the description
    document.getElementById("patcher-title").innerText = (patcher.desc.meta.filename || "Unnamed Patcher") + " (v" + patcher.desc.meta.rnboversion + ")";

    // (Optional) Automatically create sliders for the device parameters
    makeSliders(device);

    // (Optional) Create a form to send messages to RNBO inputs
    makeInportForm(device);

    // (Optional) Attach listeners to outports so you can log messages from the RNBO patcher
    attachOutports(device);

    // (Optional) Load presets, if any
    loadPresets(device, patcher);

    // (Optional) Connect MIDI inputs
    makeMIDIKeyboard(device);

    document.body.onclick = () => {
        context.resume();
    }

    // Skip if you're not using guardrails.js
    if (typeof guardrails === "function")
        guardrails();
}

function loadRNBOScript(version) {
    return new Promise((resolve, reject) => {
        if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
            throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
        }
        const el = document.createElement("script");
        el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load rnbo.js v" + version));
        };
        document.body.append(el);
    });
}

function makeSliders(device) {
    let pdiv = document.getElementById("rnbo-parameter-sliders");
    let noParamLabel = document.getElementById("no-param-label");
    if (noParamLabel && device.numParameters > 0) pdiv.removeChild(noParamLabel);

    // This will allow us to ignore parameter update events while dragging the slider.
    let isDraggingSlider = false;
    let uiElements = {};

    device.parameters.forEach(param => {
        // Subpatchers also have params. If we want to expose top-level
        // params only, the best way to determine if a parameter is top level
        // or not is to exclude parameters with a '/' in them.
        // You can uncomment the following line if you don't want to include subpatcher params
        
        //if (param.id.includes("/")) return;

        // Create a label, an input slider and a value display
        let label = document.createElement("label");
        let slider = document.createElement("input");
        let text = document.createElement("input");
        let sliderContainer = document.createElement("div");
        sliderContainer.appendChild(label);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(text);

        // Add a name for the label
        label.setAttribute("name", param.name);
        label.setAttribute("for", param.name);
        label.setAttribute("class", "param-label");
        label.textContent = `${param.name}: `;

        // Make each slider reflect its parameter
        slider.setAttribute("type", "range");
        slider.setAttribute("class", "param-slider");
        slider.setAttribute("id", param.id);
        slider.setAttribute("name", param.name);
        slider.setAttribute("min", param.min);
        slider.setAttribute("max", param.max);
        if (param.steps > 1) {
            slider.setAttribute("step", (param.max - param.min) / (param.steps - 1));
        } else {
            slider.setAttribute("step", (param.max - param.min) / 1000.0);
        }
        slider.setAttribute("value", param.value);

        // Make a settable text input display for the value
        text.setAttribute("value", param.value.toFixed(1));
        text.setAttribute("type", "text");

        // Make each slider control its parameter
        slider.addEventListener("pointerdown", () => {
            isDraggingSlider = true;
        });
        slider.addEventListener("pointerup", () => {
            isDraggingSlider = false;
            slider.value = param.value;
            text.value = param.value.toFixed(1);
        });
        slider.addEventListener("input", () => {
            let value = Number.parseFloat(slider.value);
            param.value = value;
        });

        // Make the text box input control the parameter value as well
        text.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                let newValue = Number.parseFloat(text.value);
                if (isNaN(newValue)) {
                    text.value = param.value;
                } else {
                    newValue = Math.min(newValue, param.max);
                    newValue = Math.max(newValue, param.min);
                    text.value = newValue;
                    param.value = newValue;
                }
            }
        });

        // Store the slider and text by name so we can access them later
        uiElements[param.name] = { slider, text };

        // Add the slider element
        pdiv.appendChild(sliderContainer);
    });

    // Listen to parameter changes from the device
    device.parameterChangeEvent.subscribe(param => {
        if (!isDraggingSlider)
            uiElements[param.name].slider.value = param.value;
        uiElements[param.name].text.value = param.value.toFixed(1);
    });
}

function makeInportForm(device) {
    const idiv = document.getElementById("rnbo-inports");
    const inportSelect = document.getElementById("inport-select");
    const inportText = document.getElementById("inport-text");
    const inportForm = document.getElementById("inport-form");
    let inportTag = null;
    
    // Device messages correspond to inlets/outlets or inports/outports
    // You can filter for one or the other using the "type" of the message
    const messages = device.messages;
    const inports = messages.filter(message => message.type === RNBO.MessagePortType.Inport);

    if (inports.length === 0) {
        idiv.removeChild(document.getElementById("inport-form"));
        return;
    } else {
        idiv.removeChild(document.getElementById("no-inports-label"));
        inports.forEach(inport => {
            const option = document.createElement("option");
            option.innerText = inport.tag;
            inportSelect.appendChild(option);
        });
        inportSelect.onchange = () => inportTag = inportSelect.value;
        inportTag = inportSelect.value;

        inportForm.onsubmit = (ev) => {
            // Do this or else the page will reload
            ev.preventDefault();

            // Turn the text into a list of numbers (RNBO messages must be numbers, not text)
            const values = inportText.value.split(/\s+/).map(s => parseFloat(s));
            
            // Send the message event to the RNBO device
            let messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, inportTag, values);
            device.scheduleEvent(messageEvent);
        }
    }
}

function attachOutports(device) {
    const outports = device.messages.filter(message => message.type === RNBO.MessagePortType.Outport);
    if (outports.length < 1) {
        document.getElementById("rnbo-console").removeChild(document.getElementById("rnbo-console-div"));
        return;
    }

    document.getElementById("rnbo-console").removeChild(document.getElementById("no-outports-label"));
    device.messageEvent.subscribe((ev) => {

        // Message events have a tag as well as a payload
        console.log(`${ev.tag}: ${ev.payload}`);

        document.getElementById("rnbo-console-readout").innerText = `${ev.tag}: ${ev.payload}`;
    });
}

function loadPresets(device, patcher) {
    let presets = patcher.presets || [];
    if (presets.length < 1) {
        document.getElementById("rnbo-presets").removeChild(document.getElementById("preset-select"));
        return;
    }

    document.getElementById("rnbo-presets").removeChild(document.getElementById("no-presets-label"));
    let presetSelect = document.getElementById("preset-select");
    presets.forEach((preset, index) => {
        const option = document.createElement("option");
        option.innerText = preset.name;
        option.value = index;
        presetSelect.appendChild(option);
    });
    presetSelect.onchange = () => device.setPreset(presets[presetSelect.value].preset);
}

function makeMIDIKeyboard(device) {
    let mdiv = document.getElementById("rnbo-clickable-keyboard");
    if (device.numMIDIInputPorts === 0) return;

    mdiv.removeChild(document.getElementById("no-midi-label"));

    const midiNotes = [49, 52, 56, 63];
    midiNotes.forEach(note => {
        const key = document.createElement("div");
        const label = document.createElement("p");
        label.textContent = note;
        key.appendChild(label);
        key.addEventListener("pointerdown", () => {
            let midiChannel = 0;

            // Format a MIDI message paylaod, this constructs a MIDI on event
            let noteOnMessage = [
                144 + midiChannel, // Code for a note on: 10010000 & midi channel (0-15)
                note, // MIDI Note
                100 // MIDI Velocity
            ];
        
            let noteOffMessage = [
                128 + midiChannel, // Code for a note off: 10000000 & midi channel (0-15)
                note, // MIDI Note
                0 // MIDI Velocity
            ];
        
            // Including rnbo.min.js (or the unminified rnbo.js) will add the RNBO object
            // to the global namespace. This includes the TimeNow constant as well as
            // the MIDIEvent constructor.
            let midiPort = 0;
            let noteDurationMs = 250;
        
            // When scheduling an event to occur in the future, use the current audio context time
            // multiplied by 1000 (converting seconds to milliseconds) for now.
            let noteOnEvent = new RNBO.MIDIEvent(device.context.currentTime * 1000, midiPort, noteOnMessage);
            let noteOffEvent = new RNBO.MIDIEvent(device.context.currentTime * 1000 + noteDurationMs, midiPort, noteOffMessage);
        
            device.scheduleEvent(noteOnEvent);
            device.scheduleEvent(noteOffEvent);

            key.classList.add("clicked");
        });

        key.addEventListener("pointerup", () => key.classList.remove("clicked"));

        mdiv.appendChild(key);
    });
}

rnbosetup();
disableFriendlyErrors = true;

//util

function reviver(key, value) {
    if(typeof value === 'object' && value !== null) {
	if (value.dataType === 'Map') {
	    return new Map(value.value);
	}
    }
    return value;
}

var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function() {
	this.classList.toggle("active");
	var content = this.nextElementSibling;
	if (content.style.display === "block") {
	    content.style.display = "none";
	} else {
	    content.style.display = "block";
	}
    });
}

// socket.on('gyro', function(msg) {
//     if (frameCount - lastFrame > 5) {
// 	lastPitch = pitch;
// 	lastRoll = roll;
// 	lastYaw = yaw;
// 	lastFrame = frameCount;
// 	pitch = msg.pitch;
// 	roll = msg.roll;
// 	yaw = msg.yaw;
// 	time = Date.now();
//     }
// });



function setup() {
    let c = createCanvas(windowWidth, windowHeight);
    clear()
    for (let i = 0; i < 400; i++) {
  	let r = (1 / sqrt(random())) * radius;
  	let theta = random(TWO_PI);
  	let x = cos(theta) * r;
  	let y = sin(theta) * r;
  	let z = random() * 2;
  	positions.push({"x": x, "y": y, "z": z});
	initialPositions.push({"x": x, "y": y, "z": z});
	strokeWeight((noise(t, i) * 8 + 3));
	stroke('white')
	point(positions[i].x, positions[i].y, positions[i].z);
    }
}
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

var windslider = document.getElementById("wind");

windslider.oninput = function() {
//    socket.emit("windchange", this.value);
    wind = this.value;
}

// socket.on("wind", function(newVal) {
//     windslider.value = newVal;
//     wind = newVal;
// })

var gravityslider = document.getElementById("gravity");
gravityslider.oninput = function() {
//    socket.emit("gravitychange", this.value);
    const param = device.parametersById.get("motion");
    param.value = this.value * 2000;
    gravity = this.value;
}

// socket.on("gravity", function(newVal) {
//     gravityslider.value = newVal;
//     gravity = newVal;
// })

window.addEventListener('mousemove', trackPos)

let mouseY = 0;
let mouseX = 0;
function trackPos(e) {
    mouseY = e.clientY;
    mouseX = e.clientX;
}
let r = Math.floor(Math.random() * 255);
let g = 150 + Math.floor(Math.random() * 100);
let b = 150 + Math.floor(Math.random() * 100);

function drawGradient(x, y) {
  var radius = dim/2;
  var h = random(0, 360);
  for (r = radius; r > 0; --r) {
    fill(h, 90, 90);
    ellipse(x, y, r, r);
    h = (h + 1) % 360;
  }
}

function draw() {
    angleMode(DEGREES);
    background(0,0,0);
    // let xAxis = createVector(1,0,0);
    // let yAxis = createVector(0,1,0);
    // let zAxis = createVector(0,0,1);
    let interpolated = Math.min(1, (frameCount - lastFrame) / 50);
    let p = lastPitch * (1 - interpolated) + pitch * interpolated;
    // let r = lastRoll  * (1 - interpolated) + roll  * interpolated; 
    // let y = lastYaw   * (1 - interpolated) + yaw   * interpolated;
    // rotate(p, xAxis);
    // rotate(r, yAxis);
    // rotate(y, zAxis);
    translate(windowWidth / 2, windowHeight / 2);
    translate(noise(t) * 55, noise(t + 45) * 55);
    push();
    let g = gravity + sin(frameCount / 4) * gravity - sin(frameCount / 17 + 15) * gravity * 1.6 + (p / 60) * gravity;
    let rr = radius - noise(t / 10) * 150
    // let c1 = color(Math.floor(noise(i) * 255),Math.floor(noise(i) * 255),Math.floor(noise(i) * 255));
    // let c = lerpColor(c1, color(255,255,255), 0);
    // strokeWeight(200);
    // stroke(c);
    // stroke(Math.floor(noise(i) * 255),Math.floor(noise(i) * 255),Math.floor(noise(i) * 255))
    // point(0, 0, 0);

    t += 0.01;
    for (let i = 0; i < num; i++) {
	let x = positions[i].x;
	let y = positions[i].y;
	let distance = sqrt(x ** 2 + y ** 2);
	positions[i].x = x - g * x * distance
	    + wind * (sqrt(distance - rr)) * (noise(t, i) - .5);
	positions[i].y = y - g * y * distance
	    + wind * (sqrt(distance - rr)) * (noise(t + 5, i) - .5);
	if (Number.isNaN(positions[i].x) || Number.isNaN(positions[i].y)) {
	    positions[i].x = initialPositions[i].x;// + 200 * noise(i) - 50;
	    positions[i].y = initialPositions[i].y;// + 200 * noise(i) - 50;
	} 
	//	console.log(noise(i))
	// let c = lerpColor(c1, color(255,255,255), inter);
	x = positions[i].x;
	y = positions[i].y;
	distance = sqrt(x ** 2 + y ** 2);
	let dist = sqrt(sqrt(sqrt(Math.abs(distance - radius))) / 1.8);
	//	console.log(dist);
	let k = 6;
//	for (let k = 1; k < 8; k++) {
	let wt = Math.floor(4 + 4 * noise(t,i) * 4 * (dist));
	//	    console.log("weight: " + wt);
	strokeWeight(wt);
	let c = lerpColor(color(0,0,0),  color((255 / dist),(255 / dist), (255 / dist)), k / 8);
	let c1 = Math.floor(255 * ((k + 1) / 8));
	//	    console.log("color: " + c1)
	stroke(c);
	//	    stroke(Math.floor(noise(i) * 255),Math.floor(noise(i) * 255),Math.floor(noise(i) * 255))
	point(positions[i].x, positions[i].y, positions[i].z);
//	}
    }
//    camera(200, 200, 200);
    pop();
    loop();
    // rotate(- pitch, xAxis);
    // rotate(- roll,  yAxis);
    // rotate(- yaw,   zAxis);

    // // our pointer:
    // strokeWeight(15);
    // stroke(r,g,b)
    // point(mouseX - windowWidth / 2, mouseY -  windowHeight / 2);
    // // other pointers
    // // mice.forEach(v => {
    // // 	strokeWeight(10);
    // // 	console.log('colors')
    // // 	console.log('r: ' + v.r);
    // // 	stroke(v.r, v.g, v.b)
    // // 	point(v.mx - windowWidth / 2, v.my -  windowHeight / 2);
    // // })
    // rotate(pitch, xAxis);
    // rotate(roll,  yAxis);
    // rotate(yaw,   zAxis);
}

