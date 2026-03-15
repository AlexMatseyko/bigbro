import React, { useState, useCallback, useRef, useEffect } from 'react';
import { columnLetter, DEFAULT_ROW_COUNT, ROWS_ADD_STEP } from '../utils/tableStorage';
import MethodistPicker from './MethodistPicker';
import ThemePicker from './ThemePicker';
import { THEMES } from './ThemePicker';
import { takeTableTask } from '../api/tableApi';
import { API_BASE } from '../config';

const COLS = 26;
const COL_A = 0;
const COL_F = 5;
const COLUMN_LABELS = { [COL_A]: 'Название', [COL_F]: 'Исполнитель' };
function getColumnHeader(colIndex) {
  return COLUMN_LABELS[colIndex] != null ? COLUMN_LABELS[colIndex] : columnLetter(colIndex);
}

/** Ячейка-выпадающий список исполнителей (Фамилия Имя) в столбце F */
function ExecutorCell({ value, users, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);
  const display = (value || '').trim() || 'Выбрать';
  const isEmpty = !(value || '').trim();
  return (
    <div className="sheet-executor-cell" ref={ref}>
      <button
        type="button"
        className="sheet-executor-trigger"
        data-empty={isEmpty ? 'true' : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="sheet-executor-trigger-label">{display}</span>
      </button>
      {open && (
        <ul className="sheet-executor-dropdown" role="listbox">
          <li role="option">
            <button
              type="button"
              className="sheet-executor-option"
              onClick={() => { onChange(''); setOpen(false); }}
            >
              — Не выбран
            </button>
          </li>
          {users.map((u) => {
            const fullName = `${(u.last_name || '').trim()} ${(u.first_name || '').trim()}`.trim() || 'Без имени';
            return (
              <li key={u.id} role="option">
                <button
                  type="button"
                  className="sheet-executor-option"
                  onClick={() => { onChange(fullName); setOpen(false); }}
                >
                  {fullName}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
const CELL_WIDTH = 100;
const CELL_HEIGHT = 28;
const HEADER_HEIGHT = 32;
const ROW_HEADER_WIDTH = 44;
const MIN_COL_WIDTH = 40;
const MAX_COL_WIDTH = 400;

/**
 * Редактор таблицы в стиле Google Sheets. Строк: table.rowCount (по умолчанию 35), кнопка +20 строк.
 * В шапке: название (редактируемое), методист, тема.
 */
function SheetView({ table, onSave, onBack, initialFocusTitle }) {
  const rowCount = Math.max(DEFAULT_ROW_COUNT, Number(table.rowCount) || DEFAULT_ROW_COUNT);
  const [cells, setCells] = useState(() => ({ ...(table.cells || {}) }));
  const [colWidths, setColWidths] = useState(() => ({ ...(table.colWidths || {}) }));
  const [name, setName] = useState(table.name || 'Таблица');
  const [methodist, setMethodist] = useState(table.methodist || null);
  const [theme, setTheme] = useState(table.theme != null && table.theme !== '' ? table.theme : null);
  const [resizingCol, setResizingCol] = useState(null);
  const resizeStartRef = useRef({ x: 0, w: 0 });
  const colWidthsRef = useRef(table.colWidths || {});
  colWidthsRef.current = colWidths;

  useEffect(() => {
    setName(table.name || 'Таблица');
    setTitleValue(table.name || 'Таблица');
    setMethodist(table.methodist || null);
    setTheme(table.theme != null && table.theme !== '' ? table.theme : null);
    setCells({ ...(table.cells || {}) });
    setColWidths({ ...(table.colWidths || {}) });
  }, [table.id]);

  const getColWidth = useCallback((col) => {
    const w = colWidths[col];
    if (w == null) return CELL_WIDTH;
    return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Number(w)));
  }, [colWidths]);

  useEffect(() => {
    if (resizingCol == null) return;
    const onMove = (e) => {
      const delta = e.clientX - resizeStartRef.current.x;
      const newW = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, resizeStartRef.current.w + delta));
      setColWidths((prev) => ({ ...prev, [resizingCol]: newW }));
    };
    const onUp = () => {
      if (table.id && onSave) {
        onSave({
          ...table,
          name: name.trim() || 'Таблица',
          methodist: methodist || undefined,
          theme,
          cells,
          rowCount,
          colWidths: { ...colWidthsRef.current }
        });
      }
      setResizingCol(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingCol]);

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(table.name || 'Таблица');
  const [hoveredTaskRow, setHoveredTaskRow] = useState(null);
  const [successPopup, setSuccessPopup] = useState({ show: false, taskName: '' });
  const [users, setUsers] = useState([]);
  const [takeTaskLoading, setTakeTaskLoading] = useState(false);
  const inputRef = useRef(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const getCellId = (col, row) => `${columnLetter(col)}${row + 1}`;

  const getCellValue = useCallback((col, row) => {
    const id = getCellId(col, row);
    return cells[id] ?? '';
  }, [cells]);

  const setCellValue = useCallback((col, row, value) => {
    const id = getCellId(col, row);
    setCells((prev) => {
      const next = { ...prev };
      if (value === '') delete next[id];
      else next[id] = value;
      return next;
    });
  }, []);

  const persist = useCallback(() => {
    if (!table.id || !onSave) return;
    onSave({
      ...table,
      name: name.trim() || 'Таблица',
      methodist: methodist || undefined,
      theme,
      cells,
      rowCount,
      colWidths
    });
  }, [table, name, methodist, theme, cells, rowCount, colWidths, onSave]);

  useEffect(() => {
    persist();
  }, [cells, name, methodist, theme, rowCount]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (titleEditing && titleInputRef.current) titleInputRef.current.focus();
  }, [titleEditing]);

  useEffect(() => {
    if (initialFocusTitle) {
      setTitleEditing(true);
      setTitleValue(name);
    }
  }, [initialFocusTitle]);

  const startEdit = (col, row) => {
    setSelected({ col, row });
    setEditing({ col, row });
    setEditValue(getCellValue(col, row));
  };

  const commitEdit = () => {
    if (editing == null) return;
    const { col, row } = editing;
    setCellValue(col, row, editValue.trim());
    setEditing(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e, col, row) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editing && editing.col === col && editing.row === row) commitEdit();
      else startEdit(col, row);
      return;
    }
    if (e.key === 'Escape') {
      setEditing(null);
      setEditValue('');
      inputRef.current?.blur();
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      setEditValue(getCellValue(editing.col, editing.row));
      setEditing(null);
      inputRef.current?.blur();
    }
  };

  const commitTitleEdit = () => {
    const v = titleValue.trim();
    setName(v || 'Таблица');
    setTitleValue(v || 'Таблица');
    setTitleEditing(false);
  };

  const addRows = () => {
    const next = rowCount + ROWS_ADD_STEP;
    onSave({ ...table, rowCount: next, cells, name, methodist, theme, colWidths });
  };

  const handleTakeTask = useCallback(
    async (rowIndex) => {
      if (!table.id || !onSave || takeTaskLoading) return;
      const taskName = getCellValue(COL_A, rowIndex) || `Задача ${rowIndex + 1}`;
      setTakeTaskLoading(true);
      try {
        const data = await takeTableTask(table.id, rowIndex);
        setCells(data.table.cells || {});
        setSuccessPopup({ show: true, taskName: data.taskName || taskName });
        onSave({
          ...table,
          name: data.table.name ?? name,
          cells: data.table.cells || {},
          rowCount: data.table.rowCount ?? rowCount,
          methodist: data.table.methodist ?? methodist,
          theme: data.table.theme ?? theme,
          colWidths: data.table.colWidths ?? colWidths
        });
      } catch (err) {
        window.alert(err.message || 'Не удалось взять задачу.');
      } finally {
        setTakeTaskLoading(false);
      }
    },
    [table, onSave, takeTaskLoading, cells, name, rowCount, methodist, theme, colWidths, getCellValue]
  );

  const startResize = (e, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { x: e.clientX, w: getColWidth(colIndex) };
    setResizingCol(colIndex);
  };

  const themeColor = theme != null ? (THEMES.find((t) => t.id === theme)?.color || THEMES[0].color) : THEMES[0].color;

  return (
    <div className="sheet-view" data-theme={theme} style={{ '--sheet-theme-color': themeColor }}>
      <div className="sheet-toolbar">
        <button type="button" className="btn btn-ghost sheet-back" onClick={onBack}>
          ← К списку таблиц
        </button>
        <div className="sheet-toolbar-title">
          {titleEditing ? (
            <input
              ref={titleInputRef}
              type="text"
              className="sheet-title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitleEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitleEdit();
                if (e.key === 'Escape') {
                  setTitleValue(name);
                  setTitleEditing(false);
                }
              }}
            />
          ) : (
            <span
              className="sheet-title"
              onClick={() => {
                setTitleValue(name);
                setTitleEditing(true);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && (setTitleValue(name), setTitleEditing(true))}
            >
              {name || 'Таблица'}
            </span>
          )}
        </div>
        <MethodistPicker value={methodist} onChange={setMethodist} className="sheet-toolbar-methodist" />
        <ThemePicker value={theme} onChange={setTheme} className="sheet-toolbar-theme" />
      </div>
      <div className="sheet-wrap">
        <div className="sheet-grid" style={{ '--cell-height': CELL_HEIGHT }}>
          <div className="sheet-header-row" style={{ height: HEADER_HEIGHT }}>
            <div className="sheet-corner" style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }} />
            <div className="sheet-col-headers" style={{ height: HEADER_HEIGHT }}>
              {Array.from({ length: COLS }, (_, i) => (
                <div key={i} className="sheet-col-header-wrap" style={{ width: getColWidth(i), minWidth: MIN_COL_WIDTH }}>
                  <div className="sheet-col-header" style={{ height: HEADER_HEIGHT }}>
                    {getColumnHeader(i)}
                  </div>
                  <span
                    className="sheet-col-resize"
                    onMouseDown={(e) => startResize(e, i)}
                    role="separator"
                    aria-label="Изменить ширину"
                  />
                </div>
              ))}
            </div>
          </div>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <div key={rowIndex} className="sheet-row-wrap" style={{ height: CELL_HEIGHT }}>
              <div className="sheet-row-header" style={{ width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }}>
                {rowIndex + 1}
              </div>
              <div className="sheet-row" style={{ height: CELL_HEIGHT }}>
                {Array.from({ length: COLS }, (_, colIndex) => {
                  const isSelected = selected && selected.col === colIndex && selected.row === rowIndex;
                  const isEditing = editing && editing.col === colIndex && editing.row === rowIndex;
                  const value = getCellValue(colIndex, rowIndex);
                  const w = getColWidth(colIndex);
                  const isColA = colIndex === COL_A;
                  const isColF = colIndex === COL_F;
                  const showTakeTask = isColA && hoveredTaskRow === rowIndex && (value || '').trim().length > 0;

                  const cellContent = isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      className="sheet-cell-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={handleInputKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : isColF ? (
                    <ExecutorCell
                      value={value}
                      users={users}
                      onChange={(v) => setCellValue(COL_F, rowIndex, v)}
                    />
                  ) : (
                    <>
                      <span className="sheet-cell-value">{value || '\u00A0'}</span>
                      {showTakeTask && (
                        <button
                          type="button"
                          className="sheet-cell-take-task"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTakeTask(rowIndex);
                          }}
                          disabled={takeTaskLoading}
                        >
                          Взять задачу
                        </button>
                      )}
                    </>
                  );

                  return (
                    <div
                      key={colIndex}
                      className={`sheet-cell ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''} ${isColA ? 'sheet-cell--col-a' : ''}`}
                      style={{ width: w, minWidth: MIN_COL_WIDTH, height: CELL_HEIGHT }}
                      onClick={(e) => {
                        if (e.target.closest('.sheet-cell-take-task')) return;
                        if (!isEditing && isColF) return;
                        if (!isEditing) startEdit(colIndex, rowIndex);
                      }}
                      onMouseEnter={() => isColA && setHoveredTaskRow(rowIndex)}
                      onMouseLeave={() => isColA && setHoveredTaskRow(null)}
                      onDoubleClick={() => !isColF && startEdit(colIndex, rowIndex)}
                      onKeyDown={(e) => handleCellKeyDown(e, colIndex, rowIndex)}
                      tabIndex={0}
                    >
                      {cellContent}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn btn-ghost sheet-add-rows" onClick={addRows}>
          + Добавить 20 строк
        </button>
      </div>

      {successPopup.show && (
        <div
          className="sheet-success-overlay"
          onClick={() => setSuccessPopup({ show: false, taskName: '' })}
          role="dialog"
          aria-modal="true"
          aria-label="Успешно"
        >
          <div className="sheet-success-popup" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-success-check">✓</div>
            <p className="sheet-success-title">Успешно!</p>
            <p className="sheet-success-text">
              Вы забронировали задачу «{successPopup.taskName}».
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SheetView;
