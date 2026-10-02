export const TTS_PROVIDERS = [
    {
        id: 'tencent',
        label: '腾讯云 TTS',
        modelHint: '大模型音色 / 精品音色',
        voiceHint: '例如：101001 / 101016，按腾讯云音色 ID 填写',
        keyHint: '可直接粘贴腾讯云弹窗里的 SecretId / SecretKey 两行',
        modelOptions: [
            { value: 'large', label: '大模型音色' },
            { value: 'premium', label: '精品音色' },
        ],
        voiceOptions: [
            { value: '501001', label: '501001 智兰 - 资讯女声（大模型）' },
            { value: '101001', label: '101001 智瑜 - 中文女声' },
            { value: '101004', label: '101004 智云 - 通用男声' },
            { value: '101011', label: '101011 智燕 - 新闻女声' },
            { value: '101013', label: '101013 智辉 - 新闻男声' },
            { value: '101016', label: '101016 智甜 - 女童声' },
        ],
    },
    {
        id: 'openai',
        label: 'OpenAI TTS',
        modelHint: '例如：gpt-4o-mini-tts / tts-1',
        voiceHint: '例如：alloy / verse / shimmer',
        keyHint: 'sk-...',
        modelOptions: [
            { value: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts' },
            { value: 'tts-1', label: 'tts-1' },
            { value: 'tts-1-hd', label: 'tts-1-hd' },
        ],
        voiceOptions: [
            { value: 'alloy', label: 'alloy' },
            { value: 'ash', label: 'ash' },
            { value: 'ballad', label: 'ballad' },
            { value: 'coral', label: 'coral' },
            { value: 'nova', label: 'nova' },
            { value: 'shimmer', label: 'shimmer' },
            { value: 'verse', label: 'verse' },
        ],
    },
    {
        id: 'azure',
        label: 'Azure Speech',
        modelHint: 'neural',
        voiceHint: '例如：zh-CN-XiaoxiaoNeural',
        keyHint: 'Speech key；Endpoint 可填 region 或完整地址',
        modelOptions: [{ value: 'neural', label: 'Neural voice' }],
        voiceOptions: [
            { value: 'zh-CN-XiaoxiaoNeural', label: 'zh-CN-XiaoxiaoNeural 女声' },
            { value: 'zh-CN-YunxiNeural', label: 'zh-CN-YunxiNeural 男声' },
            { value: 'zh-CN-XiaoyiNeural', label: 'zh-CN-XiaoyiNeural 女声' },
            { value: 'zh-CN-YunjianNeural', label: 'zh-CN-YunjianNeural 男声' },
        ],
    },
    {
        id: 'google',
        label: 'Google Cloud TTS',
        modelHint: 'neural2 / wavenet / standard',
        voiceHint: '例如：cmn-CN-Wavenet-A',
        keyHint: 'API key 或服务账号凭证标识',
        modelOptions: [
            { value: 'neural2', label: 'Neural2' },
            { value: 'wavenet', label: 'WaveNet' },
            { value: 'standard', label: 'Standard' },
        ],
        voiceOptions: [
            { value: 'cmn-CN-Wavenet-A', label: 'cmn-CN-Wavenet-A 女声' },
            { value: 'cmn-CN-Wavenet-B', label: 'cmn-CN-Wavenet-B 男声' },
            { value: 'cmn-CN-Wavenet-C', label: 'cmn-CN-Wavenet-C 男声' },
            { value: 'cmn-CN-Wavenet-D', label: 'cmn-CN-Wavenet-D 女声' },
        ],
    },
    {
        id: 'minimax',
        label: 'MiniMax Speech',
        modelHint: 'speech-02-turbo / speech-02-hd',
        voiceHint: '填写 voice_id',
        keyHint: 'API key',
        modelOptions: [
            { value: 'speech-02-turbo', label: 'speech-02-turbo' },
            { value: 'speech-02-hd', label: 'speech-02-hd' },
        ],
        voiceOptions: [
            { value: 'male-qn-qingse', label: 'male-qn-qingse 男声' },
            { value: 'female-shaonv', label: 'female-shaonv 女声' },
        ],
    },
    {
        id: 'elevenlabs',
        label: 'ElevenLabs',
        modelHint: 'eleven_multilingual_v2',
        voiceHint: '填写 voice_id',
        keyHint: 'xi-api-key',
        modelOptions: [
            { value: 'eleven_multilingual_v2', label: 'eleven_multilingual_v2' },
            { value: 'eleven_turbo_v2_5', label: 'eleven_turbo_v2_5' },
        ],
        voiceOptions: [],
    },
    {
        id: 'custom',
        label: '自定义兼容接口',
        modelHint: '由接口决定',
        voiceHint: '由接口决定',
        keyHint: 'Bearer token / API key',
    },
];

export function getTtsProviderConfig(providerId) {
    return TTS_PROVIDERS.find((item) => item.id === providerId) || TTS_PROVIDERS[0];
}

export function translateTtsProviderConfig(config, lang) {
    if (lang !== 'en') return config;
    const commonVoiceGender = (label) =>
        String(label || '')
            .replace('女声', 'female')
            .replace('男声', 'male')
            .replace('资讯', 'news ')
            .replace('中文', 'Chinese ')
            .replace('通用', 'general ')
            .replace('新闻', 'news ')
            .replace('女童声', 'child female voice');
    const translated = { ...config };
    if (config.id === 'tencent') {
        translated.label = 'Tencent Cloud TTS';
        translated.modelHint = 'Large-model voice / premium voice';
        translated.voiceHint = 'e.g. 101001 / 101016, Tencent Cloud voice ID';
        translated.keyHint = 'Paste the SecretId / SecretKey lines from Tencent Cloud';
        translated.modelOptions = [
            { value: 'large', label: 'Large-model voice' },
            { value: 'premium', label: 'Premium voice' },
        ];
        translated.voiceOptions = (config.voiceOptions || []).map((option) => ({
            ...option,
            label: commonVoiceGender(option.label)
                .replace('智兰 -', 'Zhilan -')
                .replace('智瑜 -', 'Zhiyu -')
                .replace('智云 -', 'Zhiyun -')
                .replace('智燕 -', 'Zhiyan -')
                .replace('智辉 -', 'Zhihui -')
                .replace('智甜 -', 'Zhitian -')
                .replace('（大模型）', '(large model)'),
        }));
    } else if (config.id === 'azure') {
        translated.label = 'Azure Speech';
        translated.voiceHint = 'e.g. zh-CN-XiaoxiaoNeural';
        translated.keyHint = 'Speech key; Endpoint can be a region or full URL';
        translated.voiceOptions = (config.voiceOptions || []).map((option) => ({
            ...option,
            label: commonVoiceGender(option.label),
        }));
    } else if (config.id === 'google') {
        translated.label = 'Google Cloud TTS';
        translated.voiceHint = 'e.g. cmn-CN-Wavenet-A';
        translated.keyHint = 'API key or service account credential ID';
        translated.voiceOptions = (config.voiceOptions || []).map((option) => ({
            ...option,
            label: commonVoiceGender(option.label),
        }));
    } else if (config.id === 'minimax') {
        translated.label = 'MiniMax Speech';
        translated.voiceHint = 'Enter voice_id';
        translated.voiceOptions = (config.voiceOptions || []).map((option) => ({
            ...option,
            label: commonVoiceGender(option.label),
        }));
    } else if (config.id === 'elevenlabs') {
        translated.label = 'ElevenLabs';
        translated.voiceHint = 'Enter voice_id';
    } else if (config.id === 'custom') {
        translated.label = 'Custom compatible API';
        translated.modelHint = 'Defined by the API';
        translated.voiceHint = 'Defined by the API';
    }
    return translated;
}

export function getTtsSelectValue(value, options = []) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return options.some((item) => item.value === raw) ? raw : '__custom';
}

export function isCustomTtsValue(value, options = []) {
    return getTtsSelectValue(value, options) === '__custom';
}

export function inferTencentModelTier(option) {
    const text = `${option?.type || ''} ${option?.label || ''}`.toLowerCase();
    if (!text.trim()) return '';
    if (text.includes('精品')) return 'premium';
    if (text.includes('大模型') || text.includes('超自然')) return 'large';
    return '';
}
