const express = require('express');
const db = require('../db');
const { createAsproTask, findOrCreateAsproProject } = require('../services/asproService');

const router = express.Router();

/** aspro_id текущего пользователя и ФИО из БД */
async function getCurrentUserAsproAndName(userId) {
  if (!userId) return { asproId: null, fullName: '' };
  const r = await db.query(
    'SELECT aspro_id, first_name, last_name FROM users WHERE id = $1',
    [userId]
  );
  const row = r.rows[0];
  if (!row) return { asproId: null, fullName: '' };
  const fullName = `${(row.last_name || '').trim()} ${(row.first_name || '').trim()}`.trim() || 'Исполнитель';
  return { asproId: row.aspro_id != null && row.aspro_id !== '' ? row.aspro_id : null, fullName };
}

/** aspro_id пользователя по нашему id (для методиста) */
async function getAsproIdByUserId(ourUserId) {
  if (!ourUserId) return null;
  const r = await db.query('SELECT aspro_id FROM users WHERE id = $1', [ourUserId]);
  const row = r.rows[0];
  return row && row.aspro_id != null && row.aspro_id !== '' ? row.aspro_id : null;
}

/**
 * GET /tables — список всех таблиц (для всех пользователей).
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, cells, row_count AS "rowCount", methodist, theme, col_widths AS "colWidths", created_at AS "createdAt"
       FROM tables
       ORDER BY created_at DESC`
    );
    const tables = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      cells: r.cells || {},
      rowCount: r.rowCount != null ? r.rowCount : 35,
      methodist: r.methodist || null,
      theme: r.theme != null ? r.theme : null,
      colWidths: r.colWidths || {},
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now()
    }));
    return res.json(tables);
  } catch (err) {
    console.error('GET /tables error:', err);
    return res.status(500).json({ message: 'Ошибка загрузки таблиц.' });
  }
});

/**
 * POST /tables — создать таблицу.
 * Body: { id, name, cells?, rowCount?, methodist?, theme?, colWidths? }
 */
router.post('/', async (req, res) => {
  try {
    const { id, name, cells, rowCount, methodist, theme, colWidths } = req.body;
    if (!id || !name) {
      return res.status(400).json({ message: 'Нужны id и name таблицы.' });
    }
    await db.query(
      `INSERT INTO tables (id, name, cells, row_count, methodist, theme, col_widths)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         cells = EXCLUDED.cells,
         row_count = EXCLUDED.row_count,
         methodist = EXCLUDED.methodist,
         theme = EXCLUDED.theme,
         col_widths = EXCLUDED.col_widths`,
      [
        id,
        name,
        JSON.stringify(cells || {}),
        rowCount != null ? rowCount : 35,
        methodist ? JSON.stringify(methodist) : null,
        theme != null ? theme : null,
        colWidths && typeof colWidths === 'object' ? JSON.stringify(colWidths) : '{}'
      ]
    );
    const row = await db.query(
      'SELECT id, name, cells, row_count AS "rowCount", methodist, theme, col_widths AS "colWidths", created_at AS "createdAt" FROM tables WHERE id = $1',
      [id]
    );
    const t = row.rows[0];
    return res.status(201).json({
      id: t.id,
      name: t.name,
      cells: t.cells || {},
      rowCount: t.rowCount != null ? t.rowCount : 35,
      methodist: t.methodist || null,
      theme: t.theme != null ? t.theme : null,
      colWidths: t.colWidths || {},
      createdAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now()
    });
  } catch (err) {
    console.error('POST /tables error:', err);
    return res.status(500).json({ message: 'Ошибка создания таблицы.' });
  }
});

