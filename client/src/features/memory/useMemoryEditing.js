import { useState } from 'react';
import { formatNumber } from './memoryLabels.js';

export function useMemoryEditing({ tx, apiUrl, headers, setNotice, loadData }) {
    const [deletingIds, setDeletingIds] = useState([]);
    const [editingMemory, setEditingMemory] = useState(null);
    const [sourceViewer, setSourceViewer] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const openMemoryEditor = ({ type, item, ids }) => {
        const safeIds = (Array.isArray(ids) ? ids : [item?.id]).filter(Boolean);
        setEditingMemory({
            type,
            ids: safeIds,
            character_id: item?.character_id || '',
            title: type === 'new' ? tx('Edit New Memory', '编辑新版记忆') : tx('Edit Memory Entry', '编辑记忆条目'),
            summary: type === 'new' ? item?.summary || item?.text || '' : item?.text || '',
            content: type === 'new' ? item?.summary || item?.text || '' : item?.text || '',
            memory_focus: item?.memory_focus || 'general',
            memory_tier: item?.memory_tier || 'ambient',
            importance: Number(item?.importance || 5),
            source_context: item?.source_context || item?.source_contexts?.[0] || 'unknown',
            scene_tag: item?.scene_tag || item?.scene_tags?.[0] || 'other',
        });
    };

    const saveMemoryEditor = async () => {
        if (!editingMemory?.ids?.length) return;
        setEditSaving(true);
        try {
            const payload = {
                memory_focus: editingMemory.memory_focus,
                memory_tier: editingMemory.memory_tier,
                importance: Number(editingMemory.importance || 5),
                source_context: editingMemory.source_context,
                scene_tag: editingMemory.scene_tag,
            };
            if (editingMemory.type === 'new') {
                payload.consolidation_summary = editingMemory.summary;
            } else {
                payload.summary = editingMemory.summary;
                payload.content = editingMemory.content || editingMemory.summary;
                payload.event = editingMemory.summary;
            }
            const res = await fetch(`${apiUrl}/memories/bulk`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ ids: editingMemory.ids, patch: payload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || tx('Save failed', '保存失败'));
            setNotice(
                tx(
                    `Saved edits to ${formatNumber(data.updated || editingMemory.ids.length)} memories.`,
                    `已保存 ${formatNumber(data.updated || editingMemory.ids.length)} 条记忆修改。`,
                ),
            );
            setEditingMemory(null);
            await loadData();
        } catch (e) {
            alert(tx(`Failed to save memory: ${e.message}`, `保存记忆失败：${e.message}`));
        } finally {
            setEditSaving(false);
        }
    };

    const openSourceViewer = async ({ item, ids }) => {
        const safeIds = Array.from(
            new Set((Array.isArray(ids) ? ids : [ids]).map((id) => Number(id || 0)).filter((id) => id > 0)),
        );
        if (!safeIds.length) {
            setSourceViewer({
                item,
                loading: false,
                data: null,
                error: tx(
                    'This memory has no carrier-card id, so source tracing cannot continue.',
                    '这条记忆没有承载卡片 id，无法继续反查原文。',
                ),
            });
            return;
        }
        setSourceViewer({ item, loading: true, data: null, error: '' });
        try {
            const query = new URLSearchParams({ ids: safeIds.join(',') });
            const res = await fetch(`${apiUrl}/memory-source?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success)
                throw new Error(data.error || tx('Failed to read source text', '读取来源原文失败'));
            setSourceViewer({ item, loading: false, data, error: '' });
        } catch (e) {
            setSourceViewer({
                item,
                loading: false,
                data: null,
                error: e.message || tx('Failed to read source text', '读取来源原文失败'),
            });
        }
    };

    const deleteMemoryItems = async ({ type, item, ids }) => {
        const safeIds = Array.from(
            new Set((Array.isArray(ids) ? ids : [item?.id]).map((id) => Number(id || 0)).filter((id) => id > 0)),
        );
        if (!safeIds.length) return;
        const label =
            type === 'new'
                ? tx(
                      `${safeIds.length} carrier cards for this new memory`,
                      `这条新版记忆的 ${safeIds.length} 条承载卡片`,
                  )
                : `#${item?.id || safeIds[0]}`;
        const isManualForget = item?.forgetting_stage === 'expired';
        const actionText = isManualForget ? tx('permanently forget', '彻底遗忘') : tx('delete', '删除');
        const confirmText = isManualForget
            ? tx(
                  `Permanently forget ${label}? It has passed the forgetting grace period and will be removed from the memory library and RAG index.`,
                  `确定彻底遗忘 ${label} 吗？它已经过遗忘缓冲期，操作后会从记忆库和 RAG 索引里移除。`,
              )
            : tx(
                  `Delete ${label}? It will be removed from the memory library and RAG index.`,
                  `确定删除 ${label} 吗？删除后会从记忆库和 RAG 索引里移除。`,
              );
        if (!window.confirm(confirmText)) return;
        setDeletingIds((prev) => Array.from(new Set([...prev, ...safeIds])));
        setNotice(
            tx(
                `${actionText} ${formatNumber(safeIds.length)} carrier cards and matching RAG index entries...`,
                `正在${actionText} ${formatNumber(safeIds.length)} 条承载卡片和对应 RAG 索引...`,
            ),
        );
        try {
            const res = await fetch(`${apiUrl}/memories/bulk`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ ids: safeIds }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || tx('Delete failed', '删除失败'));
            const indexWarning =
                data.index_deleted === false
                    ? tx(
                          '; vector index service is unavailable, so leftover index entries will be cleaned on the next index repair/rebuild',
                          '；但当前向量索引服务不可用，索引残留会在下次索引修复/重建时清理',
                      )
                    : tx(', and matching RAG index entries were removed', '，并移除对应 RAG 索引');
            setNotice(
                tx(
                    `${actionText} completed for ${formatNumber(data.deleted || 0)} / ${formatNumber(safeIds.length)} carrier cards${indexWarning}. Refreshing list.`,
                    `已${actionText} ${formatNumber(data.deleted || 0)} / ${formatNumber(safeIds.length)} 条承载卡片${indexWarning}。列表正在刷新。`,
                ),
            );
            await loadData();
        } catch (e) {
            alert(tx(`Failed to ${actionText} memory: ${e.message}`, `${actionText}记忆失败：${e.message}`));
        } finally {
            setDeletingIds((prev) => prev.filter((id) => !safeIds.includes(Number(id))));
        }
    };

    return {
        editingMemory,
        setEditingMemory,
        saveMemoryEditor,
        editSaving,
        sourceViewer,
        setSourceViewer,
        openSourceViewer,
        openMemoryEditor,
        deleteMemoryItems,
        deletingIds,
    };
}
