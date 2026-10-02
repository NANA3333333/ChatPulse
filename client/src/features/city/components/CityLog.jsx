import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertCircle,
    Archive,
    Bell,
    BookOpen,
    Briefcase,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSun,
    Coffee,
    Coins,
    List,
    MapPin,
    Megaphone,
    Moon,
    Package,
    Power,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Store,
    SunMedium,
    User,
    Users,
    Wind,
} from 'lucide-react';
import CityManager from "./CityManager.jsx";
import AvatarWithFrame from "../../../shared/media/AvatarWithFrame.jsx";
import { defaultAvatarUrl, resolveAvatarUrl } from "../../../shared/media/avatar.js";
import { deriveEmotion, derivePhysicalState } from "../../characters/emotion.js";
import { useLanguage } from "../../../shared/i18n/LanguageContext.jsx";
import "./CityLog.css";

const FALLBACK_AVATAR = defaultAvatarUrl('User');
const avatarSrc = (url, apiUrl) => resolveAvatarUrl(url, apiUrl) || FALLBACK_AVATAR;
const CITY_LIVE_EVENTS = ['city_update', 'wallet_sync', 'refresh_contacts', 'city_inventory_update'];
const INITIAL_VISIBLE_ROW_LIMIT = 300;
const ROW_LIMIT_STEP = 300;
const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();
const isEnabledConfigValue = (value) => value === true || value === 1 || String(value || '').toLowerCase() === '1' || String(value || '').toLowerCase() === 'true';
const getInventoryQuantityTotal = (inventory = []) => Array.isArray(inventory)
    ? inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0)
    : 0;

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

const TONES = ['blue', 'coral', 'green', 'purple', 'amber', 'red'];

const asNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getLocalizedLocationName = (location, isEn) => LOCATION_NAMES[location]?.[isEn ? 'en' : 'zh'] || location || (isEn ? 'Home' : '家');
const getEmotionLabel = (emotion, isEn) => (isEn ? (EMOTION_LABEL_EN[emotion?.key] || emotion?.label || '') : (emotion?.label || ''));
const getPhysicalLabel = (physical, isEn) => (isEn ? (PHYSICAL_LABEL_EN[physical?.key] || physical?.label || '') : (physical?.label || ''));

function getStatusDetails(status, isEn = false) {
    switch (status) {
        case 'working':
            return { icon: <Briefcase size={15} />, text: isEn ? 'Working' : '工作中' };
        case 'eating':
            return { icon: <Coffee size={15} />, text: isEn ? 'Eating' : '吃饭中' };
        case 'sleeping':
            return { icon: <Moon size={15} />, text: isEn ? 'Sleeping' : '睡觉中' };
        case 'hungry':
            return { icon: <AlertCircle size={15} />, text: isEn ? 'Hungry' : '饥饿' };
        case 'coma':
            return { icon: <Activity size={15} />, text: isEn ? 'Unconscious' : '昏迷' };
        default:
            return { icon: <Store size={15} />, text: isEn ? 'Idle' : '空闲' };
    }
}

function getActionEmoji(type) {
    switch (String(type || '').toUpperCase()) {
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
        case 'ORGANIZE_BAG':
            return '🎒';
        case 'HOSPITAL':
            return '🏥';
        case 'SOCIAL':
            return '💬';
        case 'QUEST':
            return '📌';
        default:
            return '';
    }
}

function parseWeatherEffect(event) {
    const value = event?.effect_json ?? event?.effect ?? {};
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
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
    };
}

