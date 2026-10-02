const { withPrivateReplyStyleGuidance } = require("./context/replyStyle.js");
const { replyError } = require("./errors");

// Only the saved main-model request is replayed. Planners and action handlers are not dependencies.
function createReplyGenerator({ callLLM, buildLlmAttemptRecorder, recordLlmDebug, recordUsage,
    looksPrematurelyCutOff, addUsageTotals, normalizeVisibleText }) {
    return async function generateReply({ character, run, messageId, assertUnchanged, operation, notify }) {
        const meta = { context_type: 'private_reply_reroll', messageId, runId: operation.runId };
        const request = {
            ...structuredClone(run.request),
            endpoint: character.api_endpoint,
            key: character.api_key,
            model: character.model_name,
            enableCache: false,
            enablePromptCacheHints: true,
            promptCacheHintMode: 'stable_system_only',
            returnUsage: true,
            debugAttempt: buildLlmAttemptRecorder(character, meta)
        };
        request.messages = withPrivateReplyStyleGuidance(request.messages);
        recordLlmDebug(character, 'input', request.messages, meta);
        const output = await operation.step('llm', () => callLLM(request), 'LLM_REQUEST_FAILED');
        let generatedText = output.content || '';
        let finishReason = output.finishReason;
        let usage = output.usage;
        for (let attempt = 0; attempt < 3 && generatedText
            && (finishReason === 'length' || looksPrematurelyCutOff(generatedText)); attempt++) {
            assertUnchanged();
            operation.record('continuation', 'requested', { attempt: attempt + 1 });
            const continuation = await operation.step('llm_continuation', () => callLLM({
                ...request,
                messages: [...request.messages, { role: 'assistant', content: generatedText },
                    { role: 'user', content: '[系统续写] 你上一条消息被截断了。不要重说前文，只把刚才没说完的那句话自然续完并收尾。输出纯文本。' }],
                maxTokens: Math.min(request.maxTokens, 800)
            }), 'LLM_REQUEST_FAILED');
            generatedText += continuation.content || '';
            usage = addUsageTotals(usage, continuation.usage);
            finishReason = continuation.finishReason;
            if (!continuation.content) break;
        }
        if (usage) {
            recordUsage(character.id, 'chat', usage);
            // A disconnected browser must not discard a successfully generated response.
            try {
                operation.step('notify_usage', () => notify({ type: 'token_stats', character_id: character.id, module: 'chat', usage }), 'REPLY_NOTIFY_FAILED');
            } catch { /* The HTTP response remains the authoritative result for the initiating client. */ }
        }
        recordLlmDebug(character, 'output', generatedText, { ...meta, usage });
        return operation.step('parse', () => {
            const content = normalizeVisibleText(generatedText);
            if (!content) throw replyError('主模型没有返回可见内容，已保留原回复。', 502, 'REPLY_EMPTY');
            return content;
        }, 'REPLY_PARSE_FAILED');
    };
}

module.exports = { createReplyGenerator };
