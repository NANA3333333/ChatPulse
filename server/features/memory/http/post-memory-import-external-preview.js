const { clipMemoryDisplayText } = require("../maintenance/index.js");
// POST /api/memory-import/external/preview
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memory-import/external/preview', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memory-import/external/preview"), dependencies.authMiddleware, (req, res) => {
    console.log(`[External Import] Preview route hit user=${req.user?.username || 'unknown'} contentType=${req.headers['content-type'] || ''}`);
    dependencies.memoryImportUpload.any()(req, res, async function (err) {
        if (err instanceof dependencies.multer.MulterError) {
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        const db = req.db;
        try {
            const settings = dependencies.getMemoryMaintenanceSettings(db);
            if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
                return res.status(400).json({ error: '请先配置“记忆库管理小模型”的 URL、Key 和模型。' });
            }
            const external = dependencies.parseExternalImportRequest(req);
            const requestedSourceApp = dependencies.normalizeExternalSourceApp(req.body?.source_app || req.body?.source || req.body?.app);
            const sourceApp = external.detectedSourceApp || requestedSourceApp;
            const importMode = external.detectedSourceApp === 'sillytavern'
                ? 'multi_role'
                : dependencies.normalizeExternalImportMode(req.body?.import_mode || req.body?.mode, sourceApp);
            const targetCharacterName = dependencies.normalizeExternalCharacterName(req.body?.target_character_name || req.body?.character_name, dependencies.getExternalSourceAppLabel(sourceApp));
            const prompt = dependencies.buildExternalImportPrompt({
                sourceApp,
                importMode,
                targetCharacterName,
                messages: external.messages,
                rawText: external.rawText,
                knownRoleTags: [],
                userName: req.user.username
            });
            const previewStartedAt = Date.now();
            console.log(`[External Import] Preview start user=${req.user.username} source=${sourceApp} requested=${requestedSourceApp} detected=${external.detectedSourceApp || ''} mode=${importMode} messages=${external.messages.length} promptChars=${prompt.user_prompt.length} changed=${external.cleanStats?.changed_messages || 0} dropped=${external.cleanStats?.dropped_messages || 0} jsonlParsed=${external.cleanStats?.jsonl_parsed_lines || 0} rawChars=${external.cleanStats?.raw_chars || 0}`);
            const response = await dependencies.callLLM({
                endpoint: settings.api_endpoint,
                key: settings.api_key,
                model: settings.model_name,
                messages: [
                    { role: 'system', content: prompt.system_prompt },
                    { role: 'user', content: prompt.user_prompt }
                ],
                maxTokens: Math.max(1500, Math.min(20000, Number(settings.max_output_tokens || 8000) || 8000)),
                temperature: 0.1,
                returnUsage: true,
                responseFormat: { type: 'json_object' },
                requestTimeoutMs: dependencies.EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS,
                maxAttempts: 1
            });
            const rawText = typeof response === 'string' ? response : response.content;
            const parsed = dependencies.extractJsonObjectFromText(rawText);
            const normalized = dependencies.normalizeExternalImportResult(parsed, {
                sourceApp,
                importMode,
                targetCharacterName,
                messages: external.messages,
                knownRoleTags: [],
                userName: req.user.username
            });
            if (!normalized.candidates.length) {
                console.warn(`[External Import] Preview produced no candidates user=${req.user.username} source=${sourceApp} mode=${importMode} roles=${normalized.role_tags?.length || 0} needsReview=${normalized.needs_review?.length || 0} rawChars=${String(rawText || '').length}`);
                return res.status(422).json({
                    error: '小模型没有提取出可导入的新记忆。可以换更明确的导出文件，或改成手动粘贴关键片段。',
                    raw_response: clipMemoryDisplayText(rawText, 1600),
                    role_tags: normalized.role_tags || [],
                    needs_review: normalized.needs_review || []
                });
            }
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
            if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
            const now = Date.now();
            const info = rawDb.prepare(`
                INSERT INTO external_memory_imports
                    (source_app, import_mode, filename, raw_text, normalized_messages_json, summary_json, role_tags_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sourceApp,
                importMode,
                external.filename || '',
                external.rawText || '',
                JSON.stringify(external.messages || []),
                JSON.stringify(normalized),
                JSON.stringify(normalized.role_tags || []),
                now
            );
            console.log(`[External Import] Preview success id=${info.lastInsertRowid} user=${req.user.username} roles=${normalized.role_tags.length} candidates=${normalized.candidates.length} durationMs=${Date.now() - previewStartedAt}`);
            res.json({
                success: true,
                import: {
                    id: info.lastInsertRowid,
                    source_app: sourceApp,
                    import_mode: importMode,
                    filename: external.filename || '',
                    message_count: external.messages.length,
                    created_at: now,
                    detected_source_app: external.detectedSourceApp || ''
                },
                role_tags: normalized.role_tags,
                candidates: normalized.candidates,
                needs_review: normalized.needs_review,
                model: {
                    name: settings.model_name,
                    usage: response?.usage || null,
                    finishReason: response?.finishReason || ''
                },
                prompt_stats: {
                    row_count: prompt.row_count,
                    prompt_chars: prompt.user_prompt.length,
                    clean_stats: external.cleanStats || null
                },
                raw_response_preview: clipMemoryDisplayText(rawText, 1600)
            });
        } catch (e) {
            console.error('External memory import preview failed:', e);
            const isTimeout = /timed out|abort/i.test(String(e.message || ''));
            res.status(e.status || (isTimeout ? 504 : 500)).json({ error: e.message });
        }
    });
});
}
module.exports = { register };
