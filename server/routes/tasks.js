const express = require('express');
const router = express.Router();
const {
  getTasksEndpoint,
  getStagesEndpoint,
  buildAsproRequestOptions,
  getAsproTaskById,
  getAsproStagesList,
  getAsproTasksListForUser,
  updateAsproTask,
  getAsproKanbanData,
  getAsproTaskListFromView,
  getAsproTaskListAll,
  getAsproTaskPortalUrl
} = require('../services/asproService');

const ASPRO_ERROR_MSG = 'Ошибка загрузки задач из Aspro Cloud';

// Три нормализованных статуса в приложении: «Не выполняется», «В работе», «Ожидает контроля».
// Маппинг по документации Aspro (openapiru.json, поле status): 1 — новая, 3 — в работе, 4 — на проверке, 5 — закрыта.
const STATUS_CODE_TO_TITLE = {
  0: 'Не выполняется',
  1: 'Не выполняется',   // 1 — новая задача → Не начато
  2: 'В работе',         // 2 в доке нет; на случай workflow_stage_id=2
  3: 'В работе',         // 3 — в работе (документация!) → Правки
  4: 'Ожидает контроля', // 4 — на проверке у постановщика → На проверке
  5: 'Не выполняется'    // 5 — задача закрыта; показываем до фильтра по closed_date
};
/** Варианты названий статуса из Kanban/API (lowercase) → наш статус. */
const STATUS_NAME_TO_TITLE = {
  'не выполняется': 'Не выполняется',
  'не выполняется ': 'Не выполняется',
  'в работе': 'В работе',
  'ожидает контроля': 'Ожидает контроля',
  'новая': 'Не выполняется',
  'новый': 'Не выполняется',
  'не начато': 'Не выполняется',
  'правки': 'В работе',
  'на проверке': 'Ожидает контроля',
  'ревью': 'Ожидает контроля',
  'review': 'Ожидает контроля'
};
const ALLOWED_STATUS_TITLES = new Set([
  'Не выполняется',
  'В работе',
  'Ожидает контроля'
]);

/** Этапы, при которых задача считается «выполненной за день» (На проверке, Опубликовано). Список показывается до смены этапа. */
const STAGE_NAMES_COMPLETED = ['ожидает контроля', 'на проверке', 'опубликовано'];

/**
 * Текущая дата по Москве (для ключа и подписи списка «выполненные за день»).
 * @returns {{ dateKey: string, label: string }} dateKey — YYYY-MM-DD, label — дд.мм.гг
 */
function getTodayMSK() {
  const now = new Date();
  const mskOffsetMin = 3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const msk = new Date(utcMs + mskOffsetMin * 60 * 1000);
  const y = msk.getFullYear();
  const m = String(msk.getMonth() + 1).padStart(2, '0');
  const d = String(msk.getDate()).padStart(2, '0');
  const yy = String(y).slice(-2);
  return { dateKey: `${y}-${m}-${d}`, label: `${d}.${m}.${yy}` };
}

/** Хранилище «отправленных за день» задач: ключ `${userAsproId}:${dateKey}`, значение — массив taskId (порядок сохранён). */
const completedTodayStore = new Map();

/**
 * Извлекает ID ответственного из задачи в любом формате, в котором отдаёт Aspro (list, list2_list, agile и т.д.).
 */
function getTaskResponsibleId(task) {
  if (!task || typeof task !== 'object') return null;
  const r =
    task.responsible_id ?? task.responsible_Id ?? task.RESPONSIBLE_ID
    ?? task.responsibleId ?? task.responsible_user_id ?? task.responsibleUserId
    ?? task.assignee_id ?? task.assigneeId
    ?? (task.responsible && (task.responsible.id ?? task.responsible.ID))
    ?? (task.assignee && (task.assignee.id ?? task.assignee.ID));
  if (r == null || r === '') return null;
  const num = Number(r);
  return Number.isNaN(num) ? null : num;
}

/**
 * Пользователь считается ответственным по задаче, если его Aspro ID совпадает с полем ответственного.
 * Постановщик (owner_id) при этом игнорируется — по ТЗ показываем только задачи, где пользователь именно Ответственный.
 */
function isUserResponsibleForTask(task, userAsproId) {
  if (!task || !userAsproId) return false;
  const responsibleId = getTaskResponsibleId(task);
  if (responsibleId == null) return false;
  return Number(responsibleId) === Number(userAsproId);
}

