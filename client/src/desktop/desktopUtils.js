import { CloudFog, CloudLightning, CloudRain, CloudSun, SunMedium, Wind } from 'lucide-react';

export const DESKTOP_APP_ICONS = {
  social: '/assets/ui/desktop/apps/social.png',
  memoryLibrary: '/assets/ui/desktop/apps/memory-library.png',
  mcpLab: '/assets/ui/desktop/apps/mcp-lab.png',
  settings: '/assets/ui/desktop/apps/settings.png',
  housing: '/assets/ui/desktop/apps/housing.png',
  pixelCottage: '/assets/ui/desktop/apps/pixel-tools.png',
  commercialStreet: '/assets/ui/desktop/apps/commercial-street.png',
  cityLog: '/assets/ui/desktop/apps/city-log.png',
  createdFolder: '/assets/ui/desktop/apps/folder-created.png',
  createdFolderFilledBack: '/assets/ui/desktop/apps/folder-created-filled-back.png',
  createdFolderFilledFront: '/assets/ui/desktop/apps/folder-created-filled-front.png',
  createdTextDocument: '/assets/ui/desktop/apps/text-document-created.png',
  recycleBinEmpty: '/assets/ui/desktop/apps/recycle-bin-empty.png',
  recycleBinFull: '/assets/ui/desktop/apps/recycle-bin-full.png',
};
export const TASKBAR_APP_ICONS = {
  social: '/assets/ui/desktop/apps/system/social.png',
  memoryLibrary: '/assets/ui/desktop/apps/system/memory-library.png',
  mcpLab: '/assets/ui/desktop/apps/system/mcp-lab.png',
  settings: '/assets/ui/desktop/apps/system/settings.png',
  housing: '/assets/ui/desktop/apps/system/housing.png',
  pixelCottage: '/assets/ui/desktop/apps/system/pixel-tools.png',
  commercialStreet: '/assets/ui/desktop/apps/system/commercial-street.png',
  cityLog: '/assets/ui/desktop/apps/system/city-log.png',
  browser: '/assets/ui/desktop/apps/system/browser.png',
};
export const TASKBAR_APP_ICON_BY_ID = {
  social: TASKBAR_APP_ICONS.social,
  memory_library: TASKBAR_APP_ICONS.memoryLibrary,
  mcp_lab: TASKBAR_APP_ICONS.mcpLab,
  settings: TASKBAR_APP_ICONS.settings,
  housing_social: TASKBAR_APP_ICONS.housing,
  commercial_street: TASKBAR_APP_ICONS.commercialStreet,
  pixel_cottage: TASKBAR_APP_ICONS.pixelCottage,
  city: TASKBAR_APP_ICONS.cityLog,
};
export const DESKTOP_WIDGET_IMAGES = {
  memoryMap: '/assets/ui/desktop/widgets/news-memory-map.png',
  greenhouseCare: '/assets/ui/desktop/widgets/news-greenhouse-care.png',
  dessertPopUp: '/assets/ui/desktop/widgets/news-dessert-pop-up.png',
  rainObservatory: '/assets/ui/desktop/widgets/news-flat-rain-observatory.png',
  bentoStation: '/assets/ui/desktop/widgets/news-flat-bento-station.png',
  cloudPost: '/assets/ui/desktop/widgets/news-flat-cloud-post.png',
  noticePlaza: '/assets/ui/desktop/widgets/news-flat-notice-plaza.png',
  laundryStation: '/assets/ui/desktop/widgets/news-flat-laundry-station.png',
  storageCart: '/assets/ui/desktop/widgets/news-flat-storage-cart.png',
};
const DESKTOP_WEATHER_BACKGROUND_ASSETS = {
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
const DESKTOP_WEATHER_INTENSITY_LABELS = {
  light: { zh: '轻度', en: 'Light' },
  comfortable: { zh: '舒适', en: 'Comfortable' },
  heavy: { zh: '重度', en: 'Heavy' },
};
const DESKTOP_WEATHER_META = {
  sunny: {
    Icon: SunMedium,
    label: { zh: '晴朗', en: 'Sunny' },
    summary: {
      light: { zh: '暖光很轻，云影慢慢散开。', en: 'Soft sunlight, clouds drifting apart.' },
      comfortable: { zh: '晴空舒展，光线温柔稳定。', en: 'Clear, warm, and easy on the eyes.' },
      heavy: { zh: '日照偏强，午后适合放慢脚步。', en: 'Bright sun, best taken slowly.' },
    },
    temp: { light: 24, comfortable: 27, heavy: 31 },
  },
  cloudy: {
    Icon: CloudSun,
    label: { zh: '微云', en: 'Soft clouds' },
    summary: {
      light: { zh: '薄云掠过，稍后有零散闪光小雨。', en: 'Thin clouds, a few glittery drizzles later.' },
      comfortable: { zh: '微云，稍后有零散闪光小雨。', en: 'Soft clouds, scattered sparkle showers later.' },
      heavy: { zh: '云层偏厚，街区光线会更柔。', en: 'Heavier clouds, softer light across the blocks.' },
    },
    temp: { light: 24, comfortable: 25, heavy: 23 },
  },
  rainy: {
    Icon: CloudRain,
    label: { zh: '小雨', en: 'Rain' },
    summary: {
      light: { zh: '细雨很轻，路面只泛一点亮光。', en: 'Light rain leaves a small shine on the paths.' },
      comfortable: { zh: '雨势平稳，适合把日程调慢一点。', en: 'Steady rain, a good day to slow the schedule.' },
      heavy: { zh: '雨线密集，外出请避开空旷区域。', en: 'Dense rain lines, avoid open areas.' },
    },
    temp: { light: 23, comfortable: 22, heavy: 20 },
  },
  windy: {
    Icon: Wind,
    label: { zh: '有风', en: 'Windy' },
    summary: {
      light: { zh: '微风穿过街角，悬挂物轻轻晃动。', en: 'A light breeze moves through the corners.' },
      comfortable: { zh: '风感清爽，适合短程移动。', en: 'Fresh wind, good for short walks.' },
      heavy: { zh: '阵风偏强，临时招牌需要加固。', en: 'Strong gusts, small signs need securing.' },
    },
    temp: { light: 24, comfortable: 23, heavy: 21 },
  },
  foggy: {
    Icon: CloudFog,
    label: { zh: '薄雾', en: 'Fog' },
    summary: {
      light: { zh: '雾气很薄，远处边缘变软。', en: 'A thin mist softens distant edges.' },
      comfortable: { zh: '雾感柔和，街灯显得更近。', en: 'Gentle fog makes the lights feel closer.' },
      heavy: { zh: '雾层较厚，路线提示会更明显。', en: 'Thick fog, route markers glow brighter.' },
    },
    temp: { light: 22, comfortable: 21, heavy: 20 },
  },
  stormy: {
    Icon: CloudLightning,
    label: { zh: '雷雨', en: 'Storm' },
    summary: {
      light: { zh: '远处有雷光，雨声暂时很轻。', en: 'Distant lightning with light rain for now.' },
      comfortable: { zh: '雷雨云经过，活动会自动转入室内。', en: 'Storm clouds pass by, activities move inside.' },
      heavy: { zh: '雷雨增强，街区进入短时避让状态。', en: 'Heavy storm, blocks enter short shelter mode.' },
    },
    temp: { light: 21, comfortable: 20, heavy: 19 },
  },
};
function parseDesktopWeatherEffect(event) {
  const value = event?.effect_json ?? event?.effect ?? {};
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function normalizeDesktopWeatherPreset(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const text = raw.toLowerCase();
  const compact = text.replace(/[\s_-]+/g, '');
  if (DESKTOP_WEATHER_BACKGROUND_ASSETS[compact]) return compact;
  if (/雷暴|雷雨|闪电|暴风雨|storm|thunder|lightning/.test(text)) return 'stormy';
  if (/晴|晴天|晴朗|艳阳|sunny|sun|clear/.test(text)) return 'sunny';
  if (/多云|阴天|阴云|云|cloud|overcast/.test(text)) return 'cloudy';
  if (/小雨|阵雨|中雨|大雨|暴雨|降雨|雨|rain|drizzle|shower/.test(text)) return 'rainy';
  if (/微风|大风|强风|阵风|风|wind|breeze|gust/.test(text)) return 'windy';
  if (/大雾|薄雾|雾|fog|mist|haze/.test(text)) return 'foggy';
  return '';
}

function normalizeDesktopWeatherIntensity(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const text = raw.toLowerCase();
  const compact = text.replace(/[\s_-]+/g, '');
  if (DESKTOP_WEATHER_INTENSITY_LABELS[compact]) return compact;
  if (/暴|强|重|大|浓|厚|剧烈|heavy|strong|severe|dense|high/.test(text)) return 'heavy';
  if (/轻|小|微|薄|淡|light|mild|soft|low/.test(text)) return 'light';
  if (/舒适|适中|中等|普通|稳定|柔和|comfortable|moderate|normal|medium/.test(text)) return 'comfortable';
  return '';
}

export function getCurrentDesktopWeatherEvent(events) {
  if (!Array.isArray(events)) return null;
  return events.find((event) => String(event?.event_type || event?.type || '').toLowerCase() === 'weather') || null;
}

export function getDesktopWeatherVisual(event, isEn = false) {
  const title = String(event?.title || '').trim();
  const description = String(event?.description || '').trim();
  const text = `${title} ${description}`;
  const effect = parseDesktopWeatherEffect(event);
  const preset = normalizeDesktopWeatherPreset(
    effect.weather_preset ?? effect.weather ?? effect.preset ?? event?.weather_preset ?? text
  ) || 'cloudy';
  const intensity = normalizeDesktopWeatherIntensity(
    effect.weather_intensity ?? effect.intensity ?? effect.severity ?? event?.weather_intensity ?? text
  ) || 'comfortable';
  const meta = DESKTOP_WEATHER_META[preset] || DESKTOP_WEATHER_META.cloudy;
  const background = DESKTOP_WEATHER_BACKGROUND_ASSETS[preset]?.[intensity]
    || DESKTOP_WEATHER_BACKGROUND_ASSETS[preset]?.comfortable
    || DESKTOP_WEATHER_BACKGROUND_ASSETS.cloudy.comfortable;
  const label = title || meta.label[isEn ? 'en' : 'zh'];
  return {
    preset,
    intensity,
    background,
    Icon: meta.Icon || CloudSun,
    label,
    taskbarLabel: meta.label[isEn ? 'en' : 'zh'],
    summary: description || meta.summary[intensity]?.[isEn ? 'en' : 'zh'] || meta.summary.comfortable[isEn ? 'en' : 'zh'],
    temp: meta.temp[intensity] || meta.temp.comfortable || 25,
  };
}
export const DESKTOP_MULTI_WINDOW_APP_TABS = new Set([
  'commercial_street',
  'pixel_cottage',
]);
export const DESKTOP_TASKBAR_HEIGHT = 56;
export const DESKTOP_WINDOW_CHROME_HEIGHT = 92;
export const DESKTOP_WINDOW_CHROME_HEIGHT_COMPACT = 78;
export const DESKTOP_WINDOW_MIN_WIDTH = 640;
export const DESKTOP_WINDOW_MIN_HEIGHT = 420;
export const DESKTOP_TAB_DRAG_THRESHOLD = 4;
export const DESKTOP_TAB_DETACH_OFFSET = 22;
export const DESKTOP_EVENT_NOTIFICATION_LIMIT = 40;
export const DESKTOP_NOTIFICATION_TOAST_LIMIT = 3;
export const DESKTOP_NOTIFICATION_TOAST_TTL_MS = 5200;
const DESKTOP_RAW_APP_SURFACE_TABS = new Set([
  'commercial_street',
  'pixel_cottage',
]);
const DESKTOP_ICON_LAYOUT_STORAGE_KEY = 'chatpulse:desktop-icon-layout:v1';
export const DESKTOP_ICON_SIZE_STORAGE_KEY = 'chatpulse:desktop-icon-size:v1';
export const DESKTOP_ICONS_VISIBLE_STORAGE_KEY = 'chatpulse:desktop-icons-visible:v1';
export const DESKTOP_AUTO_ARRANGE_STORAGE_KEY = 'chatpulse:desktop-auto-arrange:v1';
export const DESKTOP_ALIGN_TO_GRID_STORAGE_KEY = 'chatpulse:desktop-align-to-grid:v1';
const DESKTOP_CREATED_ITEMS_STORAGE_KEY = 'chatpulse:desktop-created-items:v2';
const DESKTOP_RECYCLE_BIN_STORAGE_KEY = 'chatpulse:desktop-recycle-bin:v1';
export const DESKTOP_RECYCLE_BIN_ID = 'desktop-recycle-bin';
const DESKTOP_ICON_DEFAULT_COLUMNS = 4;

export const getResponsiveBrowserChromeHeight = () => (
  typeof window !== 'undefined' && window.innerWidth <= 820
    ? DESKTOP_WINDOW_CHROME_HEIGHT_COMPACT
    : DESKTOP_WINDOW_CHROME_HEIGHT
);

export const getBrowserSnapshotFields = (snapshot) => (
  snapshot?.snapshotHtml
    ? {
        snapshotHtml: snapshot.snapshotHtml,
        snapshotWidth: snapshot.snapshotWidth,
        snapshotHeight: snapshot.snapshotHeight,
        snapshotTab: snapshot.snapshotTab,
        snapshotUpdatedAt: snapshot.snapshotUpdatedAt,
      }
    : { snapshotHtml: null }
);

export function getDesktopNotificationPreview(content, fallback = '') {
  let text = '';
  if (Array.isArray(content)) {
    text = content
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.content || item?.message || item?.title || '';
      })
      .filter(Boolean)
      .join(' / ');
  } else if (content && typeof content === 'object') {
    text = content.content || content.message || content.title || JSON.stringify(content);
  } else {
    text = String(content || '');
  }
  const normalized = text.replace(/\s+/g, ' ').trim() || fallback;
  return normalized.length > 90 ? `${normalized.slice(0, 90)}...` : normalized;
}

