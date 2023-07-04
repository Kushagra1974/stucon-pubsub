import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url';

import { Server } from 'socket.io'
import { Connect } from './classes/Connect.js';
import { Message, Connection, ConnectionRequest, UserNotification } from './modles/Schema.js';


import { messageRouter } from './routes/Message.js'
import { authRouter } from './routes/Auth.js';
import { uploadRouter } from './routes/Upload.js';
import { friendRouter } from './routes/Friend.js';
import { userRouter } from './routes/Users.js'
import { notificationRouter } from './routes/Notifications.js';


import mongoose from 'mongoose'

const ObjectId = mongoose.Types.ObjectId

dotenv.config();
const app = express();
app.use(cors())

const server = http.createServer(app);
const io = new Server(server, {
});

let onlineUsers = []

app.use(express.json())

app.use('/auth', authRouter)
app.use('/message', messageRouter)
app.use('/upload', uploadRouter)
app.use('/friends', friendRouter)
app.use('/user', userRouter)
app.use('/notification', notificationRouter)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')))

app.get('/', function (req, res) {
    // console.log(path.join(__dirname, 'static', 'index.html'));
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


app.use((req, res) => {
    res.status(404).json(`Not found - ${req.originalUrl}`)
})


const isValidObjectId = (id) => {

    if (ObjectId.isValid(id)) {
        if ((String)(new ObjectId(id)) === id)
            return true;
        return false;
    }
    return false;
}

const notifyOnlineFriendOfUser = async (userId, isConnected) => {
    if (userId === "") {
        // console.log("User Id Is Missing");
        return;
    }
    let userFrnds = [];
    try {
        userFrnds = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
    } catch (err) {
        console.log('Server Error', err);
    }
    userFrnds.sort((a, b) => {
        return a.friend._id.toString() > b.friend._id.toString()
    })
    onlineUsers.sort((a, b) => {
        return a.userId > b.userId
    })
    let onlineUserIdx = 0;
    let userFrndIdx = 0;
    while (0 <= onlineUserIdx && onlineUserIdx < onlineUsers.length && 0 <= userFrndIdx && userFrndIdx < userFrnds.length) {
        const onlineUserId = onlineUsers[onlineUserIdx].userId;
        const userFrndId = userFrnds[userFrndIdx].friend._id.toString();
        if (onlineUserId === userFrndId) {
            // emmit userdata to the current online friend
            const frndSocketId = onlineUsers[onlineUserIdx].socketId;
            if (isConnected) {
                io.to(frndSocketId).emit("frnd-online", userId)
            }
            else {
                io.to(frndSocketId).emit("frnd-offline", userId)
            }
            onlineUserIdx++;
            userFrndIdx++
        }
        else if (onlineUserId < userFrndId) {
            onlineUserIdx++;
        } else {
            userFrndIdx++;
        }
    }
}

io.on('connection', (socket) => {
    console.log("UserConnected", socket.id);

    socket.on("user-online", async (userId) => {
        console.log('user-online', userId, socket.id);
        let userFound = false;
        for (let i = 0; i < onlineUsers.length; i++) {
            const user = onlineUsers[i];
            if (user.userId === userId) {
                user.socketId = socket.id
                userFound = true;
            }
        }
        if (!userFound) {
            onlineUsers.push({ userId, socketId: socket.id });
            await notifyOnlineFriendOfUser(userId, true)
        }
    })

    socket.on("get-intial-unread-messages-count", async ({ friendId, userId }) => {
        try {
            const receivedMessages = await Message.find({ sender: friendId, receiver: userId, isRead: false });
            // console.log(receivedMessages);
            const unreadMessagesCount = receivedMessages.length;
            const user = onlineUsers.find((user) => user.userId === userId)
            const socketId = user?.socketId
            if (socketId)
                io.to(socketId).emit("update-intial-unread-messages", { unreadMessagesCount, userId: friendId, receivedMessages });
        } catch (err) {
            console.log(err);
        }
    })

    socket.on("istyping", ({ userId, friendId }) => {
        const user = onlineUsers.find((user) => user.userId === friendId)
        if (user)
            io.to(user.socketId).emit("user-typing", userId)
    })

    socket.on("nottyping", ({ userId, friendId }) => {
        const user = onlineUsers.find((user) => user.userId === friendId)
        if (user)
            io.to(user.socketId).emit("user-not-typing", userId)
    })

    socket.on('send-message', async (data) => {
        try {
            // console.log(124, data);
            const msg = new Message({ ...data, isRead: false })
            const savedMsg = await msg.save()
            const userFound = onlineUsers.find((user) => user.userId === data.receiver)
            if (userFound) {
                const friendSocketId = userFound.socketId
                io.to(friendSocketId).emit("recieve-message", { ...savedMsg._doc, type: "received" })
                const userId = userFound.userId
                const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
                const idArray = [];
                friends.forEach((user) => {
                    idArray.push(user.friend.id)
                })

                let count = 0;
                const resolveQuery = await Promise.all(idArray.map((friendId) => {
                    return Message.find({ receiver: userId, sender: friendId, isRead: false });
                }))

                resolveQuery.forEach(users => {
                    if (users.length > 0) count++;
                })
                console.log(173, count);
                io.to(friendSocketId).emit("update-message-notification", count);
            }
            io.to(socket.id).emit("recieve-message", { ...savedMsg._doc, type: "send" })
        } catch (err) {
            console.log(err);
        }
    })

    //! check this 

    socket.on("accept-connection-request", async ({ userId, friendId }) => {

        console.log("connection req accept");
        try {
            await ConnectionRequest.findOneAndDelete({ friend: userId, user: friendId })
            await ConnectionRequest.findOneAndDelete({ friend: friendId, user: userId })
            const newConnection = new Connection({ user: userId, friend: friendId });
            const inverseNewConnection = new Connection({ user: friendId, friend: userId })
            await newConnection.save();
            await inverseNewConnection.save();

            const newFriendNotification = new UserNotification({ user: userId, friend: friendId, type: "CONNECTED" })
            const newFriendNotify = await newFriendNotification.save();
            const friendNotify = await UserNotification.findById(newFriendNotify._id).populate({ path: "friend", select: "userName email educationInstitute employer" }).select('friend type createdAt')

            //! why this  is null 
            // console.log(182, newFriendNotify, friendNotify);
            // ! chat send value to ->  friendNotify
            io.to(socket.id).emit("update-local-notification", friendNotify)

            const newuserNotification = new UserNotification({ user: friendId, friend: userId, type: "CONNECTION_REQUEST_ACCEPTED" })
            const newuserNotifi = await newuserNotification.save()

            const friend = onlineUsers.find((usr) => usr.userId === friendId)
            if (friend?.socketId) {
                const userNotify = await UserNotification.findById(newuserNotifi._id).populate({ path: "friend", select: "userName email educationInstitute employer" }).select('friend type createdAt')
                console.log(191, newuserNotifi, userNotify);
                // ! chat send value to ->  userNotify

                io.to(friend.socketId).emit("update-local-notification", userNotify);
            }
        } catch (err) {
            console.log(err)
        }
    })


    socket.on("send-connection-request", async ({ userId, friendId }) => {
        try {
            const prevReq = await ConnectionRequest.findOne({ user: userId, friend: friendId })
            if (prevReq) {
                console.log(prevReq);
                return io.to(socket.id).emit("acknowlege-send-connection-request", { msg: "request-pending", friendId })
            }
            const newConnectionReq = new ConnectionRequest({ user: userId, friend: friendId });
            const savedConnection = await newConnectionReq.save();

            const friend = onlineUsers.find(user => user.userId === friendId)
            const socketId = friend?.socketId
            console.log(friend, friendId, onlineUsers);
            console.log(199, socketId);

            if (socketId) {
                const user = await ConnectionRequest.findById(savedConnection._id).populate({ path: 'user', select: 'userName educationInstitute employer' }).select('user')
                let sendData = {};
                if (user) {
                    sendData = { _id: user.user._id, userName: user.user.userName, employer: user.user.employer, educationInstitute: user.user.educationInstitute }
                    console.log(207, sendData, socketId, onlineUsers);

                    io.to(socketId).emit("connection-request", sendData)
                }
            }
        } catch (err) {
            console.log(err)
        }
    })

    socket.on("mark-message-read", async ({ messageId, friendId, userId }) => {
        if (isValidObjectId(messageId)) {
            const friend = onlineUsers.find((user) => user.userId === friendId)
            console.log("message-seen", userId);
            try {
                const resp = await Message.findByIdAndUpdate(messageId, { isRead: true });
                console.log({ resp });
            }
            catch (err) {
                console.log(err);
            }
            if (friend) io.to(friend.socketId).emit("set-message-read", { messageId, friendId: userId });
            if (userId) {
                try {
                    const receivedMessages = await Message.find({ sender: friendId, receiver: userId, isRead: false });
                    const unreadMessagesCount = receivedMessages.length;
                    io.to(socket.id).emit("update-unread-messages", { unreadMessagesCount, userId: friendId, receivedMessages });

                    const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
                    const idArray = [];
                    friends.forEach((user) => {
                        idArray.push(user.friend.id)
                    })

                    let count = 0;
                    const resolveQuery = await Promise.all(idArray.map((friendId) => {
                        return Message.find({ receiver: userId, sender: friendId, isRead: false });
                    }))

                    resolveQuery.forEach(users => {
                        if (users.length > 0) count++;
                    })

                    console.log(264, unreadMessagesCount);
                    io.to(socket.id).emit("update-message-notification", count);

                } catch (err) {
                    console.log(err);
                }
            }
        }
    })

    socket.on('check-friend-online', (userId) => {
        const user = onlineUsers.find((user) => user.userId === userId)
        // console.log(2, user, userId);
        if (user) {
            io.to(socket.id).emit("frnd-online", user.userId);
        }
    })

    // socket.on("uploaded-file", (userId) => {
    //     console.log(`user uploaded a file`, userId)
    //     setTimeout(async () => {
    //         try {
    //             const glbNotification = await GlobalNotification.findById(userId).populate({ path: "user", select: "userName email educationInstitute employer" }).select('user type createdAt');
    //             socket.broadcast.emit("gloabal-Notifications", glbNotification)
    //         } catch (err) {
    //             console.log(err);
    //         }
    //     }, 5000);
    // })

    socket.on('disconnect', async () => {
        let userId = ""
        const updatedOnlineUsers = [];

        for (let i = 0; i < onlineUsers.length; i++) {
            const onlineUser = onlineUsers[i];
            if (onlineUser.socketId === socket.id) userId = onlineUser.userId;
            else updatedOnlineUsers.push(onlineUser);
        }
        await notifyOnlineFriendOfUser(userId, false)
        onlineUsers = updatedOnlineUsers
        // console.log({ onlineUsers });

        console.log(`UserDisconnect ${socket.id}`);
    })
})

server.listen(process.env.SERVER_PORT, () => {
    console.log(`Server running at: http://localhost:${process.env.SERVER_PORT}`);
    Connect.connectToDB();
});
