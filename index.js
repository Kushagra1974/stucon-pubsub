import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import http from 'http'
import path from 'path'
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
import { cacheConnection } from "./classes/Redis.js"
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});
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


server.listen(process.env.SERVER_PORT, async () => {
    console.log(`Server running at: http://localhost:${process.env.SERVER_PORT}`);
    // listenSocketTraffic()
    await cacheConnection.connect()
    // await connectToDB()

});











