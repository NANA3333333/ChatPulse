export const LOCAL_OLLAMA_MODEL_PRESET = {
    api_endpoint: 'http://127.0.0.1:11434/v1',
    api_key: 'ollama',
    model_name: 'gemma4:31b-20k'
};

export function withLocalModelOption(models = []) {
    const cleanModels = Array.isArray(models)
        ? models.map(model => String(model || '').trim()).filter(Boolean)
        : [];
    return Array.from(new Set([LOCAL_OLLAMA_MODEL_PRESET.model_name, ...cleanModels]));
}
