import {
    formatNumber,
    MEMORY_FOCUS_OPTIONS,
    optionLabel,
    MEMORY_TIER_OPTIONS,
    SOURCE_CONTEXT_OPTIONS,
    SCENE_TAG_OPTIONS,
} from '../memoryLabels.js';
import { X, Save } from 'lucide-react';

export function MemoryEditDialog({ editingMemory, tx, setEditingMemory, saveMemoryEditor, editSaving }) {
    return (
        <div className="memory-edit-overlay">
            <div className="memory-edit-modal">
                <div className="memory-edit-head">
                    <div>
                        <strong>{editingMemory.title}</strong>
                        <span>
                            {formatNumber(editingMemory.ids.length)} {tx('carrier records', '条承载记录')}
                        </span>
                    </div>
                    <button type="button" className="memory-edit-close" onClick={() => setEditingMemory(null)}>
                        <X size={16} />
                    </button>
                </div>
                <label>
                    <span>
                        {editingMemory.type === 'new'
                            ? tx('New Memory Content', '新版记忆内容')
                            : tx('Title / Summary', '标题/摘要')}
                    </span>
                    <textarea
                        value={editingMemory.summary}
                        onChange={(e) => setEditingMemory((prev) => ({ ...prev, summary: e.target.value }))}
                    />
                </label>
                {editingMemory.type !== 'new' && (
                    <label>
                        <span>{tx('Details', '详细内容')}</span>
                        <textarea
                            value={editingMemory.content}
                            onChange={(e) => setEditingMemory((prev) => ({ ...prev, content: e.target.value }))}
                        />
                    </label>
                )}
                <div className="memory-edit-grid">
                    <label>
                        <span>{tx('Semantic Category', '语义分类')}</span>
                        <select
                            value={editingMemory.memory_focus}
                            onChange={(e) => setEditingMemory((prev) => ({ ...prev, memory_focus: e.target.value }))}
                        >
                            {MEMORY_FOCUS_OPTIONS.map(([value, label]) => (
                                <option value={value} key={value}>
                                    {optionLabel(value, label)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>{tx('Tier', '层级')}</span>
                        <select
                            value={editingMemory.memory_tier}
                            onChange={(e) => setEditingMemory((prev) => ({ ...prev, memory_tier: e.target.value }))}
                        >
                            {MEMORY_TIER_OPTIONS.map(([value, label]) => (
                                <option value={value} key={value}>
                                    {optionLabel(value, label)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>{tx('Source Scene', '来源场景')}</span>
                        <select
                            value={editingMemory.source_context}
                            onChange={(e) => setEditingMemory((prev) => ({ ...prev, source_context: e.target.value }))}
                        >
                            {SOURCE_CONTEXT_OPTIONS.map(([value, label]) => (
                                <option value={value} key={value}>
                                    {optionLabel(value, label)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>{tx('Scene Detail', '场景细分')}</span>
                        <select
                            value={editingMemory.scene_tag}
                            onChange={(e) => setEditingMemory((prev) => ({ ...prev, scene_tag: e.target.value }))}
                        >
                            {SCENE_TAG_OPTIONS.map(([value, label]) => (
                                <option value={value} key={value}>
                                    {optionLabel(value, label)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>
                            {tx('Importance', '重要性')} {editingMemory.importance}
                        </span>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={editingMemory.importance}
                            onChange={(e) =>
                                setEditingMemory((prev) => ({ ...prev, importance: Number(e.target.value) }))
                            }
                        />
                    </label>
                </div>
                <div className="memory-edit-actions">
                    <button type="button" className="memory-lib-button ghost" onClick={() => setEditingMemory(null)}>
                        {tx('Cancel', '取消')}
                    </button>
                    <button
                        type="button"
                        className="memory-lib-button"
                        onClick={saveMemoryEditor}
                        disabled={editSaving}
                    >
                        <Save size={15} /> {editSaving ? tx('Saving', '保存中') : tx('Save Changes', '保存修改')}
                    </button>
                </div>
            </div>
        </div>
    );
}
