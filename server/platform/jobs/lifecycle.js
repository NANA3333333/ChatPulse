const cron = require('node-cron');

function createJobLifecycle({ enabled = true } = {}) {
    const intervals = new Set();
    const cronTasks = new Set();
    return {
        interval(callback, delay) {
            if (!enabled) return null;
            const timer = setInterval(callback, delay);
            intervals.add(timer);
            return timer;
        },
        cron(expression, callback, options) {
            if (!enabled) return null;
            const task = cron.schedule(expression, callback, options);
            cronTasks.add(task);
            return task;
        },
        close() {
            for (const timer of intervals) clearInterval(timer);
            for (const task of cronTasks) task.destroy();
            intervals.clear();
            cronTasks.clear();
        }
    };
}

module.exports = { createJobLifecycle };
