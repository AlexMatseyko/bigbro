const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const fs = require('fs');
// Use global fetch (Node 18+) to avoid node-fetch url.parse() deprecation

/**
 * Aspro.Cloud API v1:
 * - API-ключ только в query string (?api_key=...), обязателен для запросов.
 * - Список пользователей: GET /api/v1/module/core/user/list?api_key=...&filter[email]=...
 * - Профиль в UI: /cabinet/user/{id} — id из items[0].id (aspro_id).
 */

// BASE_URL и api_key из .env (ASPRO_API_BASE, ASPRO_API_KEY)
const ASPRO_API_BASE = process.env.ASPRO_API_BASE || 'https://alexligear1.aspro.cloud/api/v1';
/** Базовый URL портала (без /api/v1) — для REST-компонентов вроде Kanban доски. */
const ASPRO_PORTAL_BASE = ASPRO_API_BASE.replace(/\/api\/v1\/?$/, '') || 'https://alexligear1.aspro.cloud';
/** Эндпоинт списка пользователей (документация Aspro) */
const ASPRO_USER_LIST_PATH = '/module/core/user/list';
const ASPRO_USER_LIST_URL = `${ASPRO_API_BASE}${ASPRO_USER_LIST_PATH}`;
const DEFAULT_BASE_URL = process.env.ASPRO_BASE_URL || process.env.ASPRO_API_BASE || 'https://api.aspro.cloud';

const ASPRO_CLIENT_ID = process.env.ASPRO_CLIENT_ID;
const ASPRO_CLIENT_SECRET = process.env.ASPRO_CLIENT_SECRET;

let _tasksEndpoint = null;
let _oauthToken = null;
let _oauthExpiresAt = 0;

// Варианты URL эндпоинта для ПОЛУЧЕНИЯ токена (POST → ответ с access_token). Точный URL см. в aspro.cloud/api
const ASPRO_BASE = 'https://alexligear1.aspro.cloud';
const TOKEN_PATH_CANDIDATES = [
  process.env.ASPRO_OAUTH_TOKEN_URL,
  `${ASPRO_BASE}/api/v1/oauth/token`,
  `${ASPRO_BASE}/oauth2/token`,
  `${ASPRO_BASE}/oauth/token`,
  'https://aspro.cloud/api/v1/oauth/token',
  'https://aspro.cloud/oauth2/token'
].filter(Boolean);

/**
 * Возвращает JWT access_token только из OAuth 2.0 (эндпоинт токена). Для обычного API-ключа не используется.
 * @returns {Promise<string|null>}
 */
async function getAccessToken() {
  const now = Date.now();
  if (_oauthToken && _oauthExpiresAt > now + 60000) {
    return _oauthToken;
  }

  const apiKey = process.env.ASPRO_API_KEY || null;
  if (ASPRO_CLIENT_ID && ASPRO_CLIENT_SECRET && apiKey) {
    const baseParams = {
      grant_type: 'client_credentials',
      client_id: ASPRO_CLIENT_ID,
      client_secret: ASPRO_CLIENT_SECRET,
      api_key: apiKey
    };
    const opts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Api-Key': apiKey
      }
    };
    for (const tokenUrl of TOKEN_PATH_CANDIDATES) {
      const isCentral = tokenUrl && tokenUrl.startsWith('https://aspro.cloud/');
      const bodyParams = { ...baseParams };
      if (isCentral) {
        bodyParams.domain = 'alexligear1';
        bodyParams.audience = 'https://alexligear1.aspro.cloud';
      }
      opts.body = new URLSearchParams(bodyParams).toString();
      try {
        const res = await fetch(tokenUrl, opts);
        const data = await res.json().catch(() => ({}));
        const tokenFromBody = data.access_token || data.token || (data.data && (data.data.access_token || data.data.token)) || (data.result && data.result.access_token);
        const tokenFromHeader = res.headers.get('x-access-token') || res.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        const token = tokenFromBody || tokenFromHeader || null;

        if (res.ok && token) {
          _oauthToken = token;
          _oauthExpiresAt = (data.expires_in != null ? data.expires_in : 3600) * 1000 + now;
          console.log('Aspro OAuth: access_token получен с', tokenUrl, ', истекает через', (data.expires_in != null ? data.expires_in : 3600), 'с');
          return _oauthToken;
        }
        if (res.ok && !token) {
          console.warn('Aspro OAuth token', tokenUrl, '→ 200, но токен не найден. Body:', JSON.stringify(data), 'Keys:', Object.keys(data));
        } else if (res.status !== 404) {
          console.warn('Aspro OAuth token', tokenUrl, '→', res.status, data);
        }
      } catch (err) {
        console.warn('Aspro OAuth token', tokenUrl, err.message);
      }
    }
  }

  return null;
}

