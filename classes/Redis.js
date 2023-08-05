import { createClient } from "redis"

export const pubClient = createClient({ url: `rediss://${process.env.REDIS_HOST_NAME}:6380`, password: process.env.REDIS_ACCESS_KEY });
export const subClient = pubClient.duplicate();


export const connectToRedis = async () => {
    try {
        console.log('wating for redis-connection');
        await subClient.connect()
        await pubClient.connect()
        console.log('connected to redis')
    }
    catch (err) {
        console.log(err);
    }
}


