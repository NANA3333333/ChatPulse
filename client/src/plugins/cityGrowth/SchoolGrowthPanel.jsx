import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, ToggleLeft, ToggleRight, X } from 'lucide-react';
import AvatarWithFrame from '../../components/AvatarWithFrame';
import { defaultAvatarUrl, resolveAvatarUrl } from '../../utils/avatar';
import { useLanguage } from '../../LanguageContext';

const FALLBACK_AVATAR = defaultAvatarUrl('User');
const avatarSrc = (url, apiUrl) => resolveAvatarUrl(url, apiUrl) || FALLBACK_AVATAR;

const sectionStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    marginBottom: '16px'
};

const headerStyle = {
    padding: '12px 18px',
    borderBottom: '1px solid #eee',
    background: 'linear-gradient(to right, #f8f9fa, #fff)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const buttonStyle = (background = '#ff9800') => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: background,
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600
});

const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '13px',
    boxSizing: 'border-box'
};

const labelStyle = {
    fontSize: '12px',
    color: '#667085',
    marginBottom: '4px',
    display: 'block',
    fontWeight: 600
};

const EMPTY_COURSE = {
    id: '',
    name: '',
    emoji: '📘',
    description: '',
    category: 'general',
    prompt_effect_basic: '',
    prompt_effect_advanced: '',
    sort_order: 0,
    is_enabled: 1
};

function getTierMeta(tier, lang = 'zh') {
    const isEn = lang === 'en';
    switch (tier) {
        case 'mastered':
            return { label: isEn ? 'Mastered' : '成型', color: '#2e7d32', bg: '#e8f5e9' };
        case 'advanced':
            return { label: isEn ? 'Advanced' : '熟练', color: '#1565c0', bg: '#e3f2fd' };
        case 'basic':
            return { label: isEn ? 'Basic' : '入门', color: '#ef6c00', bg: '#fff3e0' };
        case 'intro':
            return { label: isEn ? 'Intro' : '起步', color: '#8d6e63', bg: '#efebe9' };
        default:
            return { label: isEn ? 'Not started' : '未学', color: '#90a4ae', bg: '#eceff1' };
    }
}

function formatSchoolProgress(progress, lang = 'zh') {
    const isEn = lang === 'en';
    const learned = (progress || [])
        .filter((course) => Number(course.mastery || 0) > 0)
        .sort((a, b) => Number(b.mastery || 0) - Number(a.mastery || 0))
        .slice(0, 2);
    if (!learned.length) return isEn ? 'School courses: not started' : '学校课程：暂未开始';
    return `${isEn ? 'School courses' : '学校课程'}：${learned.map((course) => `${course.emoji || '📘'}${course.name} ${course.mastery}/100`).join(' / ')}`;
}

function formatLastStudied(timestamp, lang = 'zh') {
    const value = Number(timestamp || 0);
    if (!value) return lang === 'en' ? 'Not studied yet' : '尚未学习';
    return new Date(value).toLocaleString();
}

function formatPromptEffect(value, lang = 'zh') {
    const text = String(value || '').trim();
    return text || (lang === 'en' ? 'Not set' : '未设置');
}

