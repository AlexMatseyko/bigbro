const express = require('express');
const db = require('../db');

const router = express.Router();

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

module.exports = router;