export const DESKTOP_WALLPAPER_STORAGE_KEY = 'chatpulse:desktop-wallpaper';
const OCEAN_WALLPAPER_URL = '/assets/ui/desktop/live2d-wallpaper-reference-alt.png?v=ocean-alt-1';
const GLASS_RIBBON_SKY_WALLPAPER_URL = '/assets/ui/desktop/glass-ribbon-sky.png?v=1';
const GLASS_RIBBON_PEARL_WALLPAPER_URL = '/assets/ui/desktop/glass-ribbon-pearl.png?v=1';
export const DESKTOP_WALLPAPER_IMAGE_URLS = {
  'ocean-live2d': OCEAN_WALLPAPER_URL,
  'ocean-static': OCEAN_WALLPAPER_URL,
  'glass-ribbon-sky': GLASS_RIBBON_SKY_WALLPAPER_URL,
  'glass-ribbon-pearl': GLASS_RIBBON_PEARL_WALLPAPER_URL,
};
export const DESKTOP_WALLPAPER_OPTIONS = [
  {
    id: 'ocean-live2d',
    labelZh: '动态海浪',
    labelEn: 'Animated Ocean',
    descriptionZh: '潮汐节奏的全图动态壁纸',
    descriptionEn: 'Full-image tide motion',
  },
  {
    id: 'ocean-static',
    labelZh: '静态海浪',
    labelEn: 'Still Ocean',
    descriptionZh: '保留当前海浪图，不播放动画',
    descriptionEn: 'The ocean image without motion',
  },
  {
    id: 'glass-ribbon-sky',
    labelZh: '玻璃蓝',
    labelEn: 'Glass Blue',
    descriptionZh: '清透粉蓝玻璃丝带',
    descriptionEn: 'Pastel glass ribbon scene',
  },
  {
    id: 'glass-ribbon-pearl',
    labelZh: '珍珠金',
    labelEn: 'Pearl Gold',
    descriptionZh: '暖金珍珠丝带场景',
    descriptionEn: 'Warm pearl ribbon scene',
  },
];