export default function SchoolGrowthPanel({ apiUrl, headers }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const tx = useCallback((en, zh) => (isEn ? en : zh), [isEn]);
    const [courses, setCourses] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [editingCourse, setEditingCourse] = useState(null);
    const authHeader = headers?.Authorization;

    const fetchGrowth = useCallback(async () => {
        try {
            const [courseRes, charRes] = await Promise.all([
                fetch(`${apiUrl}/city-growth/courses`, { headers }),
                fetch(`${apiUrl}/city-growth/characters`, { headers })
            ]);
            const [courseData, charData] = await Promise.all([courseRes.json(), charRes.json()]);
            if (courseData.success) setCourses(courseData.courses || []);
            if (charData.success) setCharacters(charData.characters || []);
        } catch (err) {
            console.error('SchoolGrowthPanel Error:', err);
        }
    }, [apiUrl, headers]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (cancelled) return;
            await fetchGrowth();
        };
        load();
        const interval = setInterval(load, 5000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [fetchGrowth, authHeader]);

    const sortedCharacters = useMemo(() => {
        return [...characters].sort((a, b) => {
            const avgDelta = Number(b.school_summary?.average_mastery || 0) - Number(a.school_summary?.average_mastery || 0);
            if (avgDelta !== 0) return avgDelta;
            return Number(b.school_summary?.studied_count || 0) - Number(a.school_summary?.studied_count || 0);
        });
    }, [characters]);

    const courseStats = useMemo(() => {
        return courses.map((course) => {
            const progressRows = characters
                .map((character) => (character.school_progress || []).find((row) => row.course_id === course.id))
                .filter(Boolean);
            const unlocked = progressRows.filter((row) => Number(row.mastery || 0) >= 40).length;
            const active = progressRows.filter((row) => Number(row.mastery || 0) > 0).length;
            const average = progressRows.length
                ? Math.round(progressRows.reduce((sum, row) => sum + Number(row.mastery || 0), 0) / progressRows.length)
                : 0;
            return {
                id: course.id,
                active,
                unlocked,
                average
            };
        });
    }, [characters, courses]);

    const getCourseMastery = (character, courseId) => {
        const progress = character.school_progress || [];
        return progress.find((course) => course.course_id === courseId) || null;
    };

    const saveCourse = async (course) => {
        const payload = {
            ...course,
            id: String(course.id || '').trim().toLowerCase().replace(/\s+/g, '_'),
            name: String(course.name || '').trim(),
            emoji: String(course.emoji || '📘').trim() || '📘',
            description: String(course.description || '').trim(),
            category: String(course.category || 'general').trim() || 'general',
            prompt_effect_basic: String(course.prompt_effect_basic || '').trim(),
            prompt_effect_advanced: String(course.prompt_effect_advanced || '').trim(),
            sort_order: Number(course.sort_order || 0) || 0,
            is_enabled: Number(course.is_enabled ?? 1) === 1 ? 1 : 0
        };
        if (!payload.id || !payload.name) {
            window.alert(tx('Course ID and name are required.', '课程 ID 和名称不能为空。'));
            return;
        }
        const res = await fetch(`${apiUrl}/city-growth/courses`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
            window.alert(data?.error || tx('Failed to save course', '保存课程失败'));
            return;
        }
        setEditingCourse(null);
        fetchGrowth();
    };

    const toggleCourse = async (courseId) => {
        const res = await fetch(`${apiUrl}/city-growth/courses/${courseId}/toggle`, {
            method: 'PATCH',
            headers
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
            window.alert(data?.error || tx('Failed to toggle course status', '切换课程状态失败'));
            return;
        }
        fetchGrowth();
    };

    return (
        <div style={sectionStyle}>
            <div style={headerStyle}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>{tx('School Courses', '学校课程')}</h3>
                    <div style={{ fontSize: '12px', color: '#98a2b3', marginTop: '4px' }}>
                        {tx('Manage courses, review character progress, and edit prompt bonuses.', '这里可以统一管理课程、查看角色学习进度，以及编辑课程的 prompt 加成。')}
                    </div>
                </div>
                <button style={buttonStyle('#4caf50')} onClick={() => setEditingCourse({ ...EMPTY_COURSE })}>
                    <Plus size={14} /> {tx('Add Course', '新增课程')}
                </button>
            </div>

            <div style={{ padding: '14px 16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {courses.map((course) => {
                        const stat = courseStats.find((item) => item.id === course.id) || { active: 0, unlocked: 0, average: 0 };
                        return (
                            <div
                                key={course.id}
                                style={{
                                    border: '1px solid #eceff3',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    backgroundColor: Number(course.is_enabled || 0) === 1 ? '#fff' : '#fafafa',
                                    opacity: Number(course.is_enabled || 0) === 1 ? 1 : 0.6
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#344054' }}>
                                            {course.emoji || '📘'} {course.name}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#98a2b3', marginTop: '2px' }}>
                                            {course.id} / {course.category || 'general'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => setEditingCourse({ ...EMPTY_COURSE, ...course })} style={{ ...buttonStyle('#2196f3'), padding: '5px 8px' }}>
                                            <Edit3 size={12} />
                                        </button>
                                        <button onClick={() => toggleCourse(course.id)} style={{ ...buttonStyle(Number(course.is_enabled || 0) === 1 ? '#ff9800' : '#9e9e9e'), padding: '5px 8px' }}>
                                            {Number(course.is_enabled || 0) === 1 ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: '#667085', marginTop: '8px', minHeight: '34px' }}>
                                    {course.description || tx('No description yet', '暂无描述')}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', backgroundColor: '#f2f4f7', color: '#475467' }}>
                                        {tx('Studied by', '已学习')} {stat.active} {tx('people', '人')}
                                    </span>
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', backgroundColor: '#ecfdf3', color: '#027a48' }}>
                                        {tx('Basic+', '入门+')} {stat.unlocked} {tx('people', '人')}
                                    </span>
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', backgroundColor: '#eff8ff', color: '#175cd3' }}>
                                        {tx('Average', '平均')} {stat.average}/100
                                    </span>
                                </div>
                                <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
                                    <div style={{ fontSize: '11px', color: '#475467' }}>
                                        <strong>{tx('40-point bonus:', '40分加成：')}</strong>{formatPromptEffect(course.prompt_effect_basic, lang)}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#475467' }}>
                                        <strong>{tx('70-point bonus:', '70分加成：')}</strong>{formatPromptEffect(course.prompt_effect_advanced, lang)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {sortedCharacters.map((character) => {
                    const summary = character.school_summary || {};
                    return (
                        <div key={character.id} style={{ border: '1px solid #eee', borderRadius: '12px', padding: '14px', backgroundColor: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <AvatarWithFrame
                                    size={38}
                                    frame={character.avatar_frame}
                                    src={avatarSrc(character.avatar, apiUrl)}
                                    fallbackSrc={FALLBACK_AVATAR}
                                    alt=""
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#344054' }}>{character.name}</div>
                                    <div style={{ fontSize: '12px', color: '#667085', marginTop: '2px' }}>
                                        {formatSchoolProgress(character.school_progress, lang)}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', backgroundColor: '#f2f4f7', color: '#344054' }}>
                                    {tx('Studying', '学习中')} {summary.studied_count || 0} {tx('courses', '门')}
                                </span>
                                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', backgroundColor: '#eff8ff', color: '#175cd3' }}>
                                    {tx('Average mastery', '平均掌握')} {summary.average_mastery || 0}/100
                                </span>
                                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', backgroundColor: '#ecfdf3', color: '#027a48' }}>
                                    {tx('Strongest course', '最强课程')} {summary.strongest_course_emoji || '📘'}{summary.strongest_course_name || tx('None', '暂无')} {summary.strongest_mastery || 0}/100
                                </span>
                                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', backgroundColor: '#fff3e0', color: '#b54708' }}>
                                    {tx('Last studied', '最近学习')} {formatLastStudied(summary.latest_studied_at, lang)}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
                                {courses.map((course) => {
                                    const row = getCourseMastery(character, course.id);
                                    const mastery = Number(row?.mastery || 0);
                                    const tierMeta = getTierMeta(row?.tier || 'none', lang);
                                    return (
                                        <div key={`${character.id}-${course.id}`} style={{ border: '1px solid #f1f3f5', borderRadius: '10px', padding: '10px', backgroundColor: '#fafafa' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#344054' }}>
                                                    {course.emoji || '📘'} {course.name}
                                                </div>
                                                <div style={{ fontSize: '11px', color: tierMeta.color, fontWeight: 700 }}>
                                                    {mastery}/100
                                                </div>
                                            </div>
                                            <div style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '999px', overflow: 'hidden', marginTop: '8px' }}>
                                                <div style={{ width: `${Math.max(0, Math.min(100, mastery))}%`, height: '100%', backgroundColor: tierMeta.color, borderRadius: '999px' }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '999px', backgroundColor: tierMeta.bg, color: tierMeta.color, fontWeight: 700 }}>
                                                    {tierMeta.label}
                                                </span>
                                                <span style={{ fontSize: '10px', color: '#98a2b3' }}>
                                                    {formatLastStudied(row?.last_studied_at, lang)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingCourse && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.42)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingCourse(null);
                    }}
                >
                    <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '560px', boxSizing: 'border-box', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>{editingCourse.id ? (isEn ? `Edit course: ${editingCourse.name}` : `编辑课程：${editingCourse.name}`) : tx('Add Course', '新增课程')}</h3>
                            <button onClick={() => setEditingCourse(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={labelStyle}>{tx('Course ID', '课程 ID')}</label>
                                <input style={inputStyle} value={editingCourse.id} onChange={(e) => setEditingCourse((prev) => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>{tx('Course Name', '课程名称')}</label>
                                <input style={inputStyle} value={editingCourse.name} onChange={(e) => setEditingCourse((prev) => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>{tx('Emoji', '表情')}</label>
                                <input style={inputStyle} value={editingCourse.emoji || '📘'} onChange={(e) => setEditingCourse((prev) => ({ ...prev, emoji: e.target.value }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>{tx('Category', '分类')}</label>
                                <input style={inputStyle} value={editingCourse.category || 'general'} onChange={(e) => setEditingCourse((prev) => ({ ...prev, category: e.target.value }))} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>{tx('Description', '描述')}</label>
                                <input style={inputStyle} value={editingCourse.description || ''} onChange={(e) => setEditingCourse((prev) => ({ ...prev, description: e.target.value }))} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>{tx('40-point bonus', '40分加成')}</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: '78px', resize: 'vertical' }}
                                    value={editingCourse.prompt_effect_basic || ''}
                                    placeholder={tx('Describe what changes in the prompt after the character reaches 40 points.', '写角色学到 40 分之后会在 prompt 里体现出的变化')}
                                    onChange={(e) => setEditingCourse((prev) => ({ ...prev, prompt_effect_basic: e.target.value }))}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>{tx('70-point bonus', '70分加成')}</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: '78px', resize: 'vertical' }}
                                    value={editingCourse.prompt_effect_advanced || ''}
                                    placeholder={tx('Describe the steadier, more skilled behavior after the character reaches 70 points.', '写角色学到 70 分之后更稳定、更熟练的变化')}
                                    onChange={(e) => setEditingCourse((prev) => ({ ...prev, prompt_effect_advanced: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>{tx('Sort Order', '排序')}</label>
                                <input style={inputStyle} type="number" value={editingCourse.sort_order || 0} onChange={(e) => setEditingCourse((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>{tx('Status', '状态')}</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={() => setEditingCourse((prev) => ({ ...prev, is_enabled: 1 }))} style={{ ...buttonStyle(Number(editingCourse.is_enabled || 0) === 1 ? '#4caf50' : '#9e9e9e'), flex: 1, justifyContent: 'center' }}>{tx('Enabled', '启用')}</button>
                                    <button type="button" onClick={() => setEditingCourse((prev) => ({ ...prev, is_enabled: 0 }))} style={{ ...buttonStyle(Number(editingCourse.is_enabled || 0) === 0 ? '#f44336' : '#9e9e9e'), flex: 1, justifyContent: 'center' }}>{tx('Disabled', '停用')}</button>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button style={buttonStyle('#9e9e9e')} onClick={() => setEditingCourse(null)}>{tx('Cancel', '取消')}</button>
                            <button style={buttonStyle('#4caf50')} onClick={() => saveCourse(editingCourse)}>{tx('Save Course', '保存课程')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
