const express = require('express');
const { getSchedulerDb } = require("./db.js");
const {
    isSchedulerValidationError,
    normalizeSchedulerBatchSize,
    normalizeSchedulerTaskId,
    normalizeSchedulerTaskPayload
} = require("./inputGuards.js");
const { filterAutomationUsers } = require("../../platform/jobs/automationActivity.js");

function init(app, context) {
    const { authMiddleware, authDb, getUserDb, getEngine, getMemory } = context;
    const router = express.Router();

    // GET /api/scheduler/:charId
    require("./http/get-scheduler-charId.js").register({ get authMiddleware() { return authMiddleware; }, get getSchedulerDb() { return getSchedulerDb; }, get getUserDb() { return getUserDb; }, get router() { return router; } });

    // POST /api/scheduler
    require("./http/post-scheduler.js").register({ get authMiddleware() { return authMiddleware; }, get getSchedulerDb() { return getSchedulerDb; }, get getUserDb() { return getUserDb; }, get isSchedulerValidationError() { return isSchedulerValidationError; }, get normalizeSchedulerTaskPayload() { return normalizeSchedulerTaskPayload; }, get router() { return router; } });

    // PUT /api/scheduler/:id
    require("./http/put-scheduler-id.js").register({ get authMiddleware() { return authMiddleware; }, get getSchedulerDb() { return getSchedulerDb; }, get getUserDb() { return getUserDb; }, get isSchedulerValidationError() { return isSchedulerValidationError; }, get normalizeSchedulerTaskId() { return normalizeSchedulerTaskId; }, get normalizeSchedulerTaskPayload() { return normalizeSchedulerTaskPayload; }, get router() { return router; } });

    // DELETE /api/scheduler/:id
    require("./http/delete-scheduler-id.js").register({ get authMiddleware() { return authMiddleware; }, get getSchedulerDb() { return getSchedulerDb; }, get isSchedulerValidationError() { return isSchedulerValidationError; }, get normalizeSchedulerTaskId() { return normalizeSchedulerTaskId; }, get router() { return router; } });

    app.use('/api', router); // Mount the plugin's routes

    // ─── Global Periodic Ticker (Runs every 1 minute) ───
    context.jobs.interval(require("./runtime/tick1.js").createTick({ get authDb() { return authDb; }, get context() { return context; }, get filterAutomationUsers() { return filterAutomationUsers; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getSchedulerDb() { return getSchedulerDb; }, get getUserDb() { return getUserDb; }, get normalizeSchedulerBatchSize() { return normalizeSchedulerBatchSize; } }), 60 * 1000); // 1 minute
}

module.exports = init;
