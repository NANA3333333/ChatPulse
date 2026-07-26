import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  FlaskConical,
  Globe2,
  KeyRound,
  Library,
  Link2,
  ListChecks,
  LoaderCircle,
  PanelRightClose,
  Play,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  Settings2,
  Trash2,
  UserRound,
  Wifi,
  X
} from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import './McpLabPanel.css';

function getHeaders() {
  const token = localStorage.getItem('cp_token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : ''
  };
}

function endpoint(apiUrl, path) {
  return `${String(apiUrl || '/api').replace(/\/$/, '')}${path}`;
}

async function requestJson(url, options = {}, lang = 'zh') {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || (lang === 'en' ? `Request failed ${response.status}` : `请求失败 ${response.status}`));
  }
  return data;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function providerLabel(providerId, providers = []) {
  if (providerId === 'duckduckgo' || providerId === 'duckduckgo_instant_answer') return 'DuckDuckGo';
  return providers.find(item => item.id === providerId)?.label || providerId || 'Auto';
}

function normalizeProviderId(source) {
  if (!source) return '';
  if (source === 'duckduckgo_instant_answer') return 'duckduckgo';
  if (source.startsWith('serper')) return 'serper';
  if (source.startsWith('tavily')) return 'tavily';
  if (source.startsWith('brave')) return 'brave';
  if (source.startsWith('bing')) return 'bing';
  return source;
}

function taskKindLabel(kind, lang = 'zh') {
  const isEn = lang === 'en';
  if (kind === 'private_web_search') return isEn ? 'Private web search' : '私聊联网';
  if (kind === 'city_web_search') return isEn ? 'City web search' : '商业街联网';
  if (kind === 'web_search') return isEn ? 'Manual search' : '手动查询';
  if (kind === 'fetch_url') return isEn ? 'Page fetch' : '网页抓取';
  return kind || (isEn ? 'Task' : '任务');
}

function taskStatusLabel(status, lang = 'zh') {
  const isEn = lang === 'en';
  if (status === 'done') return isEn ? 'Done' : '完成';
  if (status === 'error') return isEn ? 'Error' : '错误';
  if (status === 'running') return isEn ? 'Running' : '运行中';
  if (status === 'pending') return isEn ? 'Pending' : '等待';
  return status || (isEn ? 'Task' : '任务');
}

