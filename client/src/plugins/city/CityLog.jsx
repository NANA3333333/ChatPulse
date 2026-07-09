import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertCircle,
    Briefcase,
    ChevronDown,
    ChevronRight,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSun,
    Coffee,
    Moon,
    Package,
    Settings,
    Store,
    SunMedium,
    Wind,
    RotateCcw,
} from 'lucide-react';
import CityManager from './CityManager';
import AvatarWithFrame from '../../components/AvatarWithFrame';
import { defaultAvatarUrl, resolveAvatarUrl } from '../../utils/avatar';
import { deriveEmotion, derivePhysicalState } from '../../utils/emotion';
import { useLanguage } from '../../LanguageContext';
import './CityLog.css';

const FALLBACK_AVATAR = defaultAvatarUrl('User');
const avatarSrc = (url, apiUrl) => resolveAvatarUrl(url, apiUrl) || FALLBACK_AVATAR;

const tabStyle = (active) => ({
    padding: '10px 16px',
    border: 'none',
    borderBottom: active ? '2px solid #ff4f82' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: active ? '#ff4f82' : '#806273',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? '600' : '400',
    transition: 'all 0.2s',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
});

const LOCATION_NAMES = {
    factory: { zh: '🏭 工厂', en: '🏭 Factory' },
    restaurant: { zh: '🍽️ 餐厅', en: '🍽️ Restaurant' },
    convenience: { zh: '🏪 便利店', en: '🏪 Convenience Store' },
    park: { zh: '🌳 中央公园', en: '🌳 Central Park' },
    mall: { zh: '🛍️ 商场', en: '🛍️ Mall' },
    school: { zh: '🏫 夜校', en: '🏫 Night School' },
    hospital: { zh: '🏥 医院', en: '🏥 Hospital' },
    home: { zh: '🏠 家', en: '🏠 Home' },
    street: { zh: '🛣️ 商业街', en: '🛣️ City Street' },
    casino: { zh: '🎰 赌城', en: '🎰 Casino' },
};

const EMOTION_LABEL_EN = {
    jealous: 'Jealous',
    hurt: 'Hurt',
    angry: 'Angry',
    lonely: 'Lonely',
    happy: 'Happy',
    sad: 'Sad',
    cautious: 'Cautious',
    guarded: 'Guarded',
    shy: 'Shy',
    hopeful: 'Hopeful',
    playful: 'Playful',
    disappointed: 'Disappointed',
    relieved: 'Relieved',
    affectionate: 'Affectionate',
    reassured: 'Reassured',
    yearning: 'Missing you',
    flustered: 'Flustered',
    guilty: 'Guilty',
    frustrated: 'Frustrated',
    wistful: 'Wistful',
    proud: 'Proud',
    secure: 'Steady',
    tender: 'Tender',
    helpless: 'Helpless',
    tense: 'Tense',
    calm: 'Calm'
};

const PHYSICAL_LABEL_EN = {
    severe_unwell: 'Very unwell',
    unwell: 'Unwell',
    sleepy: 'Sleepy',
    hungry: 'Hungry',
    overfull: 'Overfull',
    fatigued: 'Fatigued',
    stable: 'Stable'
};

const getLocalizedLocationName = (location, isEn) => LOCATION_NAMES[location]?.[isEn ? 'en' : 'zh'] || location || (isEn ? 'Home' : '家');
const getEmotionLabel = (emotion, isEn) => (isEn ? (EMOTION_LABEL_EN[emotion?.key] || emotion?.label || '') : (emotion?.label || ''));
const getPhysicalLabel = (physical, isEn) => (isEn ? (PHYSICAL_LABEL_EN[physical?.key] || physical?.label || '') : (physical?.label || ''));

function getStatusDetails(status, isEn = false) {
    switch (status) {
        case 'working':
            return { icon: <Briefcase size={16} />, text: isEn ? 'Working' : '工作中', color: '#ff9800' };
        case 'eating':
            return { icon: <Coffee size={16} />, text: isEn ? 'Eating' : '吃饭中', color: '#4caf50' };
        case 'sleeping':
            return { icon: <Moon size={16} />, text: isEn ? 'Sleeping' : '睡觉中', color: '#9c27b0' };
        case 'hungry':
            return { icon: <AlertCircle size={16} />, text: isEn ? 'Hungry' : '饥饿', color: '#f44336' };
        case 'coma':
            return { icon: <Activity size={16} />, text: isEn ? 'Unconscious' : '昏迷', color: '#d32f2f' };
        default:
            return { icon: <Store size={16} />, text: isEn ? 'Idle' : '空闲', color: '#2196f3' };
    }
}

function getActionEmoji(type) {
    switch (type) {
        case 'BUY':
            return '📦';
        case 'EAT':
            return '🍜';
        case 'STARVE':
            return '🥵';
        case 'BROKE':
            return '💸';
        case 'GIFT':
            return '🎁';
        case 'FED':
            return '🍱';
        case 'PLAN':
            return '🗓️';
        case 'GIVE_ITEM':
            return '🎁';
        case 'SOCIAL':
            return '💬';
        default:
            return '';
    }
}

function getStateColor(value) {
    if (value >= 70) return '#4caf50';
    if (value >= 40) return '#ff9800';
    return '#f44336';
}

function getInvertedStateColor(value) {
    if (value <= 30) return '#4caf50';
    if (value <= 60) return '#ff9800';
    return '#f44336';
}

function getCurrentWeather(events) {
    if (!Array.isArray(events)) return null;
    return events.find((event) => String(event.event_type || '').toLowerCase() === 'weather') || null;
}