/**
 * Задача считается «активной», если не в архиве и не закрыта.
 * В Aspro у многих задач closed_date/archive_status приходят так, что строгая проверка отсекает рабочие задачи — считаем активной, если явно не закрыта и не в архиве.
 */
function isActiveTask(task) {
  if (!task || typeof task !== 'object') return false;
  const archiveStatus = task.archive_status ?? task.ARCHIVE_STATUS;
  const isArchiveFlag = task.is_archive ?? task.IS_ARCHIVE;
  if (archiveStatus != null && Number(archiveStatus) !== 0) return false;
  if (isArchiveFlag != null && String(isArchiveFlag) !== '0' && String(isArchiveFlag) !== 'false') return false;
  const closedDate = String(task.closed_date ?? task.CLOSED_DATE ?? '').trim();
  if (!closedDate || closedDate === '0' || closedDate === 'false' || closedDate === '0000-00-00 00:00:00' || closedDate === '0000-00-00') return true;
  const looksLikeRealDate = /^\d{4}-\d{2}-\d{2}/.test(closedDate) && closedDate.slice(0, 4) !== '0000';
  return !looksLikeRealDate;
}

/**
 * В вашем портале type=30 и public_template=1 стоят у обычных рабочих задач (созданных из шаблона), поэтому по ним не отсекаем — шаблонные записи не фильтруем по этим полям.
 */
function isTemplateTask(task) {
  return false;
}