/** API-ключ из .env — передаётся только в query string, не в Authorization. */
function getApiKey() {
  return process.env.ASPRO_API_KEY || null;
}

/**
 * Подготавливает URL и заголовки для запроса к Aspro API.
 * api_key обязательно в query string: ?api_key={{apiKey}} (иначе API вернёт "api key not found").
 * @param {string} baseUrl
 * @param {Record<string, string>} [extraQuery]
 * @param {string|null} [overrideApiKey] — если передан, используется вместо getApiKey()
 * @returns {Promise<{ url: string, headers: Record<string, string> }>}
 */
async function buildAsproRequestOptions(baseUrl, extraQuery = {}, overrideApiKey = null) {
  const url = new URL(baseUrl);
  const apiKey = overrideApiKey !== undefined && overrideApiKey !== null ? String(overrideApiKey).trim() : (getApiKey() || '').trim();
  if (!apiKey) {
    console.warn('Aspro API: api_key пустой — запрос может вернуть error_code 11 (api key not found)');
  } else {
    url.searchParams.set('api_key', apiKey);
  }
  Object.entries(extraQuery).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const headers = { 'Content-Type': 'application/json' };
  return { url: url.toString(), headers };
}

/** Из ASPRO_API_BASE извлекаем поддомен (company) для подстановки в URL из spec. */
function getAsproCompany() {
  const m = ASPRO_API_BASE.match(/https?:\/\/([^.]+)\.aspro\.cloud/);
  return process.env.ASPRO_COMPANY || (m && m[1]) || 'alexligear1';
}

/**
 * Загружает URL эндпоинта из openapiru.json (поддомен из ASPRO_API_BASE или ASPRO_COMPANY).
 * Для tasks и users spec не используется — ASPRO_USER_LIST_URL и ASPRO_API_BASE + '/tasks'.
 */
function getEndpointFromSpec(segment, method = 'get') {
  if (segment === 'users') return null;
  if (segment === 'tasks') return null;
  try {
    const specPath = path.join(__dirname, '..', 'openapiru.json');
    const raw = fs.readFileSync(specPath, 'utf8');
    const spec = JSON.parse(raw);
    let baseUrl = (spec.servers && spec.servers[0] && spec.servers[0].url)
      ? String(spec.servers[0].url).replace(/\/$/, '')
      : DEFAULT_BASE_URL;
    baseUrl = baseUrl.replace(/\{company\}/g, getAsproCompany());
    const paths = spec.paths || {};
    for (const pathKey of Object.keys(paths)) {
      if (!pathKey.toLowerCase().includes(segment)) continue;
      const pathItem = paths[pathKey];
      if (!pathItem || !pathItem.get) continue;
      const p = pathKey.startsWith('/') ? pathKey : `/${pathKey}`;
      if (!p.includes('{') && !p.includes('}')) {
        return p.startsWith('http') ? p : `${baseUrl}${p}`;
      }
    }
  } catch (err) {
    console.error('Aspro getEndpointFromSpec error:', err.message);
  }
  return null;
}

/**
 * URL для списка задач Aspro (по документации openapiru.json).
 * Все запросы идут по шаблону: /api/v1/module/{module_name}/{entity_name}/{method}.
 * Задачи: модуль "task", сущность "tasks", метод list → /module/task/tasks/list.
 * Эндпоинта /api/v1/tasks не существует (404).
 */
