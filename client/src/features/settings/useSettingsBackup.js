import { useState } from 'react';

export function useSettingsBackup({ lang, apiUrl, onCharactersUpdate }) {
    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirmText, setWipeConfirmText] = useState('');
    const handleImportDatabase = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (
            !window.confirm(
                lang === 'en'
                    ? 'Warning! This will overwrite your current account archive, including characters, chats, memories, and uploaded assets. Continue?'
                    : '警告：这将覆盖你当前账号的整套存档，包括角色、聊天、记忆和上传资源。是否继续？',
            )
        ) {
            event.target.value = null;
            return;
        }

        const cleanApiUrl = apiUrl.replace(/\/api\/?$/, '');
        const formData = new FormData();
        formData.append('db_file', file);
        try {
            const res = await fetch(`${cleanApiUrl}/api/system/import`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                alert(
                    data.warnings?.length
                        ? (lang === 'en' ? 'Archive restored. Some search indexes or background tasks could not be restarted; check memory maintenance after refresh.' : '存档已恢复，但部分记忆索引或后台任务未能恢复；刷新后请检查记忆维护状态。')
                        : lang === 'en'
                        ? 'Backup restored and memory indexes rebuilt. The page will refresh in a few seconds.'
                        : '存档恢复完成，记忆索引也已重建。页面将在几秒后自动刷新。',
                );
                setTimeout(() => window.location.reload(), 3000);
            } else {
                alert(
                    (lang === 'en' ? 'Failed to restore: ' : '恢复失败：') +
                        (data.error || (lang === 'en' ? 'Unknown error' : '未知错误')),
                );
            }
        } catch (e) {
            console.error('Import Error:', e);
            alert(lang === 'en' ? 'Upload failed.' : '上传失败。');
        } finally {
            event.target.value = null;
        }
    };

    const handleExportDatabase = async () => {
        try {
            const res = await fetch(`${apiUrl}/system/export`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || `Export failed with status ${res.status}`);
            }

            const disposition = res.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
            const filename = filenameMatch ? filenameMatch[1] : 'chatpulse_backup.zip';
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.href = objectUrl;
            downloadAnchorNode.download = filename;
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(objectUrl);
            const now = Date.now();
            localStorage.setItem('cp_last_full_backup_at', String(now));
        } catch (e) {
            console.error('Export Error:', e);
            alert(lang === 'en' ? `Backup download failed: ${e.message}` : `备份下载失败：${e.message}`);
        }
    };

    const handleSystemWipe = async (skipPrompt = false) => {
        if (
            !skipPrompt &&
            !window.confirm(
                lang === 'en'
                    ? 'DANGER: This will permanently wipe ALL characters, chats, and memories. Are you absolutely sure?'
                    : '危险：这将永久清空所有角色、聊天、群聊和记忆。你确定要执行吗？',
            )
        )
            return;

        // Double check
        if (
            !skipPrompt &&
            !window.confirm(
                lang === 'en' ? 'Final confirmation: Wipe everything?' : '最后一次确认：真的要抹除所有数据吗？',
            )
        )
            return;

        try {
            const res = await fetch(`${apiUrl}/system/wipe`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            const data = await res.json();
            if (data.success) {
                alert(lang === 'en' ? 'All data wiped successfully.' : '所有数据已成功清空。');
                if (onCharactersUpdate) onCharactersUpdate();
                window.location.reload();
            } else {
                alert(
                    (lang === 'en' ? 'Wipe failed: ' : '清空失败：') +
                        (data.error || (lang === 'en' ? 'Unknown error' : '未知错误')),
                );
            }
        } catch (e) {
            console.error('Wipe Error:', e);
            alert(lang === 'en' ? 'Wipe failed.' : '清空失败。');
        }
    };

    return {
        handleExportDatabase,
        handleImportDatabase,
        setWipeModalOpen,
        wipeModalOpen,
        wipeConfirmText,
        setWipeConfirmText,
        handleSystemWipe,
    };
}
