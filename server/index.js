process.on('uncaughtException', err => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const { createApplication } = require('./app');

async function start() {
    const application = createApplication();
    try {
        await application.assertReady();
    } catch (error) {
        await application.close();
        throw error;
    }
    const port = process.env.PORT || 8000;
    application.server.listen(port, () => console.log('[Express] ChatPulse Server listening on port ' + port));
    const shutdown = () => application.close().finally(() => process.exit(0));
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return application;
}

if (require.main === module) start().catch(error => {
    console.error('[Startup] Failed to start ChatPulse server:', error.message);
    process.exitCode = 1;
});

module.exports = { start };