/** Эндпоинт списка задач: /api/v1/module/task/tasks/list (без шаблонов — filter[template]=0). */
const ASPRO_TASKS_LIST_PATH = '/module/task/tasks/list';
const ASPRO_STAGES_LIST_PATH = '/module/task/stages/list';
/** Fallback: agile issues (если task/tasks/list отдаёт только шаблоны). */
const ASPRO_AGILE_ISSUES_LIST_PATH = '/module/agile/issues/list';

function getTasksEndpoint() {
  if (_tasksEndpoint) return _tasksEndpoint;
  _tasksEndpoint = `${ASPRO_API_BASE}${ASPRO_TASKS_LIST_PATH}`;
  return _tasksEndpoint;
}

function getAgileIssuesEndpoint() {
  return `${ASPRO_API_BASE}${ASPRO_AGILE_ISSUES_LIST_PATH}`;
}

/** URL списка этапов (stages) workflow — по openapiru.json: /task/stages/list. */
function getStagesEndpoint() {
  return `${ASPRO_API_BASE}${ASPRO_STAGES_LIST_PATH}`;
}

/** URL одной задачи: GET /module/task/tasks/get/{id} (openapiru.json). */
function getTaskGetUrl(id) {
  return `${ASPRO_API_BASE}/module/task/tasks/get/${encodeURIComponent(String(id))}`;
}

/** URL обновления задачи: POST /module/task/tasks/update/{id} (openapiru.json), body: application/x-www-form-urlencoded. */
function getTaskUpdateUrl(id) {
  return `${ASPRO_API_BASE}/module/task/tasks/update/${encodeURIComponent(String(id))}`;
}

/** Путь к странице задачи в веб-интерфейсе портала (можно задать в .env: ASPRO_TASK_VIEW_PATH). Формат: .../view/task/328 */
const ASPRO_TASK_VIEW_PATH = process.env.ASPRO_TASK_VIEW_PATH || '/_module/task/view/task/';

/**
 * URL страницы задачи в браузере (портал Aspro). Открывается для перехода пользователя к задаче.
 * @param {string|number} taskId
 * @returns {string}
 */
function getAsproTaskPortalUrl(taskId) {
  if (taskId == null) return '';
  const base = ASPRO_PORTAL_BASE.replace(/\/$/, '');
  const path = ASPRO_TASK_VIEW_PATH.startsWith('/') ? ASPRO_TASK_VIEW_PATH : `/${ASPRO_TASK_VIEW_PATH}`;
  return `${base}${path}${encodeURIComponent(String(taskId))}`;
}

/**
 * Список задач для пользователя из API task/tasks/list.
 * Важно: показываем задачи, где пользователь — исполнитель (ответственный), а не постановщик (owner).
 * В Aspro filter[responsible] может означать постановщика, поэтому запрашиваем по полям исполнителя:
 * responsible_id, assignee_id, executor_id, user_id. Объединяем результаты по id.
 * @param {string|number} asproUserId — ID пользователя в Aspro (исполнитель / ответственный).
 * @returns {Promise<{ items: Array, fromAgile: boolean }>}
 */
