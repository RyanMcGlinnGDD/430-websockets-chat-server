const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read client html into memory
// __dirname is representation for current directory
// same folder as server file
const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`listening on 127.0.0.1: ${port}`);

// pass http server into socketio
const io = socketio(app);

// object to hold all connected servers
const users = [];

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
        // add data to the users array, check for uniqueness
    let addFlag = true;
    for (const piece of users) {
      if (piece === data.name) {
        addFlag = false;
        break;
      }
    }
    if (addFlag) {
      users.push(data.name);

            // message back to new user
      const joinMsg = {
        name: 'server',
        msg: `There are ${Object.keys(users).length} users online`,
      };

      socket.name = data.name;
      socket.emit('msg', joinMsg);

      socket.join('room1');

            // announce to everone in room
      const response = {
        name: 'server',
        msg: `${socket.name} joined the room.`,
      };
      socket.broadcast.to('room1').emit('msg', response);

      console.log(`${data.name} connected`);
      socket.emit('msg', { name: 'server', msg: 'You joined the room' });
    }
    else {
      socket.emit('msg', { name: 'server', msg: `Error: username ${data.name} already in use.` });
      socket.emit('joinError');
    }
  });
};

const onMsg = (sock) => {
    const socket = sock;

    socket.on('msgToServer', (data) => {
        //ensure that the string is long enough
        if(data.msg === '/roll'){
            var rollResult = Math.floor(Math.random() * (5 + 1)) + 1;
            io.sockets.in('room1').emit('roll', { name: data.name, result: rollResult });
            console.log(`${data.name} rolled a ${rollResult}`);
        }
        else if(data.msg.length > 4 && data.msg.substring(0,4) === "/me "){
            var segment = data.msg.substring(4,data.msg.length);
            io.sockets.in('room1').emit('meMsg', { name: data.name, msg: segment });
            console.log(`${data.name} ${segment}`);
        }
        //if not a special message, send a normal message
        else{
            io.sockets.in('room1').emit('msg', { name: data.name, msg: data.msg });
            console.log(`${data.name}: ${data.msg}`);
        }
    
    });
};

const onDisconnect = (sock) => {
    const socket = sock;
    socket.on('disconnect', () => {
        // remove from user list
        var removalIndex = 0;
        for(let piece of users){
            if(piece === socket.name){
                break;
            }
            removalIndex++;
        }
        users.splice(removalIndex, 1);
        
        // announce and exit the hard coded room
        io.sockets.in('room1').emit('msg', { name: 'server', msg: `${socket.name} left the room.` });
        socket.leave('room1');
        console.log(`${socket.name} disconnected`);
    });
};

io.sockets.on('connection', (socket) => {
  console.log('connecting');

  onJoined(socket);
  onMsg(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');
