export function getTextDocumentStats(content) {
    const text = String(content || '');
    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.length ? normalized.split('\n') : [''];
    const words = normalized.trim() ? normalized.trim().split(/\s+/).length : 0;
    return {
        characters: text.length,
        lines: lines.length,
        words,
    };
}
