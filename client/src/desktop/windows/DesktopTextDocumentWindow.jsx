import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
    getDefaultTextDocumentWindowGeometry,
    clampTextDocumentWindowGeometry,
    resizeTextDocumentWindowGeometry,
} from '../windowGeometry.js';
import { getTextDocumentStats } from '../textDocumentStats.js';
import {
    FileText,
    X,
    Plus,
    Minus,
    Minimize2,
    Maximize2,
    Pencil,
    Save,
    FilePlus2,
    Scissors,
    Merge,
    Heading1,
    List,
    Bold,
    Italic,
    Strikethrough,
    Link,
    Table,
    Eraser,
    Type,
    Eye,
    PanelTopOpen,
    Trash2,
} from 'lucide-react';

export function DesktopTextToolButton({ active = false, danger = false, disabled = false, label, onClick, children }) {
    return (
        <button
            type="button"
            className={`desktop-text-tool-button ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`}
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            data-window-no-drag="true"
        >
            {children}
        </button>
    );
}

export function DesktopTextDocumentWindow({
    item,
    lang,
    mergeCandidateCount = 0,
    onClose,
    onSave,
    onDelete,
    onCreateNew,
    onSplitDocument,
    onMergeDocuments,
}) {
    const textareaRef = useRef(null);
    const moveRef = useRef(null);
    const selectionRef = useRef({ start: 0, end: 0 });
    const [draftTitle, setDraftTitle] = useState(item.label);
    const [draftContent, setDraftContent] = useState(item.content);
    const [editing, setEditing] = useState(true);
    const [wordWrap, setWordWrap] = useState(true);
    const [statusVisible, setStatusVisible] = useState(true);
    const [fontScale, setFontScale] = useState(1);
    const [minimized, setMinimized] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const [geometry, setGeometry] = useState(getDefaultTextDocumentWindowGeometry);
    const dirty = draftTitle.trim() !== item.label || draftContent !== item.content;
    const stats = useMemo(() => getTextDocumentStats(draftContent), [draftContent]);

    useEffect(() => {
        setDraftTitle(item.label);
        setDraftContent(item.content);
        setEditing(true);
        setMinimized(false);
    }, [item.id, item.label, item.content]);

    const focusEditor = useCallback(() => {
        window.requestAnimationFrame(() => textareaRef.current?.focus());
    }, []);

    const rememberSelection = useCallback(() => {
        const editor = textareaRef.current;
        if (!editor) return selectionRef.current;
        selectionRef.current = {
            start: editor.selectionStart || 0,
            end: editor.selectionEnd || 0,
        };
        return selectionRef.current;
    }, []);

    const replaceEditorRange = useCallback(
        (replacementBuilder) => {
            setEditing(true);
            const editor = textareaRef.current;
            const currentSelection = editor
                ? { start: editor.selectionStart || 0, end: editor.selectionEnd || 0 }
                : selectionRef.current;
            const start = Math.min(currentSelection.start, currentSelection.end);
            const end = Math.max(currentSelection.start, currentSelection.end);
            const selected = draftContent.slice(start, end);
            const built = replacementBuilder(selected, start, end);
            const replacement = typeof built === 'string' ? built : built.text;
            const selectionStart =
                typeof built === 'object' && Number.isFinite(built.selectionStart)
                    ? built.selectionStart
                    : start + replacement.length;
            const selectionEnd =
                typeof built === 'object' && Number.isFinite(built.selectionEnd) ? built.selectionEnd : selectionStart;
            const nextContent = `${draftContent.slice(0, start)}${replacement}${draftContent.slice(end)}`;
            setDraftContent(nextContent);
            window.requestAnimationFrame(() => {
                textareaRef.current?.focus();
                textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
                selectionRef.current = { start: selectionStart, end: selectionEnd };
            });
        },
        [draftContent],
    );

    const wrapSelection = useCallback(
        (prefix, suffix = prefix, fallback = 'text') => {
            replaceEditorRange((selected, start) => {
                const core = selected || fallback;
                return {
                    text: `${prefix}${core}${suffix}`,
                    selectionStart: start + prefix.length,
                    selectionEnd: start + prefix.length + core.length,
                };
            });
        },
        [replaceEditorRange],
    );

    const formatLines = useCallback(
        (formatter) => {
            replaceEditorRange((selected, start) => {
                const source = selected || draftContent;
                const nextText = source.split(/\r?\n/).map(formatter).join('\n');
                return {
                    text: nextText,
                    selectionStart: selected ? start : 0,
                    selectionEnd: selected ? start + nextText.length : nextText.length,
                };
            });
        },
        [draftContent, replaceEditorRange],
    );

    const handleSave = useCallback(() => {
        const nextTitle = draftTitle.trim() || (lang === 'en' ? 'New text document' : '新建文本文档');
        setDraftTitle(nextTitle);
        onSave?.({ label: nextTitle, content: draftContent });
    }, [draftContent, draftTitle, lang, onSave]);

    const requestClose = useCallback(() => {
        if (dirty && !window.confirm(lang === 'en' ? 'Close without saving changes?' : '不保存更改并关闭？')) return;
        onClose?.();
    }, [dirty, lang, onClose]);

    const handleDelete = useCallback(() => {
        if (!window.confirm(lang === 'en' ? `Delete ${item.label}?` : `删除「${item.label}」？`)) return;
        onDelete?.();
    }, [item.label, lang, onDelete]);

    const handleSplit = useCallback(() => {
        const editor = textareaRef.current;
        const start = editor ? editor.selectionStart : selectionRef.current.start;
        const end = editor ? editor.selectionEnd : selectionRef.current.end;
        const left = Math.min(start || 0, end || 0);
        const right = Math.max(start || 0, end || 0);
        const selected = draftContent.slice(left, right);
        const splitContent = selected || draftContent;
        const remainingContent = selected ? `${draftContent.slice(0, left)}${draftContent.slice(right)}` : draftContent;
        setDraftContent(remainingContent);
        onSplitDocument?.({
            label: `${draftTitle.trim() || item.label} - ${lang === 'en' ? 'Split' : '拆分'}`,
            content: splitContent,
            remainingContent,
        });
    }, [draftContent, draftTitle, item.label, lang, onSplitDocument]);

    const handleMerge = useCallback(() => {
        const nextContent = onMergeDocuments?.({ label: draftTitle, content: draftContent });
        if (typeof nextContent === 'string') setDraftContent(nextContent);
    }, [draftContent, draftTitle, onMergeDocuments]);

    const cycleFontScale = useCallback(() => {
        setFontScale((current) => {
            if (current < 1) return 1;
            if (current < 1.12) return 1.18;
            return 0.92;
        });
    }, []);

    const clearMarkdown = useCallback(() => {
        replaceEditorRange((selected, start) => {
            const source = selected || draftContent;
            const cleaned = source
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/~~(.*?)~~/g, '$1')
                .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
                .replace(/^#{1,6}\s+/gm, '')
                .replace(/^\s*[-*]\s+/gm, '');
            return {
                text: cleaned,
                selectionStart: selected ? start : 0,
                selectionEnd: selected ? start + cleaned.length : cleaned.length,
            };
        });
    }, [draftContent, replaceEditorRange]);

    const startWindowMove = useCallback(
        (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            if (maximized || event.target.closest('button, input, textarea, select, [data-window-no-drag="true"]'))
                return;
            event.preventDefault();
            moveRef.current = {
                type: 'move',
                startX: event.clientX,
                startY: event.clientY,
                startGeometry: clampTextDocumentWindowGeometry(geometry),
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [geometry, maximized],
    );

    const startWindowResize = useCallback(
        (event, direction = 'se') => {
            if (event.button !== undefined && event.button !== 0) return;
            if (maximized) return;
            event.preventDefault();
            event.stopPropagation();
            moveRef.current = {
                type: 'resize',
                direction,
                startX: event.clientX,
                startY: event.clientY,
                startGeometry: clampTextDocumentWindowGeometry(geometry),
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [geometry, maximized],
    );

    const handleWindowPointerMove = useCallback((event) => {
        const move = moveRef.current;
        if (!move) return;
        event.preventDefault();
        const deltaX = event.clientX - move.startX;
        const deltaY = event.clientY - move.startY;
        const nextGeometry =
            move.type === 'resize'
                ? resizeTextDocumentWindowGeometry(move.startGeometry, deltaX, deltaY, move.direction)
                : clampTextDocumentWindowGeometry({
                      ...move.startGeometry,
                      x: move.startGeometry.x + deltaX,
                      y: move.startGeometry.y + deltaY,
                  });
        setGeometry(nextGeometry);
    }, []);

    const stopWindowInteraction = useCallback((event) => {
        if (!moveRef.current) return;
        moveRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);

    const windowStyle = maximized
        ? undefined
        : {
              left: `${geometry.x}px`,
              top: `${geometry.y}px`,
              width: `${geometry.width}px`,
              height: `${geometry.height}px`,
              '--desktop-text-editor-scale': fontScale,
          };

    const toolbarLabel = (zh, en) => (lang === 'en' ? en : zh);
    const lineText =
        lang === 'en' ? `Line ${stats.lines}, ${stats.words} words` : `行 ${stats.lines}，${stats.words} 个词`;
    const characterText = lang === 'en' ? `${stats.characters} chars` : `${stats.characters} 个字符`;

    if (minimized) {
        return (
            <button
                type="button"
                className="desktop-text-window-minimized"
                onClick={() => setMinimized(false)}
                aria-label={lang === 'en' ? 'Restore text document' : '还原文本文档'}
            >
                <FileText size={18} />
                <span>{draftTitle || item.label}</span>
                {dirty && <b />}
            </button>
        );
    }

    return (
        <section
            className={`desktop-item-window desktop-text-window ${maximized ? 'is-maximized' : ''} ${dirty ? 'is-dirty' : ''} ${statusVisible ? '' : 'is-status-hidden'}`}
            style={windowStyle}
            aria-label={item.label}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
        >
            <header
                className="desktop-text-window__chrome"
                onPointerDown={startWindowMove}
                onPointerMove={handleWindowPointerMove}
                onPointerUp={stopWindowInteraction}
                onPointerCancel={stopWindowInteraction}
            >
                <div className="desktop-text-window__tabs">
                    <div className="desktop-text-window__tab is-active" data-window-no-drag="true">
                        <FileText size={18} />
                        <input
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            aria-label={lang === 'en' ? 'Document name' : '文档名称'}
                        />
                        {dirty && <span className="desktop-text-window__dirty-dot" aria-hidden="true" />}
                        <button
                            type="button"
                            onClick={requestClose}
                            aria-label={lang === 'en' ? 'Close tab' : '关闭标签'}
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <button
                        type="button"
                        className="desktop-text-window__tab-add"
                        onClick={onCreateNew}
                        title={lang === 'en' ? 'New text document' : '新建文本文档'}
                        aria-label={lang === 'en' ? 'New text document' : '新建文本文档'}
                        data-window-no-drag="true"
                    >
                        <Plus size={18} />
                    </button>
                    <span className="desktop-text-window__drag-space" aria-hidden="true" />
                    <div className="desktop-text-window__window-controls" data-window-no-drag="true">
                        <button
                            type="button"
                            onClick={() => setMinimized(true)}
                            aria-label={lang === 'en' ? 'Minimize' : '最小化'}
                            title={lang === 'en' ? 'Minimize' : '最小化'}
                        >
                            <Minus size={17} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setMaximized((current) => !current)}
                            aria-label={
                                maximized ? (lang === 'en' ? 'Restore' : '还原') : lang === 'en' ? 'Maximize' : '最大化'
                            }
                            title={
                                maximized ? (lang === 'en' ? 'Restore' : '还原') : lang === 'en' ? 'Maximize' : '最大化'
                            }
                        >
                            {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>
                        <button
                            type="button"
                            className="desktop-text-window__close"
                            onClick={requestClose}
                            aria-label={lang === 'en' ? 'Close' : '关闭'}
                            title={lang === 'en' ? 'Close' : '关闭'}
                        >
                            <X size={19} />
                        </button>
                    </div>
                </div>

                <div className="desktop-text-window__menu" data-window-no-drag="true">
                    <button type="button" onClick={handleSave}>
                        {toolbarLabel('文件', 'File')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditing(true);
                            focusEditor();
                        }}
                    >
                        {toolbarLabel('编辑', 'Edit')}
                    </button>
                    <button type="button" onClick={() => setStatusVisible((current) => !current)}>
                        {toolbarLabel('查看', 'View')}
                    </button>
                </div>

                <div className="desktop-text-window__toolbar" data-window-no-drag="true">
                    <DesktopTextToolButton
                        label={toolbarLabel('编辑', 'Edit')}
                        active={editing}
                        onClick={() => {
                            setEditing((current) => !current);
                            focusEditor();
                        }}
                    >
                        <Pencil size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton label={toolbarLabel('保存', 'Save')} active={dirty} onClick={handleSave}>
                        <Save size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton label={toolbarLabel('新建', 'New')} onClick={onCreateNew}>
                        <FilePlus2 size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('拆分为新文档', 'Split to new document')}
                        onClick={handleSplit}
                    >
                        <Scissors size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={
                            mergeCandidateCount > 0
                                ? toolbarLabel('合并最近文档', 'Merge recent document')
                                : toolbarLabel('没有可合并文档', 'No document to merge')
                        }
                        onClick={handleMerge}
                    >
                        <Merge size={18} />
                    </DesktopTextToolButton>
                    <span className="desktop-text-window__toolbar-separator" />
                    <DesktopTextToolButton
                        label="H1"
                        onClick={() => formatLines((line) => line.replace(/^#{1,6}\s*/, '# '))}
                    >
                        <Heading1 size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('列表', 'List')}
                        onClick={() =>
                            formatLines((line) => (line.trim() ? `- ${line.replace(/^\s*[-*]\s+/, '')}` : line))
                        }
                    >
                        <List size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('加粗', 'Bold')}
                        onClick={() => wrapSelection('**', '**', toolbarLabel('加粗文本', 'bold text'))}
                    >
                        <Bold size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('斜体', 'Italic')}
                        onClick={() => wrapSelection('*', '*', toolbarLabel('斜体文本', 'italic text'))}
                    >
                        <Italic size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('删除线', 'Strikethrough')}
                        onClick={() => wrapSelection('~~', '~~', toolbarLabel('删除线文本', 'struck text'))}
                    >
                        <Strikethrough size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('链接', 'Link')}
                        onClick={() => wrapSelection('[', '](https://)', 'link')}
                    >
                        <Link size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('表格', 'Table')}
                        onClick={() => replaceEditorRange(() => '| 标题 | 内容 |\n| --- | --- |\n|  |  |')}
                    >
                        <Table size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton label={toolbarLabel('清除格式', 'Clear formatting')} onClick={clearMarkdown}>
                        <Eraser size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton label={toolbarLabel('字体大小', 'Text size')} onClick={cycleFontScale}>
                        <Type size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('状态栏', 'Status bar')}
                        active={statusVisible}
                        onClick={() => setStatusVisible((current) => !current)}
                    >
                        <Eye size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton
                        label={toolbarLabel('自动换行', 'Word wrap')}
                        active={wordWrap}
                        onClick={() => setWordWrap((current) => !current)}
                    >
                        <PanelTopOpen size={18} />
                    </DesktopTextToolButton>
                    <DesktopTextToolButton label={toolbarLabel('删除', 'Delete')} danger onClick={handleDelete}>
                        <Trash2 size={18} />
                    </DesktopTextToolButton>
                </div>
            </header>

            <textarea
                ref={textareaRef}
                className={`desktop-text-window__editor ${wordWrap ? 'is-wrapped' : 'is-nowrap'}`}
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                onSelect={rememberSelection}
                onKeyUp={rememberSelection}
                onClick={rememberSelection}
                readOnly={!editing}
                aria-label={lang === 'en' ? 'Document text' : '文本文档内容'}
                spellCheck="false"
                style={{ '--desktop-text-editor-scale': fontScale }}
            />

            {statusVisible && (
                <footer className="desktop-text-window__status" data-window-no-drag="true">
                    <span>{lineText}</span>
                    <span>{characterText}</span>
                    <span>{editing ? toolbarLabel('可编辑', 'Editable') : toolbarLabel('只读', 'Read only')}</span>
                    <span>{dirty ? toolbarLabel('未保存', 'Unsaved') : toolbarLabel('已保存', 'Saved')}</span>
                    <span>UTF-8</span>
                </footer>
            )}

            {!maximized &&
                ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((direction) => (
                    <span
                        key={direction}
                        className={`desktop-text-window__resize desktop-text-window__resize--${direction}`}
                        onPointerDown={(event) => startWindowResize(event, direction)}
                        onPointerMove={handleWindowPointerMove}
                        onPointerUp={stopWindowInteraction}
                        onPointerCancel={stopWindowInteraction}
                        aria-hidden="true"
                    />
                ))}
        </section>
    );
}
