import { MessageSquare, Laptop, Trash2, RefreshCw, FileText, Info } from 'lucide-react';

export function CharacterModelSettings({
    activeReadiness,
    lang,
    activeCharacterDraft,
    updateCharacterDraft,
    applyLocalModelPreset,
    editingContact,
    getSecretPlaceholder,
    getSecretStatusText,
    fetchModels,
    setMainModels,
    setMainModelFetching,
    setMainModelError,
    mainModelFetching,
    mainModelError,
    mainModelOptions,
    handleMainModelSelect,
    getModelOptionLabel,
    setMemModels,
    setMemModelFetching,
    setMemModelError,
    memModelFetching,
    memModelError,
    memModelOptions,
    handleMemoryModelSelect,
}) {
    return (
        <div className="settings-control-form-stack">
            <section className={`settings-control-model-card ${activeReadiness?.mainModelReady ? 'is-ready' : ''}`}>
                <div className="settings-control-model-head">
                    <div>
                        <span>
                            <MessageSquare size={18} />
                        </span>
                        <div>
                            <span className="settings-guided-kicker">MAIN MODEL</span>
                            <h2>{lang === 'en' ? 'Main chat model' : '主对话模型'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Used by private chat, groups, diaries, and city actions.'
                                    : '负责私聊、群聊、日记和商业街行动。'}
                            </p>
                        </div>
                    </div>
                    <em>
                        <i
                            className={`settings-status-dot ${activeReadiness?.mainModelReady ? 'online' : 'warning'}`}
                        />
                        {activeReadiness?.mainModelReady
                            ? lang === 'en'
                                ? 'Ready'
                                : '已连接'
                            : lang === 'en'
                              ? 'Not ready'
                              : '未连接'}
                    </em>
                </div>
                <div className="settings-control-form-grid two">
                    <label>
                        <span>API Endpoint</span>
                        <input
                            value={activeCharacterDraft.api_endpoint || ''}
                            onChange={(event) => updateCharacterDraft({ api_endpoint: event.target.value })}
                            placeholder="https://api.openai.com/v1"
                        />
                        <button
                            type="button"
                            className="settings-control-text-button"
                            onClick={() => applyLocalModelPreset('main')}
                        >
                            <Laptop size={12} />
                            {lang === 'en' ? 'Use local Ollama' : '使用本地 Ollama'}
                        </button>
                    </label>
                    <label>
                        <span>API Key</span>
                        <input
                            type="password"
                            value={editingContact?.api_key || ''}
                            onChange={(event) =>
                                updateCharacterDraft({ api_key: event.target.value, api_key_clear: false })
                            }
                            placeholder={getSecretPlaceholder(activeCharacterDraft, 'api_key', 'sk-...')}
                        />
                        <small>{getSecretStatusText(activeCharacterDraft, 'api_key')}</small>
                        {activeCharacterDraft.api_key_configured && (
                            <button
                                type="button"
                                className="settings-control-text-button danger"
                                onClick={() => updateCharacterDraft({ api_key: '', api_key_clear: true })}
                            >
                                <Trash2 size={12} />
                                {lang === 'en' ? 'Clear saved key' : '清除已保存 Key'}
                            </button>
                        )}
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Model' : '模型'}</span>
                        <div className="settings-control-inline-field">
                            <input
                                value={activeCharacterDraft.model_name || ''}
                                onChange={(event) => updateCharacterDraft({ model_name: event.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    fetchModels(
                                        activeCharacterDraft.api_endpoint,
                                        editingContact?.api_key || '',
                                        setMainModels,
                                        setMainModelFetching,
                                        setMainModelError,
                                        {
                                            characterId: activeCharacterDraft.id,
                                            scope: 'main',
                                            hasSavedKey:
                                                activeCharacterDraft.api_key_configured &&
                                                !activeCharacterDraft.api_key_clear,
                                        },
                                    )
                                }
                                disabled={mainModelFetching}
                            >
                                <RefreshCw size={14} />
                                {mainModelFetching ? '...' : lang === 'en' ? 'Fetch' : '获取'}
                            </button>
                        </div>
                        {mainModelError && <small className="settings-control-error">{mainModelError}</small>}
                        {mainModelOptions.length > 0 && (
                            <select value="" onChange={(event) => handleMainModelSelect(event.target.value)}>
                                <option value="" disabled>
                                    {lang === 'en' ? 'Select a model' : '选择模型'}
                                </option>
                                {mainModelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {getModelOptionLabel(model)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Max output' : '最大输出'}</span>
                        <div className="settings-control-number-field">
                            <input
                                type="number"
                                min="100"
                                max="20000"
                                value={activeCharacterDraft.max_tokens ?? 800}
                                onChange={(event) =>
                                    updateCharacterDraft({ max_tokens: Number(event.target.value || 800) })
                                }
                            />
                            <span>tokens</span>
                        </div>
                    </label>
                </div>
            </section>

            <section className={`settings-control-model-card ${activeReadiness?.memoryModelReady ? 'is-ready' : ''}`}>
                <div className="settings-control-model-head">
                    <div>
                        <span className="pink">
                            <FileText size={18} />
                        </span>
                        <div>
                            <span className="settings-guided-kicker">MEMORY MODEL</span>
                            <h2>{lang === 'en' ? 'Memory and summary model' : '记忆与总结模型'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Used by long-term memory extraction, summaries, and relationship impressions.'
                                    : '负责长期记忆清扫、摘要和关系印象。'}
                            </p>
                        </div>
                    </div>
                    <em>
                        <i
                            className={`settings-status-dot ${activeReadiness?.memoryModelReady ? 'online' : 'warning'}`}
                        />
                        {activeReadiness?.memoryModelReady
                            ? lang === 'en'
                                ? 'Ready'
                                : '已连接'
                            : lang === 'en'
                              ? 'Optional'
                              : '可选'}
                    </em>
                </div>
                <div className="settings-control-form-grid two">
                    <label>
                        <span>{lang === 'en' ? 'Memory API Endpoint' : '记忆 API Endpoint'}</span>
                        <input
                            value={activeCharacterDraft.memory_api_endpoint || ''}
                            onChange={(event) => updateCharacterDraft({ memory_api_endpoint: event.target.value })}
                            placeholder="https://api.openai.com/v1"
                        />
                        <button
                            type="button"
                            className="settings-control-text-button"
                            onClick={() => applyLocalModelPreset('memory')}
                        >
                            <Laptop size={12} />
                            {lang === 'en' ? 'Use local Ollama' : '使用本地 Ollama'}
                        </button>
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Memory API Key' : '记忆 API Key'}</span>
                        <input
                            type="password"
                            value={editingContact?.memory_api_key || ''}
                            onChange={(event) =>
                                updateCharacterDraft({
                                    memory_api_key: event.target.value,
                                    memory_api_key_clear: false,
                                })
                            }
                            placeholder={getSecretPlaceholder(activeCharacterDraft, 'memory_api_key', 'sk-...')}
                        />
                        <small>{getSecretStatusText(activeCharacterDraft, 'memory_api_key')}</small>
                        {activeCharacterDraft.memory_api_key_configured && (
                            <button
                                type="button"
                                className="settings-control-text-button danger"
                                onClick={() => updateCharacterDraft({ memory_api_key: '', memory_api_key_clear: true })}
                            >
                                <Trash2 size={12} />
                                {lang === 'en' ? 'Clear saved key' : '清除已保存 Key'}
                            </button>
                        )}
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Memory model' : '记忆模型'}</span>
                        <div className="settings-control-inline-field">
                            <input
                                value={activeCharacterDraft.memory_model_name || ''}
                                onChange={(event) => updateCharacterDraft({ memory_model_name: event.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    fetchModels(
                                        activeCharacterDraft.memory_api_endpoint,
                                        editingContact?.memory_api_key || '',
                                        setMemModels,
                                        setMemModelFetching,
                                        setMemModelError,
                                        {
                                            characterId: activeCharacterDraft.id,
                                            scope: 'memory',
                                            hasSavedKey:
                                                activeCharacterDraft.memory_api_key_configured &&
                                                !activeCharacterDraft.memory_api_key_clear,
                                        },
                                    )
                                }
                                disabled={memModelFetching}
                            >
                                <RefreshCw size={14} />
                                {memModelFetching ? '...' : lang === 'en' ? 'Fetch' : '获取'}
                            </button>
                        </div>
                        {memModelError && <small className="settings-control-error">{memModelError}</small>}
                        {memModelOptions.length > 0 && (
                            <select value="" onChange={(event) => handleMemoryModelSelect(event.target.value)}>
                                <option value="" disabled>
                                    {lang === 'en' ? 'Select a model' : '选择模型'}
                                </option>
                                {memModelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {getModelOptionLabel(model)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Summary threshold' : '私聊摘要阈值'}</span>
                        <div className="settings-control-number-field">
                            <input
                                type="number"
                                min="5"
                                max="100"
                                value={activeCharacterDraft.private_summary_threshold ?? 30}
                                onChange={(event) =>
                                    updateCharacterDraft({
                                        private_summary_threshold: Number(event.target.value || 30),
                                    })
                                }
                            />
                            <span>{lang === 'en' ? 'messages' : '条消息'}</span>
                        </div>
                    </label>
                </div>
                <div className="settings-control-impact-note">
                    <Info size={16} />
                    <span>
                        {lang === 'en'
                            ? 'Changing context window clears summary, history window cache, and dialogue digest after saving.'
                            : '修改上下文窗口后，保存会清理摘要、历史窗口缓存和对话 digest。'}
                    </span>
                </div>
            </section>
        </div>
    );
}
