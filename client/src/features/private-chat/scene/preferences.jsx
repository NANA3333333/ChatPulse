export function createScenePreferences(dependencies) {
function normalizeForegroundPersonPosition(position) {
  const x = Number.isFinite(Number(position?.x)) ? Number(position.x) : dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.x;
  const y = Number.isFinite(Number(position?.y)) ? Number(position.y) : dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.y;
  const direction = Object.prototype.hasOwnProperty.call(dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES, position?.direction)
    ? position.direction
    : dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.direction;
  const frame = Number.isFinite(Number(position?.frame)) ? Number(position.frame) : dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.frame;
  return {
    x: Math.max(-560, Math.min(560, x)),
    y: Math.max(-180, Math.min(48, y)),
    direction,
    frame: Math.max(0, Math.min(3, Math.round(frame))),
  };
}
function getPrivateDecorTargetLabel(target, lang = 'zh') {
  return lang === 'en' ? (target.labelEn || target.label) : target.label;
}

function loadPrivateChatForegroundEnabled() {
  try {
    return window.localStorage.getItem(dependencies.PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY) !== '0';
  } catch (error) {
    console.warn('Failed to load private chat foreground preference:', error);
    return true;
  }
}

function clampDecorScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(3, Math.max(0.25, parsed));
}

function normalizeDecorTransform(transform) {
  return {
    x: Number.isFinite(Number(transform?.x)) ? Number(transform.x) : 0,
    y: Number.isFinite(Number(transform?.y)) ? Number(transform.y) : 0,
    scale: clampDecorScale(transform?.scale ?? 1),
  };
}

function loadPrivateChatForegroundPersonPosition() {
  try {
    const raw = window.localStorage.getItem(dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY);
    if (!raw) return dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT;
    return normalizeForegroundPersonPosition(JSON.parse(raw));
  } catch (error) {
    console.warn('Failed to load private chat foreground person position:', error);
    return dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT;
  }
}

function savePrivateChatForegroundPersonPosition(position) {
  window.localStorage.setItem(
    dependencies.PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY,
    JSON.stringify(normalizeForegroundPersonPosition(position)),
  );
}

function loadPrivateChatDecorTransforms() {
  try {
    const raw = window.localStorage.getItem(dependencies.PRIVATE_CHAT_DECOR_STORAGE_KEY);
    if (!raw) return dependencies.PRIVATE_CHAT_DECOR_DEFAULTS;
    const parsed = JSON.parse(raw);
    return Object.fromEntries(
      dependencies.PRIVATE_CHAT_DECOR_TARGETS.map(({ id }) => [
        id,
        normalizeDecorTransform(parsed?.[id] || dependencies.PRIVATE_CHAT_DECOR_DEFAULTS[id]),
      ])
    );
  } catch (error) {
    console.warn('Failed to load private chat decor adjustments:', error);
    return dependencies.PRIVATE_CHAT_DECOR_DEFAULTS;
  }
}

function isDecorTransformDefault(id, transform) {
  const current = normalizeDecorTransform(transform);
  const defaults = normalizeDecorTransform(dependencies.PRIVATE_CHAT_DECOR_DEFAULTS[id]);
  return Math.round((current.x - defaults.x) * 100) === 0
    && Math.round((current.y - defaults.y) * 100) === 0
    && Math.round((current.scale - defaults.scale) * 1000) === 0;
}

function buildDecorCssSnippet(transforms) {
  const selectorMap = {
    floor: '.private-chat-scene-decor__floor',
    left: '.private-chat-scene-decor__left',
    right: '.private-chat-scene-decor__right',
  };

  return dependencies.PRIVATE_CHAT_DECOR_TARGETS.map(({ id, label }) => {
    const transform = normalizeDecorTransform(transforms[id]);
    return [
      `/* ${label} */`,
      `${selectorMap[id]} {`,
      `  --decor-x: ${Math.round(transform.x)}px;`,
      `  --decor-y: ${Math.round(transform.y)}px;`,
      `  --decor-scale: ${Number(transform.scale.toFixed(3))};`,
      `}`,
    ].join('\n');
  }).join('\n\n');
}

