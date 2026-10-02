import { Activity, MessageSquare, CalendarDays, Heart, House, FileText, Wallet } from 'lucide-react';

export function CharacterBehaviorSettings({ lang, activeCharacterDraft, updateCharacterDraft }) {
    return (
        <div className="settings-control-form-stack">
            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span>
                            <Activity size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Background behavior' : '角色会主动做什么？'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'These switches affect background actions, city participation, and API usage.'
                                    : '这些开关决定后台行为、城市参与和 API 消耗。'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="settings-control-toggle-grid">
                    {[
                        [
                            'sys_proactive',
                            lang === 'en' ? 'Proactive messages' : '主动发消息',
                            lang === 'en' ? 'The character may start private chats.' : '角色会在合适时主动开启私聊。',
                            <MessageSquare size={16} />,
                        ],
                        [
                            'sys_timer',
                            lang === 'en' ? 'Timer checks' : '定时检查',
                            lang === 'en' ? 'Background timer judges when to act.' : '按间隔判断是否需要行动。',
                            <CalendarDays size={16} />,
                        ],
                        [
                            'sys_pressure',
                            lang === 'en' ? 'Pressure and body state' : '压力与生理状态',
                            lang === 'en' ? 'Energy, sleep, and pressure can change.' : '启用体力、睡眠和压力变化。',
                            <Activity size={16} />,
                        ],
                        [
                            'sys_jealousy',
                            lang === 'en' ? 'Jealousy reactions' : '嫉妒反应',
                            lang === 'en' ? 'Relationship system may create jealousy.' : '允许关系系统产生嫉妒情绪。',
                            <Heart size={16} />,
                        ],
                        [
                            'sys_survival',
                            lang === 'en' ? 'City activity' : '参与商业街',
                            lang === 'en'
                                ? 'Character joins city actions and social events.'
                                : '角色会在城市中自主行动和社交。',
                            <House size={16} />,
                        ],
                        [
                            'llm_debug_capture',
                            lang === 'en' ? 'LLM debug capture' : '记录 LLM 调试',
                            lang === 'en'
                                ? 'Keep recent prompt and response diagnostics.'
                                : '保留最近的提示词与回复诊断。',
                            <FileText size={16} />,
                        ],
                    ].map(([field, title, detail, icon]) => {
                        const on = Number(activeCharacterDraft[field] ?? 1) !== 0;
                        return (
                            <label className="settings-control-toggle-row" key={field}>
                                <span>{icon}</span>
                                <div>
                                    <strong>{title}</strong>
                                    <small>{detail}</small>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={(event) =>
                                        updateCharacterDraft({ [field]: event.target.checked ? 1 : 0 })
                                    }
                                />
                            </label>
                        );
                    })}
                </div>
            </section>

            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span className="pink">
                            <CalendarDays size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Proactive rhythm and context' : '主动消息节奏与上下文'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Control how often the character checks and how much recent content they can see.'
                                    : '控制角色后台检查频率，以及每次回复能看到多少最近信息。'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="settings-control-form-grid two">
                    <label>
                        <span>{lang === 'en' ? 'Min interval' : '最短间隔'}</span>
                        <div className="settings-control-number-field">
                            <input
                                type="number"
                                min="0.1"
                                max="120"
                                step="0.1"
                                value={activeCharacterDraft.interval_min ?? 10}
                                onChange={(event) =>
                                    updateCharacterDraft({ interval_min: Number(event.target.value || 0.1) })
                                }
                            />
                            <span>{lang === 'en' ? 'min' : '分钟'}</span>
                        </div>
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Max interval' : '最长间隔'}</span>
                        <div className="settings-control-number-field">
                            <input
                                type="number"
                                min="0.1"
                                max="120"
                                step="0.1"
                                value={activeCharacterDraft.interval_max ?? 120}
                                onChange={(event) =>
                                    updateCharacterDraft({ interval_max: Number(event.target.value || 0.1) })
                                }
                            />
                            <span>{lang === 'en' ? 'min' : '分钟'}</span>
                        </div>
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Private context' : '私聊上下文'}</span>
                        <div className="settings-control-number-field">
                            <input
                                type="number"
                                min="0"
                                max="200"
                                value={activeCharacterDraft.context_msg_limit ?? 60}
                                onChange={(event) =>
                                    updateCharacterDraft({ context_msg_limit: Number(event.target.value || 0) })
                                }
                            />
                            <span>{lang === 'en' ? 'messages' : '条消息'}</span>
                        </div>
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'City encounters' : '商业街相遇'}</span>
                        <select
                            value={Number(activeCharacterDraft.sys_city_social ?? 1) !== 0 ? '1' : '0'}
                            onChange={(event) => updateCharacterDraft({ sys_city_social: Number(event.target.value) })}
                        >
                            <option value="1">{lang === 'en' ? 'Allowed' : '允许参与'}</option>
                            <option value="0">{lang === 'en' ? 'Disabled' : '暂停参与'}</option>
                        </select>
                    </label>
                </div>
            </section>

            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span className="mint">
                            <Wallet size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Wallet and state' : '钱包与状态'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Editable numeric state used by chat, economy, and city systems.'
                                    : '聊天、经济和城市系统会读取这些数值状态。'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="settings-control-form-grid three">
                    {[
                        ['wallet', lang === 'en' ? 'Wallet' : '钱包', 0, 1000000000],
                        ['affinity', lang === 'en' ? 'Affinity' : '好感', 0, 100],
                        ['energy', lang === 'en' ? 'Energy' : '体力', 0, 100],
                        ['calories', lang === 'en' ? 'Calories' : '卡路里', 0, 4000],
                        ['stress', lang === 'en' ? 'Stress' : '压力', 0, 100],
                        ['pressure_level', lang === 'en' ? 'Pressure level' : '压力等级', 0, 4],
                        ['sleep_debt', lang === 'en' ? 'Sleep debt' : '睡眠欠债', 0, 1000],
                        ['sleep_pressure', lang === 'en' ? 'Sleep pressure' : '睡眠压力', 0, 100],
                        ['mood', lang === 'en' ? 'Mood' : '心情', 0, 100],
                    ].map(([field, label, min, max]) => (
                        <label key={field}>
                            <span>{label}</span>
                            <input
                                type="number"
                                min={min}
                                max={max}
                                value={activeCharacterDraft[field] ?? 0}
                                onChange={(event) => updateCharacterDraft({ [field]: Number(event.target.value || 0) })}
                            />
                        </label>
                    ))}
                </div>
            </section>
        </div>
    );
}
