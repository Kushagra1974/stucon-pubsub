import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import http from 'http'
import path from 'path'
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { fileURLToPath } from 'url';
import { Server } from 'socket.io'
import { connectToDB } from './classes/Connect.js';
import { WebSocket } from './classes/WebSocket.js';
import { messageRouter } from './routes/Message.js'
import { authRouter } from './routes/Auth.js';
import { uploadRouter } from './routes/Upload.js';
import { friendRouter } from './routes/Friend.js';
import { userRouter } from './routes/Users.js'
import { notificationRouter } from './routes/Notifications.js';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

const pubClient = createClient({ url: `rediss://${process.env.REDIS_HOST_NAME}:6380`, password: process.env.REDIS_ACCESS_KEY });
const subClient = pubClient.duplicate();


const subscriber = (event, fun) => {
    subClient.on(event, fun)
}

const publisher = (event, msg) => {
    pubClient.publish(event, msg);
}

export const channelName = {
    SERVER_SYNC: "server-sync"
}

export const messagesCategory = {
    ADD_USER: "update-online-users",
    REMOVE_USER: "remove-user",
    SEND_PERSONAL_MESSAGE: "send-personal-message",
    MESSAGE_READ: "message-read",
    UPDATE_MESSAGE_COUNT: "update-message-count",
    USER_IS_TYPING: "user-is-typing",
    USER_NOT_TYPING: "user-not-typing",
    CONNECTION_REQ_ACC: "connection-req-accepted",
    CONNECTION_REQ_SEND: "connection-req-send",
}

export const serverSyncPublisher = (msg) => {
    publisher(channelName.SERVER_SYNC, JSON.stringify(msg))
}

export const serverSyncSubscriber = (callback) => {
    if (typeof (callback) !== 'function') throw new Error('Expected a function as an argument');
    subscriber(channelName.SERVER_SYNC, (msg) => { callback(JSON.parse(msg)) })
}

app.use(express.json())
app.use(cors({ origin: '*' }))
app.use('/auth', authRouter)
app.use('/message', messageRouter)
app.use('/upload', uploadRouter)
app.use('/friends', friendRouter)
app.use('/user', userRouter)
app.use('/notification', notificationRouter)


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// app.use(express.static(path.join(__dirname, 'dist')))
// app.get('/', function (req, res) {
//     console.log(path.join(__dirname, 'static', 'index.html'));
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });

app.use((req, res) => {
    res.status(404).json(`Not found - ${req.originalUrl}`)
})


const listenSocketTraffic = () => {
    WebSocket.io = io
    io.on('connection', (socket) => {
        console.log("Socket Connected");
        const webSocket = new WebSocket(socket);
    })
}

try {
    console.log("connecting to redis")

    await Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("connected to redis");
        server.listen(process.env.SERVER_PORT, async () => {
            console.log(`Server running at: http://localhost:${process.env.SERVER_PORT}`);
            await connectToDB()
            listenSocketTraffic()
        });
    });
}
catch (err) {
    console.log(err);
}


















