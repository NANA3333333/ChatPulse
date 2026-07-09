import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Database, ExternalLink, FileText, Globe2, KeyRound, Play, RefreshCw, Save, Search, Trash2, Wifi } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

const panel = {
  height: '100%',
  background: 'transparent',
  color: '#342b34',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const iconButton = {
  width: '36px',
  height: '36px',
  border: '1px solid rgba(255, 111, 151, 0.32)',
  borderRadius: '8px',
  background: 'rgba(255, 247, 250, 0.88)',
  color: '#ff4f82',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
};

const primaryButton = {
  ...iconButton,
  width: 'auto',
  padding: '0 12px',
  gap: '6px',
  background: 'linear-gradient(180deg, #ff8bad 0%, #ff5c8c 100%)',
  borderColor: 'rgba(255, 79, 130, 0.42)',
  color: '#fff',
  fontWeight: 800
};

const inputStyle = {
  height: '36px',
  border: '1px solid rgba(255, 111, 151, 0.30)',
  borderRadius: '8px',
  padding: '0 10px',
  fontSize: '13px',
  outline: 'none',
  background: 'rgba(255, 255, 255, 0.88)',
  color: '#342b34',
  minWidth: 0
};

const textAreaStyle = {
  ...inputStyle,
  height: '96px',
  resize: 'vertical',
  padding: '8px 10px',
  lineHeight: 1.45
};

const sectionStyle = {
  background: 'rgba(255, 255, 255, 0.88)',
  border: '1px solid rgba(255, 111, 151, 0.24)',
  borderRadius: '8px',
  padding: '14px',
  boxShadow: '0 7px 16px rgba(255, 111, 151, 0.08)'
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  height: '22px',
  padding: '0 8px',
  borderRadius: '999px',
  border: '1px solid rgba(255, 111, 151, 0.26)',
  background: 'rgba(255, 247, 250, 0.86)',
  color: '#806273',
  fontSize: '11px',
  whiteSpace: 'nowrap'
};

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

function formatRawJson(value) {
  if (!value) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const rawBlockStyle = {
  marginTop: '6px',
  padding: '8px',
  border: '1px solid rgba(255, 111, 151, 0.20)',
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.92)',
  color: '#59424e',
  fontSize: '11px',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  maxWidth: '100%',
  maxHeight: '320px',
  overflowY: 'auto',
  overflowX: 'hidden'
};

function TaskRecord({ task, selected, expanded = false, providers, onSelect, onRerun, onDelete, lang }) {
  const isEn = lang === 'en';
  const source = task.output?.source || task.input?.provider || '';
  const statusColor = task.status === 'done' ? '#16a34a' : task.status === 'error' ? '#dc2626' : '#806273';
  const outputResults = Array.isArray(task.output?.results) ? task.output.results : [];
  const outputText = task.output?.text || task.output?.url || '';
  const showOutput = expanded || selected;
  const handleTitleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(task);
    }
  };
  return (
    <div
      className={`mcp-command-task-record ${selected ? 'is-selected' : ''}`}
      style={{
        border: selected ? '1px solid rgba(255, 79, 130, 0.52)' : '1px solid rgba(255, 111, 151, 0.22)',
        borderRadius: '14px',
        padding: '12px 14px',
        background: selected ? 'rgba(255, 240, 246, 0.94)' : 'rgba(255, 255, 255, 0.88)',
        minWidth: 0
      }}
    >
      <div className="mcp-command-task-meta">
        <span className="mcp-command-task-kind" style={{ color: statusColor }}>
          {task.status === 'done' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
          {taskKindLabel(task.kind, lang)}
        </span>
        <span className="mcp-command-task-time">{formatTime(task.finished_at || task.created_at)}</span>
        <div className="mcp-command-task-submeta">
          <span className="mcp-command-task-status" style={{ color: statusColor }}>{task.status}</span>
          {source && <span className="mcp-command-task-source">{providerLabel(normalizeProviderId(String(source)), providers)}</span>}
        </div>
      </div>
      <div
        className="mcp-command-task-title"
        role="button"
        tabIndex={0}
        onClick={() => onSelect(task)}
        onKeyDown={handleTitleKeyDown}
        title={isEn ? 'View task output' : '查看任务输出'}
      >
        {task.title}
      </div>
      <div className="mcp-command-task-actions">
        <button style={{ ...iconButton, width: '28px', height: '28px' }} onClick={() => onRerun(task)} title={isEn ? 'Run again' : '重新执行'}><Play size={14} /></button>
        <button style={{ ...iconButton, width: '28px', height: '28px' }} onClick={() => onDelete(task)} title={isEn ? 'Delete' : '删除'}><Trash2 size={14} /></button>
      </div>
      {task.error && <div className="mcp-command-wrap-text" style={{ color: '#dc2626', fontSize: '11px', marginTop: '6px' }}>{task.error}</div>}
      {showOutput && (outputResults.length > 0 || outputText) && (
        <div className="mcp-command-task-output" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 111, 151, 0.20)', display: 'grid', gap: '6px' }}>
          {outputResults.map((item, index) => (
            <div className="mcp-command-output-item" key={`${item.url || item.title}-${index}`} style={{ display: 'grid', gap: '2px' }}>
              <div className="mcp-command-output-title" style={{ fontSize: '12px', fontWeight: 700, color: '#342b34' }}>{item.title || item.url || (isEn ? 'Result' : '结果')}</div>
              {item.snippet && <div className="mcp-command-wrap-text" style={{ fontSize: '11px', color: '#806273', lineHeight: 1.45 }}>{item.snippet}</div>}
              {item.url && <a className="mcp-command-text-link" href={item.url} target="_blank" rel="noreferrer" style={{ color: '#ff4f82', fontSize: '11px', textDecoration: 'none' }}>{isEn ? 'Open source' : '打开来源'}</a>}
              {item.page_text && (
                <details className="mcp-command-details" style={{ marginTop: '4px' }}>
                  <summary style={{ cursor: 'pointer', color: '#ff4f82', fontSize: '11px' }}>{isEn ? 'View fetched text' : '查看抓取正文'}</summary>
                  <pre style={rawBlockStyle}>{item.page_text}</pre>
                </details>
              )}
              {item.page_error && <div className="mcp-command-wrap-text" style={{ color: '#b91c1c', fontSize: '11px' }}>{isEn ? 'Page text fetch failed: ' : '正文抓取失败：'}{item.page_error}</div>}
              {item.raw && (
                <details className="mcp-command-details" style={{ marginTop: '4px' }}>
                  <summary style={{ cursor: 'pointer', color: '#ff4f82', fontSize: '11px' }}>{isEn ? 'View raw API response' : '查看 API 原始返回'}</summary>
                  <pre style={rawBlockStyle}>{formatRawJson(item.raw)}</pre>
                </details>
              )}
            </div>
          ))}
          {task.output?.raw_response && (
            <details className="mcp-command-details">
              <summary style={{ cursor: 'pointer', color: '#ff4f82', fontSize: '11px' }}>{isEn ? 'View full response for this query' : '查看本次查询完整响应'}</summary>
              <pre style={rawBlockStyle}>{formatRawJson(task.output.raw_response)}</pre>
            </details>
          )}
          {!outputResults.length && outputText && (
            <div className="mcp-command-wrap-text" style={{ fontSize: '11px', color: '#806273', lineHeight: 1.45 }}>
              {outputText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultList({ result, lang }) {
  const isEn = lang === 'en';
  const results = Array.isArray(result?.results) ? result.results : [];
  if (!result || results.length === 0) return null;
  return (
    <div className="mcp-command-result-list" style={{ marginTop: '10px', borderTop: '1px solid rgba(255, 111, 151, 0.20)', paddingTop: '10px', display: 'grid', gap: '8px' }}>
      <div className="mcp-command-result-head" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '12px' }}>{isEn ? 'Search Results' : '本次查询结果'}</div>
        <span style={badgeStyle}>{result.source || 'web'} / {results.length}</span>
      </div>
      <div className="mcp-command-result-stack" style={{ display: 'grid', gap: '7px' }}>
        {results.map((item, index) => (
          <div className="mcp-command-result-item" key={`${item.url || item.title}-${index}`} style={{ border: '1px solid rgba(255, 111, 151, 0.20)', borderRadius: '8px', padding: '8px', background: 'rgba(255, 247, 250, 0.72)' }}>
            <div className="mcp-command-result-layout" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mcp-command-output-title" style={{ fontSize: '12px', fontWeight: 700, color: '#342b34' }}>
                  {item.title || item.url || (isEn ? `Result ${index + 1}` : `结果 ${index + 1}`)}
                </div>
                {item.snippet && (
                  <div className="mcp-command-wrap-text" style={{ marginTop: '3px', color: '#806273', fontSize: '11px', lineHeight: 1.5 }}>
                    {item.snippet}
                  </div>
                )}
                {item.raw && (
                  <details className="mcp-command-details" style={{ marginTop: '6px' }}>
                    <summary style={{ cursor: 'pointer', color: '#ff4f82', fontSize: '11px' }}>{isEn ? 'Expand API fields' : '展开 API 返回字段'}</summary>
                    <pre style={rawBlockStyle}>{formatRawJson(item.raw)}</pre>
                  </details>
                )}
                {item.page_text && (
                  <details className="mcp-command-details" style={{ marginTop: '6px' }}>
                    <summary style={{ cursor: 'pointer', color: '#ff4f82', fontSize: '11px' }}>{isEn ? 'Expand fetched text' : '展开抓取正文'}</summary>
                    <pre style={rawBlockStyle}>{item.page_text}</pre>
                  </details>
                )}
                {item.page_error && <div className="mcp-command-wrap-text" style={{ color: '#b91c1c', fontSize: '11px', marginTop: '4px' }}>{isEn ? 'Page text fetch failed: ' : '正文抓取失败：'}{item.page_error}</div>}
              </div>
              {item.url && (
                <a
                  className="mcp-command-source-icon"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...iconButton, width: '28px', height: '28px', textDecoration: 'none', flexShrink: 0 }}
                  title={isEn ? 'Open source' : '打开来源'}
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {result.raw_response && (
        <details className="mcp-command-details">
          <summary style={{ cursor: 'pointer', color: '#ff4f82', fontSize: '11px' }}>{isEn ? 'View full response for this query' : '查看本次查询完整响应'}</summary>
          <pre style={rawBlockStyle}>{formatRawJson(result.raw_response)}</pre>
        </details>
      )}
    </div>
  );
}

function KnowledgeResultList({ results, lang }) {
  const isEn = lang === 'en';
  if (!Array.isArray(results) || results.length === 0) return null;
  return (
    <div className="mcp-command-knowledge-results">
      <div className="mcp-command-result-head">
        <div>{isEn ? 'Knowledge Matches' : '资料命中'}</div>
        <span style={badgeStyle}>{results.length}</span>
      </div>
      <div className="mcp-command-result-stack">
        {results.map((item, index) => (
          <article className="mcp-command-knowledge-hit" key={`${item.chunk_id || item.doc_id || item.title}-${index}`}>
            <div className="mcp-command-knowledge-hit-head">
              <div>
                <strong>{item.title || (isEn ? 'Untitled note' : '未命名资料')}</strong>
                <span>{item.source_type || 'note'} · {isEn ? 'score' : '分数'} {item.score ?? 0}</span>
              </div>
              {item.source_url && (
                <a
                  className="mcp-command-source-icon"
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...iconButton, width: '28px', height: '28px', textDecoration: 'none', flexShrink: 0 }}
                  title={isEn ? 'Open source' : '打开来源'}
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            <p className="mcp-command-wrap-text">{item.content}</p>
          </article>
        ))}
      </div>
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

  function toggleClearProvider(providerId) {
    setClearKeyIds((current) => current.includes(providerId)
      ? current.filter(id => id !== providerId)
      : [...current, providerId]);
  }

  function selectTask(task) {
    setSelectedTaskId(current => current === task.id ? '' : task.id);
  }

  const taskItems = Array.isArray(tasks) ? tasks : [];
  const completedTaskCount = taskItems.filter(task => task.status === 'done').length;
  const erroredTaskCount = taskItems.filter(task => task.status === 'error').length;
  const savedKeyCount = Number(webConfig?.saved_key_count ?? providers.filter(provider => provider.has_key).length ?? 0);
  const docCount = Array.isArray(docs) ? docs.length : 0;
  const selectedKnowledgeOwner = characterId
    ? (characters.find(character => String(character.id) === String(characterId))?.name || characterId)
    : tx('Global', '全局');

  return (
    <div className="mcp-lab-panel mcp-command-page" style={panel}>
      <header className="mcp-command-topbar">
        <div className="mcp-command-brand">
          <div className="command-page-kicker"><Wifi size={16} /> {tx('MCP Lab', 'MCP 实验室')}</div>
          <h1>{tx('Research Workbench', '联网研究工作台')}</h1>
        </div>

        <div className="mcp-command-metrics" aria-label={tx('MCP lab status metrics', 'MCP 实验室状态指标')}>
          <div>
            <span>{tx('Tasks', '任务')}</span>
            <strong>{taskItems.length}</strong>
          </div>
          <div>
            <span>{tx('Done', '完成')}</span>
            <strong>{completedTaskCount}</strong>
          </div>
          <div>
            <span>{tx('Errors', '错误')}</span>
            <strong>{erroredTaskCount}</strong>
          </div>
          <div>
            <span>{tx('Docs', '资料')}</span>
            <strong>{docCount}</strong>
          </div>
          <div>
            <span>{tx('Keys', 'Key')}</span>
            <strong>{savedKeyCount}</strong>
          </div>
        </div>

        <div className="mcp-command-top-actions">
          <span className="command-status-pill"><Globe2 size={12} /> {providerLabel(activeProvider, providers)}</span>
          <button type="button" className="command-icon-button" onClick={load} title={tx('Refresh', '刷新')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {error && <div className="command-alert command-alert--danger">{error}</div>}
      {notice && <div className="command-alert command-alert--notice">{notice}</div>}

      <div className="mcp-lab-panel__body">
        <div className="mcp-command-workspace">
          <aside className="mcp-command-left">
            <section className="command-card mcp-command-card mcp-command-connect-card" style={sectionStyle}>
              <div className="command-card-title mcp-command-card-title">
                <h2><KeyRound size={18} /> {tx('Provider', '搜索源')}</h2>
                <span className="command-status-pill">{tx('Current', '当前')}：{providerLabel(activeProvider, providers)}</span>
              </div>

              <div className="mcp-command-provider-copy">
                <strong>
                  {selectedProviderConfig
                    ? selectedProviderConfig.label
                    : (selectedProvider === 'duckduckgo' ? 'DuckDuckGo' : tx('Auto mode', '自动模式'))}
                </strong>
                <span>
                  {selectedProviderConfig
                    ? (selectedProviderConfig.has_key ? tx('API key saved', 'API Key 已保存') : tx('API key not saved', '未保存 API Key'))
                    : tx('Saved providers / DuckDuckGo', '已保存源 / DuckDuckGo')}
                </span>
              </div>

              <div className="mcp-command-provider-controls">
                <select style={inputStyle} value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
                  <option value="auto">{tx('Auto-select available search provider', '自动选择可用搜索源')}</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                  <option value="duckduckgo">{tx('DuckDuckGo, no key required', 'DuckDuckGo 免 Key')}</option>
                </select>
                <button style={iconButton} onClick={saveWebConfig} disabled={busy} title={tx('Save web keys and search provider', '保存联网 Key 与搜索源')}>
                  <Save size={15} />
                </button>
              </div>

              {selectedProviderConfig && (
                <div className="mcp-command-key-panel">
                  <div className="mcp-command-key-status">
                    {selectedProviderConfig.has_key && (
                      <>
                        <span className="mcp-command-good-pill">{tx('Saved', '已保存')}</span>
                        <span className="mcp-command-soft-pill">{selectedProviderConfig.source === 'env' ? tx('Environment variable', '环境变量') : tx('User config', '用户配置')}</span>
                      </>
                    )}
                  </div>
                  <div className="mcp-command-key-input">
                    <KeyRound size={14} />
                    <input
                      style={inputStyle}
                      type={webKeys[selectedProviderConfig.id] ? 'password' : 'text'}
                      value={webKeys[selectedProviderConfig.id] || ''}
                      onChange={(e) => setWebKeys(current => ({ ...current, [selectedProviderConfig.id]: e.target.value }))}
                      placeholder={selectedProviderConfig.has_key ? tx('Enter a new key to replace the saved key', '输入新 Key 可替换已保存 Key') : `${selectedProviderConfig.label} API Key`}
                    />
                    <button
                      className={clearKeyIds.includes(selectedProviderConfig.id) ? 'is-danger' : ''}
                      style={{ ...iconButton, width: 'auto', padding: '0 10px' }}
                      onClick={() => toggleClearProvider(selectedProviderConfig.id)}
                      title={tx('Mark this user-level key for clearing, then save to apply', '标记清除这个用户级 Key，再点保存生效')}
                    >
                      {tx('Clear', '清除')}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="command-card mcp-command-card mcp-command-run-card" style={sectionStyle}>
              <div className="command-card-title mcp-command-card-title">
                <h2><Play size={18} /> {tx('Run', '运行')}</h2>
                <span className="command-status-pill">{busy ? tx('Busy', '执行中') : tx('Ready', '就绪')}</span>
              </div>

              <div className="mcp-command-tool-stack">
                <div className="mcp-command-tool">
                  <div className="mcp-command-block-head">
                    <span><Search size={16} /> {tx('Search', '搜索')}</span>
                    <small>{tx('Web query', '联网查询')}</small>
                  </div>
                  <div className="mcp-command-field-row">
                    <input style={inputStyle} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('Search keywords', '搜索关键词')} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
                    <button style={{ ...primaryButton, width: '42px', padding: 0 }} onClick={runSearch} disabled={busy || !query.trim()} title={tx('Search', '搜索')} aria-label={tx('Search', '搜索')}>
                      <Search size={15} />
                    </button>
                  </div>
                  <button style={iconButton} className="mcp-command-wide-action" onClick={() => createTask('web_search')} disabled={busy || !query.trim()} title={tx('Create and run a search task', '创建并执行查询任务')}>
                    <Play size={15} /> {tx('Task', '任务')}
                  </button>
                </div>

                <div className="mcp-command-tool">
                  <div className="mcp-command-block-head">
                    <span><ExternalLink size={16} /> {tx('Fetch Page', '抓取网页')}</span>
                    <small>{tx('URL text', 'URL 正文')}</small>
                  </div>
                  <div className="mcp-command-field-row">
                    <input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" onKeyDown={(e) => { if (e.key === 'Enter') fetchUrl(); }} />
                    <button style={{ ...primaryButton, width: '42px', padding: 0 }} onClick={fetchUrl} disabled={busy || !url.trim()} title={tx('Fetch', '抓取')} aria-label={tx('Fetch', '抓取')}>
                      <ExternalLink size={15} />
                    </button>
                  </div>
                  <button style={iconButton} className="mcp-command-wide-action" onClick={() => createTask('fetch_url')} disabled={busy || !url.trim()} title={tx('Create and run a fetch task', '创建并执行抓取任务')}>
                    <Play size={15} /> {tx('Task', '任务')}
                  </button>
                </div>
              </div>
            </section>
          </aside>

          <main className="mcp-command-main">
            <section className="command-card mcp-command-card mcp-command-results-card" style={sectionStyle}>
              <div className="command-card-title mcp-command-card-title">
                <h2><Globe2 size={19} /> {tx('Results', '结果')}</h2>
                <span className="command-status-pill">{searchResult?.source ? providerLabel(normalizeProviderId(String(searchResult.source)), providers) : tx('No run', '未运行')}</span>
              </div>
              {searchResult ? (
                <SearchResultList result={searchResult} lang={lang} />
              ) : (
                <div className="command-empty mcp-command-empty-state">
                  <Search size={18} />
                  <span>{tx('Waiting for output', '等待输出')}</span>
                </div>
              )}

              <div className="mcp-command-results-history">
                <div className="command-card-title mcp-command-card-title">
                  <h2><Clock3 size={18} /> {tx('Reports', '任务报告')}</h2>
                  <span className="command-status-pill">{taskItems.length}</span>
                </div>
                <div className="mcp-command-task-list">
                  {taskItems.length === 0 && <div className="command-empty">{tx('No tasks yet.', '还没有任务。')}</div>}
                  {taskItems.map(task => (
                    <TaskRecord
                      key={task.id}
                      task={task}
                      selected={task.id === selectedTaskId}
                      expanded={task.id === selectedTaskId}
                      providers={providers}
                      onSelect={selectTask}
                      onRerun={rerunTask}
                      onDelete={deleteTask}
                      lang={lang}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="command-card mcp-command-card mcp-command-notes-card" style={sectionStyle}>
              <div className="command-card-title mcp-command-card-title">
                <h2><FileText size={19} /> {tx('Knowledge', '资料')}</h2>
                <span className="command-status-pill">{selectedKnowledgeOwner}</span>
              </div>

              <div className="mcp-command-note-grid">
                <input style={inputStyle} value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder={tx('Title', '标题')} />
                <input style={inputStyle} value={noteUrl} onChange={(e) => setNoteUrl(e.target.value)} placeholder={tx('Source URL, optional', '来源 URL，可空')} />
                <select style={inputStyle} value={characterId} onChange={(e) => setCharacterId(e.target.value)} title={tx('Knowledge owner character', '知识归属角色')}>
                  <option value="">{tx('Global knowledge', '全局知识')}</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>{character.name || character.id}</option>
                  ))}
                </select>
              </div>

              <textarea style={textAreaStyle} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder={tx('Page summary, setting note, or search result excerpt', '网页摘要、设定资料或查询结果摘录')} />

              <div className="mcp-command-note-actions">
                <div className="mcp-command-knowledge-search">
                  <input style={inputStyle} value={knowledgeQuery} onChange={(e) => setKnowledgeQuery(e.target.value)} placeholder={tx('Search knowledge', '搜索资料')} onKeyDown={(e) => { if (e.key === 'Enter') searchKnowledge(); }} />
                  <button style={iconButton} onClick={searchKnowledge} disabled={busy || !knowledgeQuery.trim()} title={tx('Search knowledge', '搜索资料')}>
                    <Database size={15} />
                  </button>
                </div>
                <button style={primaryButton} className="mcp-command-save-note" onClick={saveKnowledge} disabled={busy || !noteContent.trim()} title={tx('Save knowledge', '保存知识')}>
                  <Save size={15} /> {tx('Save', '保存')}
                </button>
              </div>

              <KnowledgeResultList results={knowledgeResults} lang={lang} />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