const WEATHER_BACKGROUND_ASSETS = {
    sunny: {
        light: '/assets/ui/city/weather/weather-sunny-light.png',
        comfortable: '/assets/ui/city/weather/weather-sunny-comfortable.png',
        heavy: '/assets/ui/city/weather/weather-sunny-heavy.png',
    },
    cloudy: {
        light: '/assets/ui/city/weather/weather-cloudy-light.png',
        comfortable: '/assets/ui/city/weather/weather-cloudy-comfortable.png',
        heavy: '/assets/ui/city/weather/weather-cloudy-heavy.png',
    },
    rainy: {
        light: '/assets/ui/city/weather/weather-rainy-light.png',
        comfortable: '/assets/ui/city/weather/weather-rainy-comfortable.png',
        heavy: '/assets/ui/city/weather/weather-rainy-heavy.png',
    },
    windy: {
        light: '/assets/ui/city/weather/weather-windy-light.png',
        comfortable: '/assets/ui/city/weather/weather-windy-comfortable.png',
        heavy: '/assets/ui/city/weather/weather-windy-heavy.png',
    },
    foggy: {
        light: '/assets/ui/city/weather/weather-foggy-light.png',
        comfortable: '/assets/ui/city/weather/weather-foggy-comfortable.png',
        heavy: '/assets/ui/city/weather/weather-foggy-heavy.png',
    },
    stormy: {
        light: '/assets/ui/city/weather/weather-stormy-light.png',
        comfortable: '/assets/ui/city/weather/weather-stormy-comfortable.png',
        heavy: '/assets/ui/city/weather/weather-stormy-heavy.png',
    },
};

const WEATHER_VISUAL_META = {
    sunny: {
        label: { zh: '晴天', en: 'Sunny' },
        Icon: SunMedium,
        tint: 'linear-gradient(180deg, rgba(255, 221, 150, 0.16), rgba(255, 244, 214, 0.05))',
        accent: '#f59e0b',
    },
    cloudy: {
        label: { zh: '多云', en: 'Cloudy' },
        Icon: CloudSun,
        tint: 'linear-gradient(180deg, rgba(207, 216, 240, 0.16), rgba(246, 248, 255, 0.06))',
        accent: '#7183c6',
    },
    rainy: {
        label: { zh: '雨天', en: 'Rainy' },
        Icon: CloudRain,
        tint: 'linear-gradient(180deg, rgba(83, 122, 178, 0.14), rgba(184, 207, 232, 0.06))',
        accent: '#4f83cc',
    },
    windy: {
        label: { zh: '风天', en: 'Windy' },
        Icon: Wind,
        tint: 'linear-gradient(180deg, rgba(150, 211, 232, 0.14), rgba(222, 247, 244, 0.06))',
        accent: '#2e8b89',
    },
    foggy: {
        label: { zh: '雾天', en: 'Foggy' },
        Icon: CloudFog,
        tint: 'linear-gradient(180deg, rgba(215, 223, 233, 0.18), rgba(242, 246, 249, 0.08))',
        accent: '#90a4ae',
    },
    stormy: {
        label: { zh: '雷雨', en: 'Storm' },
        Icon: CloudLightning,
        tint: 'linear-gradient(180deg, rgba(55, 62, 102, 0.18), rgba(27, 38, 64, 0.08))',
        accent: '#5c6ac4',
    },
};

const WEATHER_INTENSITY_LABELS = {
    light: { zh: '轻度', en: 'Light' },
    comfortable: { zh: '舒适', en: 'Comfortable' },
    heavy: { zh: '重度', en: 'Heavy' },
};

function parseWeatherEffect(event) {
    const value = event?.effect_json ?? event?.effect ?? {};
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_err) {
        return {};
    }
}

function normalizeWeatherPreset(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const text = raw.toLowerCase();
    const compact = text.replace(/[\s_-]+/g, '');
    if (WEATHER_BACKGROUND_ASSETS[compact]) return compact;
    if (/雷暴|雷雨|闪电|暴风雨|storm|thunder|lightning/.test(text)) return 'stormy';
    if (/晴|晴天|晴朗|艳阳|sunny|sun|clear/.test(text)) return 'sunny';
    if (/多云|阴天|阴云|云|cloud|overcast/.test(text)) return 'cloudy';
    if (/小雨|阵雨|中雨|大雨|暴雨|降雨|雨|rain|drizzle|shower/.test(text)) return 'rainy';
    if (/微风|大风|强风|阵风|风|wind|breeze|gust/.test(text)) return 'windy';
    if (/大雾|薄雾|雾|fog|mist|haze/.test(text)) return 'foggy';
    return '';
}

function normalizeWeatherIntensity(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const text = raw.toLowerCase();
    const compact = text.replace(/[\s_-]+/g, '');
    if (WEATHER_INTENSITY_LABELS[compact]) return compact;
    if (/暴|强|重|大|浓|厚|剧烈|heavy|strong|severe|dense|high/.test(text)) return 'heavy';
    if (/轻|小|微|薄|淡|light|mild|soft|low/.test(text)) return 'light';
    if (/舒适|适中|中等|普通|稳定|柔和|comfortable|moderate|normal|medium/.test(text)) return 'comfortable';
    return '';
}

function getWeatherVisual(event, isEn = false) {
    const title = String(event?.title || '');
    const desc = String(event?.description || '');
    const text = `${title} ${desc}`;
    const effect = parseWeatherEffect(event);
    const preset = normalizeWeatherPreset(
        effect.weather_preset ?? effect.weather ?? effect.preset ?? event?.weather_preset ?? text
    ) || 'cloudy';
    const intensity = normalizeWeatherIntensity(
        effect.weather_intensity ?? effect.intensity ?? effect.severity ?? event?.weather_intensity ?? text
    ) || 'comfortable';
    const meta = WEATHER_VISUAL_META[preset] || WEATHER_VISUAL_META.cloudy;
    const background = WEATHER_BACKGROUND_ASSETS[preset]?.[intensity]
        || WEATHER_BACKGROUND_ASSETS[preset]?.comfortable
        || WEATHER_BACKGROUND_ASSETS.cloudy.comfortable;
    return {
        key: preset,
        preset,
        intensity,
        label: title || meta.label[isEn ? 'en' : 'zh'],
        intensityLabel: WEATHER_INTENSITY_LABELS[intensity]?.[isEn ? 'en' : 'zh'] || '',
        Icon: meta.Icon,
        tint: meta.tint,
        accent: meta.accent,
        background,
        particles: 0,
    };
}