async function getAsproTasksListForUser(asproUserId) {
  const uid = String(asproUserId).trim();
  if (!uid) return { items: [], fromAgile: false };

  const baseUrl = getTasksEndpoint();
  const limit = '50';
  /** Страниц на каждый фильтр (50 × maxPages задач). Новые задачи часто имеют большой id — при сортировке по id ASC нужны все страницы до лимита. */
  const maxPages = 50;
  let allItems = [];

  const tryTaskList = async (extraFilter) => {
    const collected = [];
    for (let page = 1; page <= maxPages; page++) {
      const query = {
        limit,
        page: String(page),
        'filter[type]': '!30',
        ...extraFilter
      };
      const { url: fullUrl, headers } = await buildAsproRequestOptions(baseUrl, query);
      console.log('Aspro tasks list (fullUrl):', fullUrl.replace(/api_key=[^&]+/, 'api_key=***'));

      const res = await fetch(fullUrl, { method: 'GET', headers });
      const data = await res.json().catch(() => ({}));
      const items = data.response?.items ?? data.items ?? (Array.isArray(data) ? data : []);
      if (!Array.isArray(items) || items.length === 0) break;

      console.log(
        'Aspro tasks list:',
        items.length,
        items.map((i) => ({ id: i.id, name: i.name, type: i.type ?? 'нет' }))
      );
      collected.push(...items);
      const total = data.response?.total ?? data.total ?? 0;
      if (collected.length >= total || items.length < parseInt(limit, 10)) break;
    }
    return collected;
  };

  // Запрашиваем по полям исполнителя (ответственный), не постановщика (owner). Объединяем по id.
  const [byResponsibleId, byAssigneeId, byExecutorId, byUserId, byResponsible] = await Promise.all([
    tryTaskList({ 'filter[responsible_id]': uid }),
    tryTaskList({ 'filter[assignee_id]': uid }),
    tryTaskList({ 'filter[executor_id]': uid }),
    tryTaskList({ 'filter[user_id]': uid }),
    tryTaskList({ 'filter[responsible]': uid, 'filter[responsible][neq]': '0' }) // на случай если в API responsible = исполнитель
  ]);
  const byId = new Map();
  for (const t of [...byResponsibleId, ...byAssigneeId, ...byExecutorId, ...byUserId, ...byResponsible]) {
    if (t && t.id != null) byId.set(String(t.id), t);
  }

  // Доп. запрос «новые сначала»: если API лимитирует общий список (напр. 375), новые задачи с большим id не попадают.
  const orderVariants = [
    { 'filter[type]': '!30', 'order[id]': 'desc' },
    { 'filter[type]': '!30', order: 'id_desc' },
    { 'filter[type]': '!30', sort: '-id' },
    { 'order[id]': 'desc' }
  ];
  for (const extra of orderVariants) {
    const query = {
      limit: '100',
      page: '1',
      'filter[responsible_id]': uid,
      ...extra
    };
    const { url: fullUrl, headers } = await buildAsproRequestOptions(baseUrl, query);
    const res = await fetch(fullUrl, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    const items = data.response?.items ?? data.items ?? (Array.isArray(data) ? data : []);
    if (Array.isArray(items) && items.length > 0) {
      for (const t of items) {
        if (t && t.id != null) byId.set(String(t.id), t);
      }
      break;
    }
  }

  allItems = Array.from(byId.values());

  if (allItems.length === 0) {
    const agileUrl = getAgileIssuesEndpoint();
    const agileQuery = {
      'filter[assignee_id]': uid,
      'filter[is_archived]': '0',
      limit,
      page: '1'
    };
    const { url: fullUrl, headers } = await buildAsproRequestOptions(agileUrl, agileQuery);
    console.log('Aspro agile issues (fallback fullUrl):', fullUrl.replace(/api_key=[^&]+/, 'api_key=***'));

    const res = await fetch(fullUrl, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    const items = data.response?.items ?? data.items ?? (Array.isArray(data) ? data : []);
    console.log(
      'Aspro agile issues:',
      items.length,
      items.map((i) => ({ id: i.id, name: i.name, template: i.template, type: i.type ?? 'нет' }))
    );
    return { items: Array.isArray(items) ? items : [], fromAgile: true };
  }

  return { items: allItems, fromAgile: false };
}

/**
 * Данные доски Kanban — тот же источник, что и на странице /_module/task/view/board.
 * REST: GET /rest/component/VueKanban2/Kanban/get_data/
 */
async function getAsproKanbanData() {
  const path = '/rest/component/VueKanban2/Kanban/get_data/';
  const url = `${ASPRO_PORTAL_BASE}${path}`;
  const { url: fullUrl, headers } = await buildAsproRequestOptions(url);
  const res = await fetch(fullUrl, { method: 'GET', headers });
  if (!res.ok) return { tasks: [] };
  const data = await res.json().catch(() => ({}));
  let list = data.tasks ?? data.items ?? data.response?.items ?? data.response?.tasks;
  if (!Array.isArray(list) && data.columns && Array.isArray(data.columns)) {
    list = data.columns.flatMap((col) => col.tasks ?? col.items ?? []);
  }
  if (!Array.isArray(list)) list = Array.isArray(data) ? data : [];
  return { tasks: list, raw: data };
}

/** ID представления списка задач (из URL списка в Aspro: /_module/task/rest/task/list2_list/{viewId}). */
const DEFAULT_TASK_LIST_VIEW_ID = 'efcee576-50f7-45b2-a8c6-aee61d3d96d4';

/**
 * Список задач из представления «Список» (list2_list) — тот же источник, что в интерфейсе Aspro.
 * GET /_module/task/rest/task/list2_list/{viewId}
 * Важно: этот REST-эндпоинт часто возвращает 401 при авторизации только по api_key (ожидается сессия).
 * При 401 приложение использует fallback — API module/task/tasks/list.
 * @param {string} [viewId] — ID представления (из URL в браузере); по умолчанию из env или стандартный.
 * @returns {Promise<{ tasks: Array, raw?: object, _debug?: object }>}
 */
async function getAsproTaskListFromView(viewId) {
  const id = viewId || process.env.ASPRO_TASK_LIST_VIEW_ID || DEFAULT_TASK_LIST_VIEW_ID;
  const path = `/_module/task/rest/task/list2_list/${id}`;
  const url = `${ASPRO_PORTAL_BASE}${path}`;
  const { url: fullUrl, headers } = await buildAsproRequestOptions(url);
  const apiKey = getApiKey();
  const requestHeaders = { ...headers };
  if (apiKey) requestHeaders['X-Api-Key'] = apiKey;
  const res = await fetch(fullUrl, { method: 'GET', headers: requestHeaders });
  const data = await res.json().catch(() => ({}));

  const _debug = {
    url: fullUrl.replace(/api_key=[^&]+/, 'api_key=***'),
    status: res.status,
    ok: res.ok,
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
    hasError: !!(data && data.error)
  };

  if (!res.ok) {
    _debug.bodySample = JSON.stringify(data).slice(0, 500);
    return { tasks: [], raw: data, _debug };
  }
  if (data.error && (data.error.error_code != null || data.error.message)) {
    _debug.error = data.error;
    return { tasks: [], raw: data, _debug };
  }

  let list =
    data.items ??
    data.tasks ??
    data.list ??
    data.rows ??
    data.result ??
    data.response?.items ??
    data.response?.tasks ??
    data.response?.list ??
    data.data;
  if (!Array.isArray(list) && data.columns && Array.isArray(data.columns)) {
    list = data.columns.flatMap((col) => col.tasks ?? col.items ?? col.data ?? []);
  }
  if (!Array.isArray(list) && data.data && typeof data.data === 'object' && Array.isArray(data.data.list)) {
    list = data.data.list;
  }
  if (!Array.isArray(list)) list = Array.isArray(data) ? data : [];
  const tasks = Array.isArray(list) ? list : [];

  _debug.tasksCount = tasks.length;
  if (tasks.length === 0) _debug.bodySample = JSON.stringify(data).slice(0, 800);

  return { tasks, raw: data, _debug };
}

/** Путь «Все задачи» (как в Network: /_module/task/view/tasks_list/all). Можно переопределить в .env: ASPRO_TASK_LIST_ALL_PATH */
const TASK_LIST_ALL_PATH = process.env.ASPRO_TASK_LIST_ALL_PATH || '/_module/task/view/tasks_list/all';

/**
 * Список «Все задачи» — тот же источник, что страница «Классика» / Все задачи в интерфейсе Aspro.
 * URL в браузере: https://alexligear1.aspro.cloud/_module/task/view/classic?sidecenter=task.tasks_list.all
 * REST: GET /_module/task/view/tasks_list/all (путь можно задать в .env: ASPRO_TASK_LIST_ALL_PATH).
 * @returns {Promise<{ tasks: Array, raw?: object, _debug?: object }>}
 */
async function getAsproTaskListAll() {
  const path = TASK_LIST_ALL_PATH.startsWith('/') ? TASK_LIST_ALL_PATH : `/${TASK_LIST_ALL_PATH}`;
  const url = `${ASPRO_PORTAL_BASE}${path}`;
  const { url: fullUrl, headers } = await buildAsproRequestOptions(url);
  const apiKey = getApiKey();
  const requestHeaders = { ...headers };
  if (apiKey) requestHeaders['X-Api-Key'] = apiKey;
  const res = await fetch(fullUrl, { method: 'GET', headers: requestHeaders });
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const bodyText = await res.text().catch(() => '');
  let data = {};
  if (contentType.includes('application/json') && bodyText && !bodyText.trim().startsWith('<')) {
    try {
      data = JSON.parse(bodyText);
    } catch (parseErr) {
      console.warn('Aspro getAsproTaskListAll: JSON parse failed', parseErr.message);
    }
  } else if (bodyText.trim().startsWith('<') || contentType.includes('text/html')) {
    data = { _isHtml: true };
  }

  const _debug = {
    url: fullUrl.replace(/api_key=[^&]+/, 'api_key=***'),
    status: res.status,
    ok: res.ok,
    contentType,
    isHtml: !!data._isHtml,
    dataKeys: data && typeof data === 'object' ? Object.keys(data).filter((k) => k !== '_isHtml') : [],
    hasError: !!(data && data.error)
  };

  if (!res.ok) {
    _debug.bodySample = bodyText.slice(0, 500);
    return { tasks: [], raw: data, _debug };
  }
  if (data._isHtml || (data.error && (data.error.error_code != null || data.error.message))) {
    if (data.error) _debug.error = data.error;
    return { tasks: [], raw: data, _debug };
  }

  let list =
    data.items ??
    data.tasks ??
    data.list ??
    data.rows ??
    data.result ??
    data.response?.items ??
    data.response?.tasks ??
    data.response?.list ??
    data.data;
  if (!Array.isArray(list) && data.columns && Array.isArray(data.columns)) {
    list = data.columns.flatMap((col) => col.tasks ?? col.items ?? col.data ?? []);
  }
  if (!Array.isArray(list) && data.data && typeof data.data === 'object' && Array.isArray(data.data.list)) {
    list = data.data.list;
  }
  if (!Array.isArray(list)) list = Array.isArray(data) ? data : [];
  const tasks = Array.isArray(list) ? list : [];

  _debug.tasksCount = tasks.length;
  if (tasks.length === 0) _debug.bodySample = JSON.stringify(data).slice(0, 800);

  return { tasks, raw: data, _debug };
}

/**
 * Получить одну задачу по ID (GET /module/task/tasks/get/{id}).
 * @param {string|number} taskId
 * @returns {Promise<object|null>} data.response или null
 */
async function getAsproTaskById(taskId) {
  if (taskId == null) return null;
  const url = getTaskGetUrl(taskId);
  const { url: fullUrl, headers } = await buildAsproRequestOptions(url);
  const res = await fetch(fullUrl, { method: 'GET', headers });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const response = data.response ?? data;
  return response && typeof response === 'object' ? response : null;
}

/**
 * Список этапов (stages) для маппинга workflow_stage_id → название и поиска этапа "В работе".
 * По документации Aspro.Cloud API (Etap / agile/stages): этапы могут иметь is_template — шаблонные этапы не содержат реальных задач.
 * @returns {Promise<Array<{ id: number, name: string, workflow_id: number, is_template?: boolean }>>
 */
async function getAsproStagesList() {
  const stagesUrl = getStagesEndpoint();
  const { url, headers } = await buildAsproRequestOptions(stagesUrl, { limit: '500', page: '1' });
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const items = data.response?.items ?? data.items ?? (Array.isArray(data) ? data : []);
  return items.map((s) => ({
    id: Number(s.id ?? s.ID),
    name: String(s.name ?? s.NAME ?? s.title ?? s.TITLE ?? '').trim(),
    workflow_id: Number(s.workflow_id ?? s.workflow_Id ?? s.WORKFLOW_ID ?? 0),
    is_template: !!(s.is_template ?? s.IS_TEMPLATE ?? s.is_template_stage ?? s.template ?? false)
  })).filter((s) => s.id && s.name);
}

/**
 * Обновить задачу в Aspro (POST /module/task/tasks/update/{id}, body: application/x-www-form-urlencoded).
 * @param {string|number} taskId
 * @param {Record<string, string|number|boolean>} fields — например workflow_stage_id, workflow_id
 * @returns {Promise<{ ok: boolean, response?: object }>}
 */
async function updateAsproTask(taskId, fields) {
  if (taskId == null) return { ok: false };
  const updateUrl = getTaskUpdateUrl(taskId);
  const { url: fullUrl, headers } = await buildAsproRequestOptions(updateUrl);
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') body.set(k, String(v));
  });
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Aspro updateTask error:', res.status, text);
    return { ok: false };
  }
  const data = await res.json().catch(() => ({}));
  const response = data.response ?? data;
  return { ok: true, response };
}