function getCurrentWeather(events) {
    if (!Array.isArray(events)) return null;
    return events.find((event) => String(event.event_type || '').toLowerCase() === 'weather') || null;
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

function parseQuestReview(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function formatDateTag(value) {
    const date = new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(value, isEn) {
    const date = new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return '--:--';
    return date.toLocaleTimeString(isEn ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(tag, todayTag, isEn) {
    if (!tag) return isEn ? 'Unknown date' : '未知日期';
    if (tag === todayTag) return isEn ? `${tag} Today` : `${tag} 今天`;
    return tag;
}

function getCategoryForLog(log) {
    const type = String(log?.action_type || '').toUpperCase();
    const questReview = parseQuestReview(log?.quest_review);
    const content = String(log?.content || '').trim();
    if (Boolean(log?.is_truncated) || content.startsWith('【商业街输出折叠】') || String(questReview?.status || '') === 'error' || type.includes('ERROR')) {
        return 'exception';
    }
    if (type === 'SOCIAL') return 'social';
    if (['BUY', 'EAT', 'GIFT', 'GIVE_ITEM', 'FED', 'BROKE', 'ORGANIZE_BAG'].includes(type)) return 'trade';
    return 'action';
}

function getCategoryLabel(categoryId, tx) {
    switch (categoryId) {
        case 'action':
            return tx('Action', '行动');
        case 'trade':
            return tx('Trade', '交易');
        case 'social':
            return tx('Social', '社交');
        case 'notice':
            return tx('Notice', '公告');
        case 'exception':
            return tx('Exception', '异常');
        default:
            return tx('All', '全部');
    }
}

function getLogActionTitle(log, content, tx) {
    const emoji = getActionEmoji(log.action_type);
    const type = String(log.action_type || '').toUpperCase();
    const text = String(content || log.content || '').replace(/\s+/g, ' ').trim();
    if (text) return `${emoji ? `${emoji} ` : ''}${text}`;
    if (type === 'SOCIAL') return tx('Social encounter', '社交偶遇');
    if (type === 'BUY') return tx('Bought an item', '购买物品');
    if (type === 'EAT') return tx('Had a meal', '吃饭恢复');
    if (type === 'ORGANIZE_BAG') return tx('Organized backpack', '整理背包');
    if (type === 'QUEST') return tx('Quest progress', '任务推进');
    return type || tx('City activity', '城市行动');
}

function Avatar({ resident, size = 'md', apiUrl }) {
    const name = resident?.name || 'C';
    if (resident?.avatar) {
        return (
            <AvatarWithFrame
                size={size === 'lg' ? 68 : size === 'sm' ? 32 : 50}
                frame={resident.avatarFrame || 'none'}
                src={avatarSrc(resident.avatar, apiUrl)}
                fallbackSrc={FALLBACK_AVATAR}
                alt=""
                className={`city-avatar city-avatar-${size}`}
            />
        );
    }
    return (
        <div className={`avatar-placeholder avatar-${size} tone-${resident?.tone || 'blue'}`} aria-label={`${name}头像占位`}>
            {name.slice(0, 1)}
        </div>
    );
}

function Metric({ value, kind }) {
    const number = asNumber(value);
    const positive = number > 0;
    const display = number === 0 ? '0' : `${positive ? '+' : '-'}${Math.abs(number)}`;
    return <span className={`metric ${positive ? 'positive' : number < 0 ? 'negative' : 'neutral'}`}>{display}{kind}</span>;
}

function AppShell({
    page,
    setPage,
    children,
    currentWeather,
    weatherVisual,
    onRefresh,
    loading,
    tx,
    isEn,
    residentCount = 0,
    searchValue,
    onSearchChange,
    cityEnabled = false,
    cityStatusKnown = false,
    togglingCityEnabled = false,
    onToggleCityEnabled,
}) {
    const now = new Date();
    const WeatherIcon = weatherVisual?.Icon || CloudSun;
    const weatherText = currentWeather ? (currentWeather.title || weatherVisual?.label || tx('Live', '实时')) : tx('Quiet', '平稳');
    const dateText = isEn
        ? now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toLocaleDateString('zh-CN', { weekday: 'short' })}`;
    const timeText = now.toLocaleTimeString(isEn ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="brand">
                    <span className="brand-mark"><Activity /></span>
                    <strong>ChatPulse</strong>
                    <i />
                    <b>{tx('Commercial Street', '商业街')}</b>
                </div>
                <nav className="page-tabs" aria-label={tx('Commercial street page', '商业街页面')}>
                    <button className={page === 'logs' ? 'active' : ''} type="button" onClick={() => setPage('logs')}>{tx('Logs', '日志')}</button>
                    <button className={page === 'settings' ? 'active' : ''} type="button" onClick={() => setPage('settings')}>{tx('Management', '管理')}</button>
                </nav>
                <div className="top-meta">
                    <span><CalendarDays />{dateText}</span>
                    <span>{timeText}</span>
                    <span className="weather"><WeatherIcon />{weatherText}</span>
                    <span><User />{tx(`Online ${residentCount}`, `在线 ${residentCount}`)}</span>
                    <label className="global-search">
                        <input
                            value={searchValue}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder={tx('Search districts/items/characters', '搜索分区/商品/角色')}
                        />
                        <Search />
                    </label>
                    <button
                        className={`city-status-button ${cityEnabled ? 'is-on' : 'is-off'}`}
                        type="button"
                        onClick={onToggleCityEnabled}
                        disabled={!cityStatusKnown || togglingCityEnabled}
                        aria-pressed={cityEnabled}
                        title={cityEnabled ? tx('Click to pause commercial street', '点击关闭商业街') : tx('Click to start commercial street', '点击开启商业街')}
                    >
                        <Power />
                        {togglingCityEnabled
                            ? tx('Saving', '保存中')
                            : cityEnabled
                                ? tx('Street On', '商业街开启')
                                : cityStatusKnown
                                    ? tx('Street Off', '商业街关闭')
                                    : tx('Status', '状态')}
                    </button>
                    <button className="icon-button refresh-button" type="button" onClick={onRefresh} disabled={loading}><RotateCcw />{tx('Refresh', '刷新')}</button>
                </div>
            </header>
            {children}
        </div>
    );
}

function ResidentRibbon({ residents, selected, setSelected, apiUrl, tx, activityCount }) {
    const trackRef = useRef(null);
    const scrollNext = () => trackRef.current?.scrollBy({ left: 320, behavior: 'smooth' });
    return (
        <div className="resident-ribbon" aria-label={tx('Resident filter', '居民筛选')}>
            <div className="ribbon-track" ref={trackRef}>
                <button type="button" className={`resident-tab resident-tab-all ${selected === 'all' ? 'selected' : ''}`} onClick={() => setSelected('all')}>
                    <div className="avatar-placeholder avatar-md tone-blue"><Users size={22} /></div>
                    <span className="resident-tab-copy"><strong>{tx('All Residents', '全部居民')}</strong><small>{tx('Full city feed', '全城动态')}</small></span>
                    <span className="energy-ring energy-high">{activityCount}</span>
                </button>
                {residents.map((resident) => (
                    <button key={resident.id} type="button" className={`resident-tab ${selected === resident.id ? 'selected' : ''}`} onClick={() => setSelected(selected === resident.id ? 'all' : resident.id)}>
                        <Avatar resident={resident} apiUrl={apiUrl} />
                        <span className="resident-tab-copy"><strong>{resident.name}</strong><small>{resident.place}</small></span>
                        <span className={`energy-ring energy-${resident.energy < 50 ? 'low' : resident.energy < 70 ? 'mid' : 'high'}`}>{resident.energy}</span>
                        {resident.unread > 0 && <b className="unread-badge">{resident.unread}</b>}
                    </button>
                ))}
            </div>
            <button className="ribbon-next" type="button" aria-label={tx('More residents', '查看更多居民')} onClick={scrollNext}><ChevronRight /></button>
        </div>
    );
}

function CategoryRail({ categories, active, setActive }) {
    return (
        <aside className="category-rail" aria-label="Log categories">
            {categories.map((item) => {
                const Icon = item.icon;
                return (
                    <button key={item.id} className={active === item.id ? 'active' : ''} type="button" onClick={() => setActive(item.id)}>
                        <Icon />
                        <span>{item.label}</span>
                        {item.count > 0 && <b>{item.count > 99 ? '99+' : item.count}</b>}
                    </button>
                );
            })}
        </aside>
    );
}

function LogRow({ row, expanded, setExpanded, apiUrl, tx, isEn, expandedHiddenLogs, setExpandedHiddenLogs, retryQuestReview, rerollCityLog, retryingQuestReviewId, rerollingLogId }) {
    const hiddenExpanded = Boolean(expandedHiddenLogs[row.numericId]);
    const showFailureActions = row.sourceType === 'log' && (row.failed || row.isTruncated || String(row.questReview?.status || '') === 'error');
    return (
        <article className={`log-row ${row.failed ? 'is-failed' : ''} ${expanded ? 'is-expanded' : ''}`}>
            <button className="log-row-main" type="button" aria-expanded={expanded} onClick={() => setExpanded(expanded ? null : row.id)}>
                <time>{row.time}</time>
                <span className="log-person">
                    <Avatar resident={row.resident} apiUrl={apiUrl} size="sm" />
                    <strong>{row.residentName}</strong>
                </span>
                <span className="log-action"><b>{row.action}</b><small>{row.categoryLabel}</small></span>
                <span className="log-place"><MapPin />{row.place}</span>
                <Metric value={row.money} kind={tx(' coins', '金币')} />
                <Metric value={row.energy} kind={tx(' energy', '精力')} />
                <Metric value={row.calories} kind={tx(' cal', '卡')} />
                <span className="row-caret">{expanded ? <ChevronDown /> : <ChevronRight />}</span>
            </button>
            {expanded && (
                <div className="log-expanded">
                    <div>
                        <h4>{row.failed ? tx('Exception Details', '异常详情') : tx('Event Details', '事件详情')}</h4>
                        <p>{row.content || row.action}</p>
                        {(row.isTruncated || row.hasHiddenHackerIntel) && (
                            <div className="technical-reason">
                                <strong>{row.isTruncated ? tx('Hidden content', '隐藏内容') : tx('Private intel hidden', '私密情报已隐藏')}</strong>
                                <button className="text-link-button" type="button" onClick={() => setExpandedHiddenLogs((prev) => ({ ...prev, [row.numericId]: !hiddenExpanded }))}>
                                    {hiddenExpanded ? tx('Collapse original', '收起原文') : tx('View original', '查看原文')}
                                </button>
                                {hiddenExpanded && <code>{row.hiddenContent || row.content}</code>}
                            </div>
                        )}
                        {row.technicalReason && (
                            <div className="technical-reason">
                                <strong>{tx('Technical reason', '技术原因')}</strong>
                                <code>{row.technicalReason}</code>
                            </div>
                        )}
                        <dl>
                            <div><dt>{tx('Source', '来源')}</dt><dd>{row.sourceLabel}</dd></div>
                            <div><dt>{tx('Location', '地点')}</dt><dd>{row.place}</dd></div>
                            <div><dt>{tx('Recorded at', '记录时间')}</dt><dd>{new Date(row.timestamp).toLocaleString(isEn ? 'en-US' : 'zh-CN')}</dd></div>
                        </dl>
                    </div>
                    <div>
                        <h4>{row.questReview ? tx('Mayor Review', '市长评分') : tx('State Changes', '状态变化')}</h4>
                        {row.questReview ? (
                            <div className={`quest-review-card ${String(row.questReview.status || '') === 'error' ? 'is-error' : ''}`}>
                                <div className="quest-review-head">
                                    <strong>{String(row.questReview.status || '') === 'error' ? tx('Scoring failed', '评分失败') : tx('Progress score', '推进评分')}</strong>
                                    {String(row.questReview.status || '') !== 'error' && <b>+{Number(row.questReview.progress_delta || 0)} {tx('pts', '分')}</b>}
                                </div>
                                {String(row.questReview.status || '') !== 'error' && (
                                    <div className="progress">
                                        <span style={{ width: `${clamp((Number(row.questReview.progress_after || 0) / Math.max(1, Number(row.questReview.target_score || 1))) * 100, 0, 100)}%` }} />
                                    </div>
                                )}
                                <p>{String(row.questReview.status || '') === 'error' ? (row.questReview.error_message || tx('Quest scoring failed. Please retry.', '任务评分失败，请重试。')) : (row.questReview.comment || tx('This action has been scored by the Mayor judge.', '这次行动已由市长裁判完成评分。'))}</p>
                            </div>
                        ) : (
                            <p>{tx('This record has been synchronized to wallet, energy and inventory state.', '本条记录已同步角色钱包、体力和背包状态。')}</p>
                        )}
                        {showFailureActions && (
                            <div className="inline-actions">
                                <button type="button" onClick={() => rerollCityLog(row.numericId)} disabled={rerollingLogId === row.numericId}>
                                    <RotateCcw /><span>{rerollingLogId === row.numericId ? tx('Generating...', '生成中...') : tx('Regenerate', '重新生成')}<small>{tx('Rebuild this event', '重新生成本次事件')}</small></span>
                                </button>
                                <button className="primary" type="button" onClick={() => retryQuestReview(row.numericId)} disabled={retryingQuestReviewId === row.numericId}>
                                    <Activity /><span>{retryingQuestReviewId === row.numericId ? tx('Scoring...', '评分中...') : tx('Retry score', '重试评分')}<small>{tx('Keep event content', '保留事件内容')}</small></span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}

function CityBrief({ currentWeather, weatherVisual, visibleAnnouncements, events, selectedResident, residents, apiUrl, tx, isEn, onRefresh }) {
    const selected = residents.find((item) => item.id === selectedResident) || residents[0] || null;
    const WeatherIcon = weatherVisual?.Icon || CloudSun;
    const eventLines = events
        .filter((event) => String(event.event_type || '').toLowerCase() !== 'weather')
        .slice(0, 3);
    const inventory = selected?.inventory || [];
    const inventoryQuantity = getInventoryQuantityTotal(inventory);
    const status = selected?.raw ? getStatusDetails(selected.raw.city_status, isEn) : null;

    return (
        <aside className="city-brief">
            <section>
                <h3><Bell />{tx('City Brief', '城市简报')}</h3>
                <div className="weather-line">
                    <WeatherIcon />
                    <div>
                        <strong>{currentWeather ? (currentWeather.title || weatherVisual?.label) : tx('Street is quiet', '街区平稳')}</strong>
                        <span>{weatherVisual?.intensityLabel || tx('No special weather', '暂无特殊天气')}</span>
                    </div>
                    <small>{currentWeather ? formatTime(currentWeather.created_at || currentWeather.timestamp, isEn) : tx('Now', '现在')}</small>
                </div>
                {currentWeather?.description && <p className="brief-description">{currentWeather.description}</p>}
            </section>

            <section>
                <div className="section-heading">
                    <h4><Megaphone />{tx('Notices', '公告')}</h4>
                    <button type="button" onClick={onRefresh}>{tx('Refresh', '刷新')}</button>
                </div>
                {visibleAnnouncements.length === 0 ? (
                    <p>{tx('No notices yet.', '暂无公告。')}</p>
                ) : visibleAnnouncements.slice(0, 3).map((item) => {
                    const meta = getAnnouncementMeta(item, isEn);
                    const paragraphs = splitAnnouncementParagraphs(item);
                    return (
                        <div className="event-line" key={`brief-ann-${item.id}`}>
                            <i />
                            <div>
                                <strong>{item.title || meta.label}</strong>
                                <span>{paragraphs[0] || cleanAnnouncementContent(item)}</span>
                            </div>
                            <b>{meta.label}</b>
                        </div>
                    );
                })}
            </section>

            <section>
                <h4><Archive />{tx('Active Events', '当前事件')}</h4>
                {eventLines.length === 0 ? (
                    <p>{tx('No active event right now.', '当前没有活跃事件。')}</p>
                ) : eventLines.map((event) => (
                    <div className="event-line" key={`brief-event-${event.id || event.title}`}>
                        <i />
                        <div>
                            <strong>{event.emoji || ''}{event.title || tx('Street event', '街区事件')}</strong>
                            <span>{event.description || tx('Event is running.', '事件正在进行。')}</span>
                        </div>
                        <b>{event.event_type || tx('Live', '实时')}</b>
                    </div>
                ))}
            </section>

            {selected && (
                <section className="resident-detail">
                    <div className="section-heading">
                        <h4><User />{tx('Resident Snapshot', '居民快照')}</h4>
                    </div>
                    <div className="detail-person">
                        <Avatar resident={selected} apiUrl={apiUrl} size="lg" />
                        <div>
                            <strong>{selected.name}</strong>
                            <span><MapPin />{selected.place}</span>
                            <small>{selected.mood} · {selected.physical}</small>
                        </div>
                    </div>
                    <div className="detail-metrics">
                        <div><span>{tx('Coins', '金币')}</span><strong>{selected.wallet.toFixed(0)}</strong></div>
                        <div><span>{tx('Energy', '精力')}</span><strong>{selected.energy}</strong></div>
                        <div><span>{tx('Inventory', '背包')}</span><strong>{inventoryQuantity}/10</strong></div>
                    </div>
                    <div className="progress"><span style={{ width: `${selected.energy}%` }} /></div>
                    <div className="inventory-preview">
                        <span>{tx('Inventory preview', '背包预览')}</span>
                        <div>
                            {inventory.slice(0, 6).length > 0 ? inventory.slice(0, 6).map((item, index) => (
                                <i key={`${selected.id}-item-${item.item_id || item.id || index}`} title={`${item.name || item.item_name || tx('Item', '物品')}${Number(item.user_gifted_quantity || item.gifted_quantity || 0) > 0 ? ` · ${tx('Gifted by user', '用户送的')}` : ''}`}>
                                    {item.emoji || item.name?.slice(0, 1) || item.item_name?.slice(0, 1) || <Package size={14} />}
                                </i>
                            )) : <i>--</i>}
                        </div>
                    </div>
                    <div className="schedule">
                        <h5>{tx('Current state', '当前状态')}</h5>
                        <p><time>{formatTime(Date.now(), isEn)}</time><span>{status?.icon}{status?.text} · {selected.place}</span></p>
                    </div>
                </section>
            )}
        </aside>
    );
}

function LogPage({ rows, totalRows, canLoadMore, onLoadMore, categories, category, setCategory, selectedResident, setSelectedResident, searchValue, clearSearch, residents, apiUrl, tx, isEn, currentWeather, weatherVisual, visibleAnnouncements, events, onRefresh, loading, retryQuestReview, rerollCityLog, retryingQuestReviewId, rerollingLogId, activityCount }) {
    const [expandedRow, setExpandedRow] = useState(null);
    const [expandedHiddenLogs, setExpandedHiddenLogs] = useState({});
    const todayTag = formatDateTag(Date.now());
    const firstRowId = rows[0]?.id || null;
    const groupedRows = useMemo(() => rows.reduce((acc, row) => {
        const tag = row.dateTag || todayTag;
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push(row);
        return acc;
    }, {}), [rows, todayTag]);
    const sortedTags = Object.keys(groupedRows).sort((a, b) => b.localeCompare(a));

    useEffect(() => {
        setExpandedRow((current) => {
            if (current && rows.some((row) => row.id === current)) return current;
            return firstRowId;
        });
    }, [firstRowId, rows]);

    return (
        <div className="log-page">
            <ResidentRibbon residents={residents} selected={selectedResident} setSelected={setSelectedResident} apiUrl={apiUrl} tx={tx} activityCount={activityCount} />
            <div className="log-workspace">
                <CategoryRail categories={categories} active={category} setActive={setCategory} />
                <main className="workspace-scroll city-scroll">
                    <div className="feed-column">
                        <div className="feed-toolbar">
                            <div><BookOpen /><strong>{tx('Live Ledger', '实时账本')}</strong><span>{rows.length}/{totalRows} {tx('records', '条记录')}</span></div>
                            <button type="button" onClick={onRefresh} disabled={loading}><SlidersHorizontal />{tx('Refresh feed', '刷新动态')}</button>
                        </div>
                        <div className="log-list">
                            {rows.length === 0 ? (
                                <div className="empty-state">
                                    <Archive />
                                    <strong>{tx('No records found', '没有找到记录')}</strong>
                                    <span>{selectedResident !== 'all' || category !== 'all' || searchValue ? tx('Try clearing the current filters.', '可以清除筛选条件再试。') : tx('New city activity will appear here.', '新的城市动态会显示在这里。')}</span>
                                    {selectedResident !== 'all' || category !== 'all' || searchValue ? (
                                        <button type="button" onClick={() => { setSelectedResident('all'); setCategory('all'); clearSearch(); }}>
                                            {tx('Clear filters', '清除筛选')}
                                        </button>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    {sortedTags.map((tag) => (
                                        <div key={tag}>
                                            <div className="date-divider">
                                                <span><CalendarDays />{formatDateLabel(tag, todayTag, isEn)}</span>
                                                <small>{groupedRows[tag].length} {tx('records', '条记录')}</small>
                                            </div>
                                            {groupedRows[tag].map((row) => (
                                                <LogRow
                                                    key={row.id}
                                                    row={row}
                                                    expanded={expandedRow === row.id}
                                                    setExpanded={setExpandedRow}
                                                    apiUrl={apiUrl}
                                                    tx={tx}
                                                    isEn={isEn}
                                                    expandedHiddenLogs={expandedHiddenLogs}
                                                    setExpandedHiddenLogs={setExpandedHiddenLogs}
                                                    retryQuestReview={retryQuestReview}
                                                    rerollCityLog={rerollCityLog}
                                                    retryingQuestReviewId={retryingQuestReviewId}
                                                    rerollingLogId={rerollingLogId}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    {canLoadMore && (
                                        <div className="load-more-row">
                                            <button type="button" onClick={onLoadMore}>
                                                <ChevronDown />
                                                <span>{tx('Load more', '查看更多')}</span>
                                                <small>{Math.min(ROW_LIMIT_STEP, Math.max(0, totalRows - rows.length))} {tx('more', '条')}</small>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    <CityBrief
                        currentWeather={currentWeather}
                        weatherVisual={weatherVisual}
                        visibleAnnouncements={visibleAnnouncements}
                        events={events}
                        selectedResident={selectedResident}
                        residents={residents}
                        apiUrl={apiUrl}
                        tx={tx}
                        isEn={isEn}
                        onRefresh={onRefresh}
                    />
                </main>
            </div>
        </div>
    );
}

function SettingsPage({ apiUrl, onRefresh, onOpenLogs }) {
    return (
        <div className="settings-page settings-page--management">
            <CityManager apiUrl={apiUrl} onRefreshLogs={onRefresh} onOpenLogs={onOpenLogs} />
        </div>
    );
}

export default function CityLog({ apiUrl }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const tx = useCallback((en, zh) => (isEn ? en : zh), [isEn]);
    const [page, setPage] = useState('logs');
    const [selectedResident, setSelectedResident] = useState('all');
    const [category, setCategory] = useState('all');
    const [logs, setLogs] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [events, setEvents] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [cityConfig, setCityConfig] = useState({});
    const [globalSearch, setGlobalSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [visibleRowLimit, setVisibleRowLimit] = useState(INITIAL_VISIBLE_ROW_LIMIT);
    const [retryingQuestReviewId, setRetryingQuestReviewId] = useState(null);
    const [rerollingLogId, setRerollingLogId] = useState(null);
    const [togglingCityEnabled, setTogglingCityEnabled] = useState(false);
    const refreshTimerRef = useRef(null);
    const token = localStorage.getItem('cp_token') || '';
    const announcementActionTypes = useMemo(() => new Set(['ANNOUNCE', 'MAYOR', 'EVENT']), []);

    const isAnnouncementLog = useCallback((log) => {
        const actionType = String(log.action_type || '').toUpperCase();
        if (announcementActionTypes.has(actionType)) return true;
        return actionType === 'QUEST' && String(log.character_id || '').toLowerCase() === 'system';
    }, [announcementActionTypes]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [logsRes, announcementsRes, eventsRes, charsRes, configRes] = await Promise.all([
                fetch(`${apiUrl}/city/logs?limit=300`, { headers }),
                fetch(`${apiUrl}/city/announcements?limit=50`, { headers }),
                fetch(`${apiUrl}/city/events`, { headers }),
                fetch(`${apiUrl}/city/characters`, { headers }),
                fetch(`${apiUrl}/city/config`, { headers }),
            ]);
            const [logsData, announcementsData, eventsData, charsData, configData] = await Promise.all([
                logsRes.json(),
                announcementsRes.json(),
                eventsRes.json(),
                charsRes.json(),
                configRes.json(),
            ]);
            if (logsData.success) setLogs(logsData.logs || []);
            if (announcementsData.success) setAnnouncements(announcementsData.announcements || []);
            if (eventsData.success) setEvents(eventsData.events || []);
            if (charsData.success) setCharacters(charsData.characters || []);
            if (configData.success) setCityConfig(configData.config || {});
        } catch (e) {
            console.error('CityLog error:', e);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, token]);

    const cityEnabled = isEnabledConfigValue(cityConfig.dlc_enabled);
    const cityStatusKnown = Object.prototype.hasOwnProperty.call(cityConfig, 'dlc_enabled');

    const toggleCityEnabled = useCallback(async () => {
        if (togglingCityEnabled) return;
        const nextValue = cityEnabled ? '0' : '1';
        setTogglingCityEnabled(true);
        try {
            const headers = {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
            const response = await fetch(`${apiUrl}/city/config`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ key: 'dlc_enabled', value: nextValue }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || tx('Failed to update commercial street status', '商业街状态更新失败'));
            }
            setCityConfig((current) => data.config || { ...current, dlc_enabled: nextValue });
            await fetchData();
            window.dispatchEvent(new Event('city_update'));
        } catch (error) {
            window.alert(error.message || tx('Failed to update commercial street status', '商业街状态更新失败'));
        } finally {
            setTogglingCityEnabled(false);
        }
    }, [apiUrl, cityEnabled, fetchData, token, togglingCityEnabled, tx]);

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
        CITY_LIVE_EVENTS.forEach((eventName) => window.addEventListener(eventName, scheduleRefresh));
        const interval = setInterval(fetchData, 5000);
        return () => {
            CITY_LIVE_EVENTS.forEach((eventName) => window.removeEventListener(eventName, scheduleRefresh));
            clearInterval(interval);
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [fetchData]);

    const activityLogs = useMemo(() => logs.filter((log) => !isAnnouncementLog(log)), [logs, isAnnouncementLog]);
    const characterById = useMemo(() => new Map(characters.map((character) => [String(character.id), character])), [characters]);

    const recentCountByCharacter = useMemo(() => {
        const todayTag = formatDateTag(Date.now());
        return activityLogs.reduce((acc, log) => {
            if (formatDateTag(log.timestamp) !== todayTag) return acc;
            const key = String(log.character_id || '');
            acc.set(key, (acc.get(key) || 0) + 1);
            return acc;
        }, new Map());
    }, [activityLogs]);

    const residents = useMemo(() => characters.map((character, index) => {
        const emotion = deriveEmotion(character);
        const physical = derivePhysicalState(character);
        const inventory = Array.isArray(character.inventory) ? character.inventory : [];
        return {
            id: String(character.id),
            name: character.name || tx('Unnamed', '未命名'),
            place: getLocalizedLocationName(character.location, isEn),
            energy: clamp(Math.round(asNumber(character.energy, 100)), 0, 100),
            wallet: asNumber(character.wallet, 0),
            mood: getEmotionLabel(emotion, isEn) || tx('Calm', '平静'),
            physical: getPhysicalLabel(physical, isEn) || tx('Stable', '稳定'),
            inventory,
            unread: Math.min(9, recentCountByCharacter.get(String(character.id)) || 0),
            avatar: character.avatar,
            avatarFrame: character.avatar_frame,
            tone: TONES[index % TONES.length],
            raw: character,
        };
    }), [characters, isEn, recentCountByCharacter, tx]);

    useEffect(() => {
        if (selectedResident !== 'all' && !residents.some((resident) => resident.id === selectedResident)) {
            setSelectedResident('all');
        }
    }, [residents, selectedResident]);

    const currentWeather = getCurrentWeather(events);
    const weatherVisual = currentWeather ? getWeatherVisual(currentWeather, isEn) : null;
    const visibleAnnouncements = useMemo(() => announcements.filter((item, index) => {
        if (isWeatherAnnouncement(item)) {
            return announcements.findIndex((candidate) => isWeatherAnnouncement(candidate)) === index;
        }
        const identity = normalizeAnnouncementIdentity(item);
        return announcements.findIndex((candidate) => normalizeAnnouncementIdentity(candidate) === identity) === index;
    }), [announcements]);

    const allRows = useMemo(() => {
        const residentFallback = {
            id: 'system',
            name: tx('System', '系统'),
            place: tx('Commercial Street', '商业街'),
            energy: 100,
            wallet: 0,
            mood: tx('Stable', '稳定'),
            physical: tx('Stable', '稳定'),
            inventory: [],
            unread: 0,
            tone: 'blue',
            raw: null,
        };

        const activityRows = activityLogs.map((log) => {
            const character = characterById.get(String(log.character_id));
            const resident = residents.find((item) => item.id === String(log.character_id)) || {
                ...residentFallback,
                id: String(log.character_id || 'system'),
                name: log.char_name || character?.name || residentFallback.name,
                avatar: log.char_avatar || character?.avatar,
                avatarFrame: log.char_avatar_frame || character?.avatar_frame,
                raw: character || null,
            };
            const questReview = parseQuestReview(log.quest_review);
            const isCollapsedOutput = String(log.content || '').trim().startsWith('【商业街输出折叠】');
            const isTruncated = Boolean(log.is_truncated) || isCollapsedOutput;
            const hackerIntelView = splitHackerIntelContent(log.content);
            const content = hackerIntelView.hasIntel ? hackerIntelView.visible : String(log.content || '').trim();
            const categoryId = getCategoryForLog(log);
            const failed = categoryId === 'exception';
            const timestamp = log.timestamp || Date.now();
            return {
                id: `log-${log.id}`,
                numericId: log.id,
                sourceType: 'log',
                sourceLabel: String(log.action_type || '').toUpperCase() || tx('City runtime', '城市运行时'),
                raw: log,
                timestamp,
                timestampValue: new Date(timestamp).getTime() || Date.now(),
                time: formatTime(timestamp, isEn),
                dateTag: formatDateTag(timestamp),
                residentId: String(log.character_id || 'system'),
                resident,
                residentName: log.char_name || resident.name,
                categoryId,
                categoryLabel: getCategoryLabel(categoryId, tx),
                action: getLogActionTitle(log, content, tx),
                content,
                place: getLocalizedLocationName(log.location || character?.location, isEn),
                money: asNumber(log.delta_money, 0),
                energy: asNumber(log.delta_energy, 0),
                calories: asNumber(log.delta_calories, 0),
                failed,
                isTruncated,
                hasHiddenHackerIntel: hackerIntelView.hasIntel,
                hiddenContent: log.truncated_original_content || log.content,
                technicalReason: questReview?.error_message || '',
                questReview,
            };
        });

        const announcementRows = visibleAnnouncements.map((item) => {
            const meta = getAnnouncementMeta(item, isEn);
            const paragraphs = splitAnnouncementParagraphs(item);
            const timestamp = item.timestamp || item.created_at || Date.now();
            return {
                id: `announcement-${item.id}`,
                numericId: `announcement-${item.id}`,
                sourceType: 'announcement',
                sourceLabel: meta.label,
                raw: item,
                timestamp,
                timestampValue: new Date(timestamp).getTime() || Date.now(),
                time: formatTime(timestamp, isEn),
                dateTag: formatDateTag(timestamp),
                residentId: 'system',
                resident: residentFallback,
                residentName: meta.label,
                categoryId: 'notice',
                categoryLabel: getCategoryLabel('notice', tx),
                action: item.title || paragraphs[0] || meta.label,
                content: paragraphs.join('\n') || cleanAnnouncementContent(item),
                place: getLocalizedLocationName(item.location, isEn),
                money: 0,
                energy: 0,
                calories: 0,
                failed: false,
                isTruncated: false,
                hasHiddenHackerIntel: false,
                hiddenContent: '',
                technicalReason: '',
                questReview: null,
            };
        });

        return [...activityRows, ...announcementRows].sort((a, b) => b.timestampValue - a.timestampValue);
    }, [activityLogs, characterById, residents, visibleAnnouncements, isEn, tx]);

    const searchNeedle = useMemo(() => normalizeSearchText(globalSearch), [globalSearch]);
    const searchedRows = useMemo(() => {
        if (!searchNeedle) return allRows;
        return allRows.filter((row) => [
            row.residentName,
            row.sourceLabel,
            row.categoryLabel,
            row.action,
            row.content,
            row.place,
            row.raw?.location,
            row.raw?.item_id,
            row.raw?.action_type,
        ].some((value) => normalizeSearchText(value).includes(searchNeedle)));
    }, [allRows, searchNeedle]);

    const filteredRows = useMemo(() => searchedRows.filter((row) => {
        if (selectedResident !== 'all' && row.residentId !== selectedResident) return false;
        if (category !== 'all' && row.categoryId !== category) return false;
        return true;
    }), [category, searchedRows, selectedResident]);

    useEffect(() => {
        setVisibleRowLimit(INITIAL_VISIBLE_ROW_LIMIT);
    }, [category, selectedResident, searchNeedle]);

    const visibleRows = useMemo(() => filteredRows.slice(0, visibleRowLimit), [filteredRows, visibleRowLimit]);

    const categories = useMemo(() => {
        const count = (id) => id === 'all' ? searchedRows.length : searchedRows.filter((row) => row.categoryId === id).length;
        return [
            { id: 'all', label: tx('All', '全部'), icon: List, count: count('all') },
            { id: 'action', label: tx('Action', '行动'), icon: Activity, count: count('action') },
            { id: 'trade', label: tx('Trade', '交易'), icon: Coins, count: count('trade') },
            { id: 'social', label: tx('Social', '社交'), icon: Users, count: count('social') },
            { id: 'notice', label: tx('Notice', '公告'), icon: Megaphone, count: count('notice') },
            { id: 'exception', label: tx('Exception', '异常'), icon: AlertCircle, count: count('exception') },
        ];
    }, [searchedRows, tx]);

    return (
        <div className="city-log-panel">
            <AppShell
                page={page}
                setPage={setPage}
                currentWeather={currentWeather}
                weatherVisual={weatherVisual}
                onRefresh={fetchData}
                loading={loading}
                tx={tx}
                isEn={isEn}
                residentCount={residents.length}
                searchValue={globalSearch}
                onSearchChange={setGlobalSearch}
                cityEnabled={cityEnabled}
                cityStatusKnown={cityStatusKnown}
                togglingCityEnabled={togglingCityEnabled}
                onToggleCityEnabled={toggleCityEnabled}
            >
                {page === 'settings' ? (
                    <SettingsPage
                        apiUrl={apiUrl}
                        onRefresh={fetchData}
                        onOpenLogs={(query = '') => {
                            setGlobalSearch(query);
                            setPage('logs');
                        }}
                    />
                ) : loading && allRows.length === 0 ? (
                    <div className="city-log-loading">{tx('Loading...', '加载中...')}</div>
                ) : (
                    <LogPage
                        rows={visibleRows}
                        totalRows={filteredRows.length}
                        canLoadMore={visibleRows.length < filteredRows.length}
                        onLoadMore={() => setVisibleRowLimit((current) => current + ROW_LIMIT_STEP)}
                        categories={categories}
                        category={category}
                        setCategory={setCategory}
                        selectedResident={selectedResident}
                        setSelectedResident={setSelectedResident}
                        searchValue={globalSearch}
                        clearSearch={() => setGlobalSearch('')}
                        residents={residents}
                        apiUrl={apiUrl}
                        tx={tx}
                        isEn={isEn}
                        currentWeather={currentWeather}
                        weatherVisual={weatherVisual}
                        visibleAnnouncements={visibleAnnouncements}
                        events={events}
                        onRefresh={fetchData}
                        loading={loading}
                        retryQuestReview={retryQuestReview}
                        rerollCityLog={rerollCityLog}
                        retryingQuestReviewId={retryingQuestReviewId}
                        rerollingLogId={rerollingLogId}
                        activityCount={activityLogs.length}
                    />
                )}
            </AppShell>
        </div>
    );
}