function isWeatherAnnouncement(item) {
    const haystack = `${item?.title || ''} ${item?.content || ''}`;
    return /天气|晴天|多云|微风|小雨|大雨|暴风雨|雷暴|大雾|春雨|雨/i.test(haystack);
}

function getAnnouncementMeta(item, isEn = false) {
    const sourceType = String(item?.source_type || '').toLowerCase();
    if (sourceType === 'mayor') {
        return { label: isEn ? 'Mayor Broadcast' : '市长广播', chipBg: '#efe6ff', chipColor: '#7c3aed', borderColor: '#ddd6fe' };
    }
    if (sourceType === 'agency') {
        return { label: isEn ? 'Agency Ad' : '中介广告', chipBg: '#ffedd5', chipColor: '#c2410c', borderColor: '#fed7aa' };
    }
    return { label: isEn ? 'Street Notice' : '街头公告', chipBg: '#ecfccb', chipColor: '#4d7c0f', borderColor: '#d9f99d' };
}

function cleanAnnouncementContent(item) {
    const raw = String(item?.content || '').trim();
    const withoutPrefix = raw.replace(/^\s*[[【].{1,12}?[\]】]\s*/, '').trim();
    return withoutPrefix || raw;
}

function splitAnnouncementParagraphs(item) {
    const cleaned = cleanAnnouncementContent(item);
    return cleaned
        .split(/\s*[|｜]\s*|\n+/)
        .map((part) => part.trim())
        .filter(Boolean);
}

function normalizeAnnouncementIdentity(item) {
    const sourceType = String(item?.source_type || '').trim().toLowerCase();
    const rawTitle = String(item?.title || '').trim();
    const rawContent = String(item?.content || '').trim();
    let title = rawTitle;
    let content = rawContent;

    if (sourceType === 'agency' && !rawTitle) {
        const normalized = rawContent.replace(/^\s*\[中介所广告\]\s*/u, '').trim();
        const splitIndex = normalized.indexOf('|');
        if (splitIndex >= 0) {
            title = normalized.slice(0, splitIndex).trim();
            content = normalized.slice(splitIndex + 1).trim();
        } else {
            content = normalized;
        }
    }

    return `${sourceType}|${title.replace(/\s+/g, ' ').trim()}|${content.replace(/\s+/g, ' ').trim()}`;
}

function splitHackerIntelContent(value) {
    const raw = String(value || '').trim();
    if (!raw) return { visible: '', hasIntel: false };
    const marker = '[黑客据点情报]';
    const markerIndex = raw.indexOf(marker);
    if (markerIndex < 0) return { visible: raw, hasIntel: false };
    const visible = raw.slice(0, markerIndex).trim();
    return { visible, hasIntel: true };
}

