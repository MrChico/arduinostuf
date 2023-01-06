var net = require('net');

var client = new net.Socket();
client.connect(1025, '127.0.0.1', function() {
    console.log('Connected');
    let sent = false;
    let i = 0;
    while (true) {
	if (Date.now() % 20) {
	    if (!sent) {
		sent = true;
		i++;
		console.log("sending data: " + i)
		let msg = {pitch: 300 + i * 10, roll: 300, yaw: 300};
		console.log(msg);
		client.write(JSON.stringify({pitch: 300 + i * 10, roll: 300, yaw: 300}))
	    }
	} else {
	    sent = false;
	}
    }
});
