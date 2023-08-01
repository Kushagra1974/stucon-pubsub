import { isValidObjectId, Message, Connection, ConnectionRequest, UserNotification } from '../modles/Schema.js';
import { messagesCategory, serverSyncPublisher, serverSyncSubscriber } from "../classes/Redis.js"


serverSyncSubscriber(({ message, payload }) => {
    switch (message) {
        case messagesCategory.SEND_PERSONAL_MESSAGE: {
            const { event, receiver, data } = payload;
            WebSocket.emitDataToRoom({ data, roomId: receiver, eventName: event })
        }
            break;
        case messagesCategory.ADD_USER: {
            const { userId } = payload
            WebSocket.onlineUsers.push({ userId, socketId: "NOT_NATIVE" });
            WebSocket.notifyOnlineFriendOfUser(userId, true);
        }
            break;
        case messagesCategory.REMOVE_USER: {
            const { userId } = payload
            WebSocket.onlineUsers = WebSocket.onlineUsers.filter((user) => { user.userId === userId })
            WebSocket.notifyOnlineFriendOfUser(userId, false)
        }
            break;
        case messagesCategory.USER_IS_TYPING: {
            const { sender, receiver, eventName } = payload;
            WebSocket.emitDataToRoom({ data: sender, roomId: receiver, eventName })
        }
            break;
        case messagesCategory.USER_NOT_TYPING: {
            const { sender, receiver, eventName } = payload;
            WebSocket.emitDataToRoom({ data: sender, roomId: receiver, eventName })
        }
            break;
        case messagesCategory.UPDATE_MESSAGE_COUNT: {
            const { receiver, data, eventName } = payload;
            WebSocket.emitDataToRoom({ data, eventName, roomId: receiver })
        }
        case messagesCategory.CONNECTION_REQ_ACC: {
            const { receiver, data, eventName } = payload
            WebSocket.emitDataToRoom({ data, eventName, roomId: receiver })
        }
        case messagesCategory.CONNECTION_REQ_SEND: {
            const { receiver, data, eventName } = payload
            WebSocket.emitDataToRoom({ data, eventName, roomId: receiver })
        }
            break;
        case messagesCategory.MESSAGE_READ: {
            const { receiver, data, eventName } = payload
            WebSocket.emitDataToRoom({ data, eventName, roomId: receiver })
        }
            break;
        default: return;
    }
})


class WebSocket {

    static onlineUsers = [];
    static io

    GLOBAL_CONSTANT = {
        TYPING: "typing",
        NOT_TYPING: "not-typing"
    }

    constructor(socket) {
        this.socket = socket;
        this.connection()
    }

    static roomExists = (id) => {
        if (id === undefined) return false
        if (WebSocket.io.sockets.adapter.rooms.get(id)) return true;
        return false;
    }

    static emitDataToRoom = ({ roomId, eventName, data }) => {
        if (this.roomExists(roomId)) {
            WebSocket.io.to(roomId).emit(eventName, data)
            return true;
        }
        else return false;
    }

    sortArray = (array, comp) => {
        array.sort((a, b) => {
            if (comp(a, b) === true) return 1;
            else if (comp(a, b) === false) return -1;
            else return 0;
        })
    }