export function normalizeDesktopWallpaper(value) {
  return DESKTOP_WALLPAPER_OPTIONS.some(option => option.id === value)
    ? value
    : DESKTOP_WALLPAPER_OPTIONS[0].id;
}

export function loadDesktopWallpaper() {
  try {
    return normalizeDesktopWallpaper(window.localStorage.getItem(DESKTOP_WALLPAPER_STORAGE_KEY));
  } catch (error) {
    console.warn('Failed to load desktop wallpaper preference:', error);
    return DESKTOP_WALLPAPER_OPTIONS[0].id;
  }
}

export function formatDesktopDateTime(lang) {
  const now = new Date();
  const time = now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('/');
  return { time, date };
}

const DESKTOP_LUNAR_DAY_LABELS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export function isSameDesktopDate(left, right) {
  return Boolean(left && right)
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function getDesktopLunarInfo(date, lang) {
  if (lang === 'en') {
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      day: String(date.getDate()),
      short: String(date.getDate()),
    };
  }

  try {
    const formatted = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      month: 'long',
      day: 'numeric',
    }).format(date);
    const match = formatted.match(/^(.+?)(\d+)(?:日)?$/);
    if (match) {
      const dayIndex = Number(match[2]) - 1;
      const day = DESKTOP_LUNAR_DAY_LABELS[dayIndex] || match[2];
      return {
        month: match[1],
        day,
        short: dayIndex === 0 ? match[1] : day,
      };
    }
    return { month: '', day: formatted, short: formatted };
  } catch (error) {
    return {
      month: '',
      day: String(date.getDate()),
      short: String(date.getDate()),
    };
  }
}

