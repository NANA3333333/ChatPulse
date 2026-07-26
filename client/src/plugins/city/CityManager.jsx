import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Activity,
    AlertTriangle,
    Archive,
    ArrowRight,
    BookOpen,
    Bot,
    CalendarDays,
    CheckCircle,
    ChevronRight,
    Coins,
    Database,
    Edit3,
    Gift,
    Heart,
    Info,
    LayoutDashboard,
    LoaderCircle,
    Package,
    Pin,
    Play,
    Plus,
    Power,
    RotateCcw,
    Save,
    Search,
    ShieldAlert,
    ShoppingBag,
    SlidersHorizontal,
    Store,
    Trash2,
    Users,
    X
} from 'lucide-react';
import AvatarWithFrame from '../../components/AvatarWithFrame';
import { defaultAvatarUrl, resolveAvatarUrl } from '../../utils/avatar';
import { useLanguage } from '../../LanguageContext';

const FALLBACK_AVATAR = defaultAvatarUrl('User');
const avatarSrc = (url, apiUrl) => resolveAvatarUrl(url, apiUrl) || FALLBACK_AVATAR;

const EMPTY_DISTRICT = {
    id: '', name: '', emoji: '🏬', type: 'generic', description: '',
    action_label: '前往', cal_cost: 0, cal_reward: 0, money_cost: 0,
    money_reward: 0, duration_ticks: 1, capacity: 0, is_enabled: 1, sort_order: 0
};

const EMPTY_ITEM = {
    id: '', name: '', emoji: '🍱', category: 'food', description: '',
    buy_price: 10, sell_price: 0, cal_restore: 0, effect: '', sold_at: '', is_available: 1, sort_order: 0, stock: -1
};

const DISTRICT_TYPE_OPTIONS = [
    ['work', { zh: '工作', en: 'Work' }],
    ['food', { zh: '餐饮', en: 'Food' }],
    ['rest', { zh: '休息', en: 'Rest' }],
    ['leisure', { zh: '娱乐', en: 'Leisure' }],
    ['shopping', { zh: '购物', en: 'Shopping' }],
    ['education', { zh: '教育', en: 'Education' }],
    ['medical', { zh: '医疗', en: 'Medical' }],
    ['gambling', { zh: '赌博', en: 'Gambling' }],
    ['wander', { zh: '闲逛', en: 'Wander' }],
    ['generic', { zh: '通用', en: 'Generic' }]
];

const itemCategoryLabel = (category, isEn) => {
    const labels = {
        food: { zh: '食物', en: 'Food' },
        gift: { zh: '礼物', en: 'Gift' },
        medicine: { zh: '药品', en: 'Medicine' },
        tool: { zh: '道具', en: 'Tool' },
        misc: { zh: '杂项', en: 'Misc' }
    };
    return labels[category]?.[isEn ? 'en' : 'zh'] || (isEn ? 'Misc' : '杂项');
};

const MANAGER_NAV_ITEMS = [
    { id: 'overview', zh: '总览', en: 'Overview', icon: LayoutDashboard },
    { id: 'districts', zh: '分区管理', en: 'Districts', icon: Store },
    { id: 'items', zh: '商品与物品', en: 'Items', icon: ShoppingBag },
    { id: 'config', zh: '城市设置', en: 'City Settings', icon: SlidersHorizontal, expandable: true },
    { id: 'residents', zh: '角色补给', en: 'Resident Supply', icon: Users },
    { id: 'events', zh: '事件与任务', en: 'Events & Quests', icon: CalendarDays },
    { id: 'mayor', zh: '市长 AI', en: 'Mayor AI', icon: Bot }
];

const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const formatMoney = (value) => num(value).toFixed(num(value) % 1 === 0 ? 0 : 2);
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const compactText = (value, max = 42) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
};

const districtAliasSet = (district) => new Set([
    normalizeKey(district?.id),
    normalizeKey(district?.name)
].filter(Boolean));

const matchesDistrictRef = (district, value) => {
    const raw = normalizeKey(value);
    if (!raw) return false;
    const aliases = districtAliasSet(district);
    if (aliases.has(raw)) return true;
    return Array.from(aliases).some((alias) => alias && raw.split(/[,\s|/]+/).includes(alias));
};

