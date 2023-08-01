import redis from "redis"

export const cacheConnection = redis.createClient({
    url: `rediss://${process.env.REDIS_HOST_NAME}:6380`,
    password: process.env.REDIS_ACCESS_KEY
});

const subscriber = (event, fun) => {
    redis.createClient().on(event, fun)
}
const publisher = (event, msg) => {
    redis.createClient().publish(event, msg);
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
