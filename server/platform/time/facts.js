function getLocalDateTimeFacts(input = new Date()) {
    const date = input instanceof Date ? input : new Date(input);
    const fallbackWeekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const parts = {};
    try {
        for (const part of new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).formatToParts(date)) {
            if (part.type !== 'literal') parts[part.type] = part.value;
        }
    } catch (e) {
        // Intl can fail in stripped-down runtimes; fall back to local Date fields.
    }

    const year = parts.year || String(date.getFullYear()).padStart(4, '0');
    const month = parts.month || String(date.getMonth() + 1).padStart(2, '0');
    const day = parts.day || String(date.getDate()).padStart(2, '0');
    const hour = parts.hour || String(date.getHours()).padStart(2, '0');
    const minute = parts.minute || String(date.getMinutes()).padStart(2, '0');
    const second = parts.second || String(date.getSeconds()).padStart(2, '0');
    const weekday = parts.weekday || fallbackWeekdays[date.getDay()] || '';

    return {
        date: `${year}年${month}月${day}日`,
        weekday,
        time: `${hour}:${minute}:${second}`,
        label: `${year}年${month}月${day}日 ${weekday} ${hour}:${minute}:${second}`
    };
}

module.exports = {
    getLocalDateTimeFacts
};
