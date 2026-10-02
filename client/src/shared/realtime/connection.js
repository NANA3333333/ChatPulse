export function connectRealtime({ url, token, onMessage, onReconnect }) {
    let ws, reconnectTimer;
    let closed = false, hasOpened = false;
    function connect() {
        reconnectTimer = null;
        ws = new WebSocket(url);
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'auth', token }));
            if (hasOpened) onReconnect();
            hasOpened = true;
        };
        ws.onclose = () => { if (!closed && !reconnectTimer) reconnectTimer = setTimeout(connect, 1200); };
        ws.onerror = () => ws.close();
        ws.onmessage = event => {
            try { onMessage(JSON.parse(event.data)); }
            catch (error) { console.error('WS event handling failed', error); }
        };
    }
    connect();
    return () => { closed = true; clearTimeout(reconnectTimer); if (ws) ws.close(); };
}
