export function getRecycleBinEntryType(entry, lang) {
    return entry?.item?.kind === 'folder'
        ? lang === 'en'
            ? 'File folder'
            : '文件夹'
        : lang === 'en'
          ? 'Text document'
          : '文本文档';
}

export function getRecycleBinEntrySize(entry, lang) {
    const item = entry?.item;
    if (!item) return lang === 'en' ? '0 KB' : '0 KB';
    const rawSize =
        item.kind === 'text'
            ? Math.max(1, Math.ceil(String(item.content || '').length / 1024))
            : Math.max(1, (item.folderAppIds || []).length || 1);
    return `${rawSize} KB`;
}

export function getRecycleBinDateLabel(timestamp, lang) {
    const value = Number(timestamp) || Date.now();
    return new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