    static notifyOnlineFriendOfUser = async (userId, isConnected) => {
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

        userFrnds = userFrnds.map((user) => user.friend._id);

        this.sortArray(userFrnds, (a, b) => a > b)

        this.sortArray(WebSocket.onlineUsers, (a, b) => a.userId > b.userId)

        let onlineUserIdx = 0;
        let userFrndIdx = 0;
        while (0 <= onlineUserIdx && onlineUserIdx < WebSocket.onlineUsers.length && 0 <= userFrndIdx && userFrndIdx < userFrnds.length) {
            const onlineUserId = WebSocket.onlineUsers[onlineUserIdx].userId;
            const userFrndId = userFrnds[userFrndIdx]
            if (onlineUserId === userFrndId) {
                const frndSocketId = WebSocket.onlineUsers[onlineUserIdx].socketId;
                if (isConnected) {
                    console.log('user came online', userId);
                    WebSocket.emitDataToRoom({ id: frndSocketId, data: userId, eventName: "frnd-online" })
                }
                else {
                    console.log('user disconnet updating friends')
                    WebSocket.emitDataToRoom({ id: frndSocketId, data: userId, evenName: "frnd-offline" })
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


    //* handel user connected (user online) 
    userOnline = async (userId) => {
        // console.log(this.socket.id);
        console.log('user-online', userId);


        this.socket.join(userId)

        let userFound = false;
        for (let i = 0; i < WebSocket.onlineUsers.length; i++) {
            const user = WebSocket.onlineUsers[i];
            if (user.userId === userId) {
                user.socketId = this.socket.id
                userFound = true;
            }
        }
        if (!userFound) {
            serverSyncPublisher({ message: messagesCategory.ADD_USER, payload: { userId } })
        }
    }

    getInitialUnReadMessageCount = async ({ friendId, userId }) => {
        try {
            const receivedMessages = await Message.find({ sender: friendId, receiver: userId, isRead: false });
            const unreadMessagesCount = receivedMessages.length;
            const data = { unreadMessagesCount, userId: friendId, receivedMessages }
            if (userId)
                WebSocket.emitDataToRoom({ data, roomId: userId, evenName: "update-intial-unread-messages" })
        } catch (err) {
            console.log(err);
        }
    }

    typingStatus = (userId, friendId, typingStatus) => {
        if (typingStatus === this.GLOBAL_CONSTANT.TYPING) {
            WebSocket.emitDataToRoom({ eventName: "user-typing", data: userId, roomId: friendId })
            //* publish to redis
            if (!WebSocket.roomExists(friendId))
                serverSyncPublisher({ message: messagesCategory.USER_IS_TYPING, payload: { sender: userId, reciver: friendId, eventName: "user-typing" } })
            console.log("typing", friendId);
        }
        else if (typingStatus === this.GLOBAL_CONSTANT.NOT_TYPING && WebSocket.roomExists(friendId)) {
            WebSocket.emitDataToRoom({ roomId: friendId, data: userId, eventName: "user-not-typing" })
            //* publish to redis
            if (!WebSocket.roomExists(friendId))
                serverSyncPublisher({ message: messagesCategory.USER_NOT_TYPING, payload: { sender: userId, receiver: friendId, eventName: "user-not-typing" } })
            console.log("not-typing", friendId);
        }
    }

    acceptConnectionReq = async ({ userId, friendId }) => {

        // console.log("connection req accept");
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

            WebSocket.emitDataToRoom({ data: friendNotify, roomId: userId, eventName: "update-local-notification" })

            const newuserNotification = new UserNotification({ user: friendId, friend: userId, type: "CONNECTION_REQUEST_ACCEPTED" })
            const newuserNotifi = await newuserNotification.save()

            if (friendId) {
                const userNotify = await UserNotification.findById(newuserNotifi._id).populate({ path: "friend", select: "userName email educationInstitute employer" }).select('friend type createdAt')
                WebSocket.emitDataToRoom({ roomId: friendId, data: userNotify, eventName: "update-local-notification" })
                //* publish to redis
                if (!WebSocket.roomExists(friendId))
                    serverSyncPublisher({ message: messagesCategory.CONNECTION_REQ_ACC, payload: { receiver: friendId, data: userNotify, evenName: "update-local-notification" } })
            }
        } catch (err) {
            console.log(err)
        }
    }

    sendConnectionReq = async ({ userId, friendId }) => {
        try {
            const prevReq = await ConnectionRequest.findOne({ user: userId, friend: friendId })
            if (prevReq) {
                return WebSocket.emitDataToRoom({ eventName: "acknowlege-send-connection-request", data: { msg: "request-pending", friendId }, roomId: userId })
            }
            const newConnectionReq = new ConnectionRequest({ user: userId, friend: friendId });
            const savedConnection = await newConnectionReq.save();

            if (friendId) {
                const user = await ConnectionRequest.findById(savedConnection._id).populate({ path: 'user', select: 'userName educationInstitute employer' }).select('user')
                let sendData = {};
                if (user) {
                    sendData = { _id: user.user._id, userName: user.user.userName, employer: user.user.employer, educationInstitute: user.user.educationInstitute }
                    WebSocket.emitDataToRoom({ data: sendData, eventName: "connection-request", roomId: friendId })
                    //* publish to redis
                    if (!WebSocket.roomExists(friendId)) {
                        serverSyncPublisher({ message: messagesCategory.CONNECTION_REQ_SEND, payload: { eventName: "connection-request", data: sendData, reciver: friendId } })
                    }
                }
            }
        } catch (err) {
            console.log(err)
        }
    }

    sendMessage = async (data) => {
        try {
            const msg = new Message({ ...data, isRead: false })
            const savedMsg = await msg.save()
            if (data?.receiver) {
                const friendSocketId = data.receiver
                const userId = data.receiver
                WebSocket.emitDataToRoom({ roomId: friendSocketId, eventName: "recieve-message", data: { ...savedMsg._doc, type: "received" } })

                //* publish to redis
                if (!WebSocket.roomExists(friendSocketId))
                    serverSyncPublisher({ message: messagesCategory.SEND_PERSONAL_MESSAGE, payload: { receiver: friendSocketId, event: "recieve-message", data: { ...savedMsg._doc, type: "received" } } })
                const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
                const idArray = [];
                friends.forEach((user) => {
                    idArray.push(user.friend._id)
                })

                let count = 0;
                const resolveQuery = await Promise.all(idArray.map((friendId) => {
                    return Message.find({ receiver: userId, sender: friendId, isRead: false });
                }))

                resolveQuery.forEach(users => {
                    if (users.length > 0) count++;
                })

                WebSocket.emitDataToRoom({ roomId: friendSocketId, eventName: "update-message-notification", data: count })

                //* publis to redis
                if (!WebSocket.roomExists(friendSocketId))
                    serverSyncPublisher({ message: messagesCategory.UPDATE_MESSAGE_COUNT, payload: { receiver: friendSocketId, eventName: "update-message-notification", data: count } })
            }
            if (data?.sender) {
                WebSocket.emitDataToRoom({ roomId: data.sender, data: { ...savedMsg._doc, type: "send" }, eventName: "recieve-message" })
            }
        } catch (err) {
            console.log(err);
        }
    }

    markMessageRead = async ({ messageId, friendId, userId }) => {
        if (!isValidObjectId(messageId) || !messageId || !userId) return;
        try {
            const resp = await Message.findByIdAndUpdate(messageId, { isRead: true });
        }
        catch (err) {
            console.log(err);
        }
        if (WebSocket.roomExists(friendId)) WebSocket.io.to(friendId).emit("set-message-read", { messageId, friendId: userId });

        try {
            const receivedMessages = await Message.find({ sender: friendId, receiver: userId, isRead: false });
            const unreadMessagesCount = receivedMessages.length;
            WebSocket.emitDataToRoom({ eventName: "update-unread-messages", data: { unreadMessagesCount, userId: friendId, receivedMessages }, roomId: userId })
            //* publis to redis
            if (!WebSocket.roomExists(userId))
                serverSyncPublisher({ message: messagesCategory.MESSAGE_READ, payload: { data: { unreadMessagesCount, userId: friendId, receivedMessages }, receiver: userId, eventName: "update-unread-messages" } })

            const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
            const idArray = [];
            friends.forEach((user) => {
                idArray.push(user.friend._id)
            })

            let count = 0;
            const resolveQuery = await Promise.all(idArray.map((friendId) => {
                return Message.find({ receiver: userId, sender: friendId, isRead: false });
            }))

            resolveQuery.forEach(users => {
                if (users.length > 0) count++;
            })

            WebSocket.emitDataToRoom({ eventName: "update-message-notification", data: count, roomId: userId })

        } catch (err) {
            console.log(err);
        }

    }

    checkFriendOnl = ({ userId, friendId }) => {
        const frnd = WebSocket.onlineUsers.find((onlineUser) => onlineUser.userId === friendId)
        if (frnd)
            WebSocket.emitDataToRoom({ data: friendId, eventName: "frnd-online", roomId: userId })
    }

    userDisconnect = async () => {
        let userId = ""
        const updatedOnlineUsers = [];
        console.log('disconnecting', this.socket.id);

        // console.log('before filtering the online array', WebSocket.onlineUsers);
        for (let i = 0; i < WebSocket.onlineUsers.length; i++) {
            const onlineUser = WebSocket.onlineUsers[i];
            if (onlineUser.socketId === this.socket.id) {
                userId = onlineUser.userId
                break;
            }
        }
        serverSyncPublisher({ message: messagesCategory.REMOVE_USER, payload: { userId } })
    }

    connection = () => {

        console.log("UserConnected", this.socket.id);

        //* user connected for the first time (used for showing online status)
        //todo changes due to redis
        this.socket.on("user-online", this.userOnline)

        //* intial unread messages 
        this.socket.on("get-intial-unread-messages-count", this.getInitialUnReadMessageCount)

        //* for showing typing status 
        this.socket.on("istyping", ({ userId, friendId }) => { this.typingStatus(userId, friendId, this.GLOBAL_CONSTANT.TYPING) })

        //* for stop showing typing status
        this.socket.on("nottyping", ({ userId, friendId }) => { this.typingStatus(userId, friendId, this.GLOBAL_CONSTANT.NOT_TYPING) })

        //* for sending message
        this.socket.on('send-message', this.sendMessage)

        //* for showing notification of connection-request-accepting
        this.socket.on("accept-connection-request", this.acceptConnectionReq)

        //* for sending-connection-req real time
        this.socket.on("send-connection-request", this.sendConnectionReq)

        //* for marking message read in messenger  (Feature : Read message tick color change)
        this.socket.on("mark-message-read", this.markMessageRead)

        //* for checking if frind is online (Feature : online - status)
        this.socket.on('check-friend-online', this.checkFriendOnl)

        //* for user disconnect (update online list send notification to all friends only)
        this.socket.on('disconnect', this.userDisconnect)
    }
}

export { WebSocket };