router.get('/', async (req, res) => {
  try {
    const userAsproId = req.user && req.user.aspro_id;
    if (!userAsproId) {
      return res
        .status(400)
        .json({ message: 'Не указан Aspro Cloud ID для пользователя.' });
    }

    // Источник 1: API module/task/tasks/list с filter[template]=0, filter[responsible]=userAsproId, filter[active]=1; fallback — agile/issues/list.
    const { items: apiItems } = await getAsproTasksListForUser(userAsproId);
    let tasks = Array.isArray(apiItems) ? apiItems : [];

    if (tasks.length === 0) {
      const { tasks: allListTasks } = await getAsproTaskListAll();
      tasks = Array.isArray(allListTasks) ? allListTasks : [];
    }
    if (tasks.length === 0) {
      const { tasks: listTasks } = await getAsproTaskListFromView();
      tasks = Array.isArray(listTasks) ? listTasks : [];
    }

    // Только активные задачи, где пользователь — ответственный.
    tasks = tasks.filter((t) => isActiveTask(t) && isUserResponsibleForTask(t, userAsproId));

    // Исключаем записи-шаблоны (сам шаблон задачи, не задачи из шаблона) по полям задачи: type=30 и public_template=1.
    tasks = tasks.filter((t) => !isTemplateTask(t));

    // Статус: из названия или из кода (1,2,3,4). List2_list и API могут отдавать этап в разных полях — проверяем все варианты.
    const withStatus = tasks.map((t) => {
      const rawStatus =
        t.status ?? t.STATUS ?? t.statusId ?? t.status_id ?? t.STATUS_ID
        ?? t.workflow_stage_id ?? t.workflow_stage_Id ?? t.WORKFLOW_STAGE_ID
        ?? t.stage_id ?? t.stageId ?? t.STAGE_ID ?? t.state
        ?? (t.stage && (t.stage.id ?? t.stage.ID))
        ?? (t.workflow_stage && (t.workflow_stage.id ?? t.workflow_stage.ID))
        ?? (t.status && typeof t.status === 'object' && (t.status.id ?? t.status.ID));
      const code = rawStatus != null && rawStatus !== '' ? Number(rawStatus) : null;
      const nameFromApi = (
        t.statusTitle ?? t.status_title ?? t.stageName ?? t.stage_name
        ?? (t.stage && (t.stage.name ?? t.stage.title ?? t.stage.NAME))
        ?? (t.workflow_stage && (t.workflow_stage.name ?? t.workflow_stage.title))
        ?? ''
      ).toString().trim();
      const norm = nameFromApi.toLowerCase();
      let statusTitle = STATUS_NAME_TO_TITLE[norm] || (nameFromApi && STATUS_NAME_TO_TITLE[norm.replace(/\s+/g, ' ')]) || null;
      if (!statusTitle) statusTitle = code != null ? (STATUS_CODE_TO_TITLE[code] || null) : null;
      if (!statusTitle) statusTitle = nameFromApi || (code != null ? `Статус ${code}` : 'Без статуса');
      return { ...t, statusTitle };
    });

    // Показываем задачи всех этапов (не только три статуса), чтобы отображались не только этап id 4, но и остальные.
    return res.json(withStatus);
  } catch (err) {
    console.error('Error in GET /tasks:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

/**
 * GET /tasks/raw — отладка: что вернул Aspro и почему после фильтров 0 задач.
 * Показывает: сколько пришло от API, ваш aspro_id, и по каждой задаче — поля + прошла ли фильтры.
 */
router.get('/raw', async (req, res) => {
  try {
    const userAsproId = req.user && req.user.aspro_id;
    if (!userAsproId) {
      return res.status(400).json({ message: 'Не указан Aspro Cloud ID для пользователя.' });
    }
    // Тот же порядок источников, что и в GET /tasks
    let rawTasks = [];
    let source = 'none';
    const { items: apiItems } = await getAsproTasksListForUser(userAsproId);
    if (Array.isArray(apiItems) && apiItems.length > 0) {
      rawTasks = apiItems;
      source = 'task/tasks/list or agile/issues/list';
    } else {
      const { tasks: allTasks } = await getAsproTaskListAll();
      if (Array.isArray(allTasks) && allTasks.length > 0) {
        rawTasks = allTasks;
        source = 'tasks_list/all';
      } else {
        const { tasks: viewTasks } = await getAsproTaskListFromView();
        if (Array.isArray(viewTasks)) rawTasks = viewTasks;
        source = 'list2_list';
      }
    }

    const withReason = rawTasks.map((t) => {
      const active = isActiveTask(t);
      const responsible = isUserResponsibleForTask(t, userAsproId);
      const rawStatus =
        t.status ?? t.STATUS ?? t.statusId ?? t.status_id ?? t.workflow_stage_id ?? t.stage_id ?? t.stageId
        ?? (t.stage && (t.stage.id ?? t.stage.ID)) ?? (t.workflow_stage && (t.workflow_stage.id ?? t.workflow_stage.ID));
      const code = rawStatus != null && rawStatus !== '' ? Number(rawStatus) : null;
      const nameFromApi = (t.statusTitle ?? t.status_title ?? t.stageName ?? t.stage_name ?? (t.stage && t.stage.name) ?? '').toString().trim();
      const norm = nameFromApi.toLowerCase();
      let statusTitle = STATUS_NAME_TO_TITLE[norm] || (code != null ? (STATUS_CODE_TO_TITLE[code] || null) : null) || nameFromApi || (code != null ? `Статус ${code}` : 'Без статуса');
      return {
        id: t.id,
        name: t.name,
        responsible_id: t.responsible_id,
        _responsible_id_extracted: getTaskResponsibleId(t),
        owner_id: t.owner_id,
        status: t.status,
        workflow_stage_id: t.workflow_stage_id,
        stage_id: t.stage_id,
        stage: t.stage,
        _status_code: code,
        _status_name_from_api: nameFromApi,
        _status_title_computed: statusTitle,
        _in_allowed: ALLOWED_STATUS_TITLES.has(statusTitle),
        closed_date: t.closed_date,
        type: t.type,
        template_id: t.template_id,
        public_template: t.public_template,
        archive_status: t.archive_status,
        is_hidden: t.is_hidden,
        is_archive: t.is_archive,
        workflow_id: t.workflow_id,
        passed_active: active,
        passed_responsible: responsible,
        is_template_task: isTemplateTask(t),
        in_result: active && responsible && !isTemplateTask(t)
      };
    });

    const afterFilter = withReason.filter((r) => r.in_result);
    return res.json({
      debug: true,
      user_aspro_id: userAsproId,
      source,
      raw_count: rawTasks.length,
      after_filter_count: afterFilter.length,
      tasks: withReason
    });
  } catch (err) {
    console.error('Error in GET /tasks/raw:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

/**
 * GET /tasks/completed-today — список задач, отправленных пользователем «за день» (дата по МСК), с этапами «На проверке» или «Опубликовано».
 * Если в Aspro этап задачи сменился на другой — задача в список не попадает. Список обновляется при каждом запросе.
 */
router.get('/completed-today', async (req, res) => {
  try {
    const userAsproId = req.user && req.user.aspro_id;
    if (!userAsproId) {
      return res.status(400).json({ message: 'Не указан Aspro Cloud ID для пользователя.' });
    }

    const { dateKey, label } = getTodayMSK();
    const storeKey = `${userAsproId}:${dateKey}`;
    const taskIds = completedTodayStore.has(storeKey) ? [...completedTodayStore.get(storeKey)] : [];

    const stages = await getAsproStagesList();
    const tasks = [];

    for (const tid of taskIds) {
      const task = await getAsproTaskById(tid);
      if (!task || !task.id) continue;
      const stageId =
        task.workflow_stage_id ?? task.workflow_stage_Id ?? task.stage_id
        ?? (task.stage && (task.stage.id ?? task.stage.ID))
        ?? (task.workflow_stage && (task.workflow_stage.id ?? task.workflow_stage.ID));
      const stage = stages.find((s) => Number(s.id) === Number(stageId));
      const stageNameFromTask = (
        task.statusTitle ?? task.status_title ?? task.stageName ?? task.stage_name
        ?? (task.stage && (task.stage.name ?? task.stage.title ?? task.stage.NAME))
        ?? (task.workflow_stage && (task.workflow_stage.name ?? task.workflow_stage.title ?? task.workflow_stage.NAME))
      );
      const stageName = (stageNameFromTask != null ? String(stageNameFromTask).trim().toLowerCase() : '')
        || (stage && (stage.name || '').trim().toLowerCase()) || '';
      if (!STAGE_NAMES_COMPLETED.some((n) => stageName.includes(n) || n.includes(stageName))) continue;
      const name = (task.name ?? task.title ?? task.NAME ?? '').toString().trim() || `Задача ${tid}`;
      tasks.push({
        id: String(tid),
        name,
        taskUrl: getAsproTaskPortalUrl(tid)
      });
    }

    return res.json({ dateLabel: label, tasks });
  } catch (err) {
    console.error('Error in GET /tasks/completed-today:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

/**
 * GET /tasks/raw-from-view — отладка: что вернул list2_list (представление «Список»).
 * Нужные задачи чаще всего приходят именно оттуда; если здесь пусто — проверьте ASPRO_TASK_LIST_VIEW_ID в .env.
 */
router.get('/raw-from-view', async (req, res) => {
  try {
    const userAsproId = req.user && req.user.aspro_id;
    if (!userAsproId) {
      return res.status(400).json({ message: 'Не указан Aspro Cloud ID для пользователя.' });
    }
    const { tasks, raw, _debug: listDebug } = await getAsproTaskListFromView();
    const list = Array.isArray(tasks) ? tasks : [];
    const withDebug = list.slice(0, 20).map((t) => {
      const active = isActiveTask(t);
      const responsible = isUserResponsibleForTask(t, userAsproId);
      return {
        id: t.id,
        name: t.name,
        responsible_id: t.responsible_id ?? t.RESPONSIBLE_ID,
        workflow_stage_id: t.workflow_stage_id ?? t.stage_id ?? t.stage?.id,
        status: t.status,
        closed_date: t.closed_date,
        passed_active: active,
        passed_responsible: responsible,
        in_result: active && responsible
      };
    });
    return res.json({
      debug: true,
      source: 'list2_list',
      user_aspro_id: userAsproId,
      count: list.length,
      first_20_with_debug: withDebug,
      raw_keys: raw && typeof raw === 'object' ? Object.keys(raw) : [],
      list2_list_debug: listDebug
    });
  } catch (err) {
    console.error('Error in GET /tasks/raw-from-view:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

/**
 * GET /tasks/raw-from-all — отладка: что вернул REST «Все задачи» (tasks_list/all).
 */
router.get('/raw-from-all', async (req, res) => {
  try {
    const { tasks, raw, _debug } = await getAsproTaskListAll();
    const list = Array.isArray(tasks) ? tasks : [];
    return res.json({
      debug: true,
      source: 'tasks_list/all (страница classic?sidecenter=task.tasks_list.all)',
      count: list.length,
      first_20: list.slice(0, 20).map((t) => ({
        id: t.id,
        name: t.name,
        responsible_id: t.responsible_id,
        workflow_stage_id: t.workflow_stage_id ?? t.stage_id,
        status: t.status
      })),
      raw_keys: raw && typeof raw === 'object' ? Object.keys(raw) : [],
      _debug
    });
  } catch (err) {
    console.error('Error in GET /tasks/raw-from-all:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

/** Этап «В работе» в Aspro — по документации меняем workflow_stage_id задачи на соответствующий stage. */
const STAGE_NAME_IN_PROGRESS = 'в работе';
/** Варианты названия этапа «На проверке» в Aspro (lowercase для поиска). */
const STAGE_NAMES_REVIEW = ['ожидает контроля', 'на проверке'];

/**
 * POST /tasks/:id/start — перевести задачу в статус «В работе» в Aspro (по документации openapiru: tasks/update с workflow_stage_id).
 */
router.post('/:id/start', async (req, res) => {
  try {
    const userAsproId = req.user && req.user.aspro_id;
    if (!userAsproId) {
      return res.status(400).json({ message: 'Не указан Aspro Cloud ID для пользователя.' });
    }

    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: 'Не указан ID задачи.' });
    }

    const task = await getAsproTaskById(taskId);
    if (!task || !task.id) {
      return res.status(404).json({ message: 'Задача не найдена в Aspro Cloud.' });
    }

    const responsibleId = task.responsible_id ?? task.responsible_Id ?? task.owner_id ?? task.owner_Id;
    if (responsibleId != null && Number(responsibleId) !== Number(userAsproId)) {
      return res.status(403).json({ message: 'Нет прав на изменение этой задачи.' });
    }

    const workflowId = task.workflow_id ?? task.workflow_Id ?? task.WORKFLOW_ID;
    if (!workflowId) {
      return res.status(502).json({ message: 'У задачи не указан workflow. Невозможно перевести в «В работе».' });
    }

    const stages = await getAsproStagesList();
    const stageInProgress = stages.find(
      (s) => s.workflow_id === Number(workflowId) && (s.name || '').trim().toLowerCase() === STAGE_NAME_IN_PROGRESS
    );
    if (!stageInProgress) {
      return res.status(502).json({
        message: 'Этап «В работе» не найден в workflow задачи. Проверьте настройки этапов в Aspro.'
      });
    }

    const updateResult = await updateAsproTask(taskId, {
      workflow_stage_id: stageInProgress.id,
      workflow_id: workflowId
    });
    if (!updateResult.ok) {
      return res.status(502).json({ message: 'Не удалось обновить статус задачи в Aspro Cloud.' });
    }

    return res.json({ ok: true, message: 'Задача переведена в статус «В работе».' });
  } catch (err) {
    console.error('Error in POST /tasks/:id/start:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

/**
 * POST /tasks/:id/send — перевести задачу в статус «На проверке» в Aspro и вернуть URL страницы задачи в портале.
 */
router.post('/:id/send', async (req, res) => {
  try {
    const userAsproId = req.user && req.user.aspro_id;
    if (!userAsproId) {
      return res.status(400).json({ message: 'Не указан Aspro Cloud ID для пользователя.' });
    }

    const taskId = req.params.id;
    if (!taskId) {
      return res.status(400).json({ message: 'Не указан ID задачи.' });
    }

    const task = await getAsproTaskById(taskId);
    if (!task || !task.id) {
      return res.status(404).json({ message: 'Задача не найдена в Aspro Cloud.' });
    }

    const responsibleId = task.responsible_id ?? task.responsible_Id ?? task.owner_id ?? task.owner_Id;
    if (responsibleId != null && Number(responsibleId) !== Number(userAsproId)) {
      return res.status(403).json({ message: 'Нет прав на изменение этой задачи.' });
    }

    const workflowId = task.workflow_id ?? task.workflow_Id ?? task.WORKFLOW_ID;
    if (!workflowId) {
      return res.status(502).json({ message: 'У задачи не указан workflow. Невозможно перевести в «На проверке».' });
    }

    const stages = await getAsproStagesList();
    const stageReview = stages.find(
      (s) =>
        s.workflow_id === Number(workflowId) &&
        STAGE_NAMES_REVIEW.includes((s.name || '').trim().toLowerCase())
    );
    if (!stageReview) {
      return res.status(502).json({
        message: 'Этап «На проверке» не найден в workflow задачи. Проверьте настройки этапов в Aspro.'
      });
    }

    const updateResult = await updateAsproTask(taskId, {
      workflow_stage_id: stageReview.id,
      workflow_id: workflowId
    });
    if (!updateResult.ok) {
      return res.status(502).json({ message: 'Не удалось обновить статус задачи в Aspro Cloud.' });
    }

    const { dateKey } = getTodayMSK();
    const storeKey = `${userAsproId}:${dateKey}`;
    if (!completedTodayStore.has(storeKey)) completedTodayStore.set(storeKey, []);
    const list = completedTodayStore.get(storeKey);
    if (!list.includes(taskId)) list.push(taskId);

    const taskUrl = getAsproTaskPortalUrl(taskId);
    return res.json({ ok: true, message: 'Задача переведена в статус «На проверке».', taskUrl });
  } catch (err) {
    console.error('Error in POST /tasks/:id/send:', err);
    return res.status(500).json({ error: ASPRO_ERROR_MSG });
  }
});

module.exports = router;

