const { Queue } = require('bullmq');
const redisConnection = require('./config/redis');

// Shared BullMQ queue instance for image processing jobs
const imageQueue = new Queue('image-processing', { connection: redisConnection });

module.exports = imageQueue;