/** Параметры пагинации по умолчанию (API поддерживает limit и page). */
const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_LIST_PAGE = 1;

/**
 * Запрос списка пользователей Aspro API.
 * URL: GET /api/v1/module/core/user/list?api_key=...&limit=100&page=1&search=... (search вместо filter — filter по username/email не работает).
 * В ответе структура может быть data.response.items или data.items; в объекте пользователя username = email, отдельного email нет.
 * @param {Record<string, string>} [query] — limit, page, search (encodeURIComponent(email))
 * @param {string|null} [overrideApiKey] — если передан, подставляется в query вместо getApiKey()
 * @returns {Promise<{ items: Array, total: number }>} items — массив пользователей, items[].id = aspro_id
 */
async function getAsproUserList(query = {}, overrideApiKey = null) {
  const baseQuery = { limit: String(DEFAULT_LIST_LIMIT), page: String(DEFAULT_LIST_PAGE) };
  const mergedQuery = { ...baseQuery, ...query };
  const { url, headers } = await buildAsproRequestOptions(ASPRO_USER_LIST_URL, mergedQuery, overrideApiKey);
  // Полный URL для дебага (ключ маскируем)
  console.log('Aspro user list: GET (full URL)', url.replace(/api_key=[^&]+/, 'api_key=***'));

  try {
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json().catch(() => ({}));
    console.log('Aspro user list: status', response.status, '| keys:', Object.keys(data), '| error:', data.error?.error_code ?? '-');

    if (!response.ok) {
      console.warn('Aspro getAsproUserList: error', response.status, JSON.stringify(data).slice(0, 300));
      return { items: [], total: 0 };
    }
    if (data.error && data.error.error_code === 11) {
      console.warn('Aspro getAsproUserList: api key not found (error_code 11). Проверьте api_key.');
      return { items: [], total: 0 };
    }

    // Ответ: data.response.items (часто в Aspro), или data.items, или массив, или один объект
    let items;
    if (data.response && Array.isArray(data.response.items)) {
      items = data.response.items;
    } else if (Array.isArray(data)) {
      items = data;
    } else if (data.items && Array.isArray(data.items)) {
      items = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      items = data.data;
    } else if (data && typeof data === 'object' && data.id != null && (data.username != null || data.email != null)) {
      items = [data];
    } else {
      items = [];
    }
    const total = data.response?.total ?? data.total ?? data.data?.total ?? items.length;

    // Дебаг: первый элемент списка
    const first = items[0];
    if (first) {
      console.log('Aspro user list: data.response.items[0] (debug)', JSON.stringify({ id: first.id, username: first.username, name: first.name }));
    }

    return { items, total };
  } catch (err) {
    console.error('Aspro getAsproUserList error:', err.message);
    return { items: [], total: 0 };
  }
}