export function formatDesktopPanelDate(date, lang) {
  if (lang === 'en') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function formatDesktopMonthTitle(date, lang) {
  if (lang === 'en') {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function buildDesktopCalendarDays(monthDate, selectedDate, today, lang) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayBasedOffset = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - mondayBasedOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const lunar = getDesktopLunarInfo(date, lang);
    return {
      key: [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ].join('-'),
      date,
      day: date.getDate(),
      lunar: lunar.short,
      isCurrentMonth: date.getMonth() === month,
      isToday: isSameDesktopDate(date, today),
      isSelected: isSameDesktopDate(date, selectedDate),
    };
  });
}

export function formatPomodoroTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function loadDesktopStoredChoice(key, allowedValues, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return allowedValues.includes(value) ? value : fallback;
  } catch (error) {
    console.warn(`Failed to load desktop preference ${key}:`, error);
    return fallback;
  }
}

export function loadDesktopStoredBoolean(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (value === '1') return true;
    if (value === '0') return false;
    return fallback;
  } catch (error) {
    console.warn(`Failed to load desktop preference ${key}:`, error);
    return fallback;
  }
}

export function saveDesktopStoredPreference(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn(`Failed to save desktop preference ${key}:`, error);
  }
}

function normalizeDesktopIconCoordinate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Number(numeric.toFixed(3)));
}