export default function CityLog({ apiUrl }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const tx = useCallback((en, zh) => (isEn ? en : zh), [isEn]);
    const announcementActionTypes = new Set(['ANNOUNCE', 'MAYOR', 'EVENT']);
    const isAnnouncementLog = (log) => {
        const actionType = String(log.action_type || '').toUpperCase();
        if (announcementActionTypes.has(actionType)) return true;
        return actionType === 'QUEST' && String(log.character_id || '').toLowerCase() === 'system';
    };
    const [tab, setTab] = useState('feed');
    const [logs, setLogs] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [events, setEvents] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedBag, setExpandedBag] = useState(null);
    const [collapsedDates, setCollapsedDates] = useState({});
    const [expandedHiddenLogs, setExpandedHiddenLogs] = useState({});
    const [retryingQuestReviewId, setRetryingQuestReviewId] = useState(null);
    const [rerollingLogId, setRerollingLogId] = useState(null);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
    const refreshTimerRef = React.useRef(null);
    const token = localStorage.getItem('cp_token') || '';
    const characterById = useMemo(() => new Map(characters.map(c => [String(c.id), c])), [characters]);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [logsRes, announcementsRes, eventsRes, charsRes] = await Promise.all([
                fetch(`${apiUrl}/city/logs?limit=all`, { headers }),
                fetch(`${apiUrl}/city/announcements?limit=50`, { headers }),
                fetch(`${apiUrl}/city/events`, { headers }),
                fetch(`${apiUrl}/city/characters`, { headers }),
            ]);
            const logsData = await logsRes.json();
            const announcementsData = await announcementsRes.json();
            const eventsData = await eventsRes.json();
            const charsData = await charsRes.json();
            if (logsData.success) setLogs(logsData.logs || []);
            if (announcementsData.success) setAnnouncements(announcementsData.announcements || []);
            if (eventsData.success) setEvents(eventsData.events || []);
            if (charsData.success) setCharacters(charsData.characters || []);
        } catch (e) {
            console.error('CityLog error:', e);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, token]);

    const retryQuestReview = async (logId) => {
        if (!logId || retryingQuestReviewId) return;
        setRetryingQuestReviewId(logId);
        try {
            const headers = {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
            const response = await fetch(`${apiUrl}/city/logs/${logId}/retry-quest-score`, {
                method: 'POST',
                headers,
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || tx('Mayor scoring retry failed', '市长评分重试失败'));
            }
            await fetchData();
            window.dispatchEvent(new Event('city_update'));
        } catch (error) {
            window.alert(error.message || tx('Mayor scoring retry failed', '市长评分重试失败'));
        } finally {
            setRetryingQuestReviewId(null);
        }
    };

    const rerollCityLog = async (logId) => {
        if (!logId || rerollingLogId) return;
        setRerollingLogId(logId);
        try {
            const headers = {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
            const response = await fetch(`${apiUrl}/city/logs/${logId}/reroll`, {
                method: 'POST',
                headers,
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || tx('City activity reroll failed', '商业街活动重 roll 失败'));
            }
            await fetchData();
            window.dispatchEvent(new Event('city_update'));
        } catch (error) {
            window.alert(error.message || tx('City activity reroll failed', '商业街活动重 roll 失败'));
        } finally {
            setRerollingLogId(null);
        }
    };

    useEffect(() => {
        fetchData();
        const scheduleRefresh = () => {
            if (refreshTimerRef.current) return;
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null;
                fetchData();
            }, 800);
        };
        const handleCityUpdate = () => scheduleRefresh();
        window.addEventListener('city_update', handleCityUpdate);
        const interval = setInterval(fetchData, 5000);
        return () => {
            window.removeEventListener('city_update', handleCityUpdate);
            clearInterval(interval);
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [fetchData]);

    const activityLogs = logs.filter((log) => !isAnnouncementLog(log));

    const latestLogDateTag = activityLogs.length > 0
        ? (() => {
            const latest = new Date(activityLogs[0].timestamp);
            return `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}-${String(latest.getDate()).padStart(2, '0')}`;
        })()
        : '';

    const groupedLogs = activityLogs.reduce((acc, log) => {
        const d = new Date(log.timestamp);
        const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push(log);
        return acc;
    }, {});

    const todayTag = (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    const currentWeather = getCurrentWeather(events);
    const weatherVisual = currentWeather ? getWeatherVisual(currentWeather, isEn) : null;
    const visibleAnnouncements = announcements.filter((item, index) => {
        if (isWeatherAnnouncement(item)) {
            return announcements.findIndex((candidate) => isWeatherAnnouncement(candidate)) === index;
        }
        const identity = normalizeAnnouncementIdentity(item);
        return announcements.findIndex((candidate) => normalizeAnnouncementIdentity(candidate) === identity) === index;
    });
    const summaryCards = [
        { key: 'records', Icon: Activity, label: tx('Diary Records', '日记记录'), value: activityLogs.length, tone: 'rose' },
        { key: 'notices', Icon: AlertCircle, label: tx('Notices', '公告'), value: visibleAnnouncements.length, tone: 'amber' },
        { key: 'residents', Icon: Store, label: tx('Residents', '居民'), value: characters.length, tone: 'mint' },
        {
            key: 'weather',
            Icon: weatherVisual?.Icon || CloudSun,
            label: tx('Weather', '天气'),
            value: currentWeather ? (currentWeather.title || weatherVisual?.label || tx('Live', '实时')) : tx('Quiet', '平稳'),
            tone: 'sky',
        },
    ];

    const isCollapsed = (tag) => {
        if (collapsedDates[tag] !== undefined) return collapsedDates[tag];
        return tag !== latestLogDateTag;
    };

    return (
        <div className="city-log-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <style>{`
                .city-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(148, 163, 184, 0.32) transparent;
                }
                .city-scroll::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .city-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .city-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, rgba(203, 213, 225, 0.72), rgba(148, 163, 184, 0.38));
                    border-radius: 999px;
                    border: 1px solid transparent;
                    background-clip: padding-box;
                }
                .city-scroll::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, rgba(191, 219, 254, 0.78), rgba(148, 163, 184, 0.52));
                    border-radius: 999px;
                    border: 1px solid transparent;
                    background-clip: padding-box;
                }
            `}</style>
            <div className="city-log-tabs" style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '0 12px', backgroundColor: '#fff', overflowX: 'auto', gap: '8px' }}>
                <button className={tab === 'feed' ? 'is-active' : ''} style={tabStyle(tab === 'feed')} onClick={() => setTab('feed')}>
                    <Activity size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{tx('Live Feed', '实时动态')}
                </button>
                <button className={tab === 'manage' ? 'is-active' : ''} style={tabStyle(tab === 'manage')} onClick={() => setTab('manage')}>
                    <Settings size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{tx('District Management', '分区管理')}
                </button>
            </div>

            <div className="city-log-content" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {tab === 'manage' ? (
                    <CityManager apiUrl={apiUrl} onRefreshLogs={fetchData} />
                ) : loading ? (
                    <div className="city-log-loading" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>{tx('Loading...', '加载中...')}</div>
                ) : (
                    <div
                        className="city-log-feed"
                        style={{
                            padding: isMobile ? '10px' : '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            height: '100%',
                            minHeight: 0,
                            overflow: 'hidden',
                        }}
                    >
                        <div className="city-log-overview">
                            <div className="city-log-overview-title">
                                <span className="city-log-kicker">{tx('Commercial Street Diary', '商业街日记')}</span>
                                <strong>{tx('Live city pulse', '街区实时脉搏')}</strong>
                            </div>
                            <div className="city-log-stat-grid">
                                {summaryCards.map((card) => {
                                    const StatIcon = card.Icon;
                                    return (
                                        <div key={card.key} className={`city-log-stat-card city-log-stat-card--${card.tone}`}>
                                            <StatIcon size={16} />
                                            <span>{card.label}</span>
                                            <strong>{card.value}</strong>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div
                            className="city-log-feed-layout"
                            style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: '16px',
                                flex: 1,
                                minHeight: 0,
                            }}
                        >
                        <div
                            className="city-log-main-panel"
                            style={{
                                flex: isMobile ? 'none' : 2.2,
                                minHeight: isMobile ? '56vh' : 0,
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                overflow: 'hidden',
                            }}
                        >
                            <div className="city-log-main-header" style={{ padding: '12px 18px', borderBottom: '1px solid #eee', background: weatherVisual ? weatherVisual.tint : 'linear-gradient(to right, #f8f9fa, #fff)' }}>
                                <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                                    <Activity size={16} color="#ff9800" /> {tx('City Feed', '城市动态')}
                                </h3>
                            </div>
                            {weatherVisual && (
                                <div className="city-log-weather-backdrop" style={{ position: 'absolute', inset: '52px 0 0 0', pointerEvents: 'none', overflow: 'hidden' }}>
                                    {weatherVisual.background && (
                                        <img
                                            src={weatherVisual.background}
                                            alt=""
                                            aria-hidden="true"
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                opacity: 0.94,
                                                filter: 'saturate(1.03) brightness(1.03)',
                                            }}
                                        />
                                    )}
                                    <div style={{ position: 'absolute', inset: 0, background: weatherVisual.tint, opacity: 0.08 }} />
                                    {Array.from({ length: weatherVisual.particles }).map((_, index) => (
                                        <span
                                            key={`weather-particle-${weatherVisual.key}-${index}`}
                                            style={{
                                                position: 'absolute',
                                                left: `${8 + ((index * 11) % 84)}%`,
                                                top: `${5 + ((index * 9) % 70)}%`,
                                                width: weatherVisual.key === 'foggy' ? '54px' : weatherVisual.key === 'windy' ? '30px' : '2px',
                                                height: weatherVisual.key === 'foggy' ? '12px' : weatherVisual.key === 'windy' ? '2px' : '14px',
                                                borderRadius: '999px',
                                                background: weatherVisual.key === 'foggy'
                                                    ? 'rgba(255,255,255,0.24)'
                                                    : weatherVisual.key === 'windy'
                                                        ? `${weatherVisual.accent}55`
                                                        : `${weatherVisual.accent}44`,
                                                transform: weatherVisual.key === 'windy'
                                                    ? `translateX(${(index % 4) * 6}px)`
                                                    : `rotate(${weatherVisual.key === 'stormy' ? 18 : 8}deg)`,
                                                boxShadow: weatherVisual.key === 'sunny'
                                                    ? `0 0 18px ${weatherVisual.accent}22`
                                                    : 'none',
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="city-scroll city-log-workbench" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', position: 'relative', zIndex: 1, background: weatherVisual ? 'rgba(255,255,255,0.16)' : undefined }}>
                                <div className="city-log-announcement-panel" style={{ flex: isMobile ? 'none' : 0.9, minHeight: isMobile ? '28vh' : 0, display: 'flex', flexDirection: 'column', border: '1px solid #f3e8dc', borderRadius: '10px', overflow: 'hidden', background: '#fffaf5' }}>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3e8dc', background: 'linear-gradient(to right, #fff7ed, #fff)' }}>
                                        <h3 style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#c2410c' }}>
                                            <AlertCircle size={15} color="#f97316" /> {tx('Notice Board', '公告区')}
                                        </h3>
                                    </div>
                                    <div className="city-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' }}>
                                        {currentWeather && weatherVisual && (
                                            <div className="city-log-weather-card" style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '10px', background: 'rgba(255,255,255,0.72)', border: `1px solid ${weatherVisual.accent}2e`, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: weatherVisual.accent }}>
                                                        <weatherVisual.Icon size={14} />
                                                        {tx('Current Weather', '当前天气')}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#b45309', flexShrink: 0 }}>
                                                        {new Date(currentWeather.created_at || currentWeather.timestamp || Date.now()).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#7c2d12', marginBottom: '3px' }}>
                                                    {currentWeather.emoji || ''} {currentWeather.title || weatherVisual.label}
                                                    {weatherVisual.intensityLabel && (
                                                        <span style={{ marginLeft: '6px', fontSize: '11px', color: weatherVisual.accent, fontWeight: 800 }}>
                                                            {weatherVisual.intensityLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                {currentWeather.description && (
                                                    <div style={{ fontSize: isMobile ? '12px' : '13px', color: '#7c2d12', lineHeight: 1.65 }}>
                                                        {currentWeather.description}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {visibleAnnouncements.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#bbb', padding: '16px 0', fontSize: '12px' }}>{tx('No notices yet', '暂无公告')}</div>
                                        ) : (
                                            visibleAnnouncements.map((item) => (
                                                <div className="city-log-notice-card" key={`ann-${item.id}`} style={{ padding: '10px 10px 12px', marginBottom: '10px', border: `1px solid ${getAnnouncementMeta(item, isEn).borderColor}`, borderRadius: '12px', background: 'rgba(255,255,255,0.72)', boxShadow: '0 4px 14px rgba(120, 53, 15, 0.04)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: getAnnouncementMeta(item, isEn).chipColor, background: getAnnouncementMeta(item, isEn).chipBg, borderRadius: '999px', padding: '3px 8px', flexShrink: 0 }}>
                                                            {item.title || getAnnouncementMeta(item, isEn).label}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: '#b45309', flexShrink: 0 }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {item.title && (
                                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#7c2d12', wordBreak: 'break-word' }}>
                                                                {item.title}
                                                            </div>
                                                        )}
                                                        {splitAnnouncementParagraphs(item).map((part, index) => (
                                                            <div
                                                                key={`ann-${item.id}-part-${index}`}
                                                                style={{
                                                                    fontSize: isMobile ? '12px' : '13px',
                                                                    color: '#7c2d12',
                                                                    lineHeight: 1.7,
                                                                    wordBreak: 'break-word',
                                                                    paddingLeft: index === 0 ? 0 : '10px',
                                                                    borderLeft: index === 0 ? 'none' : '2px solid rgba(249, 115, 22, 0.16)',
                                                                }}
                                                            >
                                                                {part}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div
                                    className="city-log-activity-panel"
                                    style={{
                                        flex: isMobile ? 'none' : 1.8,
                                        minHeight: isMobile ? '36vh' : 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        border: '1px solid #eee',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        background: '#fff',
                                    }}
                                >
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #eee', background: 'linear-gradient(to right, #f8f9fa, #fff)' }}>
                                        <h3 style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Activity size={15} color="#ff9800" /> {tx('Personal Activity', '个人活动')}
                                        </h3>
                                    </div>
                                    <div className="city-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' }}>
                                {activityLogs.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#bbb', marginTop: '40px', fontSize: '13px' }}>{tx('No activity yet. Waiting for the simulation engine...', '暂无动态，等待模拟引擎运行...')}</div>
                                ) : (
                                    Object.keys(groupedLogs)
                                        .sort((a, b) => b.localeCompare(a))
                                        .map((dateTag) => {
                                            const dateLogs = groupedLogs[dateTag];
                                            const collapsed = isCollapsed(dateTag);
                                            const isToday = dateTag === todayTag;
                                            return (
                                                <div className="city-log-date-group" key={dateTag} style={{ marginBottom: '12px' }}>
                                                    <div
                                                        className="city-log-date-header"
                                                        onClick={() => setCollapsedDates((prev) => ({ ...prev, [dateTag]: !collapsed }))}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '8px 10px',
                                                            backgroundColor: isToday ? '#fff8e1' : '#f5f5f5',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            marginBottom: '8px',
                                                            fontSize: isMobile ? '12px' : '13px',
                                                            fontWeight: '600',
                                                            color: isToday ? '#ff9800' : '#666',
                                                            border: isToday ? '1px solid #ffe082' : '1px solid #eee',
                                                        }}
                                                    >
                                                        {collapsed ? <ChevronRight size={14} style={{ marginRight: '6px' }} /> : <ChevronDown size={14} style={{ marginRight: '6px' }} />}
                                                        📅 {dateTag} {isToday ? tx('(today)', '(今天)') : ''}
                                                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#999', fontWeight: '400' }}>{dateLogs.length} {tx('records', '条记录')}</span>
                                                    </div>

                                                    {!collapsed &&
                                                        dateLogs.map((log) => {
                                                            const isSocial = log.action_type === 'SOCIAL';
                                                            const isCollapsedOutput = String(log.content || '').trim().startsWith('【商业街输出折叠】');
                                                            const isTruncated = Boolean(log.is_truncated) || isCollapsedOutput;
                                                            const hiddenExpanded = Boolean(expandedHiddenLogs[log.id]);
                                                            const hackerIntelView = splitHackerIntelContent(log.content);
                                                            const hasHiddenHackerIntel = hackerIntelView.hasIntel;
                                                            const displayContent = hasHiddenHackerIntel ? hackerIntelView.visible : log.content;
                                                            const logCharacter = characterById.get(String(log.character_id));
                                                            return (
                                                                <div
                                                                    className={`city-log-entry${isSocial ? ' is-social' : ''}${isTruncated ? ' is-muted' : ''}`}
                                                                    key={log.id}
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: '10px',
                                                                        padding: isMobile ? '8px' : '10px',
                                                                        marginLeft: isMobile ? '4px' : '12px',
                                                                        borderLeft: '2px solid #eee',
                                                                        borderBottom: '1px solid #f5f5f5',
                                                                        alignItems: 'flex-start',
                                                                        ...(isSocial
                                                                            ? {
                                                                                background: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e8eaf6 100%)',
                                                                                borderRadius: '0 8px 8px 0',
                                                                                marginBottom: '4px',
                                                                                border: '1px solid #e1bee7',
                                                                                borderLeft: '4px solid #ff4081',
                                                                                borderBottom: '1px solid #e1bee7',
                                                                            }
                                                                            : {}),
                                                                    }}
                                                                >
                                                                    <AvatarWithFrame
                                                                        size={isMobile ? 32 : 36}
                                                                        frame={logCharacter?.avatar_frame || log.char_avatar_frame}
                                                                        src={avatarSrc(log.char_avatar, apiUrl)}
                                                                        fallbackSrc={FALLBACK_AVATAR}
                                                                        alt=""
                                                                    />
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                                                                            <span style={{ fontWeight: '600', fontSize: isMobile ? '12px' : '13px', color: isSocial ? '#7b1fa2' : undefined }}>
                                                                                {getActionEmoji(log.action_type)} {log.char_name}
                                                                                {isSocial ? tx(' · encounter', ' · 偶遇') : ''}
                                                                            </span>
                                                                            <span style={{ fontSize: '11px', color: '#bbb', flexShrink: 0 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                                        </div>
                                                                        {isTruncated ? (
                                                                            <div
                                                                                style={{
                                                                                    borderLeft: '2px solid rgba(140, 140, 140, 0.16)',
                                                                                    background: 'rgba(120, 120, 120, 0.028)',
                                                                                    color: 'rgba(102, 102, 102, 0.5)',
                                                                                    borderRadius: '0 6px 6px 0',
                                                                                    padding: isMobile ? '4px 8px' : '5px 9px',
                                                                                    lineHeight: 1.35,
                                                                                    opacity: 0.52,
                                                                                }}
                                                                            >
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setExpandedHiddenLogs((prev) => ({ ...prev, [log.id]: !hiddenExpanded }))}
                                                                                    style={{
                                                                                        width: '100%',
                                                                                        border: 'none',
                                                                                        background: 'transparent',
                                                                                        padding: 0,
                                                                                        cursor: 'pointer',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'space-between',
                                                                                        gap: '6px',
                                                                                        color: 'inherit',
                                                                                        textAlign: 'left',
                                                                                        opacity: 0.95,
                                                                                    }}
                                                                                >
                                                                                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.01em' }}>
                                                                                        <AlertCircle size={11} />
                                                                                        {isCollapsedOutput ? tx('City activity collapsed', '商业街活动已折叠') : tx('Hidden content', '隐藏内容')}
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: 'rgba(108, 108, 108, 0.42)' }}>
                                                                                        <span>{hiddenExpanded ? tx('Collapse', '收起') : tx('View', '查看')}</span>
                                                                                        {hiddenExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                                                    </div>
                                                                                </button>
                                                                                {hiddenExpanded && (
                                                                                    <div style={{ marginTop: '4px', fontSize: '10px', color: 'rgba(92, 92, 92, 0.64)', wordBreak: 'break-word' }}>
                                                                                        {tx('Original: ', '原文：')}{log.truncated_original_content || log.content}
                                                                                    </div>
                                                                                )}
                                                                                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => rerollCityLog(log.id)}
                                                                                        disabled={rerollingLogId === log.id}
                                                                                        style={{
                                                                                            border: '1px solid rgba(245, 158, 11, 0.35)',
                                                                                            borderRadius: '999px',
                                                                                            padding: '4px 8px',
                                                                                            background: rerollingLogId === log.id ? '#fde68a' : '#fff7ed',
                                                                                            color: '#b45309',
                                                                                            cursor: rerollingLogId === log.id ? 'not-allowed' : 'pointer',
                                                                                            fontSize: '10px',
                                                                                            fontWeight: 700,
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                        }}
                                                                                    >
                                                                                        <RotateCcw size={10} />
                                                                                        {rerollingLogId === log.id ? tx('Retrying...', '重试中...') : tx('Retry', '重试')}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                {!!displayContent && (
                                                                                    <div style={{ fontSize: isMobile ? '12px' : '13px', color: isSocial ? '#4a148c' : '#555', lineHeight: 1.7, wordBreak: 'break-word' }}>{displayContent}</div>
                                                                                )}
                                                                                {hasHiddenHackerIntel && (
                                                                                    <div
                                                                                        style={{
                                                                                            marginTop: '6px',
                                                                                            borderLeft: '2px solid rgba(140, 140, 140, 0.16)',
                                                                                            background: 'rgba(120, 120, 120, 0.028)',
                                                                                            color: 'rgba(102, 102, 102, 0.68)',
                                                                                            borderRadius: '0 6px 6px 0',
                                                                                            padding: isMobile ? '4px 8px' : '5px 9px',
                                                                                            lineHeight: 1.4,
                                                                                        }}
                                                                                    >
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setExpandedHiddenLogs((prev) => ({ ...prev, [log.id]: !hiddenExpanded }))}
                                                                                            style={{
                                                                                                width: '100%',
                                                                                                border: 'none',
                                                                                                background: 'transparent',
                                                                                                padding: 0,
                                                                                                cursor: 'pointer',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                justifyContent: 'space-between',
                                                                                                gap: '6px',
                                                                                                color: 'inherit',
                                                                                                textAlign: 'left',
                                                                                            }}
                                                                                        >
                                                                                            <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.01em' }}>
                                                                                                <AlertCircle size={11} />
                                                                                                {tx('Hacker intel monitor log collapsed', '黑客据点监听记录已折叠')}
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: 'rgba(108, 108, 108, 0.5)' }}>
                                                                                                <span>{hiddenExpanded ? tx('Collapse', '收起') : tx('View', '查看')}</span>
                                                                                                {hiddenExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                                                            </div>
                                                                                        </button>
                                                                                        {hiddenExpanded && (
                                                                                            <div style={{ marginTop: '4px', fontSize: '10px', color: 'rgba(92, 92, 92, 0.7)', wordBreak: 'break-word' }}>
                                                                                                {tx('Detailed monitored conversations are visible only to the character. The frontend will not show raw private-chat content to the user.', '具体监听对话仅角色可见，前端不会向用户展示原始私聊内容。')}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        {(log.delta_calories !== 0 || log.delta_money !== 0) && (
                                                                            <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', fontWeight: '600' }}>
                                                                                {log.delta_calories !== 0 && (
                                                                                    <span style={{ color: log.delta_calories > 0 ? '#4caf50' : '#f44336' }}>
                                                                                        {log.delta_calories > 0 ? '+' : ''}
                                                                                        {log.delta_calories} {tx('cal', '卡')}
                                                                                    </span>
                                                                                )}
                                                                                {log.delta_money !== 0 && (
                                                                                    <span style={{ color: log.delta_money > 0 ? '#ff9800' : '#d32f2f' }}>
                                                                                        {log.delta_money > 0 ? '+' : ''}
                                                                                        {Number(log.delta_money).toFixed(0)} {tx('coins', '金币')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {log.quest_review && (
                                                                            <div
                                                                                style={{
                                                                                    marginTop: '8px',
                                                                                    padding: isMobile ? '8px' : '9px 10px',
                                                                                    borderRadius: '8px',
                                                                                    background: String(log.quest_review.status || '') === 'error' ? '#fff1f0' : '#fff7e8',
                                                                                    border: `1px solid ${String(log.quest_review.status || '') === 'error' ? '#ffccc7' : '#ffd591'}`,
                                                                                }}
                                                                            >
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: String(log.quest_review.status || '') === 'error' ? '#cf1322' : '#ad6800' }}>
                                                                                            {String(log.quest_review.status || '') === 'error' ? tx('Quest Scoring Failed', '任务评分失败') : tx('Quest Progress Score', '任务推进评分')}
                                                                                        </span>
                                                                                        {String(log.quest_review.status || '') !== 'error' && (
                                                                                            <span style={{ fontSize: '11px', color: '#d46b08', fontWeight: 700 }}>
                                                                                                +{Number(log.quest_review.progress_delta || 0)} {tx('pts', '分')}
                                                                                            </span>
                                                                                        )}
                                                                                        {String(log.quest_review.short_label || '').trim() && String(log.quest_review.status || '') !== 'error' && (
                                                                                            <span style={{ fontSize: '10px', color: '#ad6800', background: '#fff1b8', borderRadius: '999px', padding: '2px 6px' }}>
                                                                                                {log.quest_review.short_label}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    {String(log.quest_review.status || '') !== 'error' && (
                                                                                        <span style={{ fontSize: '11px', color: '#ad6800', fontWeight: 600 }}>
                                                                                            {Number(log.quest_review.progress_after || 0)}/{Number(log.quest_review.target_score || 0)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {String(log.quest_review.status || '') === 'error' ? (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                                        <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#a8071a', lineHeight: 1.6 }}>
                                                                                            {log.quest_review.error_message || tx('Quest scoring failed. Please retry.', '任务评分失败，请重试。')}
                                                                                        </div>
                                                                                        <div>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => retryQuestReview(log.id)}
                                                                                                disabled={retryingQuestReviewId === log.id}
                                                                                                style={{
                                                                                                    border: 'none',
                                                                                                    borderRadius: '999px',
                                                                                                    padding: '5px 10px',
                                                                                                    background: retryingQuestReviewId === log.id ? '#ffd8bf' : '#ff7a45',
                                                                                                    color: '#fff',
                                                                                                    cursor: retryingQuestReviewId === log.id ? 'not-allowed' : 'pointer',
                                                                                                    fontSize: '11px',
                                                                                                    fontWeight: 700,
                                                                                                }}
                                                                                            >
                                                                                                {retryingQuestReviewId === log.id ? tx('Retrying...', '重试中...') : tx('Retry scoring only', '只重试评分')}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#8c5a12', lineHeight: 1.65 }}>
                                                                                        {log.quest_review.comment || tx('This action has been scored by the Mayor judge.', '这次行动已由市长裁判完成评分。')}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            );
                                        })
                                )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            className="city-log-population-panel"
                            style={{
                                flex: isMobile ? 'none' : 1,
                                minHeight: isMobile ? '46vh' : 0,
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                overflow: 'hidden',
                            }}
                        >
                            <div className="city-log-population-header" style={{ padding: '12px 18px', borderBottom: '1px solid #eee' }}>
                                <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px' }}>{tx('Population Status', '人口状态')}</h3>
                            </div>
                            <div className="city-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
                                {characters.map((c) => {
                                    const status = getStatusDetails(c.city_status, isEn);
                                    const emotion = deriveEmotion(c);
                                    const physical = derivePhysicalState(c);
                                    const pct = Math.min(100, Math.max(0, (c.calories / 4000) * 100));
                                    const bagOpen = expandedBag === c.id;
                                    const inventory = c.inventory || [];
                                    const stateChips = [
                                        { label: tx('Energy ⚡', '精力 ⚡'), value: c.energy ?? 100, color: getStateColor(c.energy ?? 100) },
                                        { label: tx('Sleep Debt 😴', '睡眠债 😴'), value: c.sleep_debt ?? 0, color: getInvertedStateColor(c.sleep_debt ?? 0) },
                                        { label: tx('Stress 🔥', '压力 🔥'), value: c.stress ?? 20, color: getInvertedStateColor(c.stress ?? 20) },
                                        { label: tx('Social Need 💬', '社交需求 💬'), value: c.social_need ?? 50, color: getInvertedStateColor(c.social_need ?? 50) },
                                        { label: tx('Health ❤️', '健康 ❤️'), value: c.health ?? 100, color: getStateColor(c.health ?? 100) },
                                        { label: tx('Satiety 🍽️', '饱腹感 🍽️'), value: c.satiety ?? 45, color: getStateColor(c.satiety ?? 45) },
                                        { label: tx('Stomach Load 🤰', '胃负担 🤰'), value: c.stomach_load ?? 0, color: getInvertedStateColor(c.stomach_load ?? 0) },
                                    ];
                                    return (
                                        <div className="city-log-character-card" key={c.id} style={{ padding: isMobile ? '8px' : '10px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <AvatarWithFrame
                                                    size={isMobile ? 26 : 28}
                                                    frame={c.avatar_frame}
                                                    src={avatarSrc(c.avatar, apiUrl)}
                                                    fallbackSrc={FALLBACK_AVATAR}
                                                    alt=""
                                                />
                                                <span style={{ fontWeight: '500', flex: 1, minWidth: 0, fontSize: isMobile ? '12px' : '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                                <span style={{ fontSize: '10px', color: emotion.color, fontWeight: '700', flexShrink: 0 }}>{emotion.emoji} {getEmotionLabel(emotion, isEn)}</span>
                                                <span style={{ fontSize: '10px', color: physical.color, fontWeight: '700', flexShrink: 0 }}>{physical.emoji} {getPhysicalLabel(physical, isEn)}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#ff9800', flexShrink: 0 }}>{(c.wallet || 0).toFixed(0)}💰</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: isMobile ? '10px' : '11px', color: status.color, marginBottom: '6px', padding: '4px 6px', backgroundColor: `${status.color}12`, borderRadius: '4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                                {status.icon} {status.text} · {getLocalizedLocationName(c.location, isEn)}
                                            </div>
                                            <div style={{ width: '100%', height: '5px', backgroundColor: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct < 20 ? '#f44336' : pct < 50 ? '#ff9800' : '#4caf50', transition: 'width 0.3s' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px', marginTop: '6px' }}>
                                                {stateChips.map((chip) => (
                                                    <div key={chip.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', padding: '3px 5px', borderRadius: '4px', backgroundColor: `${chip.color}12`, color: chip.color }}>
                                                        <span>{chip.label}</span>
                                                        <span style={{ fontWeight: '700' }}>{chip.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '10px', color: '#aaa' }}>{c.calories}/4000 {tx('calories', '卡路里')}</span>
                                                <button
                                                    onClick={() => setExpandedBag(bagOpen ? null : c.id)}
                                                    style={{ fontSize: '10px', color: inventory.length > 0 ? '#ff9800' : '#ccc', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
                                                >
                                                    <Package size={12} /> {tx('Inventory', '背包')} ({inventory.length})
                                                </button>
                                            </div>
                                            {bagOpen && (
                                                <div style={{ marginTop: '6px', padding: '6px', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px dashed #ddd' }}>
                                                    {inventory.length === 0 ? (
                                                        <div style={{ fontSize: '11px', color: '#bbb', textAlign: 'center' }}>{tx('Empty inventory', '空背包')}</div>
                                                    ) : (
                                                        inventory.map((item) => (
                                                            <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '12px' }}>
                                                                <span>{item.emoji}</span>
                                                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                                                <span style={{ color: '#999', fontSize: '11px', flexShrink: 0 }}>x{item.quantity}</span>
                                                                {item.cal_restore > 0 && <span style={{ color: '#4caf50', fontSize: '10px', flexShrink: 0 }}>+{item.cal_restore}{tx('cal', '卡')}</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