const formatClock = (timestamp, isEn) => {
    const date = new Date(Number(timestamp || 0) || Date.now());
    return date.toLocaleTimeString(isEn ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const dayKey = (timestamp) => {
    const date = new Date(Number(timestamp || 0) || Date.now());
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const lastSevenDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today.getTime() - (6 - index) * DAY_MS);
        const key = dayKey(date.getTime());
        return { key, label: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` };
    });
};

const rewardKind = (district) => (num(district?.money_reward) ? 'money' : num(district?.cal_reward) ? 'calories' : 'none');

const flatTrend = (value, length = 7) => Array.from({ length }, () => num(value));

const getEventDistrictRef = (event) => {
    const explicit = event?.target_district || '';
    if (explicit) return explicit;
    try {
        const effect = typeof event?.effect_json === 'string' ? JSON.parse(event.effect_json) : (event?.effect || {});
        return effect?.district || effect?.target_district || '';
    } catch {
        return '';
    }
};

const getTimedProgress = (row) => {
    const created = Number(row?.created_at || 0);
    const expires = Number(row?.expires_at || 0);
    if (!created || !expires || expires <= created) return 0;
    return clamp(Math.round(((Date.now() - created) / (expires - created)) * 100), 0, 100);
};

const getQuestProgress = (quest) => {
    if (!quest) return { current: 0, target: 1, percent: 0, label: '0/1' };
    const target = Math.max(1, num(quest.completion_target, 1));
    const current = (quest.claims || []).reduce((max, claim) => Math.max(max, num(claim.progress_count)), 0);
    const completed = Number(quest.is_completed) === 1 || String(quest.status || '') === 'completed';
    const percent = completed ? 100 : clamp(Math.round((current / target) * 100), 0, 100);
    return { current, target, percent, label: `${current}/${target}` };
};

const formatRemaining = (row, tx) => {
    const expires = Number(row?.expires_at || 0);
    if (!expires) return tx('No deadline', '无截止时间');
    const remainingMs = expires - Date.now();
    if (remainingMs <= 0) return tx('Ending soon', '即将结束');
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    if (hours <= 0) return tx(`${minutes}m remaining`, `剩余 ${minutes} 分`);
    return tx(`${hours}h ${minutes}m remaining`, `剩余 ${hours} 小时 ${minutes} 分`);
};

const formatSigned = (value, suffix = '') => {
    const amount = num(value);
    const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
    return `${prefix}${formatMoney(Math.abs(amount))}${suffix}`;
};

function ToolbarButton({ children, primary = false, danger = false, onClick, disabled = false, type = 'button' }) {
    const className = `button ${primary ? 'primary' : ''} ${danger ? 'danger' : ''}`.trim();
    return <button className={className} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

function ToggleSwitch({ checked, onChange, label }) {
    return (
        <button
            type="button"
            className={`toggle ${checked ? 'is-on' : ''}`}
            aria-label={label}
            aria-pressed={checked}
            onClick={() => onChange(!checked)}
        >
            <span />
        </button>
    );
}

function MiniLine({ values = [], labels = null, withLabels = false, height = 54 }) {
    const points = values.length ? values.map((value) => num(value)) : [0];
    const max = Math.max(1, ...points);
    const min = Math.min(...points);
    const spread = Math.max(1, max - min);
    const coordinates = points.map((value, index) => {
        const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
        const y = 35 - ((value - min) / spread) * 27;
        return `${x},${y}`;
    }).join(' ');
    const resolvedLabels = labels?.length ? labels : lastSevenDays().map((day) => day.label);
    return (
        <div className={`mini-line ${withLabels ? 'with-labels' : ''}`} style={{ minHeight: height }} aria-hidden="true">
            <svg viewBox="0 0 100 42" preserveAspectRatio="none">
                <polyline points={coordinates} />
                {points.map((value, index) => {
                    const [x, y] = coordinates.split(' ')[index].split(',');
                    return <circle key={`${value}-${index}`} cx={x} cy={y} r="1.5" />;
                })}
            </svg>
            {withLabels && <div>{resolvedLabels.slice(-points.length).map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>}
        </div>
    );
}

function OccupancyRing({ value, total, label }) {
    const safeTotal = Math.max(1, num(total, 1));
    const safeValue = Math.max(0, Math.min(safeTotal, num(value)));
    const percent = safeValue / safeTotal;
    const circumference = 2 * Math.PI * 34;
    return (
        <div className="occupancy-ring" style={{ '--ring-progress': `${circumference * (1 - percent)}`, '--ring-size': `${circumference}` }}>
            <svg viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="34" />
                <circle cx="40" cy="40" r="34" />
            </svg>
            <strong>{label || `${safeValue}/${safeTotal}`}</strong>
        </div>
    );
}

function ChangeScale({ current, next, min, max, positive = false }) {
    const position = Math.max(0, Math.min(100, ((num(next) - min) / Math.max(1, max - min)) * 100));
    const isGood = positive ? num(next) >= num(current) : num(next) <= num(current);
    return (
        <div className="change-scale">
            <div className="change-copy">
                <span>变更影响</span>
                <strong className={isGood ? 'positive' : 'negative'}>{current} → {next}</strong>
            </div>
            <div className="scale-track"><span style={{ left: `${position}%` }} /></div>
            <div className="scale-labels"><span>{min}</span><span>{Math.round((min + max) / 2)}</span><span>{max}</span></div>
        </div>
    );
}

function ManagerNav({ active, setActive, tx, isEn }) {
    const [cityOpen, setCityOpen] = useState(active === 'config');
    return (
        <aside className="management-nav">
            <h2>{tx('Management', '管理')}</h2>
            <div className="management-links">
                {MANAGER_NAV_ITEMS.map(({ id, zh, en, icon: Icon, expandable }) => (
                    <div key={id}>
                        <button
                            type="button"
                            className={active === id ? 'active' : ''}
                            onClick={() => {
                                setActive(id);
                                if (expandable) setCityOpen(!cityOpen || active !== id);
                            }}
                        >
                            {React.createElement(Icon)}
                            <span>{isEn ? en : zh}</span>
                            {expandable && <ChevronRight className={cityOpen ? 'rotate' : ''} />}
                        </button>
                        {id === 'config' && cityOpen && (
                            <div className="nested-nav">
                                <button type="button" onClick={() => setActive('config')}>{tx('Economy & memory', '经济与记忆')}</button>
                                <button type="button" onClick={() => setActive('config')}>{tx('Log rules', '日志规则')}</button>
                                <button type="button" onClick={() => setActive('config')}>{tx('System status', '系统状态')}</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button className={`danger-nav ${active === 'danger' ? 'active' : ''}`} type="button" onClick={() => setActive('danger')}>
                <ShieldAlert />
                <span>{tx('Danger Zone', '危险操作')}</span>
            </button>
        </aside>
    );
}

export default function CityManager({ apiUrl, onRefreshLogs, onOpenLogs }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const tx = useCallback((en, zh) => (isEn ? en : zh), [isEn]);
    const [districts, setDistricts] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [config, setConfig] = useState({});
    const [economy, setEconomy] = useState(null);
    const [items, setItems] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [actionNotice, setActionNotice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mayorRunning, setMayorRunning] = useState(false);
    const [mayorResult, setMayorResult] = useState(null);
    const [mayorPromptLocal, setMayorPromptLocal] = useState('');
    const [mayorModelMode, setMayorModelMode] = useState('auto'); // 'auto' | charId | 'custom'
    const [customEndpoint, setCustomEndpoint] = useState('');
    const [customKey, setCustomKey] = useState('');
    const [customModel, setCustomModel] = useState('');
    const [events, setEvents] = useState([]);
    const [quests, setQuests] = useState([]);
    const [activeManagerSection, setActiveManagerSection] = useState('districts');
    const [selectedDistrictId, setSelectedDistrictId] = useState('');
    const [selectedDistrictIds, setSelectedDistrictIds] = useState([]);
    const [districtSortMode, setDistrictSortMode] = useState('custom');
    const [districtTypeFilter, setDistrictTypeFilter] = useState('all');
    const [districtEditorTab, setDistrictEditorTab] = useState('basic');
    const [itemSearch, setItemSearch] = useState('');
    const [itemDistrictFilter, setItemDistrictFilter] = useState('all');
    const [itemStatusFilter, setItemStatusFilter] = useState('all');
    const [districtDraft, setDistrictDraft] = useState(null);
    const [selectedCharacterId, setSelectedCharacterId] = useState('');
    const [residentSearch, setResidentSearch] = useState('');
    const [supplyMode, setSupplyMode] = useState('gold');
    const [supplyAmount, setSupplyAmount] = useState(100);
    const [supplyItemId, setSupplyItemId] = useState('');
    const [dangerConfirm, setDangerConfirm] = useState(null);
    const [eventView, setEventView] = useState('events');
    const [inspectorPinned, setInspectorPinned] = useState(false);
    const [savingDistrict, setSavingDistrict] = useState(false);
    const [savingSupply, setSavingSupply] = useState(false);
    const refreshTimerRef = React.useRef(null);
    const actionNoticeTimerRef = React.useRef(null);
    const token = localStorage.getItem('cp_token') || '';
    const headers = useMemo(() => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
    const getEmptyDistrict = useCallback(() => ({
        ...EMPTY_DISTRICT,
        action_label: isEn ? 'Go' : EMPTY_DISTRICT.action_label
    }), [isEn]);
    const getEmptyItem = useCallback(() => ({ ...EMPTY_ITEM }), []);

    const showActionNotice = useCallback((kind, message) => {
        setActionNotice({ kind, message });
        if (actionNoticeTimerRef.current) {
            clearTimeout(actionNoticeTimerRef.current);
        }
        actionNoticeTimerRef.current = setTimeout(() => {
            actionNoticeTimerRef.current = null;
            setActionNotice(null);
        }, 3500);
    }, []);

    const fetchAll = useCallback(async () => {
        try {
            const [dRes, cRes, cfgRes, ecoRes, itRes, evRes, qRes, logsRes] = await Promise.all([
                fetch(`${apiUrl}/city/districts`, { headers }),
                fetch(`${apiUrl}/city/characters`, { headers }),
                fetch(`${apiUrl}/city/config`, { headers }),
                fetch(`${apiUrl}/city/economy`, { headers }),
                fetch(`${apiUrl}/city/items`, { headers }),
                fetch(`${apiUrl}/city/events`, { headers }),
                fetch(`${apiUrl}/city/quests`, { headers }),
                fetch(`${apiUrl}/city/logs?limit=300`, { headers })
            ]);
            const [dData, cData, cfgData, ecoData, itData, evData, qData, logsData] = await Promise.all([dRes.json(), cRes.json(), cfgRes.json(), ecoRes.json(), itRes.json(), evRes.json(), qRes.json(), logsRes.json()]);
            if (dData.success) setDistricts(dData.districts);
            if (cData.success) setCharacters(cData.characters);
            if (cfgData.success) {
                setConfig(cfgData.config);
                if (!mayorPromptLocal && cfgData.config.mayor_prompt) setMayorPromptLocal(cfgData.config.mayor_prompt);
                const mId = cfgData.config.mayor_model_char_id;
                if (mId === '__custom__') {
                    setMayorModelMode('custom');
                    setCustomEndpoint(cfgData.config.mayor_custom_endpoint || '');
                    setCustomKey(cfgData.config.mayor_custom_key || '');
                    setCustomModel(cfgData.config.mayor_custom_model || '');
                } else if (mId) {
                    setMayorModelMode(mId);
                } else {
                    setMayorModelMode('auto');
                }
            }
            if (ecoData.success) setEconomy(ecoData.stats);
            if (itData.success) setItems(itData.items);
            if (evData.success) setEvents(evData.events);
            if (qData.success) setQuests(qData.quests);
            if (logsData.success) setRecentLogs(logsData.logs || []);
        } catch (e) { console.error('CityManager Error:', e); }
        finally { setLoading(false); }
    }, [apiUrl, headers, mayorPromptLocal]);

    useEffect(() => {
        fetchAll();
        const scheduleRefresh = () => {
            if (refreshTimerRef.current) return;
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null;
                fetchAll();
            }, 800);
        };
        const handleCityUpdate = () => scheduleRefresh();
        window.addEventListener('city_update', handleCityUpdate);
        const interval = setInterval(fetchAll, 5000);
        return () => {
            window.removeEventListener('city_update', handleCityUpdate);
            clearInterval(interval);
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
            if (actionNoticeTimerRef.current) {
                clearTimeout(actionNoticeTimerRef.current);
                actionNoticeTimerRef.current = null;
            }
        };
    }, [fetchAll]);

    useEffect(() => {
        if (!selectedDistrictId && districts.length > 0) {
            setSelectedDistrictId(districts[0].id);
        }
    }, [districts, selectedDistrictId]);

    useEffect(() => {
        const districtIds = new Set(districts.map((district) => String(district.id)));
        setSelectedDistrictIds((current) => current.filter((id) => districtIds.has(String(id))));
    }, [districts]);

    const selectedDistrict = useMemo(
        () => districts.find((district) => district.id === selectedDistrictId) || (!selectedDistrictId ? districts[0] : null),
        [districts, selectedDistrictId]
    );

    useEffect(() => {
        if (selectedDistrictId === '__new__') return;
        if (selectedDistrict) {
            setDistrictDraft({ ...selectedDistrict });
        } else {
            setDistrictDraft(null);
        }
    }, [selectedDistrict, selectedDistrictId]);

    useEffect(() => {
        if (!selectedCharacterId && characters.length > 0) {
            setSelectedCharacterId(characters[0].id);
        }
    }, [characters, selectedCharacterId]);

    useEffect(() => {
        if (!supplyItemId && items.length > 0) {
            setSupplyItemId(items[0].id);
        }
    }, [items, supplyItemId]);

    const selectedCharacter = useMemo(
        () => characters.find((character) => character.id === selectedCharacterId) || characters[0] || null,
        [characters, selectedCharacterId]
    );

    const visibleEvents = useMemo(() => events
        .map((event) => ({
            ...event,
            remainingMs: Number(event.expires_at || 0) - Date.now(),
            remainingHours: Math.ceil((Number(event.expires_at || 0) - Date.now()) / 3600000)
        }))
        .filter((event) => event.remainingMs > 0 && event.remainingHours > 0), [events]);

    const activeQuestCount = useMemo(() => quests.filter((quest) => !quest.is_completed && String(quest.status || '') !== 'completed').length, [quests]);

    const districtDirtyCount = useMemo(() => {
        if (!districtDraft) return 0;
        if (!selectedDistrict) return districtDraft.id || districtDraft.name ? 1 : 0;
        const keys = ['name', 'emoji', 'type', 'description', 'action_label', 'cal_cost', 'cal_reward', 'money_cost', 'money_reward', 'duration_ticks', 'capacity', 'is_enabled', 'sort_order'];
        return keys.reduce((count, key) => String(selectedDistrict[key] ?? '') !== String(districtDraft[key] ?? '') ? count + 1 : count, 0);
    }, [selectedDistrict, districtDraft]);

    const saveDistrict = async (d) => { await fetch(`${apiUrl}/city/districts`, { method: 'POST', headers, body: JSON.stringify(d) }); fetchAll(); };
    const updateDistrictDraft = (key, value) => setDistrictDraft((current) => ({ ...(current || selectedDistrict || getEmptyDistrict()), [key]: value }));
    const resetDistrictDraft = () => {
        if (selectedDistrict) setDistrictDraft({ ...selectedDistrict });
    };
    const saveSelectedDistrict = async () => {
        if (!districtDraft || savingDistrict) return;
        const payload = { ...districtDraft };
        if (!payload.id && payload.name) {
            payload.id = payload.name.trim().toLowerCase().replace(/\s+/g, '_');
        }
        if (!payload.id) {
            showActionNotice('error', tx('District name is required before saving.', '请先填写分区名称再保存。'));
            return;
        }
        setSavingDistrict(true);
        try {
            await saveDistrict(payload);
            setSelectedDistrictId(payload.id);
            setDistrictDraft({ ...payload });
            showActionNotice('success', tx('District changes saved.', '分区修改已保存。'));
        } catch (e) {
            showActionNotice('error', tx(`Failed to save district: ${e.message}`, `保存分区失败：${e.message}`));
        } finally {
            setSavingDistrict(false);
        }
    };
    const deleteDistrict = async (id) => { if (!confirm(tx(`Delete district "${id}"?`, `确认删除分区 "${id}" 吗？`))) return; await fetch(`${apiUrl}/city/districts/${id}`, { method: 'DELETE', headers }); fetchAll(); };
    const toggleDistrict = async (id) => { await fetch(`${apiUrl}/city/districts/${id}/toggle`, { method: 'PATCH', headers }); fetchAll(); };
    const setDistrictStatus = async (ids, isEnabled) => {
        const targetIds = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
        if (!targetIds.length) {
            showActionNotice('error', tx('Select at least one district first.', '请先选择至少一个分区。'));
            return;
        }
        try {
            const res = await fetch(`${apiUrl}/city/districts/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ ids: targetIds, is_enabled: isEnabled ? 1 : 0 })
            });
            const data = await res.json();
            if (!res.ok || data?.success === false) throw new Error(data?.error || tx('Status update failed', '状态更新失败'));
            if (Array.isArray(data.districts)) setDistricts(data.districts);
            else fetchAll();
            showActionNotice('success', tx(
                `${data.updated || targetIds.length} district(s) updated.`,
                `已更新 ${data.updated || targetIds.length} 个分区。`
            ));
        } catch (e) {
            showActionNotice('error', tx(`Status update failed: ${e.message}`, `状态更新失败：${e.message}`));
        }
    };
    const updateConfig = async (key, value) => { await fetch(`${apiUrl}/city/config`, { method: 'POST', headers, body: JSON.stringify({ key, value }) }); setConfig(prev => ({ ...prev, [key]: value })); };

    const saveItem = async (it) => { await fetch(`${apiUrl}/city/items`, { method: 'POST', headers, body: JSON.stringify(it) }); setEditingItem(null); fetchAll(); };
    const deleteItemAction = async (id) => { if (!confirm(tx(`Delete item "${id}"?`, `确认删除商品 "${id}" 吗？`))) return; await fetch(`${apiUrl}/city/items/${id}`, { method: 'DELETE', headers }); fetchAll(); };

    const giveItem = async (charId, itemId) => {
        const targetName = selectedCharacter?.name || tx('this character', '该角色');
        const item = items.find(it => it.id === itemId);
        showActionNotice('success', tx(
            `Sent ${item?.emoji || ''}${item?.name || 'item'} to ${targetName}. The character reply is being generated in the background.`,
            `已送出 ${item?.emoji || ''}${item?.name || '物品'} 给 ${targetName}，角色回复正在后台生成。`
        ));
        void (async () => {
            try {
                const res = await fetch(`${apiUrl}/city/give-item`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ characterId: charId, itemId, quantity: 1 })
                });
                const data = await res.json();
                if (!res.ok || data?.success === false) throw new Error(data?.error || tx('Failed to send item', '送物品失败'));
                window.dispatchEvent(new CustomEvent('city_inventory_update', {
                    detail: { characterId: charId, inventory: Array.isArray(data.inventory) ? data.inventory : null }
                }));
                fetchAll();
            } catch (e) {
                showActionNotice('error', tx(`Failed to send item: ${e.message}`, `送物品失败: ${e.message}`));
            }
        })();
    };
    const deleteEvent = async (id) => { await fetch(`${apiUrl}/city/events/${id}`, { method: 'DELETE', headers }); fetchAll(); };
    const deleteQuest = async (id) => { await fetch(`${apiUrl}/city/quests/${id}`, { method: 'DELETE', headers }); fetchAll(); };
    const claimQuestForCharacter = async (questId, characterId) => {
        try {
            const res = await fetch(`${apiUrl}/city/quests/${questId}/claim`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ characterId })
            });
            const data = await res.json();
            if (!res.ok || data?.success === false) throw new Error(data?.error || tx('Claim failed', '领取失败'));
            showActionNotice('success', tx('Bounty quest claimed.', '悬赏任务已领取'));
            fetchAll();
            if (onRefreshLogs) onRefreshLogs();
        } catch (e) {
            showActionNotice('error', tx(`Claim failed: ${e.message}`, `领取失败: ${e.message}`));
        }
    };
    const completeQuestAction = async (questId, characterId) => {
        try {
            const res = await fetch(`${apiUrl}/city/quests/${questId}/complete`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ characterId })
            });
            const data = await res.json();
            if (!res.ok || data?.success === false) throw new Error(data?.error || tx('Completion failed', '完成失败'));
            showActionNotice('success', tx('Bounty quest completed.', '悬赏任务已完成'));
            fetchAll();
            if (onRefreshLogs) onRefreshLogs();
        } catch (e) {
            showActionNotice('error', tx(`Completion failed: ${e.message}`, `完成失败: ${e.message}`));
        }
    };

    const submitSupply = async () => {
        if (!selectedCharacter || savingSupply) return;
        setSavingSupply(true);
        try {
            if (supplyMode === 'gold') {
                const res = await fetch(`${apiUrl}/city/give-gold`, { method: 'POST', headers, body: JSON.stringify({ characterId: selectedCharacter.id, amount: Number(supplyAmount) }) });
                const data = await res.json();
                if (!res.ok || data?.success === false) throw new Error(data?.error || tx('Failed to send coins', '发金币失败'));
                showActionNotice('success', tx('Coins sent.', '金币已发放。'));
            } else if (supplyMode === 'calories') {
                const res = await fetch(`${apiUrl}/city/feed`, { method: 'POST', headers, body: JSON.stringify({ characterId: selectedCharacter.id, calories: Number(supplyAmount) }) });
                const data = await res.json();
                if (!res.ok || data?.success === false) throw new Error(data?.error || tx('Failed to restore energy', '补体力失败'));
                showActionNotice('success', tx('Energy restored.', '体力已补充。'));
            } else if (supplyItemId) {
                await giveItem(selectedCharacter.id, supplyItemId);
            }
            fetchAll();
        } catch (e) {
            showActionNotice('error', tx(`Supply failed: ${e.message}`, `补给失败：${e.message}`));
        } finally {
            setSavingSupply(false);
        }
    };

    const executeDangerAction = async () => {
        const action = dangerConfirm;
        setDangerConfirm(null);
        if (action === 'logs') {
            await fetch(`${apiUrl}/city/logs/clear`, { method: 'DELETE', headers });
            setMayorResult(null);
            fetchAll();
            if (onRefreshLogs) onRefreshLogs();
            showActionNotice('success', tx('Activity logs cleared.', '活动记录已清空。'));
        }
        if (action === 'wipe') {
            await fetch(`${apiUrl}/city/data/wipe`, { method: 'DELETE', headers });
            setMayorResult(null);
            setEconomy(null);
            fetchAll();
            if (onRefreshLogs) onRefreshLogs();
            showActionNotice('success', tx('All city data has been wiped.', '商业街数据已彻底清空。'));
        }
    };

    const runMayor = async () => {
        setMayorRunning(true); setMayorResult(null);
        try {
            const res = await fetch(`${apiUrl}/city/mayor/run`, { method: 'POST', headers });
            const data = await res.json();
            setMayorResult(data);
            fetchAll();
        } catch (e) { setMayorResult({ error: e.message }); }
        finally { setMayorRunning(false); }
    };
    const saveMayorPrompt = async () => { await updateConfig('mayor_prompt', mayorPromptLocal); };

    const saveMayorModel = async (mode) => {
        setMayorModelMode(mode);
        if (mode === 'custom') {
            await updateConfig('mayor_model_char_id', '__custom__');
        } else {
            await updateConfig('mayor_model_char_id', mode === 'auto' ? '' : mode);
        }
    };
    const saveCustomApi = async () => {
        await Promise.all([
            updateConfig('mayor_custom_endpoint', customEndpoint),
            updateConfig('mayor_custom_key', customKey),
            updateConfig('mayor_custom_model', customModel),
        ]);
        alert(tx('Custom API configuration saved.', '自定义 API 配置已保存。'));
    };

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>{tx('Loading...', '加载中...')}</div>;

    const mayorEnabled = config.mayor_enabled === '1' || config.mayor_enabled === 'true';
    const selectedDistrictDraft = districtDraft || selectedDistrict || getEmptyDistrict();
    const activeDistricts = districts.filter((district) => Number(district.is_enabled) === 1);
    const totalActionsLastHour = economy?.actions_last_hour?.reduce((sum, item) => sum + Number(item.count || 0), 0) || 0;
    const activeDistrictType = selectedDistrictDraft?.type || 'generic';
    const selectedInventory = selectedCharacter?.inventory || [];
    const dayBuckets = lastSevenDays();
    const logVolumeTrend = dayBuckets.map((day) => recentLogs.filter((log) => dayKey(log.timestamp) === day.key).length);
    const logVolumeLabels = dayBuckets.map((day) => day.label);
    const contextMixRows = [
        { id: 'self', label: tx('Self', '本人经历'), className: 'blue', value: num(config.city_self_log_limit, 5) },
        { id: 'social', label: tx('Social', '熟人情报'), className: 'green', value: num(config.city_social_log_limit, 3) },
        { id: 'notice', label: tx('Notice', '公告信息'), className: 'amber', value: num(config.city_announcement_limit, 5) },
        { id: 'system', label: tx('System', '系统事件'), className: 'red', value: num(config.city_global_log_limit, 5) }
    ];
    const contextTotal = Math.max(1, contextMixRows.reduce((sum, row) => sum + row.value, 0));
    const contextMix = contextMixRows.map((row) => ({
        ...row,
        percent: Math.round((row.value / contextTotal) * 100)
    }));
    const configRows = [
        { key: 'metabolism_rate', label: tx('Base metabolism', '基础代谢'), desc: tx('Energy decay per tick', '每 tick 生理消耗'), step: 1, type: 'number', values: flatTrend(config.metabolism_rate ?? 20) },
        { key: 'inflation', label: tx('Inflation multiplier', '通货膨胀倍率'), desc: tx('Overall city price multiplier', '物价整体倍率'), step: 0.05, type: 'number', values: flatTrend(config.inflation ?? 1) },
        { key: 'work_bonus', label: tx('Work bonus multiplier', '打工奖金倍率'), desc: tx('Reward multiplier for work districts', '工作分区收益倍率'), step: 0.05, type: 'number', values: flatTrend(config.work_bonus ?? 1) },
        { key: 'gambling_win_rate', label: tx('Gambling win rate', '赌博胜率'), desc: tx('Chance to win in gambling districts', '赌博分区获胜概率'), step: 0.01, type: 'number', values: flatTrend(config.gambling_win_rate ?? 0.35) },
    ];
    const memoryRows = [
        { key: 'city_self_log_limit', label: tx('Self memory limit', '本人记忆获取上限'), max: 20, fallback: 5 },
        { key: 'city_social_log_limit', label: tx('Acquaintance intel limit', '熟人情报获取上限'), max: 20, fallback: 3 },
        { key: 'city_announcement_limit', label: tx('Announcement read limit', '公告区读取上限'), max: 20, fallback: 5 },
    ];
    const buildDistrictStats = (district) => {
        const districtLogs = recentLogs
            .filter((log) => matchesDistrictRef(district, log.location))
            .sort((a, b) => num(b.timestamp) - num(a.timestamp));
        const trafficByDay = districtLogs.reduce((acc, log) => {
            const key = dayKey(log.timestamp);
            acc.set(key, (acc.get(key) || 0) + 1);
            return acc;
        }, new Map());
        const locatedResidents = characters.filter((character) => matchesDistrictRef(district, character.location));
        const linked = items
            .filter((item) => matchesDistrictRef(district, item.sold_at))
            .sort((a, b) => num(a.sort_order) - num(b.sort_order));
        const activeEvent = visibleEvents.find((event) => matchesDistrictRef(district, getEventDistrictRef(event)));
        const activeQuest = quests.find((quest) => !quest.is_completed && String(quest.status || '') !== 'completed' && matchesDistrictRef(district, quest.target_district));
        const todayKey = dayBuckets[dayBuckets.length - 1]?.key || dayKey(Date.now());
        const lastDayLogs = districtLogs.filter((log) => dayKey(log.timestamp) === todayKey);
        return {
            locatedResidents,
            occupancy: locatedResidents.length,
            trafficTrend: dayBuckets.map((day) => trafficByDay.get(day.key) || 0),
            trafficLabels: dayBuckets.map((day) => day.label),
            logs: districtLogs,
            recentLogs: districtLogs.slice(0, 4),
            lastDayLogs,
            lastDayMoney: lastDayLogs.reduce((sum, log) => sum + num(log.delta_money), 0),
            linkedItems: linked,
            activeEvent,
            activeQuest
        };
    };
    const districtRows = districts.map((district) => ({ ...district, __stats: buildDistrictStats(district) }));
    const typeOptions = Array.from(new Set(districts.map((district) => String(district.type || '').trim()).filter(Boolean)));
    const visibleDistrictRows = districtRows
        .filter((district) => districtTypeFilter === 'all' || String(district.type || '') === districtTypeFilter)
        .sort((a, b) => {
            if (districtSortMode === 'traffic') return (b.__stats?.lastDayLogs?.length || 0) - (a.__stats?.lastDayLogs?.length || 0);
            if (districtSortMode === 'occupancy') return (b.__stats?.occupancy || 0) - (a.__stats?.occupancy || 0);
            return num(a.sort_order) - num(b.sort_order);
        });
    const selectedDistrictIdSet = new Set(selectedDistrictIds.map((id) => String(id)));
    const bulkDistrictIds = selectedDistrictIds.length
        ? selectedDistrictIds
        : selectedDistrict
            ? [selectedDistrict.id]
            : [];
    const allVisibleDistrictsSelected = visibleDistrictRows.length > 0
        && visibleDistrictRows.every((district) => selectedDistrictIdSet.has(String(district.id)));
    const toggleDistrictSelection = (id, checked) => {
        const cleanId = String(id || '').trim();
        if (!cleanId) return;
        setSelectedDistrictIds((current) => {
            const next = new Set(current.map((item) => String(item)));
            if (checked) next.add(cleanId);
            else next.delete(cleanId);
            return Array.from(next);
        });
    };
    const toggleVisibleDistrictSelection = (checked) => {
        const visibleIds = visibleDistrictRows.map((district) => String(district.id));
        setSelectedDistrictIds((current) => {
            const next = new Set(current.map((item) => String(item)));
            visibleIds.forEach((id) => {
                if (checked) next.add(id);
                else next.delete(id);
            });
            return Array.from(next);
        });
    };
    const itemDistrictOptions = Array.from(new Map([
        ...districts.map((district) => [district.id, `${district.emoji || ''} ${district.name || district.id}`.trim()]),
        ...items.map((item) => [String(item.sold_at || '').trim(), String(item.sold_at || '').trim()]).filter(([value]) => value)
    ]).entries());
    const selectedItemFilterDistrict = itemDistrictFilter === 'all'
        ? null
        : districts.find((district) => String(district.id) === String(itemDistrictFilter)) || { id: itemDistrictFilter, name: itemDistrictFilter };
    const itemNeedle = normalizeKey(itemSearch);
    const visibleItems = items.filter((item) => {
        const matchesSearch = !itemNeedle || [item.id, item.name, item.category, item.effect, item.sold_at]
            .some((value) => normalizeKey(value).includes(itemNeedle));
        const matchesDistrict = !selectedItemFilterDistrict || matchesDistrictRef(selectedItemFilterDistrict, item.sold_at);
        const stock = num(item.stock, -1);
        const isAvailable = Number(item.is_available) === 1;
        const matchesStatus = itemStatusFilter === 'all'
            || (itemStatusFilter === 'available' && isAvailable && stock !== 0)
            || (itemStatusFilter === 'disabled' && !isAvailable)
            || (itemStatusFilter === 'out' && stock === 0);
        return matchesSearch && matchesDistrict && matchesStatus;
    });
    const residentNeedle = normalizeKey(residentSearch);
    const visibleCharacters = characters.filter((character) => !residentNeedle || [character.id, character.name, character.location, character.city_status, character.emotion_label]
        .some((value) => normalizeKey(value).includes(residentNeedle)));
    const selectedStats = buildDistrictStats(selectedDistrictDraft);
    const selectedCapacityLimit = num(selectedDistrictDraft.capacity, 0);
    const selectedCapacity = selectedCapacityLimit > 0 ? selectedCapacityLimit : Math.max(1, selectedStats.occupancy);
    const selectedOccupancy = selectedCapacityLimit > 0 ? Math.min(selectedCapacity, selectedStats.occupancy) : selectedStats.occupancy;
    const selectedCapacityText = selectedCapacityLimit > 0 ? `${selectedOccupancy}/${selectedCapacityLimit}` : `${selectedOccupancy}/-`;
    const selectedTraffic = selectedStats.trafficTrend;
    const inspectorItems = selectedStats.linkedItems.slice(0, 4);
    const selectedResidents = selectedStats.locatedResidents.slice(0, Math.max(0, selectedOccupancy));
    const rewardFieldKey = num(selectedDistrictDraft.money_reward) > 0 || num(selectedDistrict?.money_reward) > 0 ? 'money_reward' : 'cal_reward';
    const rewardCurrent = selectedDistrict?.[rewardFieldKey] || 0;
    const rewardNext = selectedDistrictDraft[rewardFieldKey] || 0;
    const rewardLabel = rewardFieldKey === 'money_reward' ? tx('Reward (coins)', '奖励（金币）') : tx('Reward (energy)', '奖励（体力）');
    const recentActivityRows = selectedStats.recentLogs.map((log) => {
        const money = num(log.delta_money);
        const calories = num(log.delta_calories);
        const deltas = [
            money ? formatSigned(money, tx(' coins', ' 金币')) : '',
            calories ? formatSigned(calories, tx(' cal', ' 卡')) : ''
        ].filter(Boolean).join(' · ');
        const actor = log.char_name || tx('System', '系统');
        return {
            time: formatClock(log.timestamp, isEn),
            text: `${actor} · ${compactText(log.content || log.action_type || tx('City activity', '商业街活动'), 34)}${deltas ? ` · ${deltas}` : ''}`
        };
    });
    const activeQuestProgress = getQuestProgress(selectedStats.activeQuest);
    const activeContext = selectedStats.activeEvent
        ? {
            title: `${selectedStats.activeEvent.emoji || ''}${selectedStats.activeEvent.title || tx('City event', '城市事件')}`,
            detail: formatRemaining(selectedStats.activeEvent, tx),
            progress: getTimedProgress(selectedStats.activeEvent),
            kind: tx('In progress', '进行中')
        }
        : selectedStats.activeQuest
            ? {
                title: `${selectedStats.activeQuest.emoji || ''}${selectedStats.activeQuest.title || tx('Bounty quest', '悬赏任务')}`,
                detail: `${activeQuestProgress.label} · ${formatRemaining(selectedStats.activeQuest, tx)}`,
                progress: activeQuestProgress.percent,
                kind: selectedStats.activeQuest.claimed_by ? tx('Claimed', '已领取') : tx('Open', '待领取')
            }
            : null;
    const baselineDailyNet = selectedStats.lastDayMoney;
    const actionCountBasis = Math.max(1, selectedStats.lastDayLogs.length);
    const beforeNetPerAction = num(selectedDistrict?.money_reward) - num(selectedDistrict?.money_cost);
    const afterNetPerAction = num(selectedDistrictDraft.money_reward) - num(selectedDistrictDraft.money_cost);
    const projectedDailyNet = baselineDailyNet + (afterNetPerAction - beforeNetPerAction) * actionCountBasis;
    const projectedDailyNetChange = projectedDailyNet - baselineDailyNet;
    const estimatedNetLabel = formatSigned(projectedDailyNet, tx(' coins', ' 金币'));

    const renderOverview = () => (
        <main className="section-page overview-page">
            <div className="content-title">
                <div><h1>{tx('Management Overview', '管理总览')}</h1><p>{tx('Current city health and items needing attention.', '查看商业街当前运行状态与需要处理的事项。')}</p></div>
                <ToolbarButton primary onClick={() => setActiveManagerSection('districts')}><AlertTriangle />{tx('Review districts', '处理分区')}</ToolbarButton>
            </div>
            <section className="pulse-panel">
                <div className="section-row"><h2>{tx('City Pulse', '城市脉搏')}</h2><span>{tx('Live API data', '实时接口数据')}</span></div>
                <div className="resource-strip">
                    <div><Coins /><span><small>{tx('Coins', '流通金币')}</small><strong>{formatMoney(economy?.total_gold_in_circulation || 0)}</strong></span><em>API</em></div>
                    <div><Activity /><span><small>{tx('Avg energy', '平均体力')}</small><strong>{economy?.avg_calories || 0}</strong></span><em>{tx('cal', '卡')}</em></div>
                    <div><Store /><span><small>{tx('Districts', '启用分区')}</small><strong>{activeDistricts.length}/{districts.length}</strong></span><em>{tx('open', '运行')}</em></div>
                    <div><CalendarDays /><span><small>{tx('Last hour', '近1小时')}</small><strong>{totalActionsLastHour}</strong></span><em>{tx('actions', '行动')}</em></div>
                </div>
            </section>
            <section className="attention-table">
                <div className="section-row"><h2>{tx('Needs Attention', '需要关注')}</h2><span>{tx('Sorted by current order', '按当前排序展示')}</span></div>
                <div className="attention-head"><span>{tx('District', '分区名称')}</span><span>{tx('Economy', '经济')}</span><span>{tx('Trend', '7日趋势')}</span><span>{tx('Status', '状态')}</span><span>{tx('Reason', '原因')}</span><span>{tx('Action', '操作')}</span></div>
                {districtRows.slice(0, 6).map((district) => (
                    <div className="attention-row" key={district.id}>
                        <strong>{district.emoji} {district.name}</strong>
                        <span>{num(district.money_reward) > 0 ? `+${formatMoney(district.money_reward)}` : `-${formatMoney(district.money_cost)}`}</span>
                        <MiniLine values={district.__stats.trafficTrend} labels={district.__stats.trafficLabels} />
                        <span className={district.is_enabled ? 'positive' : 'warning-text'}>{district.is_enabled ? tx('Enabled', '启用') : tx('Disabled', '停用')}</span>
                        <span>{district.__stats.occupancy > num(district.capacity) && num(district.capacity) > 0 ? tx('Over capacity', '超过容量') : num(district.cal_cost) > 200 ? tx('High energy cost', '体力消耗偏高') : tx('No issue', '无')}</span>
                        <button type="button" onClick={() => { setSelectedDistrictId(district.id); setActiveManagerSection('districts'); }}>{tx('Manage', '进入管理')}</button>
                    </div>
                ))}
            </section>
        </main>
    );

    const renderDistricts = () => (
        <div className="district-layout">
            <main className="district-main">
                <div className="content-title"><div><h1>{tx('District Management', '分区管理')}</h1><p>{tx('Manage district layout, operating numbers, and rewards.', '管理商业街内的分区布局、运营参数与奖励结构。')}</p></div></div>
                <div className="district-toolbar">
                    <div>
                        <ToolbarButton primary onClick={() => { setSelectedDistrictId('__new__'); setDistrictDraft(getEmptyDistrict()); }}><Plus />{tx('New district', '新建分区')}</ToolbarButton>
                        <ToolbarButton onClick={() => setDistrictStatus(bulkDistrictIds, true)} disabled={!bulkDistrictIds.length}><CheckCircle />{tx('Batch enable', '批量启用')}</ToolbarButton>
                        <ToolbarButton onClick={() => setDistrictStatus(bulkDistrictIds, false)} disabled={!bulkDistrictIds.length}><Power />{tx('Batch disable', '批量禁用')}</ToolbarButton>
                    </div>
                    <div>
                        <span>{tx('Sort', '排序')}：</span>
                        <select value={districtSortMode} onChange={(event) => setDistrictSortMode(event.target.value)}>
                            <option value="custom">{tx('Custom order', '自定义排序')}</option>
                            <option value="traffic">{tx('Recent traffic high to low', '近期客流从高到低')}</option>
                            <option value="occupancy">{tx('Occupancy high to low', '占用从高到低')}</option>
                        </select>
                        <span>{tx('Filter', '筛选')}：</span>
                        <select value={districtTypeFilter} onChange={(event) => setDistrictTypeFilter(event.target.value)}>
                            <option value="all">{tx('All types', '全部类型')}</option>
                            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                </div>
                <div className="district-table-wrap">
                    <div className="district-table-head district-grid">
                        <input type="checkbox" aria-label={tx('Select all districts', '全选分区')} checked={allVisibleDistrictsSelected} onChange={(event) => toggleVisibleDistrictSelection(event.target.checked)} />
                        <span>{tx('District', '分区名称')}</span><span>{tx('Type', '类型')}</span><span>{tx('Energy cost', '行动消耗')}</span><span>{tx('Reward', '奖励')}</span><span>{tx('Capacity', '容量')}</span><span>{tx('Sort', '排序')}</span><span>{tx('Status', '启用状态')}</span><span>{tx('Actions', '操作')}</span>
                    </div>
                    {visibleDistrictRows.map((district) => {
                        const capacity = num(district.capacity);
                        const rewardLabelText = rewardKind(district) === 'money'
                            ? `${tx('Coins', '金币')} +${formatMoney(district.money_reward)}`
                            : rewardKind(district) === 'calories'
                                ? `${tx('Energy', '体力')} +${formatMoney(district.cal_reward)}`
                                : '-';
                        return (
                            <div key={district.id} className={`district-record ${selectedDistrictId === district.id ? 'selected' : ''}`}>
                                <div className="district-row district-grid" onClick={() => setSelectedDistrictId(district.id)}>
                                    <input type="checkbox" aria-label={`${tx('Select', '选择')}${district.name}`} checked={selectedDistrictIdSet.has(String(district.id))} onClick={(event) => event.stopPropagation()} onChange={(event) => toggleDistrictSelection(district.id, event.target.checked)} />
                                    <button type="button" className="district-name" onClick={(event) => { event.stopPropagation(); setSelectedDistrictId(district.id); }}>{district.emoji} {district.name}</button>
                                    <span>{district.type}</span>
                                    <span>{num(district.cal_cost) > 0 ? `${tx('Energy', '体力')} -${formatMoney(district.cal_cost)}` : '0'}</span>
                                    <span>{rewardLabelText}</span>
                                    <span>{district.__stats.occupancy} / {capacity > 0 ? capacity : '-'}</span>
                                    <span>{district.sort_order}</span>
                                    <span className="status-toggle" onClick={(event) => event.stopPropagation()}><ToggleSwitch checked={!!district.is_enabled} onChange={() => toggleDistrict(district.id)} label={`${district.name}启用状态`} /><em>{district.is_enabled ? tx('On', '启用') : tx('Off', '停用')}</em></span>
                                    <span className="row-actions"><button type="button" aria-label={tx('Edit', '编辑')} onClick={(event) => { event.stopPropagation(); setSelectedDistrictId(district.id); setDistrictEditorTab('basic'); }}><Edit3 /></button><button type="button" aria-label={tx('Delete', '删除')} onClick={(event) => { event.stopPropagation(); deleteDistrict(district.id); }}><Trash2 /></button></span>
                                </div>
                            </div>
                        );
                    })}
                    <div className="district-editor">
                        <nav className="editor-tabs">
                            {[
                                ['basic', tx('Basic Settings', '基础设置')],
                                ['numbers', tx('Operating Numbers', '运营参数')],
                                ['visual', tx('Visual Copy', '外观与描述')],
                                ['rules', tx('Rules', '事件与规则')]
                            ].map(([id, label]) => (
                                <button key={id} className={districtEditorTab === id ? 'active' : ''} type="button" onClick={() => setDistrictEditorTab(id)}>{label}</button>
                            ))}
                        </nav>
                        <div className="editor-content">
                            {districtEditorTab === 'basic' && (
                                <div className="field-row identity-fields">
                                    <label><span>{tx('Name', '分区名称')} <b>*</b></span><input value={selectedDistrictDraft.name || ''} onChange={(event) => updateDistrictDraft('name', event.target.value)} /></label>
                                    <label><span>{tx('Type', '类型')}</span><select value={activeDistrictType} onChange={(event) => updateDistrictDraft('type', event.target.value)}>{DISTRICT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label[isEn ? 'en' : 'zh']}</option>)}</select></label>
                                    <label><span>{tx('Sort', '排序')}</span><input type="number" value={selectedDistrictDraft.sort_order || 0} onChange={(event) => updateDistrictDraft('sort_order', Number(event.target.value))} /></label>
                                    <label className="enabled-field"><span>{tx('Enabled', '启用状态')}</span><div><ToggleSwitch checked={Number(selectedDistrictDraft.is_enabled ?? 1) === 1} onChange={(value) => updateDistrictDraft('is_enabled', value ? 1 : 0)} label={tx('Enable current district', '启用当前分区')} /><em>{Number(selectedDistrictDraft.is_enabled ?? 1) === 1 ? tx('Enabled', '启用') : tx('Disabled', '停用')}</em></div></label>
                                </div>
                            )}
                            {districtEditorTab === 'numbers' && (
                                <>
                                    <div className="field-row metric-fields">
                                        <label><span>{tx('Energy cost', '行动消耗（体力）')}</span><input type="number" value={selectedDistrictDraft.cal_cost || 0} onChange={(event) => updateDistrictDraft('cal_cost', Number(event.target.value))} /><ChangeScale current={selectedDistrict?.cal_cost || 0} next={selectedDistrictDraft.cal_cost || 0} min={0} max={500} /></label>
                                        <label><span>{rewardLabel}</span><input type="number" value={rewardNext} onChange={(event) => updateDistrictDraft(rewardFieldKey, Number(event.target.value))} /><ChangeScale current={rewardCurrent} next={rewardNext} min={0} max={rewardFieldKey === 'money_reward' ? 500 : 1200} positive /></label>
                                        <label><span>{tx('Capacity', '容量（上限）')}</span><input type="number" value={selectedDistrictDraft.capacity || 0} onChange={(event) => updateDistrictDraft('capacity', Number(event.target.value))} /><ChangeScale current={selectedDistrict?.capacity || 0} next={selectedDistrictDraft.capacity || 0} min={0} max={24} positive /></label>
                                    </div>
                                    <div className="editor-visuals">
                                        <section><div className="mini-heading"><strong>{tx('7-day traffic', '7日客流')}</strong><Info /></div><MiniLine values={selectedTraffic} labels={selectedStats.trafficLabels} height={75} withLabels /></section>
                                        <section className="balance-visual"><div className="mini-heading"><strong>{tx('Reward-cost balance', '收益—消耗平衡')}</strong><Info /></div><div className="balance-values"><span>{tx('Cost', '消耗')}<b>{num(selectedDistrictDraft.cal_cost) + num(selectedDistrictDraft.money_cost)}</b></span><span>{tx('Reward', '收益')}<b>{num(selectedDistrictDraft.cal_reward) + num(selectedDistrictDraft.money_reward)}</b></span></div><div className="balance-track"><i /><b /></div><strong>{tx('Projected daily net', '预计每日净金币')} {estimatedNetLabel}</strong></section>
                                    </div>
                                </>
                            )}
                            {districtEditorTab === 'visual' && (
                                <label className="description-field"><span>{tx('Description', '描述')}</span><textarea value={selectedDistrictDraft.description || ''} maxLength={120} onChange={(event) => updateDistrictDraft('description', event.target.value)} /><small>{String(selectedDistrictDraft.description || '').length}/120</small></label>
                            )}
                            {districtEditorTab === 'rules' && (
                                <div className="district-rules-panel">
                                    <section><strong>{tx('Linked event', '关联活动')}</strong><span>{selectedStats.activeEvent ? `${selectedStats.activeEvent.emoji || ''}${selectedStats.activeEvent.title}` : tx('None', '无')}</span></section>
                                    <section><strong>{tx('Linked quest', '关联任务')}</strong><span>{selectedStats.activeQuest ? `${selectedStats.activeQuest.emoji || ''}${selectedStats.activeQuest.title}` : tx('None', '无')}</span></section>
                                    <section><strong>{tx('Recent logs', '近期日志')}</strong><span>{selectedStats.recentLogs.length} / {recentLogs.length}</span></section>
                                    <ToolbarButton onClick={() => setActiveManagerSection('events')}><BookOpen />{tx('Manage events and quests', '管理事件与任务')}</ToolbarButton>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="save-bar">
                    <strong>{tx('Unsaved changes', '未保存修改')}：{districtDirtyCount}</strong>
                    <div><ToolbarButton onClick={resetDistrictDraft}><RotateCcw />{tx('Reset', '还原更改')}</ToolbarButton><ToolbarButton primary onClick={saveSelectedDistrict} disabled={!districtDirtyCount || savingDistrict}>{savingDistrict ? <LoaderCircle className="spin" /> : <Save />}{tx('Save changes', '保存更改')}（{districtDirtyCount}）</ToolbarButton></div>
                </div>
            </main>
            <aside className={`impact-inspector ${inspectorPinned ? 'is-pinned' : ''}`}>
                <div className="inspector-title"><h2>{tx('Impact Inspector', '影响检视增强版')}</h2><button type="button" aria-label={tx('Pin inspector', '固定检视')} aria-pressed={inspectorPinned} onClick={() => setInspectorPinned((current) => !current)}><Pin /></button></div>
                <section className="district-summary">
                    <div className="district-thumb">{selectedDistrictDraft.emoji || '🏬'}</div>
                    <div><h3>{selectedDistrictDraft.name || tx('New district', '新分区')}</h3><span className="green-tag">{Number(selectedDistrictDraft.is_enabled ?? 1) === 1 ? tx('Enabled', '启用') : tx('Disabled', '停用')}</span><p>{activeDistrictType} · {tx('Sort', '排序')} {selectedDistrictDraft.sort_order || 0}</p><strong>{tx('Capacity', '容量')} {selectedCapacityText} · {tx('Today actions', '今日行动')} {selectedStats.lastDayLogs.length}</strong></div>
                </section>
                <section>
                    <h3>{tx('Seat occupancy', '座位占用')}（{selectedCapacityLimit > 0 ? `${selectedCapacityLimit} ${tx('spots', '人位')}` : tx('No capacity limit', '未设容量上限')}）</h3>
                    <div className="occupancy-row">
                        <OccupancyRing value={selectedOccupancy} total={selectedCapacity} label={selectedCapacityText} />
                        <div className="avatar-stack">{selectedResidents.map((resident) => <AvatarWithFrame key={resident.id} size={34} frame={resident.avatar_frame} src={avatarSrc(resident.avatar, apiUrl)} fallbackSrc={FALLBACK_AVATAR} alt="" />)}<span className="avatar empty"><Users /></span></div>
                    </div>
                </section>
                <section><h3>{tx('7-day traffic trend (visits)', '7日客流趋势（人次）')}</h3><MiniLine values={selectedTraffic} labels={selectedStats.trafficLabels} height={70} withLabels /></section>
                <section><div className="section-row"><h3>{tx('Related item stock', '关联商品库存')}</h3><button type="button" onClick={() => { setItemDistrictFilter(selectedDistrictDraft.id || 'all'); setItemSearch(''); setActiveManagerSection('items'); }}>{tx('View all', '查看全部')} <ChevronRight /></button></div><div className="inventory-bars">{inspectorItems.length ? inspectorItems.map((item, index) => {
                    const stock = num(item.stock, -1);
                    const width = stock < 0 ? 100 : clamp(Math.round((stock / 20) * 100), 4, 100);
                    return <div key={item.id || index}><span>{item.emoji} {item.name}</span><i><b style={{ width: `${width}%` }} /></i><em>{stock < 0 ? tx('Unlimited', '不限') : `${stock}`}</em></div>;
                }) : <p className="muted">{tx('No linked items for this district.', '这个分区暂无关联商品。')}</p>}</div></section>
                <section><div className="section-row"><h3>{tx('Recent Activity', '近期活动')}</h3><button type="button" onClick={() => onOpenLogs?.(selectedDistrictDraft.name || selectedDistrictDraft.id || '')}>{tx('View all', '查看全部')} <ChevronRight /></button></div>{recentActivityRows.length ? <ol className="activity-list">{recentActivityRows.map((row) => <li key={`${row.time}-${row.text}`}><time>{row.time}</time><span>{row.text}</span></li>)}</ol> : <p className="muted">{tx('No recent logs for this district.', '这个分区暂无近期日志。')}</p>}</section>
                <section className="active-event"><div className="section-row"><h3>{tx('Current event', '当前活动')}</h3>{activeContext && <span className="green-tag">{activeContext.kind}</span>}</div>{activeContext ? <><div className="event-progress"><BookOpen /><span><strong>{activeContext.title}</strong><small>{activeContext.detail}</small></span><em>{activeContext.progress}%</em></div><div className="progress-track"><i style={{ width: `${activeContext.progress}%` }} /></div></> : <p className="muted">{tx('No active event targets this district.', '当前没有指向该分区的活动。')}</p>}</section>
                <section className="impact-preview">
                    <h3>{tx('After Save Preview', '保存后影响（预览）')}</h3>
                    <div className="impact-table">
                        <div><span>{tx('Item', '项目')}</span><span>{tx('Before', '调整前')}</span><i /><span>{tx('After', '调整后')}</span><span>{tx('Change', '变化')}</span></div>
                        <div><b>{tx('Energy cost', '行动消耗（体力）')}</b><span>-{formatMoney(selectedDistrict?.cal_cost || 0)}</span><ArrowRight /><strong>-{formatMoney(selectedDistrictDraft.cal_cost || 0)}</strong><em className={num(selectedDistrictDraft.cal_cost) <= num(selectedDistrict?.cal_cost) ? 'positive' : 'negative'}>{formatSigned(num(selectedDistrictDraft.cal_cost) - num(selectedDistrict?.cal_cost))}</em></div>
                        <div><b>{rewardLabel}</b><span>+{formatMoney(rewardCurrent)}</span><ArrowRight /><strong>+{formatMoney(rewardNext)}</strong><em className={rewardNext >= rewardCurrent ? 'positive' : 'negative'}>{formatSigned(rewardNext - rewardCurrent)}</em></div>
                        <div><b>{tx('Capacity', '容量上限')}</b><span>{selectedDistrict?.capacity || 0}</span><ArrowRight /><strong>{selectedDistrictDraft.capacity || 0}</strong><em className={num(selectedDistrictDraft.capacity) >= num(selectedDistrict?.capacity) ? 'positive' : 'negative'}>{formatSigned(num(selectedDistrictDraft.capacity) - num(selectedDistrict?.capacity))}</em></div>
                        <div><b>{tx('Projected daily net coins', '预计每日净金币')}</b><span>{formatSigned(baselineDailyNet)}</span><ArrowRight /><strong>{formatSigned(projectedDailyNet)}</strong><em className={projectedDailyNetChange >= 0 ? 'positive' : 'negative'}>{formatSigned(projectedDailyNetChange)}</em></div>
                    </div>
                    <p>{tx('Projected daily net coins', '预计每日净金币')} <strong>{estimatedNetLabel}</strong><Info /></p>
                </section>
            </aside>
        </div>
    );

    const renderItems = () => (
        <main className="section-page">
            <div className="content-title"><div><h1>{tx('Items', '商品与物品')}</h1><p>{tx('Manage prices, stock, effects and selling districts.', '统一管理商品价格、库存、效果与所属分区。')}</p></div><ToolbarButton primary onClick={() => setEditingItem(getEmptyItem())}><Plus />{tx('New item', '新增商品')}</ToolbarButton></div>
            <div className="list-toolbar">
                <label><Search /><input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder={tx('Search item name', '搜索商品名称')} /></label>
                <select value={itemDistrictFilter} onChange={(event) => setItemDistrictFilter(event.target.value)}>
                    <option value="all">{tx('All districts', '全部分区')}</option>
                    {itemDistrictOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={itemStatusFilter} onChange={(event) => setItemStatusFilter(event.target.value)}>
                    <option value="all">{tx('All statuses', '全部状态')}</option>
                    <option value="available">{tx('Available', '可售')}</option>
                    <option value="disabled">{tx('Disabled', '停用')}</option>
                    <option value="out">{tx('Out of stock', '缺货')}</option>
                </select>
            </div>
            <section className="items-table">
                <div className="items-head"><span>{tx('Item', '商品名称')}</span><span>{tx('Category', '分类')}</span><span>{tx('Price', '价格')}</span><span>{tx('Stock', '库存')}</span><span>{tx('Effect', '角色效果')}</span><span>{tx('District', '所属分区')}</span><span>{tx('Status', '状态')}</span><span>{tx('Actions', '操作')}</span></div>
                {visibleItems.map((item) => (
                    <div className="items-row" key={item.id}>
                        <strong><Package />{item.emoji} {item.name}</strong><span>{itemCategoryLabel(item.category, isEn)}</span><span>¥ {formatMoney(item.buy_price)}</span>
                        <div className="stock-cell"><i><b style={{ width: `${item.stock === -1 ? 100 : Math.max(4, Math.min(100, item.stock))}%` }} /></i><span>{item.stock === -1 ? tx('Unlimited', '不限') : item.stock}</span></div>
                        <span>{item.effect || '-'}</span><span>{item.sold_at || '-'}</span><span className={item.is_available ? 'positive' : 'muted'}>{item.is_available ? tx('On', '启用') : tx('Off', '停用')}</span>
                        <div className="row-actions"><button type="button" onClick={() => setEditingItem({ ...item })}><Edit3 /></button><button type="button" onClick={() => deleteItemAction(item.id)}><Trash2 /></button></div>
                    </div>
                ))}
                {!visibleItems.length && <p className="muted">{tx('No items match the current filters.', '没有符合当前筛选的商品。')}</p>}
            </section>
        </main>
    );

    const renderConfig = () => (
        <div className="config-layout">
            <main className="section-page config-page">
                <div className="content-title"><div><h1>{tx('City Settings', '城市设置')}</h1><p>{tx('Readable controls for economy, memory, logs and system state.', '以可读参数控制商业街经济、记忆、日志与系统状态。')}</p></div></div>
                <section className="config-section">
                    <div className="section-row"><h2><SlidersHorizontal />{tx('Economy Controls', '经济调控')}</h2><span>{tx('Saved on blur/change', '改动即时保存')}</span></div>
                    <div className="config-table config-head"><span>{tx('Metric', '指标')}</span><span>{tx('Current', '当前值')}</span><span>{tx('Trend', '近7日趋势')}</span><span>{tx('Range', '推荐范围')}</span><span>{tx('Edit', '修改值')}</span></div>
                    {configRows.map((row) => (
                        <div className="config-table config-row" key={row.key}>
                            <span><strong>{row.label}</strong><small>{row.desc}</small></span><b>{config[row.key] ?? ''}</b><MiniLine values={row.values} /><span>{row.key === 'gambling_win_rate' ? '0–1' : '0–100'}</span>
                            <input type={row.type} step={row.step} defaultValue={config[row.key] ?? ''} onBlur={(event) => updateConfig(row.key, event.target.value)} />
                        </div>
                    ))}
                </section>
                <section className="config-section">
                    <div className="section-row"><h2><Users />{tx('Memory & Social', '记忆与社交')}</h2><span>{tx('Context volume controls', '上下文读取量控制')}</span></div>
                    <div className="memory-grid">
                        <div>
                            {memoryRows.map((row) => (
                                <label key={row.key}><span>{row.label}<b>{config[row.key] || row.fallback} {tx('logs', '条')}</b></span><input type="range" min="0" max={row.max} value={parseInt(config[row.key]) || row.fallback} onChange={(event) => updateConfig(row.key, event.target.value)} /></label>
                            ))}
                        </div>
                        <div className="memory-flow"><div><span>{tx('Self logs', '本人经历')}</span><span>{tx('Social intel', '熟人情报')}</span><span>{tx('Announcements', '公告区发布')}</span><span>{tx('System events', '系统事件')}</span></div><ArrowRight /><div className="memory-hub"><Database /><strong>{tx('Context', '角色记忆')}</strong></div><ArrowRight /><div className="stacked-context">{contextMix.map((row) => <i key={row.id} style={{ height: `${row.percent}%` }} />)}</div></div>
                    </div>
                </section>
                <section className="config-section log-rules">
                    <div className="section-row"><h2><Archive />{tx('Log Rules', '日志规则')}</h2><span>{tx('Frontend renders 300 first, then loads more.', '前端默认渲染 300 条，底部查看更多。')}</span></div>
                    <div className="log-volume"><div><strong>{tx('Log volume trend', '日志量趋势')}</strong><MiniLine values={logVolumeTrend} labels={logVolumeLabels} /></div><label><span>{tx('Global log limit', '全局日志上限')}</span><input type="number" defaultValue={config.city_global_log_limit || 5} onBlur={(event) => updateConfig('city_global_log_limit', event.target.value)} /><small>{tx('Backend validates the range.', '后端会校验范围。')}</small></label></div>
                </section>
            </main>
            <aside className="config-inspector">
                <h2>{tx('Live Impact Preview', '实时影响预览')}</h2><span>{tx('Uses current config and economy stats.', '根据当前配置和经济状态估算。')}</span>
                <section className="impact-number"><span>{tx('Actions last hour', '近1小时行动')}</span><strong>{totalActionsLastHour}</strong><em>API</em></section>
                <section><h3>{tx('Context mix', '记忆情境构成')}</h3><div className="legend-list">{contextMix.map((row) => <span key={row.id}><i className={row.className} />{row.label} {row.percent}%</span>)}</div></section>
                <div className="warning-box"><AlertTriangle /><span><strong>{tx('Immediate save is enabled', '当前为即时保存')}</strong><small>{tx('Use small adjustments to avoid economy spikes.', '建议小幅调整，避免经济波动过大。')}</small></span></div>
            </aside>
        </div>
    );

    const renderResidents = () => (
        <main className="section-page">
            <div className="content-title"><div><h1>{tx('Resident Supply', '角色补给')}</h1><p>{tx('Grant coins, energy or items and keep operation logs.', '为指定角色补充金币、体力或物品，并保留操作记录。')}</p></div></div>
            <div className="resident-operation-layout">
                <aside className="resident-list"><label><Search /><input value={residentSearch} onChange={(event) => setResidentSearch(event.target.value)} placeholder={tx('Search resident', '搜索角色')} /></label>{visibleCharacters.map((character) => <button key={character.id} className={selectedCharacterId === character.id ? 'active' : ''} type="button" onClick={() => setSelectedCharacterId(character.id)}><AvatarWithFrame size={36} frame={character.avatar_frame} src={avatarSrc(character.avatar, apiUrl)} fallbackSrc={FALLBACK_AVATAR} alt="" /><span><strong>{character.name}</strong><small>{character.location || 'home'}</small></span><ChevronRight /></button>)}{!visibleCharacters.length && <p className="muted">{tx('No residents match this search.', '没有符合搜索条件的角色。')}</p>}</aside>
                <section className="supply-form">
                    {selectedCharacter && <div className="selected-resident"><AvatarWithFrame size={54} frame={selectedCharacter.avatar_frame} src={avatarSrc(selectedCharacter.avatar, apiUrl)} fallbackSrc={FALLBACK_AVATAR} alt="" /><div><span>{tx('Current target', '当前补给对象')}</span><h2>{selectedCharacter.name}</h2><p>{tx('Coins', '金币')} ¥{formatMoney(selectedCharacter.wallet)} · {tx('Energy', '体力')} {selectedCharacter.calories} · {tx('Inventory', '背包')} {(selectedCharacter.inventory || []).length}</p></div></div>}
                    <div className="supply-tabs">{[{ id: 'gold', label: tx('Coins', '金币'), icon: Coins }, { id: 'calories', label: tx('Energy', '体力'), icon: Heart }, { id: 'item', label: tx('Item', '物品'), icon: Gift }].map(({ id, label, icon: Icon }) => <button key={id} type="button" className={supplyMode === id ? 'active' : ''} onClick={() => setSupplyMode(id)}>{React.createElement(Icon)}{label}</button>)}</div>
                    {supplyMode === 'item' ? <label className="supply-field"><span>{tx('Choose item', '选择物品')}</span><select value={supplyItemId} onChange={(event) => setSupplyItemId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label> : <label className="supply-field"><span>{tx('Amount', '补给数量')}</span><input type="number" value={supplyAmount} onChange={(event) => setSupplyAmount(Number(event.target.value))} /><small>{tx('Written to character state immediately.', '执行后将立即写入角色状态与商业街日志。')}</small></label>}
                    <ToolbarButton primary onClick={submitSupply} disabled={!selectedCharacter || savingSupply}>{savingSupply ? <LoaderCircle className="spin" /> : <CheckCircle />}{tx('Confirm supply', '确认补给')}</ToolbarButton>
                </section>
                <aside className="operation-history"><h3>{tx('Inventory Preview', '背包预览')}</h3>{selectedInventory.length === 0 ? <p className="muted">{tx('Empty inventory', '背包为空')}</p> : selectedInventory.slice(0, 6).map((item, index) => <div key={`${item.item_id || item.id}-${index}`}><span>{item.emoji} {item.name} ×{item.quantity}</span><time>{item.category || 'item'}</time></div>)}</aside>
            </div>
        </main>
    );

    const renderEvents = () => (
        <main className="section-page">
            <div className="content-title"><div><h1>{tx('Events & Quests', '事件与任务')}</h1><p>{tx('Manage city events, bounty quests and resident participation.', '管理城市活动、悬赏任务与居民参与状态。')}</p></div></div>
            <div className="section-tabs"><button className={eventView === 'events' ? 'active' : ''} type="button" onClick={() => setEventView('events')}>{tx('Active events', '活跃事件')} {visibleEvents.length}</button><button className={eventView === 'quests' ? 'active' : ''} type="button" onClick={() => setEventView('quests')}>{tx('Bounty quests', '悬赏任务')} {activeQuestCount}</button></div>
            <section className="work-table">
                <div className="work-head"><span>{tx('Name', '名称')}</span><span>{tx('District', '所属分区')}</span><span>{tx('Time', '时间')}</span><span>{tx('Progress', '参与/进度')}</span><span>{tx('Status', '状态')}</span><span>{tx('Actions', '操作')}</span></div>
                {eventView === 'events' && visibleEvents.map((event) => {
                    const eventProgress = getTimedProgress(event);
                    return (
                        <div className="work-row" key={`event-${event.id}`}>
                            <strong>{event.emoji} {event.title}</strong><span>{getEventDistrictRef(event) || event.target_district || '-'}</span><span>{formatRemaining(event, tx)}</span><div className="work-progress"><i><b style={{ width: `${eventProgress}%` }} /></i><span>{eventProgress}%</span></div><span className="positive">{tx('Active', '进行中')}</span><div className="row-actions"><button type="button" onClick={() => deleteEvent(event.id)}><Trash2 /></button></div>
                        </div>
                    );
                })}
                {eventView === 'events' && !visibleEvents.length && <p className="muted table-empty">{tx('No active events.', '暂无活跃事件。')}</p>}
                {eventView === 'quests' && quests.map((quest) => {
                    const questProgress = getQuestProgress(quest);
                    const questStatusLabel = quest.is_completed ? tx('Completed', '已完成') : quest.claimed_by ? tx('Claimed', '已领取') : tx('Open', '待领取');
                    return (
                        <div className="work-row" key={`quest-${quest.id}`}>
                            <strong>{quest.emoji} {quest.title}</strong><span>{quest.target_district || '-'}</span><span>{quest.is_completed ? tx('Done', '已结束') : formatRemaining(quest, tx)}</span><div className="work-progress"><i><b style={{ width: `${questProgress.percent}%` }} /></i><span>{questProgress.label}</span></div><span className={quest.is_completed ? 'positive' : 'warning-text'}>{questStatusLabel}</span><div className="row-actions">{!quest.is_completed && !quest.claimed_by && <select onChange={(event) => { if (event.target.value) claimQuestForCharacter(quest.id, event.target.value); event.target.value = ''; }} defaultValue=""><option value="">{tx('Assign', '指派')}</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select>}{!quest.is_completed && quest.claimed_by && <button type="button" onClick={() => completeQuestAction(quest.id, quest.claimed_by)}><CheckCircle /></button>}<button type="button" onClick={() => deleteQuest(quest.id)}><Trash2 /></button></div>
                        </div>
                    );
                })}
                {eventView === 'quests' && !quests.length && <p className="muted table-empty">{tx('No bounty quests.', '暂无悬赏任务。')}</p>}
            </section>
        </main>
    );

    const renderMayor = () => (
        <main className="section-page mayor-page">
            <div className="content-title"><div><h1>{tx('Mayor AI', '市长 AI')}</h1><p>{tx('Configure automated decisions and run the Mayor manually.', '配置自动决策模型，查看决策依据并手动执行。')}</p></div><ToolbarButton primary onClick={runMayor} disabled={mayorRunning}>{mayorRunning ? <LoaderCircle className="spin" /> : <Play />}{tx('Run manually', '手动执行')}</ToolbarButton></div>
            <section className="mayor-console">
                <div className="mayor-form"><div className="ai-status"><Bot /><span><strong>{mayorEnabled ? tx('Mayor AI enabled', '市长 AI 已启用') : tx('Mayor AI disabled', '市长 AI 已停用')}</strong><small>{tx('Interval', '执行间隔')} {config.mayor_interval_hours || 6}h</small></span><span className="green-tag">{mayorEnabled ? tx('Running', '运行中') : tx('Paused', '已暂停')}</span></div><label><span>{tx('Decision interval', '决策间隔')}</span><input type="number" min="1" defaultValue={config.mayor_interval_hours || 6} onBlur={(event) => updateConfig('mayor_interval_hours', event.target.value)} /></label><label><span>{tx('Mayor model', '市长使用模型')}</span><select value={mayorModelMode} onChange={(event) => saveMayorModel(event.target.value)}><option value="auto">{tx('Auto-select character API', '自动选择有 API 的角色')}</option>{characters.filter(c => c.api_endpoint).map(c => <option key={c.id} value={c.id}>{c.name} - {c.model_name || tx('Unknown model', '未知模型')}</option>)}<option value="custom">{tx('Custom API', '手动填写 API')}</option></select></label>{mayorModelMode === 'custom' && <div className="custom-api-grid"><input value={customEndpoint} onChange={(event) => setCustomEndpoint(event.target.value)} placeholder="API endpoint" /><input value={customKey} type="password" onChange={(event) => setCustomKey(event.target.value)} placeholder="API key" /><input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="model" /><ToolbarButton onClick={saveCustomApi}><Save />{tx('Save API', '保存 API')}</ToolbarButton></div>}<label><span>{tx('Mayor Prompt', '市长 Prompt')}</span><textarea value={mayorPromptLocal} onChange={(event) => setMayorPromptLocal(event.target.value)} /></label><div className="mayor-actions"><ToolbarButton onClick={() => updateConfig('mayor_enabled', mayorEnabled ? '0' : '1')}><Power />{mayorEnabled ? tx('Disable Mayor', '关闭市长') : tx('Enable Mayor', '启用市长')}</ToolbarButton><ToolbarButton onClick={saveMayorPrompt}><Save />{tx('Save Prompt', '保存 Prompt')}</ToolbarButton></div></div>
                <aside className="decision-preview"><h3>{tx('Last result', '上次执行结果')}</h3>{mayorResult ? <pre>{JSON.stringify(mayorResult, null, 2)}</pre> : <p>{tx('No manual run result yet.', '暂无手动执行结果。')}</p>}<dl><div><dt>{tx('Events', '事件')}</dt><dd>{visibleEvents.length}</dd></div><div><dt>{tx('Quests', '任务')}</dt><dd>{activeQuestCount}</dd></div><div><dt>{tx('Model', '模型')}</dt><dd>{mayorModelMode}</dd></div></dl></aside>
            </section>
        </main>
    );

    const renderDanger = () => (
        <main className="section-page danger-page">
            <div className="content-title"><div><h1>{tx('Danger Zone', '危险操作')}</h1><p>{tx('These actions cannot be undone.', '这些操作不可撤销，只在明确确认后执行。')}</p></div></div>
            <section><div><Archive /><span><strong>{tx('Clear Mayor and character logs', '清空市长与角色活动日志')}</strong><small>{tx('Deletes activity logs without changing districts/items.', '删除所有日志记录，不影响分区、商品和角色状态。')}</small></span></div><button type="button" onClick={() => setDangerConfirm('logs')}><Trash2 />{tx('Clear logs', '清空日志')}</button></section>
            <section><div><Database /><span><strong>{tx('Wipe all city data', '彻底格式化商业街所有数据')}</strong><small>{tx('Deletes districts, items, events, quests and operation records.', '删除分区、商品、事件、任务和运营记录。')}</small></span></div><button type="button" onClick={() => setDangerConfirm('wipe')}><AlertTriangle />{tx('Wipe data', '格式化数据')}</button></section>
        </main>
    );

    return (
        <div className="city-manager-panel city-manager-redesign">
            {actionNotice?.message && <div className={`manager-toast ${actionNotice.kind === 'error' ? 'is-error' : ''}`}>{actionNotice.message}</div>}
            <div className="management-page">
                <ManagerNav active={activeManagerSection} setActive={setActiveManagerSection} tx={tx} isEn={isEn} />
                {activeManagerSection === 'overview' && renderOverview()}
                {activeManagerSection === 'districts' && renderDistricts()}
                {activeManagerSection === 'items' && renderItems()}
                {activeManagerSection === 'config' && renderConfig()}
                {activeManagerSection === 'residents' && renderResidents()}
                {activeManagerSection === 'events' && renderEvents()}
                {activeManagerSection === 'mayor' && renderMayor()}
                {activeManagerSection === 'danger' && renderDanger()}
            </div>

            {editingItem && (
                <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setEditingItem(null); }}>
                    <div className="form-modal">
                        <button className="modal-close" type="button" onClick={() => setEditingItem(null)}><X /></button>
                        <h2>{editingItem.id ? tx('Edit item', '编辑商品') : tx('New item', '新建商品')}</h2>
                        <div className="form-grid">
                            <label><span>ID</span><input value={editingItem.id} onChange={(event) => setEditingItem((current) => ({ ...current, id: event.target.value.toLowerCase().replace(/\s/g, '_') }))} /></label>
                            <label><span>{tx('Name', '名称')}</span><input value={editingItem.name} onChange={(event) => setEditingItem((current) => ({ ...current, name: event.target.value }))} /></label>
                            <label><span>{tx('Emoji', '表情')}</span><input value={editingItem.emoji} onChange={(event) => setEditingItem((current) => ({ ...current, emoji: event.target.value }))} /></label>
                            <label><span>{tx('Category', '分类')}</span><select value={editingItem.category} onChange={(event) => setEditingItem((current) => ({ ...current, category: event.target.value }))}><option value="food">{tx('Food', '食物')}</option><option value="gift">{tx('Gift', '礼物')}</option><option value="medicine">{tx('Medicine', '药品')}</option><option value="tool">{tx('Tool', '道具')}</option><option value="misc">{tx('Misc', '杂项')}</option></select></label>
                            <label className="wide"><span>{tx('Description', '描述')}</span><input value={editingItem.description} onChange={(event) => setEditingItem((current) => ({ ...current, description: event.target.value }))} /></label>
                            <label><span>{tx('Buy price', '购买价格')}</span><input type="number" value={editingItem.buy_price} onChange={(event) => setEditingItem((current) => ({ ...current, buy_price: Number(event.target.value) }))} /></label>
                            <label><span>{tx('Energy restore', '恢复体力')}</span><input type="number" value={editingItem.cal_restore} onChange={(event) => setEditingItem((current) => ({ ...current, cal_restore: Number(event.target.value) }))} /></label>
                            <label><span>{tx('Sold at', '售卖地点')}</span><input value={editingItem.sold_at} onChange={(event) => setEditingItem((current) => ({ ...current, sold_at: event.target.value }))} /></label>
                            <label><span>{tx('Stock', '库存')}</span><input type="number" value={editingItem.stock ?? -1} onChange={(event) => setEditingItem((current) => ({ ...current, stock: Number(event.target.value) }))} /></label>
                        </div>
                        <div className="modal-actions"><ToolbarButton onClick={() => setEditingItem(null)}>{tx('Cancel', '取消')}</ToolbarButton><ToolbarButton primary onClick={() => saveItem(editingItem)}><Save />{tx('Save', '保存')}</ToolbarButton></div>
                    </div>
                </div>
            )}

            {dangerConfirm && (
                <div className="modal-backdrop">
                    <div className="confirm-modal">
                        <button type="button" className="modal-close" onClick={() => setDangerConfirm(null)}><X /></button>
                        <AlertTriangle />
                        <h2>{dangerConfirm === 'wipe' ? tx('Confirm wiping city data?', '确认格式化商业街数据？') : tx('Confirm clearing logs?', '确认清空活动日志？')}</h2>
                        <p>{tx('This action cannot be undone.', '操作执行后无法恢复，请再次确认。')}</p>
                        <div><button type="button" onClick={() => setDangerConfirm(null)}>{tx('Cancel', '取消')}</button><button type="button" className="danger-confirm" onClick={executeDangerAction}>{tx('Confirm', '确认执行')}</button></div>
                    </div>
                </div>
            )}
        </div>
    );

}