const LIST_PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * Нормализует строку для сравнения (username в Aspro = email, без отдельного поля email).
 */
function normalizeForMatch(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Находит aspro_id пользователя по email.
 * 1) Запрос с search=encodeURIComponent(email) (filter[email]/filter[username] в API не работают).
 * 2) Если не найден — fallback: запрос списка limit=100 по страницам (total > 100 — минимум 2 страницы), поиск по u.username.
 * Обязательно логируются полный URL и data.response.items[0] для дебага.
 * @param {string} email — email/логин (в Aspro username = email)
 * @param {string} apiKey — API-ключ для query string
 * @returns {Promise<string|number|null>} user.id (aspro_id) или null
 */
async function findAsproUserIdByEmail(email, apiKey) {
  if (!email || typeof email !== 'string') {
    console.log('findAsproUserIdByEmail: пустой email');
    return null;
  }
  if (!apiKey || !String(apiKey).trim()) {
    console.warn('findAsproUserIdByEmail: api_key не передан');
    return null;
  }
  const normalizedEmail = normalizeForMatch(email);
  const key = String(apiKey).trim();

  try {
    // 1) Поиск через параметр search (filter по username/email не работает)
    const searchQuery = {
      search: encodeURIComponent(normalizedEmail),
      limit: String(LIST_PAGE_SIZE),
      page: '1'
    };
    const { items: searchItems, total: searchTotal } = await getAsproUserList(searchQuery, key);
    const byUsername = (u) => u && normalizeForMatch(u.username) === normalizedEmail;
    let user = searchItems.find(byUsername);
    if (user && user.id != null) {
      console.log('findAsproUserIdByEmail: найден по search → aspro_id', user.id);
      return user.id;
    }

    // 2) Fallback: полный список по страницам (если total > 100 — запрашиваем несколько страниц)
    console.log('findAsproUserIdByEmail: search пустой или не совпал, fallback — список по страницам (limit=100)');
    const allItems = [];
    let page = 1;
    let totalCount = searchTotal;

    do {
      const query = { limit: String(LIST_PAGE_SIZE), page: String(page) };
      const { items: pageItems, total } = await getAsproUserList(query, key);
      allItems.push(...pageItems);
      if (total != null && total > 0) totalCount = total;
      if (pageItems.length === 0) break;
      user = pageItems.find(byUsername);
      if (user && user.id != null) {
        console.log('findAsproUserIdByEmail: найден на странице', page, '→ aspro_id', user.id);
        return user.id;
      }
      page++;
      if (page > MAX_PAGES) {
        console.warn('findAsproUserIdByEmail: достигнут лимит страниц', MAX_PAGES);
        break;
      }
    } while (allItems.length < totalCount && page <= Math.ceil(totalCount / LIST_PAGE_SIZE));

    user = allItems.find(byUsername);
    if (user && user.id != null) {
      console.log('findAsproUserIdByEmail: найден в собранном списке → aspro_id', user.id);
      return user.id;
    }

    console.log('findAsproUserIdByEmail: пользователь не найден, email=', normalizedEmail);
    return null;
  } catch (err) {
    console.error('findAsproUserIdByEmail error:', err.message);
    return null;
  }
}

/**
 * Находит aspro_id по email (использует ASPRO_API_KEY из .env). Обёртка над findAsproUserIdByEmail.
 * @param {string} email
 * @returns {Promise<string|number|null>}
 */
async function findAsproUserByEmail(email) {
  return findAsproUserIdByEmail(email, getApiKey());
}

/** Alias: возвращает только массив items (обратная совместимость). */
async function getAsproUsers(query = {}) {
  const { items } = await getAsproUserList(query);
  return items;
}

module.exports = {
  getAsproUserList,
  getAsproUsers,
  findAsproUserIdByEmail,
  findAsproUserByEmail,
  getAccessToken,
  getApiKey,
  buildAsproRequestOptions,
  getTasksEndpoint,
  getAgileIssuesEndpoint,
  getStagesEndpoint,
  getAsproTaskById,
  getAsproStagesList,
  getAsproTasksListForUser,
  updateAsproTask,
  getAsproKanbanData,
  getAsproTaskListFromView,
  getAsproTaskListAll,
  getAsproTaskPortalUrl,
  ASPRO_USER_LIST_URL,
  ASPRO_USERS_LIST_URL: ASPRO_USER_LIST_URL
};
