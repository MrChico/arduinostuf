var net = require('net');

var client = new net.Socket();
client.connect(1025, '127.0.0.1', function() {
	console.log('Connected');
    client.write(JSON.stringify({pitch: 300, roll: 300, yaw: 300}))
});