function PrivateChatDecorEditor({
  open,
  onOpenChange,
  transforms,
  setTransforms,
  isPrivateChatView,
  lang = 'zh',
}) {
  const [selectedId, setSelectedId] = dependencies.useState('floor');
  const [boxes, setBoxes] = dependencies.useState({});
  const [copyStatus, setCopyStatus] = dependencies.useState('');
  const dragRef = dependencies.useRef(null);

  const selectedTransform = normalizeDecorTransform(transforms[selectedId]);

  const measureDecor = dependencies.useCallback(() => {
    if (!isPrivateChatView) return;
    const root = document.querySelector('.app-container.has-private-chat');
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const nextBoxes = {};
    dependencies.PRIVATE_CHAT_DECOR_TARGETS.forEach((target) => {
      const element = root.querySelector(target.selector);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      nextBoxes[target.id] = {
        left: rect.left - rootRect.left,
        top: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
      };
    });
    setBoxes(nextBoxes);
  }, [isPrivateChatView]);

  dependencies.useEffect(() => {
    if (!open || !isPrivateChatView) return undefined;
    const rafId = window.requestAnimationFrame(measureDecor);
    const timeoutId = window.setTimeout(measureDecor, 120);
    window.addEventListener('resize', measureDecor);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', measureDecor);
    };
  }, [open, isPrivateChatView, transforms, measureDecor]);

  dependencies.useEffect(() => {
    if (!copyStatus) return undefined;
    const timeoutId = window.setTimeout(() => setCopyStatus(''), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const updateTransform = dependencies.useCallback((id, patch) => {
    setTransforms((prev) => ({
      ...prev,
      [id]: normalizeDecorTransform({
        ...(prev[id] || dependencies.PRIVATE_CHAT_DECOR_DEFAULTS[id]),
        ...patch,
      }),
    }));
  }, [setTransforms]);

  const startDrag = dependencies.useCallback((event, id) => {
    event.preventDefault();
    setSelectedId(id);
    const base = normalizeDecorTransform(transforms[id]);
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      base,
    };

    const handlePointerMove = (moveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      updateTransform(drag.id, {
        x: drag.base.x + (moveEvent.clientX - drag.startX),
        y: drag.base.y + (moveEvent.clientY - drag.startY),
      });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [transforms, updateTransform]);

  const handleWheelScale = dependencies.useCallback((event, id) => {
    event.preventDefault();
    setSelectedId(id);
    const current = normalizeDecorTransform(transforms[id]);
    const step = event.shiftKey ? 0.02 : 0.06;
    updateTransform(id, {
      scale: current.scale + (event.deltaY > 0 ? -step : step),
    });
  }, [transforms, updateTransform]);

  const resetDecor = dependencies.useCallback((id) => {
    updateTransform(id, dependencies.PRIVATE_CHAT_DECOR_DEFAULTS[id]);
  }, [updateTransform]);

  const resetAllDecor = dependencies.useCallback(() => {
    setTransforms(dependencies.PRIVATE_CHAT_DECOR_DEFAULTS);
    window.localStorage.removeItem(dependencies.PRIVATE_CHAT_DECOR_STORAGE_KEY);
  }, [setTransforms]);

  const copyDecorCss = dependencies.useCallback(async () => {
    const snippet = buildDecorCssSnippet(transforms);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyStatus(lang === 'en' ? 'CSS copied' : '已复制 CSS');
    } catch (error) {
      console.warn('Failed to copy private chat decor CSS:', error);
      window.prompt(lang === 'en' ? 'Copy these CSS variables:' : '复制这些 CSS 变量：', snippet);
      setCopyStatus(lang === 'en' ? 'Copy prompt opened' : '已弹出复制框');
    }
  }, [lang, transforms]);

  if (!isPrivateChatView) return null;

  return (
    <>
      {open && (
        <div className="private-decor-editor" aria-label={lang === 'en' ? 'Private chat asset debug panel' : '私聊素材调试面板'}>
          <div className="private-decor-editor__stage">
            {dependencies.PRIVATE_CHAT_DECOR_TARGETS.map((target) => {
              const box = boxes[target.id];
              if (!box) return null;
              return (
                <button
                  key={target.id}
                  type="button"
                  className={`private-decor-editor__box ${selectedId === target.id ? 'is-selected' : ''}`}
                  style={{
                    left: `${box.left}px`,
                    top: `${box.top}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                  }}
                  onPointerDown={(event) => startDrag(event, target.id)}
                  onWheel={(event) => handleWheelScale(event, target.id)}
                  title={lang === 'en' ? `${getPrivateDecorTargetLabel(target, lang)}: drag to move, wheel to scale` : `${getPrivateDecorTargetLabel(target, lang)}：拖动移动，滚轮缩放`}
                >
                  <span>{getPrivateDecorTargetLabel(target, lang)}</span>
                </button>
              );
            })}
          </div>
          <div className="private-decor-editor__panel">
            <div className="private-decor-editor__header">
              <strong>{lang === 'en' ? 'Asset Debug' : '素材调试'}</strong>
              <button type="button" onClick={() => onOpenChange(false)} aria-label={lang === 'en' ? 'Close asset debug' : '关闭素材调试'}>
                <dependencies.X size={16} />
              </button>
            </div>
            <div className="private-decor-editor__hint">{lang === 'en' ? 'Drag the selected box to move, wheel to scale, Shift + wheel for fine tuning.' : '拖动选中框移动，滚轮缩放，Shift + 滚轮细调。'}</div>
            <div className="private-decor-editor__tabs">
              {dependencies.PRIVATE_CHAT_DECOR_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={selectedId === target.id ? 'is-selected' : ''}
                  onClick={() => setSelectedId(target.id)}
                >
                  {getPrivateDecorTargetLabel(target, lang)}
                </button>
              ))}
            </div>
            <div className="private-decor-editor__fields">
              <label>
                X
                <input
                  type="number"
                  value={Math.round(selectedTransform.x)}
                  onChange={(event) => updateTransform(selectedId, { x: Number(event.target.value) })}
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={Math.round(selectedTransform.y)}
                  onChange={(event) => updateTransform(selectedId, { y: Number(event.target.value) })}
                />
              </label>
              <label>
                {lang === 'en' ? 'Scale' : '缩放'}
                <input
                  type="number"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={Number(selectedTransform.scale.toFixed(2))}
                  onChange={(event) => updateTransform(selectedId, { scale: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="private-decor-editor__actions">
              <button type="button" onClick={() => resetDecor(selectedId)}>{lang === 'en' ? 'Reset Current' : '重置当前'}</button>
              <button type="button" onClick={resetAllDecor}>{lang === 'en' ? 'Clear All' : '全部清空'}</button>
              <button type="button" onClick={copyDecorCss}>{lang === 'en' ? 'Copy CSS' : '复制 CSS'}</button>
            </div>
            {copyStatus && <div className="private-decor-editor__status">{copyStatus}</div>}
          </div>
        </div>
      )}
    </>
  );
}

function PrivateChatDrawerShell({ type, children }) {
  return (
    <div className="private-chat-drawer-shell" data-drawer-type={type}>
      <div className="private-chat-drawer-shell__content">
        {children}
      </div>
    </div>
  );
}
return { normalizeForegroundPersonPosition, getPrivateDecorTargetLabel, loadPrivateChatForegroundEnabled, clampDecorScale, normalizeDecorTransform, loadPrivateChatForegroundPersonPosition, savePrivateChatForegroundPersonPosition, loadPrivateChatDecorTransforms, isDecorTransformDefault, buildDecorCssSnippet, PrivateChatDecorEditor, PrivateChatDrawerShell };
}