export function normalizeDesktopIconPosition(position) {
  if (!position || typeof position !== 'object') return null;
  const col = normalizeDesktopIconCoordinate(position.col);
  const row = normalizeDesktopIconCoordinate(position.row);
  if (col === null || row === null) return null;
  return {
    col,
    row,
  };
}

export function getDefaultDesktopIconPosition(index) {
  return {
    col: index % DESKTOP_ICON_DEFAULT_COLUMNS,
    row: Math.floor(index / DESKTOP_ICON_DEFAULT_COLUMNS),
  };
}

export function findOpenDesktopIconPosition(used, startIndex = 0) {
  for (let offset = 0; offset < 120; offset += 1) {
    const position = getDefaultDesktopIconPosition(startIndex + offset);
    const key = `${position.col}:${position.row}`;
    if (!used.has(key)) return position;
  }
  return getDefaultDesktopIconPosition(startIndex);
}

export function loadDesktopIconLayout() {
  try {
    const raw = window.localStorage.getItem(DESKTOP_ICON_LAYOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed).reduce((layout, [id, position]) => {
      const normalized = normalizeDesktopIconPosition(position);
      if (normalized) layout[id] = normalized;
      return layout;
    }, {});
  } catch (error) {
    console.warn('Failed to load desktop icon layout:', error);
    return {};
  }
}