/**
 * PUT /tables/:id — обновить таблицу.
 */
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, cells, rowCount, methodist, theme, colWidths } = req.body;
    await db.query(
      `UPDATE tables
       SET name = $2, cells = $3, row_count = $4, methodist = $5, theme = $6, col_widths = $7
       WHERE id = $1`,
      [
        id,
        name != null ? name : 'Таблица',
        cells != null ? JSON.stringify(cells) : '{}',
        rowCount != null ? rowCount : 35,
        methodist != null ? JSON.stringify(methodist) : null,
        theme != null ? theme : null,
        colWidths && typeof colWidths === 'object' ? JSON.stringify(colWidths) : '{}'
      ]
    );
    const row = await db.query(
      'SELECT id, name, cells, row_count AS "rowCount", methodist, theme, col_widths AS "colWidths", created_at AS "createdAt" FROM tables WHERE id = $1',
      [id]
    );
    if (!row.rows.length) return res.status(404).json({ message: 'Таблица не найдена.' });
    const t = row.rows[0];
    return res.json({
      id: t.id,
      name: t.name,
      cells: t.cells || {},
      rowCount: t.rowCount != null ? t.rowCount : 35,
      methodist: t.methodist || null,
      theme: t.theme != null ? t.theme : null,
      colWidths: t.colWidths || {},
      createdAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now()
    });
  } catch (err) {
    console.error('PUT /tables/:id error:', err);
    return res.status(500).json({ message: 'Ошибка обновления таблицы.' });
  }
});

/**
 * DELETE /tables/:id — удалить таблицу.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM tables WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Таблица не найдена.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /tables/:id error:', err);
    return res.status(500).json({ message: 'Ошибка удаления таблицы.' });
  }
});

/**
 * POST /tables/:id/take-task — взять задачу: создать задачу в Aspro (исполнитель = текущий пользователь, постановщик = методист таблицы, проект = название таблицы), записать исполнителя в ячейку J строки.
 * Body: { rowIndex: number } (индекс строки 0-based).
 */
router.post('/:id/take-task', async (req, res) => {
  try {
    const tableId = req.params.id;
    const { rowIndex } = req.body;
    const userId = req.user && req.user.userId;
    if (userId == null) return res.status(401).json({ message: 'Необходима авторизация.' });

    const rowNum = typeof rowIndex === 'number' ? rowIndex : parseInt(rowIndex, 10);
    if (isNaN(rowNum) || rowNum < 0) {
      return res.status(400).json({ message: 'Укажите rowIndex (номер строки).' });
    }

    const tableResult = await db.query(
      'SELECT id, name, cells, row_count AS "rowCount", methodist FROM tables WHERE id = $1',
      [tableId]
    );
    if (!tableResult.rows.length) return res.status(404).json({ message: 'Таблица не найдена.' });
    const tableRow = tableResult.rows[0];
    const cells = tableRow.cells || {};
    const taskOrdinal = Math.max(1, rowNum);
    const taskName = cells[`A${rowNum + 1}`] || `Задача ${taskOrdinal}`;

    const { asproId: executorAsproId, fullName: executorFullName } = await getCurrentUserAsproAndName(userId);
    if (!executorAsproId) {
      return res.status(400).json({
        message: 'У вашего пользователя не привязан Aspro Cloud ID. Используйте «Синхронизация с Aspro» в профиле.'
      });
    }

    const methodist = tableRow.methodist;
    let ownerAsproId = null;
    if (methodist && methodist.id) {
      ownerAsproId = await getAsproIdByUserId(methodist.id);
    }

    const projectName = tableRow.name || 'Таблица';
    const projectId = await findOrCreateAsproProject(projectName);

    const createPayload = {
      owner_id: ownerAsproId || undefined,
      responsible_id: executorAsproId,
      project_id: projectId || undefined
    };
    const created = await createAsproTask(taskName, createPayload);
    if (!created.ok) {
      return res.status(502).json({
        message: created.error || 'Не удалось создать задачу в Aspro Cloud.'
      });
    }

    cells[`J${rowNum + 1}`] = executorFullName;
    await db.query(
      'UPDATE tables SET cells = $2 WHERE id = $1',
      [tableId, JSON.stringify(cells)]
    );

    const updated = await db.query(
      'SELECT id, name, cells, row_count AS "rowCount", methodist, theme, col_widths AS "colWidths", created_at AS "createdAt" FROM tables WHERE id = $1',
      [tableId]
    );
    const t = updated.rows[0];
    return res.json({
      success: true,
      taskName,
      asproTaskId: created.taskId,
      table: {
        id: t.id,
        name: t.name,
        cells: t.cells || {},
        rowCount: t.rowCount != null ? t.rowCount : 35,
        methodist: t.methodist || null,
        theme: t.theme != null ? t.theme : null,
        colWidths: t.colWidths || {},
        createdAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now()
      }
    });
  } catch (err) {
    console.error('POST /tables/:id/take-task error:', err);
    return res.status(500).json({ message: 'Ошибка при взятии задачи.' });
  }
});

module.exports = router;
