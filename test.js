import redis from 'redis';

const client = redis.createClient();

client.connect({
    url: `rediss://${process.env.REDIS_HOST_NAME}:6380`,
    password: process.env.REDIS_ACCESS_KEY
})

client.publish('test', JSON.stringify({ message: "hello" }))

client.subscribe('test', (msg) => {
    const parsedMsg = JSON.parse(msg)
    console.log(parsedMsg);
})