function formatRawJson(value) {
  if (!value) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function IconButton({ icon: Icon, title, children, variant = 'quiet', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`mcp-lab-icon-button is-${variant} ${className}`.trim()}
      title={title}
      aria-label={title}
      {...props}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

function ActionButton({ icon: Icon, children, variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`mcp-lab-button is-${variant} ${className}`.trim()}
      {...props}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

function Badge({ children, icon: Icon, tone = 'neutral' }) {
  return (
    <span className={`mcp-lab-badge is-${tone}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function ToolButton({ active, icon, label, detail, count, onClick }) {
  const ToolIcon = icon;
  return (
    <button
      type="button"
      className={`mcp-lab-rail-button ${active ? 'is-active' : ''}`}
      onClick={onClick}
      title={label}
      aria-pressed={active}
    >
      <span className="mcp-lab-rail-icon"><ToolIcon size={18} aria-hidden="true" /></span>
      <span className="mcp-lab-rail-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {typeof count === 'number' && <span className="mcp-lab-rail-count">{count}</span>}
    </button>
  );
}

function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="mcp-lab-empty">
      {Icon && <Icon size={20} aria-hidden="true" />}
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

function RawDetails({ label, value }) {
  if (!value) return null;
  return (
    <details className="mcp-lab-details">
      <summary>{label}</summary>
      <pre>{typeof value === 'string' ? value : formatRawJson(value)}</pre>
    </details>
  );
}

function ResultCard({ item, index, lang }) {
  const isEn = lang === 'en';
  return (
    <article className="mcp-lab-result-card">
      <div className="mcp-lab-result-main">
        <div className="mcp-lab-result-index">{index + 1}</div>
        <div className="mcp-lab-result-copy">
          <h3>{item.title || item.url || (isEn ? `Result ${index + 1}` : `结果 ${index + 1}`)}</h3>
          {item.snippet && <p>{item.snippet}</p>}
          {item.url && (
            <a className="mcp-lab-link" href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink size={13} aria-hidden="true" />
              <span>{isEn ? 'Open source' : '打开来源'}</span>
            </a>
          )}
          <RawDetails label={isEn ? 'Fetched text' : '抓取正文'} value={item.page_text} />
          {item.page_error && <div className="mcp-lab-inline-error">{isEn ? 'Page text fetch failed: ' : '正文抓取失败：'}{item.page_error}</div>}
          <RawDetails label={isEn ? 'API fields' : 'API 字段'} value={item.raw} />
        </div>
      </div>
    </article>
  );
}

function SearchResultList({ result, providers, lang }) {
  const isEn = lang === 'en';
  const results = Array.isArray(result?.results) ? result.results : [];
  if (!result || results.length === 0) return null;
  const source = providerLabel(normalizeProviderId(String(result.source || '')), providers);
  return (
    <section className="mcp-lab-output-block" aria-label={isEn ? 'Search results' : '搜索结果'}>
      <div className="mcp-lab-section-head">
        <div>
          <span className="mcp-lab-section-kicker">{isEn ? 'Search Output' : '搜索输出'}</span>
          <h2>{isEn ? 'Current Results' : '本次结果'}</h2>
        </div>
        <Badge icon={Globe2}>{source} / {results.length}</Badge>
      </div>
      <div className="mcp-lab-result-stack">
        {results.map((item, index) => (
          <ResultCard key={`${item.url || item.title || 'result'}-${index}`} item={item} index={index} lang={lang} />
        ))}
      </div>
      <RawDetails label={isEn ? 'Full response' : '完整响应'} value={result.raw_response} />
    </section>
  );
}

function TaskOutputPreview({ task, providers, lang }) {
  const isEn = lang === 'en';
  if (!task) return null;
  const source = task.output?.source || task.input?.provider || '';
  const outputResults = Array.isArray(task.output?.results) ? task.output.results : [];
  const outputText = task.output?.text || task.output?.url || '';
  return (
    <div className="mcp-lab-task-preview">
      <div className="mcp-lab-preview-head">
        <div>
          <span>{taskKindLabel(task.kind, lang)}</span>
          <strong>{task.title || task.id}</strong>
        </div>
        <Badge tone={task.status === 'error' ? 'danger' : task.status === 'done' ? 'success' : 'neutral'}>
          {taskStatusLabel(task.status, lang)}
        </Badge>
      </div>
      {source && (
        <div className="mcp-lab-preview-provider">
          <Wifi size={13} aria-hidden="true" />
          {providerLabel(normalizeProviderId(String(source)), providers)}
        </div>
      )}
      {task.error && <div className="mcp-lab-inline-error">{task.error}</div>}
      {outputResults.length > 0 && (
        <div className="mcp-lab-result-stack is-compact">
          {outputResults.map((item, index) => (
            <ResultCard key={`${item.url || item.title || 'task-result'}-${index}`} item={item} index={index} lang={lang} />
          ))}
        </div>
      )}
      {!outputResults.length && outputText && <p className="mcp-lab-task-text">{outputText}</p>}
      <RawDetails label={isEn ? 'Full task response' : '任务完整响应'} value={task.output?.raw_response || task.output?.raw} />
    </div>
  );
}

function TaskRecord({ task, selected, providers, onSelect, onRerun, onDelete, lang }) {
  const isEn = lang === 'en';
  const source = task.output?.source || task.input?.provider || '';
  const isDone = task.status === 'done';
  const isError = task.status === 'error';
  const handleSelect = () => onSelect(task);
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect();
    }
  };
  return (
    <article className={`mcp-lab-task-card ${selected ? 'is-selected' : ''} ${isError ? 'has-error' : ''}`}>
      <button type="button" className="mcp-lab-task-select" onClick={handleSelect} onKeyDown={handleKeyDown}>
        <span className="mcp-lab-task-state">
          {isDone ? <CheckCircle2 size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
        </span>
        <span className="mcp-lab-task-copy">
          <span className="mcp-lab-task-meta">
            {taskKindLabel(task.kind, lang)}
            {source && <span>{providerLabel(normalizeProviderId(String(source)), providers)}</span>}
          </span>
          <strong>{task.title || task.id}</strong>
          <span className="mcp-lab-task-foot">
            {taskStatusLabel(task.status, lang)}
            {formatTime(task.finished_at || task.created_at)}
          </span>
        </span>
        <ChevronRight className="mcp-lab-task-chevron" size={15} aria-hidden="true" />
      </button>
      <div className="mcp-lab-task-actions">
        <IconButton
          icon={RotateCw}
          title={isEn ? 'Run again' : '重新执行'}
          onClick={() => onRerun(task)}
        />
        <IconButton
          icon={Trash2}
          title={isEn ? 'Delete' : '删除'}
          variant="danger"
          onClick={() => onDelete(task)}
        />
      </div>
      {task.error && <div className="mcp-lab-inline-error">{task.error}</div>}
    </article>
  );
}

function KnowledgeResultList({ results, lang }) {
  const isEn = lang === 'en';
  if (!Array.isArray(results) || results.length === 0) return null;
  return (
    <section className="mcp-lab-output-block" aria-label={isEn ? 'Knowledge matches' : '资料命中'}>
      <div className="mcp-lab-section-head">
        <div>
          <span className="mcp-lab-section-kicker">{isEn ? 'Knowledge Output' : '知识输出'}</span>
          <h2>{isEn ? 'Matches' : '命中资料'}</h2>
        </div>
        <Badge icon={Database}>{results.length}</Badge>
      </div>
      <div className="mcp-lab-knowledge-stack">
        {results.map((item, index) => (
          <article className="mcp-lab-knowledge-hit" key={`${item.chunk_id || item.doc_id || item.title || 'knowledge'}-${index}`}>
            <div className="mcp-lab-knowledge-head">
              <div>
                <strong>{item.title || (isEn ? 'Untitled note' : '未命名资料')}</strong>
                <span>{item.source_type || 'note'} · {isEn ? 'score' : '分数'} {item.score ?? 0}</span>
              </div>
              {item.source_url && (
                <a className="mcp-lab-icon-link" href={item.source_url} target="_blank" rel="noreferrer" title={isEn ? 'Open source' : '打开来源'}>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
            <p>{item.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function ContextMetric({ label, value }) {
  return (
    <span className="mcp-lab-context-metric">
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function ContextMiniList({ items, emptyText, renderItem }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="mcp-lab-context-empty">{emptyText}</div>;
  }
  return (
    <div className="mcp-lab-context-list">
      {items.map((item, index) => (
        <div className="mcp-lab-context-row" key={item.id || item.doc_id || item.timestamp || index}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

function ContextInspector({ contextData, loading, error, onRefresh, characterName, lang }) {
  const isEn = lang === 'en';
  const context = contextData?.context || contextData || null;
  const character = context?.character || {};
  const privateWindow = context?.private_window || {};
  const cityLogs = context?.city?.recent_logs || [];
  const groups = context?.group_context?.groups || [];
  const docs = context?.external_knowledge?.docs || [];
  const debugRows = context?.recent_llm_debug || [];
  const tail = privateWindow.tail || [];

  if (!characterName && !character?.name) {
    return (
      <div className="mcp-lab-inspector-scroll">
        <EmptyState icon={UserRound} title={isEn ? 'Choose a character first' : '先选择角色'} />
      </div>
    );
  }

  return (
    <div className="mcp-lab-inspector-scroll">
      <section className="mcp-lab-context-card">
        <div className="mcp-lab-context-head">
          <div>
            <span className="mcp-lab-section-kicker">CONTEXT</span>
            <strong>{character?.name || characterName}</strong>
            <small>{character?.location || character?.city_status || (isEn ? 'Context window' : '上下文窗口')}</small>
          </div>
          <IconButton icon={RefreshCw} title={isEn ? 'Refresh context' : '刷新上下文'} onClick={onRefresh} disabled={loading} />
        </div>
        {error && <div className="mcp-lab-inline-error">{error}</div>}
        {loading && <div className="mcp-lab-context-empty">{isEn ? 'Loading context...' : '正在读取上下文...'}</div>}
        {!loading && context && (
          <>
            <div className="mcp-lab-context-metrics">
              <ContextMetric label={isEn ? 'Private msgs' : '私聊'} value={privateWindow.count || countItems(tail)} />
              <ContextMetric label={isEn ? 'City logs' : '商业街'} value={countItems(cityLogs)} />
              <ContextMetric label={isEn ? 'Groups' : '群聊'} value={countItems(groups)} />
              <ContextMetric label={isEn ? 'Docs' : '资料'} value={countItems(docs)} />
            </div>

            <section className="mcp-lab-context-section">
              <h3>{isEn ? 'Private Window Tail' : '私聊窗口尾部'}</h3>
              <ContextMiniList
                items={tail}
                emptyText={isEn ? 'No recent private messages.' : '暂无最近私聊消息。'}
                renderItem={(item) => (
                  <>
                    <strong>{item.role || 'message'}</strong>
                    <p>{item.content || ''}</p>
                    <small>{formatTime(item.timestamp)}</small>
                  </>
                )}
              />
            </section>

            <section className="mcp-lab-context-section">
              <h3>{isEn ? 'Recent City Logs' : '最近商业街日志'}</h3>
              <ContextMiniList
                items={cityLogs}
                emptyText={isEn ? 'No city logs in this context.' : '上下文里暂无商业街日志。'}
                renderItem={(item) => (
                  <>
                    <strong>{item.action_type || 'CITY'}</strong>
                    <p>{item.message || ''}</p>
                    <small>{item.location || ''} {formatTime(item.timestamp)}</small>
                  </>
                )}
              />
            </section>

            <section className="mcp-lab-context-section">
              <h3>{isEn ? 'Groups and External Knowledge' : '群聊与外部资料'}</h3>
              <ContextMiniList
                items={[...groups.map(item => ({ ...item, _kind: 'group' })), ...docs.map(item => ({ ...item, _kind: 'doc' }))]}
                emptyText={isEn ? 'No group or external knowledge entries.' : '暂无群聊或外部资料条目。'}
                renderItem={(item) => (
                  <>
                    <strong>{item._kind === 'group' ? (item.name || item.id) : (item.title || item.id)}</strong>
                    <p>{item._kind === 'group'
                      ? (isEn ? `${item.member_count || 0} members, inject limit ${item.inject_limit ?? '-'}` : `${item.member_count || 0} 位成员，注入上限 ${item.inject_limit ?? '-'}`)
                      : `${item.source_type || 'note'} · ${item.trust_level || 'normal'}`}</p>
                    {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">{isEn ? 'Open source' : '打开来源'}</a>}
                  </>
                )}
              />
            </section>

            <section className="mcp-lab-context-section">
              <h3>{isEn ? 'Recent LLM Debug' : '最近 LLM Debug'}</h3>
              <ContextMiniList
                items={debugRows}
                emptyText={isEn ? 'No recent debug records.' : '暂无最近调试记录。'}
                renderItem={(item) => (
                  <>
                    <strong>{item.direction || 'debug'} · {item.context_type || 'context'}</strong>
                    <p>{item.payload_preview || ''}</p>
                    <small>{formatTime(item.timestamp)}</small>
                  </>
                )}
              />
            </section>
          </>
        )}
      </section>
    </div>
  );
}

export default function McpLabPanel({ apiUrl }) {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const tx = useCallback((en, zh) => (isEn ? en : zh), [isEn]);
  const headers = useMemo(() => getHeaders(), []);
  const [status, setStatus] = useState(null);
  const [webConfig, setWebConfig] = useState(null);
  const [webKeys, setWebKeys] = useState({});
  const [clearKeyIds, setClearKeyIds] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [characters, setCharacters] = useState([]);
  const [characterId, setCharacterId] = useState('');
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [docs, setDocs] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeResults, setKnowledgeResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('search');
  const [inspectorPanel, setInspectorPanel] = useState('tasks');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [contextData, setContextData] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [statusData, taskData, characterData, docData] = await Promise.all([
        requestJson(endpoint(apiUrl, '/mcp-lab/status'), { headers }, lang),
        requestJson(endpoint(apiUrl, '/mcp-lab/tasks'), { headers }, lang),
        requestJson(endpoint(apiUrl, '/characters'), { headers }, lang),
        requestJson(endpoint(apiUrl, '/mcp-lab/knowledge'), { headers }, lang)
      ]);
      setStatus(statusData);
      try {
        const configData = await requestJson(endpoint(apiUrl, '/mcp-lab/web-config'), { headers }, lang);
        setWebConfig(configData);
        setSelectedProvider(configData.preferred_provider || 'auto');
      } catch {
        setWebConfig(null);
      }
      setTasks(taskData.tasks || []);
      setSelectedTaskId((current) => current || taskData.tasks?.[0]?.id || '');
      const nextCharacters = Array.isArray(characterData) ? characterData : [];
      setCharacters(nextCharacters);
      setCharacterId((current) => current || nextCharacters[0]?.id || '');
      setDocs(docData.docs || []);
    } catch (e) {
      setError(e.message);
    }
  }, [apiUrl, headers, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const loadContext = useCallback(async (nextCharacterId = characterId) => {
    if (!nextCharacterId) {
      setContextData(null);
      setContextError('');
      return;
    }
    setContextLoading(true);
    setContextError('');
    try {
      const data = await requestJson(endpoint(apiUrl, `/mcp-lab/context/${encodeURIComponent(nextCharacterId)}`), { headers }, lang);
      setContextData(data.context ? data : { success: true, context: data });
    } catch (e) {
      setContextError(e.message);
    } finally {
      setContextLoading(false);
    }
  }, [apiUrl, characterId, headers, lang]);

  useEffect(() => {
    if (characterId) {
      loadContext(characterId);
    } else {
      setContextData(null);
      setContextError('');
    }
  }, [characterId, loadContext]);

  async function runSearch() {
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (Object.values(webKeys).some(value => String(value || '').trim()) || clearKeyIds.length > 0) {
        await saveWebConfig({ quiet: true });
      }
      const data = await requestJson(endpoint(apiUrl, '/mcp-lab/search'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, provider: selectedProvider })
      }, lang);
      const count = Array.isArray(data.result?.results) ? data.result.results.length : 0;
      setSearchResult(data.result || null);
      if (data.task) {
        setTasks(current => [data.task, ...current.filter(task => task.id !== data.task.id)].slice(0, 80));
        setSelectedTaskId(data.task.id);
      }
      setInspectorPanel('tasks');
      setInspectorOpen(true);
      setNotice(tx(
        `Search complete: ${providerLabel(data.result?.source || selectedProvider, providers)} returned ${count} results`,
        `查询完成：${providerLabel(data.result?.source || selectedProvider, providers)} 返回 ${count} 条结果`
      ));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveWebConfig(options = {}) {
    const quiet = !!options.quiet;
    if (!quiet) setBusy(true);
    setError('');
    try {
      const data = await requestJson(endpoint(apiUrl, '/mcp-lab/web-config'), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          preferred_provider: selectedProvider,
          keys: webKeys,
          clear_ids: clearKeyIds
        })
      }, lang);
      setWebConfig(data);
      setWebKeys({});
      setClearKeyIds([]);
      const statusData = await requestJson(endpoint(apiUrl, '/mcp-lab/status'), { headers }, lang);
      setStatus(statusData);
      if (!quiet) setNotice(tx(
        `Web keys and search provider saved. ${data.saved_key_count || 0} keys are saved.`,
        `联网 Key 和搜索源已保存，当前已保存 ${data.saved_key_count || 0} 个 Key`
      ));
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      if (!quiet) setBusy(false);
    }
  }

  async function fetchUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await requestJson(endpoint(apiUrl, '/mcp-lab/fetch'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ url })
      }, lang);
      if (data.task) {
        setTasks(current => [data.task, ...current.filter(task => task.id !== data.task.id)].slice(0, 80));
        setSelectedTaskId(data.task.id);
      }
      setInspectorPanel('tasks');
      setInspectorOpen(true);
      setNotice(tx(
        `Page fetch complete: ${data.result?.status || ''} ${data.result?.content_type || ''}`.trim(),
        `页面抓取完成：${data.result?.status || ''} ${data.result?.content_type || ''}`.trim()
      ));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveKnowledge() {
    if (!noteContent.trim()) return;
    setBusy(true);
    setError('');
    try {
      await requestJson(endpoint(apiUrl, '/mcp-lab/knowledge'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          character_id: characterId,
          title: noteTitle,
          source_url: noteUrl,
          source_type: noteUrl ? 'web' : 'note',
          content: noteContent
        })
      }, lang);
      setNotice(tx('External knowledge saved', '外部知识已保存'));
      setNoteTitle('');
      setNoteUrl('');
      setNoteContent('');
      await loadDocs();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function searchKnowledge() {
    if (!knowledgeQuery.trim()) return;
    setBusy(true);
    setError('');
    try {
      const data = await requestJson(endpoint(apiUrl, '/mcp-lab/knowledge/search'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ character_id: characterId, query: knowledgeQuery })
      }, lang);
      setKnowledgeResults(Array.isArray(data.results) ? data.results : []);
      setNotice(tx(
        `External knowledge matched ${data.results?.length || 0} items`,
        `外部知识命中 ${data.results?.length || 0} 条`
      ));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadDocs() {
    const suffix = characterId ? `?character_id=${encodeURIComponent(characterId)}` : '';
    const data = await requestJson(endpoint(apiUrl, `/mcp-lab/knowledge${suffix}`), { headers }, lang);
    setDocs(data.docs || []);
  }

  async function createTask(kind) {
    setBusy(true);
    setError('');
    try {
      const input = kind === 'fetch_url' ? { url } : { query, provider: selectedProvider };
      const title = kind === 'fetch_url' ? url : query;
      await requestJson(endpoint(apiUrl, '/mcp-lab/tasks'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind, title, input, run_now: true })
      }, lang);
      setInspectorPanel('tasks');
      setInspectorOpen(true);
      setNotice(tx('Task created and executed', '任务已创建并执行'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function rerunTask(task) {
    setBusy(true);
    setError('');
    try {
      await requestJson(endpoint(apiUrl, `/mcp-lab/tasks/${task.id}/run`), { method: 'POST', headers }, lang);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(task) {
    setError('');
    try {
      await requestJson(endpoint(apiUrl, `/mcp-lab/tasks/${task.id}`), { method: 'DELETE', headers }, lang);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const providers = webConfig?.providers || status?.web_search_providers || [];
  const activeProvider = webConfig?.active_provider || status?.search_provider || 'duckduckgo';
  const selectedProviderConfig = providers.find(provider => provider.id === selectedProvider);
  const taskItems = Array.isArray(tasks) ? tasks : [];
  const selectedTask = taskItems.find(task => task.id === selectedTaskId) || taskItems[0] || null;
  const completedTaskCount = taskItems.filter(task => task.status === 'done').length;
  const erroredTaskCount = taskItems.filter(task => task.status === 'error').length;
  const savedKeyCount = Number(webConfig?.saved_key_count ?? providers.filter(provider => provider.has_key).length ?? 0);
  const docCount = Array.isArray(docs) ? docs.length : 0;
  const selectedKnowledgeOwner = characterId
    ? (characters.find(character => String(character.id) === String(characterId))?.name || characterId)
    : tx('Global', '全局');
  const selectedContextCharacterName = characters.find(character => String(character.id) === String(characterId))?.name || characterId;
  const currentSearchCount = Array.isArray(searchResult?.results) ? searchResult.results.length : 0;

  const tools = [
    { id: 'search', icon: Search, label: tx('Search', '搜索'), detail: tx('Web query', '联网查询'), count: currentSearchCount },
    { id: 'fetch', icon: Link2, label: tx('Fetch', '抓取'), detail: tx('URL text', '网页正文'), count: null },
    { id: 'knowledge', icon: Library, label: tx('Knowledge', '资料'), detail: selectedKnowledgeOwner, count: docCount },
    { id: 'keys', icon: KeyRound, label: tx('Keys', '密钥'), detail: tx('Providers', '搜索源'), count: savedKeyCount }
  ];
  const activeToolMeta = tools.find(tool => tool.id === activeTool) || tools[0];
  const ActiveToolIcon = activeToolMeta.icon;

  function toggleClearProvider(providerId) {
    setClearKeyIds((current) => current.includes(providerId)
      ? current.filter(id => id !== providerId)
      : [...current, providerId]);
  }

  function selectTask(task) {
    setSelectedTaskId(current => current === task.id ? '' : task.id);
    setInspectorPanel('tasks');
    setInspectorOpen(true);
  }

  function renderProviderSummary(provider) {
    const isSaved = !!provider.has_key;
    return (
      <article className={`mcp-lab-provider-row ${selectedProvider === provider.id ? 'is-active' : ''}`} key={provider.id}>
        <button type="button" onClick={() => setSelectedProvider(provider.id)}>
          <span className="mcp-lab-provider-dot" />
          <span>
            <strong>{provider.label}</strong>
            <small>{isSaved ? tx('API key saved', 'API Key 已保存') : tx('No user key', '未配置用户 Key')}</small>
          </span>
        </button>
        {isSaved && <Badge icon={Check} tone="success">{provider.source === 'env' ? tx('Env', '环境') : tx('Saved', '已保存')}</Badge>}
      </article>
    );
  }

  return (
    <div className="mcp-lab-panel mcp-lab-redesign">
      <header className="mcp-lab-topbar">
        <div className="mcp-lab-brand">
          <span className="mcp-lab-kicker"><FlaskConical size={16} aria-hidden="true" /> {tx('MCP Lab', 'MCP 实验室')}</span>
          <h1>{tx('Research Console', '联网研究控制台')}</h1>
        </div>

        <div className="mcp-lab-toolbar" aria-label={tx('MCP lab tools', 'MCP 实验室功能')}>
          {tools.map(tool => {
            const ToolIcon = tool.icon;
            return (
              <button
                type="button"
                key={tool.id}
                className={activeTool === tool.id ? 'is-active' : ''}
                onClick={() => setActiveTool(tool.id)}
              >
                <ToolIcon size={15} aria-hidden="true" />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mcp-lab-top-actions">
          <Badge icon={Wifi}>{providerLabel(activeProvider, providers)}</Badge>
          <IconButton icon={RefreshCw} title={tx('Refresh', '刷新')} onClick={load} disabled={busy} />
          <IconButton
            icon={PanelRightClose}
            title={inspectorOpen ? tx('Hide inspector', '收起侧栏') : tx('Show inspector', '展开侧栏')}
            onClick={() => setInspectorOpen(current => !current)}
          />
        </div>
      </header>

      {(error || notice) && (
        <div className="mcp-lab-alerts">
          {error && <div className="mcp-lab-alert is-danger">{error}</div>}
          {notice && <div className="mcp-lab-alert is-info">{notice}</div>}
        </div>
      )}

      <div className="mcp-lab-panel__body mcp-lab-body">
        <div className={`mcp-lab-frame ${inspectorOpen ? 'has-inspector' : 'is-inspector-closed'}`}>
          <nav className="mcp-lab-rail" aria-label={tx('MCP lab navigation', 'MCP 实验室导航')}>
            {tools.map(tool => (
              <ToolButton
                key={tool.id}
                active={activeTool === tool.id}
                icon={tool.icon}
                label={tool.label}
                detail={tool.detail}
                count={tool.count}
                onClick={() => setActiveTool(tool.id)}
              />
            ))}
          </nav>

          <main className="mcp-lab-workspace">
            <section className="mcp-lab-work-head">
              <div className="mcp-lab-work-title">
                <span><ActiveToolIcon size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{activeToolMeta.label}</strong>
                  <small>{activeToolMeta.detail}</small>
                </div>
              </div>
              <div className="mcp-lab-work-stats">
                <Badge icon={ListChecks}>{taskItems.length}</Badge>
                <Badge icon={CheckCircle2} tone="success">{completedTaskCount}</Badge>
                <Badge icon={BookOpen}>{docCount}</Badge>
                {busy && <Badge icon={LoaderCircle} tone="warning">{tx('Busy', '执行中')}</Badge>}
              </div>
            </section>

            <div className="mcp-lab-work-scroll">
              {activeTool === 'search' && (
                <section className="mcp-lab-surface">
                  <div className="mcp-lab-section-head">
                    <div>
                      <span className="mcp-lab-section-kicker">{tx('Web Search', '联网搜索')}</span>
                      <h2>{tx('Query Builder', '查询面板')}</h2>
                    </div>
                    <Badge icon={Globe2}>{providerLabel(activeProvider, providers)}</Badge>
                  </div>
                  <form className="mcp-lab-command-row" onSubmit={(event) => { event.preventDefault(); runSearch(); }}>
                    <label className="mcp-lab-field">
                      <span>{tx('Query', '关键词')}</span>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={tx('Search keywords', '搜索关键词')}
                      />
                    </label>
                    <ActionButton icon={Search} variant="primary" disabled={busy || !query.trim()}>
                      {tx('Search', '搜索')}
                    </ActionButton>
                    <ActionButton icon={Play} disabled={busy || !query.trim()} onClick={() => createTask('web_search')}>
                      {tx('Task', '任务')}
                    </ActionButton>
                  </form>
                  {searchResult ? (
                    <SearchResultList result={searchResult} providers={providers} lang={lang} />
                  ) : (
                    <EmptyState icon={Search} title={tx('No search output', '暂无搜索输出')} />
                  )}
                </section>
              )}

              {activeTool === 'fetch' && (
                <section className="mcp-lab-surface">
                  <div className="mcp-lab-section-head">
                    <div>
                      <span className="mcp-lab-section-kicker">{tx('Page Fetch', '网页抓取')}</span>
                      <h2>{tx('URL Reader', 'URL 读取')}</h2>
                    </div>
                    <Badge icon={Link2}>{tx('Text', '正文')}</Badge>
                  </div>
                  <form className="mcp-lab-command-row" onSubmit={(event) => { event.preventDefault(); fetchUrl(); }}>
                    <label className="mcp-lab-field">
                      <span>URL</span>
                      <input
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com"
                      />
                    </label>
                    <ActionButton icon={ExternalLink} variant="primary" disabled={busy || !url.trim()}>
                      {tx('Fetch', '抓取')}
                    </ActionButton>
                    <ActionButton icon={Play} disabled={busy || !url.trim()} onClick={() => createTask('fetch_url')}>
                      {tx('Task', '任务')}
                    </ActionButton>
                  </form>
                  {selectedTask?.kind === 'fetch_url' ? (
                    <TaskOutputPreview task={selectedTask} providers={providers} lang={lang} />
                  ) : (
                    <EmptyState icon={FileText} title={tx('No fetched page selected', '暂无选中的抓取结果')} />
                  )}
                </section>
              )}

              {activeTool === 'knowledge' && (
                <section className="mcp-lab-surface">
                  <div className="mcp-lab-section-head">
                    <div>
                      <span className="mcp-lab-section-kicker">{tx('External Knowledge', '外部知识')}</span>
                      <h2>{tx('Knowledge Desk', '资料工作台')}</h2>
                    </div>
                    <Badge icon={Library}>{selectedKnowledgeOwner}</Badge>
                  </div>

                  <div className="mcp-lab-note-grid">
                    <label className="mcp-lab-field">
                      <span>{tx('Title', '标题')}</span>
                      <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder={tx('Title', '标题')} />
                    </label>
                    <label className="mcp-lab-field">
                      <span>{tx('Source', '来源')}</span>
                      <input value={noteUrl} onChange={(event) => setNoteUrl(event.target.value)} placeholder={tx('Source URL, optional', '来源 URL，可空')} />
                    </label>
                    <label className="mcp-lab-field">
                      <span>{tx('Owner', '归属')}</span>
                      <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
                        <option value="">{tx('Global knowledge', '全局知识')}</option>
                        {characters.map((character) => (
                          <option key={character.id} value={character.id}>{character.name || character.id}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mcp-lab-field is-textarea">
                    <span>{tx('Content', '内容')}</span>
                    <textarea
                      value={noteContent}
                      onChange={(event) => setNoteContent(event.target.value)}
                      placeholder={tx('Page summary, setting note, or search result excerpt', '网页摘要、设定资料或查询结果摘录')}
                    />
                  </label>

                  <div className="mcp-lab-note-actions">
                    <form className="mcp-lab-knowledge-search" onSubmit={(event) => { event.preventDefault(); searchKnowledge(); }}>
                      <label className="mcp-lab-field">
                        <span>{tx('Search', '检索')}</span>
                        <input
                          value={knowledgeQuery}
                          onChange={(event) => setKnowledgeQuery(event.target.value)}
                          placeholder={tx('Search knowledge', '搜索资料')}
                        />
                      </label>
                      <ActionButton icon={Database} disabled={busy || !knowledgeQuery.trim()}>
                        {tx('Match', '匹配')}
                      </ActionButton>
                    </form>
                    <ActionButton icon={Save} variant="primary" disabled={busy || !noteContent.trim()} onClick={saveKnowledge}>
                      {tx('Save', '保存')}
                    </ActionButton>
                  </div>

                  <KnowledgeResultList results={knowledgeResults} lang={lang} />

                  <section className="mcp-lab-doc-strip" aria-label={tx('Saved documents', '已保存资料')}>
                    <div className="mcp-lab-section-head is-compact">
                      <h2>{tx('Saved Docs', '已保存资料')}</h2>
                      <Badge icon={FileText}>{docCount}</Badge>
                    </div>
                    {docCount > 0 ? (
                      <div className="mcp-lab-doc-list">
                        {docs.slice(0, 8).map((doc, index) => (
                          <article className="mcp-lab-doc-item" key={doc.id || doc.doc_id || `${doc.title || 'doc'}-${index}`}>
                            <strong>{doc.title || tx('Untitled note', '未命名资料')}</strong>
                            <span>{doc.source_type || 'note'} · {formatTime(doc.updated_at || doc.created_at)}</span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={FileText} title={tx('No saved documents', '暂无已保存资料')} />
                    )}
                  </section>
                </section>
              )}

              {activeTool === 'keys' && (
                <section className="mcp-lab-surface">
                  <div className="mcp-lab-section-head">
                    <div>
                      <span className="mcp-lab-section-kicker">{tx('Provider Settings', '搜索源设置')}</span>
                      <h2>{tx('Keys and Routing', '密钥与路由')}</h2>
                    </div>
                    <Badge icon={KeyRound}>{savedKeyCount}</Badge>
                  </div>

                  <div className="mcp-lab-provider-layout">
                    <section className="mcp-lab-provider-config">
                      <label className="mcp-lab-field">
                        <span>{tx('Preferred provider', '优先搜索源')}</span>
                        <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)}>
                          <option value="auto">{tx('Auto-select available search provider', '自动选择可用搜索源')}</option>
                          {providers.map(provider => (
                            <option key={provider.id} value={provider.id}>{provider.label}</option>
                          ))}
                          <option value="duckduckgo">{tx('DuckDuckGo, no key required', 'DuckDuckGo 免 Key')}</option>
                        </select>
                      </label>

                      {selectedProviderConfig ? (
                        <div className="mcp-lab-key-editor">
                          <div className="mcp-lab-key-title">
                            <KeyRound size={16} aria-hidden="true" />
                            <div>
                              <strong>{selectedProviderConfig.label}</strong>
                              <span>{selectedProviderConfig.has_key ? tx('API key saved', 'API Key 已保存') : tx('API key not saved', '未保存 API Key')}</span>
                            </div>
                          </div>
                          <label className="mcp-lab-field">
                            <span>API Key</span>
                            <input
                              type={webKeys[selectedProviderConfig.id] ? 'password' : 'text'}
                              value={webKeys[selectedProviderConfig.id] || ''}
                              onChange={(event) => setWebKeys(current => ({ ...current, [selectedProviderConfig.id]: event.target.value }))}
                              placeholder={selectedProviderConfig.has_key ? tx('Enter a new key to replace the saved key', '输入新 Key 可替换已保存 Key') : `${selectedProviderConfig.label} API Key`}
                            />
                          </label>
                          <div className="mcp-lab-key-actions">
                            {selectedProviderConfig.has_key && (
                              <Badge icon={Check} tone="success">
                                {selectedProviderConfig.source === 'env' ? tx('Environment variable', '环境变量') : tx('User config', '用户配置')}
                              </Badge>
                            )}
                            <ActionButton
                              icon={X}
                              variant={clearKeyIds.includes(selectedProviderConfig.id) ? 'danger' : 'secondary'}
                              onClick={() => toggleClearProvider(selectedProviderConfig.id)}
                            >
                              {tx('Clear', '清除')}
                            </ActionButton>
                          </div>
                        </div>
                      ) : (
                        <EmptyState icon={Settings2} title={selectedProvider === 'duckduckgo' ? 'DuckDuckGo' : tx('Auto mode', '自动模式')} />
                      )}

                      <ActionButton icon={Save} variant="primary" disabled={busy} onClick={() => saveWebConfig()}>
                        {tx('Save provider settings', '保存搜索源设置')}
                      </ActionButton>
                    </section>

                    <section className="mcp-lab-provider-list" aria-label={tx('Provider list', '搜索源列表')}>
                      {providers.map(renderProviderSummary)}
                      <article className={`mcp-lab-provider-row ${selectedProvider === 'duckduckgo' ? 'is-active' : ''}`}>
                        <button type="button" onClick={() => setSelectedProvider('duckduckgo')}>
                          <span className="mcp-lab-provider-dot" />
                          <span>
                            <strong>DuckDuckGo</strong>
                            <small>{tx('No key required', '无需 Key')}</small>
                          </span>
                        </button>
                        <Badge tone="success">{tx('Free', '免 Key')}</Badge>
                      </article>
                    </section>
                  </div>
                </section>
              )}
            </div>
          </main>

          {inspectorOpen && (
            <aside className="mcp-lab-inspector">
              <div className="mcp-lab-inspector-head">
                <div>
                  <span className="mcp-lab-section-kicker">{tx('Inspector', '检查器')}</span>
                  <strong>
                    {inspectorPanel === 'tasks'
                      ? tx('Task Trail', '任务轨迹')
                      : inspectorPanel === 'context'
                        ? tx('Role Context', '角色上下文')
                        : tx('Providers', '搜索源')}
                  </strong>
                </div>
                <IconButton icon={X} title={tx('Close', '关闭')} onClick={() => setInspectorOpen(false)} />
              </div>

              <div className="mcp-lab-inspector-tabs">
                <button
                  type="button"
                  className={inspectorPanel === 'tasks' ? 'is-active' : ''}
                  onClick={() => setInspectorPanel('tasks')}
                >
                  <ListChecks size={14} aria-hidden="true" />
                  <span>{tx('Tasks', '任务')}</span>
                </button>
                <button
                  type="button"
                  className={inspectorPanel === 'providers' ? 'is-active' : ''}
                  onClick={() => setInspectorPanel('providers')}
                >
                  <Settings2 size={14} aria-hidden="true" />
                  <span>{tx('Providers', '搜索源')}</span>
                </button>
                <button
                  type="button"
                  className={inspectorPanel === 'context' ? 'is-active' : ''}
                  onClick={() => {
                    setInspectorPanel('context');
                    if (characterId) loadContext(characterId);
                  }}
                >
                  <Database size={14} aria-hidden="true" />
                  <span>{tx('Context', '上下文')}</span>
                </button>
              </div>

              {inspectorPanel === 'tasks' ? (
                <div className="mcp-lab-inspector-scroll">
                  <div className="mcp-lab-task-list">
                    {taskItems.length === 0 && <EmptyState icon={Clock3} title={tx('No tasks yet', '还没有任务')} />}
                    {taskItems.map(task => (
                      <TaskRecord
                        key={task.id}
                        task={task}
                        selected={task.id === selectedTaskId}
                        providers={providers}
                        onSelect={selectTask}
                        onRerun={rerunTask}
                        onDelete={deleteTask}
                        lang={lang}
                      />
                    ))}
                  </div>
                  {selectedTask && <TaskOutputPreview task={selectedTask} providers={providers} lang={lang} />}
                </div>
              ) : inspectorPanel === 'context' ? (
                <ContextInspector
                  contextData={contextData}
                  loading={contextLoading}
                  error={contextError}
                  onRefresh={() => loadContext(characterId)}
                  characterName={selectedContextCharacterName}
                  lang={lang}
                />
              ) : (
                <div className="mcp-lab-inspector-scroll">
                  <div className="mcp-lab-provider-list is-inspector">
                    {providers.map(renderProviderSummary)}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      <footer className="mcp-lab-statusbar">
        <span>{tx('Current provider', '当前搜索源')}: <strong>{providerLabel(activeProvider, providers)}</strong></span>
        <span>{tx('Tasks', '任务')}: <strong>{taskItems.length}</strong></span>
        <span>{tx('Done', '完成')}: <strong>{completedTaskCount}</strong></span>
        <span>{tx('Errors', '错误')}: <strong>{erroredTaskCount}</strong></span>
        <span>{tx('Docs', '资料')}: <strong>{docCount}</strong></span>
        <span>{tx('Keys', 'Key')}: <strong>{savedKeyCount}</strong></span>
      </footer>
    </div>
  );
}