export function saveDesktopIconLayout(layout) {
  try {
    window.localStorage.setItem(DESKTOP_ICON_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch (error) {
    console.warn('Failed to save desktop icon layout:', error);
  }
}

export function createDesktopItemId(kind) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `created-${kind}-${Date.now().toString(36)}-${suffix}`;
}

export function normalizeCreatedDesktopItem(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  const kind = item.kind === 'folder' || item.kind === 'text'
    ? item.kind
    : (item.variant === 'folder' ? 'folder' : null);
  if (!kind) return null;
  const now = Date.now();
  const id = String(item.id || createDesktopItemId(kind));
  const fallbackLabel = kind === 'folder' ? '新建文件夹' : '新建文本文档';
  const rawLabel = typeof item.label === 'string' ? item.label.trim() : '';
  const folderAppIds = Array.isArray(item.folderAppIds)
    ? item.folderAppIds.map(value => String(value)).filter(Boolean)
    : [];
  const uniqueFolderAppIds = [...new Set(folderAppIds)];

  return {
    id,
    kind,
    label: rawLabel || (index > 0 ? `${fallbackLabel} ${index + 1}` : fallbackLabel),
    createdAt: Number(item.createdAt) || now,
    updatedAt: Number(item.updatedAt) || Number(item.createdAt) || now,
    folderAppIds: kind === 'folder' ? uniqueFolderAppIds : [],
    content: kind === 'text' ? String(item.content || '') : '',
  };
}

export function loadCreatedDesktopItems() {
  try {
    const raw = window.localStorage.getItem(DESKTOP_CREATED_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeCreatedDesktopItem(item, index))
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to load created desktop items:', error);
    return [];
  }
}

export function saveCreatedDesktopItems(items) {
  try {
    const serializableItems = (Array.isArray(items) ? items : [])
      .map((item, index) => normalizeCreatedDesktopItem(item, index))
      .filter(Boolean);
    window.localStorage.setItem(DESKTOP_CREATED_ITEMS_STORAGE_KEY, JSON.stringify(serializableItems));
  } catch (error) {
    console.warn('Failed to save created desktop items:', error);
  }
}

export function normalizeRecycleBinItem(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const item = normalizeCreatedDesktopItem(entry.item || entry, index);
  if (!item) return null;
  const deletedAt = Number(entry.deletedAt) || Date.now();
  const originalPosition = normalizeDesktopIconPosition(entry.originalPosition);
  return {
    id: String(entry.id || `recycle-${item.id}-${deletedAt}`),
    item,
    deletedAt,
    originalLocation: String(entry.originalLocation || 'Desktop'),
    originalPosition,
  };
}

export function loadRecycleBinItems() {
  try {
    const raw = window.localStorage.getItem(DESKTOP_RECYCLE_BIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, index) => normalizeRecycleBinItem(entry, index))
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to load recycle bin items:', error);
    return [];
  }
}

export function saveRecycleBinItems(items) {
  try {
    const serializableItems = (Array.isArray(items) ? items : [])
      .map((entry, index) => normalizeRecycleBinItem(entry, index))
      .filter(Boolean);
    window.localStorage.setItem(DESKTOP_RECYCLE_BIN_STORAGE_KEY, JSON.stringify(serializableItems));
  } catch (error) {
    console.warn('Failed to save recycle bin items:', error);
  }
}

export function getDesktopGridMetrics(element) {
  if (!element) {
    return {
      originX: 54,
      originY: 38,
      cellX: 96,
      cellY: 102,
      slotWidth: 84,
      slotHeight: 96,
      maxCol: 0,
      maxRow: 0,
    };
  }
  const styles = window.getComputedStyle(element);
  const readPx = (name, fallback) => {
    const value = parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  const originX = readPx('--desktop-grid-origin-x', 54);
  const originY = readPx('--desktop-grid-origin-y', 38);
  const cellX = readPx('--desktop-grid-cell-x', 96);
  const cellY = readPx('--desktop-grid-cell-y', 102);
  const slotWidth = readPx('--desktop-icon-slot-width', 84);
  const slotHeight = readPx('--desktop-icon-slot-height', 96);
  const maxCol = Math.max(0, Math.floor((element.clientWidth - originX - slotWidth) / cellX));
  const maxRow = Math.max(0, Math.floor((element.clientHeight - originY - slotHeight) / cellY));
  return { originX, originY, cellX, cellY, slotWidth, slotHeight, maxCol, maxRow };
}

export function clampDesktopIconPosition(position, metrics, alignToGrid = true) {
  const clampCoordinate = (value, max) => {
    const clamped = Math.min(Math.max(0, Number(value) || 0), max);
    return alignToGrid ? Math.round(clamped) : Number(clamped.toFixed(3));
  };
  return {
    col: clampCoordinate(position.col, metrics.maxCol),
    row: clampCoordinate(position.row, metrics.maxRow),
  };
}

export function getDesktopAppSurfaceClass(tab) {
  const normalizedTab = String(tab || 'app').replace(/[^a-z0-9_-]/gi, '_');
  const surfaceMode = DESKTOP_RAW_APP_SURFACE_TABS.has(tab) ? 'raw' : 'polished';
  return `plugin-content-shell desktop-app-surface desktop-app-surface--${surfaceMode} desktop-app-surface--${normalizedTab}`;
}
