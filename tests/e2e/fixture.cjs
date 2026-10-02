const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dataDir = process.env.CHATPULSE_E2E_DATA_DIR
    ? path.resolve(process.env.CHATPULSE_E2E_DATA_DIR)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-e2e-'));
if (path.dirname(dataDir) !== path.resolve(os.tmpdir()) || !path.basename(dataDir).startsWith('chatpulse-e2e-')) {
    throw new Error('Fixture data must be in its dedicated OS temporary directory');
}
Object.assign(process.env, {
    CHATPULSE_DATA_DIR: dataDir, CHATPULSE_UPLOADS_DIR: path.join(dataDir, 'uploads'),
    JWT_SECRET: 'e2e-fixture-secret', ADMIN_PASSWORD: 'E2E-fixture-password-428',
    CP_PRIVATE_AUTONOMY: '0', CP_GROUP_AUTONOMY: '0', QDRANT_ENABLED: '0', QDRANT_REQUIRED: '0'
});

// Exercise storage without downloading model weights or calling providers.
const embeddings = require('../../server/platform/vectors/embeddings');
const createEmbeddings = embeddings.createModule;
embeddings.createModule = dependencies => ({
    ...createEmbeddings(dependencies),
    getEmbedding: async () => { throw new Error('Embedding deliberately unavailable in E2E fixture'); }
});

(async () => {
    const { createApplication } = require('../../server/app');
    let application;
    async function start() {
        application = createApplication({ backgroundJobs: false });
        await application.assertReady();
        application.server.listen(0, '127.0.0.1', () => {
            process.send({ baseUrl: `http://127.0.0.1:${application.server.address().port}`, dataDir });
        });
    }
    await start();
    process.on('message', async message => {
        if (message === 'disable-labs') {
            await application.close();
            const manifest = require('../../config/feature-manifest.json');
            for (const lab of Object.values(manifest.labs)) lab.enabled = false;
            await start();
            return;
        }
        if (message !== 'close') return;
        await application.close();
        process.exit(0);
    });
})().catch(error => { console.error(error); process.exit(1); });
