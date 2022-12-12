const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
// const osc = require('osc');
// //const board = new five.Board();

// For serving static assets
app.use(express.static(path.join(__dirname, '/')));

app.use('/css', express.static(__dirname + '/css'));

app.get('/', (req, res) => {
    res.sendFile('index.html', {
	root: (__dirname + '/public')
    });
});

io.on('connection', (socket) => {
    console.log('a user connected');
});

server.listen(3001, () => {
    console.log("listening on *:3001");
})


const udp = require('dgram')


// creating a client socket
const client = udp.createSocket('udp4')

//buffer msg

client.on('message', (msg, info) => {
    let data = JSON.parse(msg.toString());
    console.log("received gyro data: " + data);
    io.emit('gyro', data);
})

client.bind(1025);
// Prints: server listening 0.0.0.0:41234
//sending msg
// client.send(data, 1025, "127.0.0.1", error => {
// if (error) {
//     console.log(error)
//     client.close()
// } else {
//     console.log('Data sent !!!')
// }
// })

// setTimeout( () => {
//     client.close()
// },1000)
