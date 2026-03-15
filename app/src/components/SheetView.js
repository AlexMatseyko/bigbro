import React, { useState, useCallback, useRef, useEffect } from 'react';
import { columnLetter } from '../utils/tableStorage';

const COLS = 26;
const ROWS = 100;
const CELL_WIDTH = 100;
const CELL_HEIGHT = 28;
const HEADER_HEIGHT = 32;
const ROW_HEADER_WIDTH = 44;

/**
 * Редактор таблицы в стиле Google Sheets: сетка ячеек, заголовки колонок (A–Z) и строк (1–100), редактирование по клику.
 */
function SheetView({ table, onSave, onBack }) {
  const [cells, setCells] = useState(() => ({ ...(table.cells || {}) }));
  const [selected, setSelected] = useState(null); // { col, row } or null
  const [editing, setEditing] = useState(null);    // { col, row } or null
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

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

  // При сохранении таблицы — прокидывать cells наверх и в localStorage
  useEffect(() => {
    if (!table.id || !onSave) return;
    onSave({ ...table, cells });
  }, [cells, table.id, table.name, onSave]);

  // Фокус на input при входе в режим редактирования
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

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
      if (editing && editing.col === col && editing.row === row) {
        commitEdit();
      } else {
        startEdit(col, row);
      }
      return;
    }
    if (e.key === 'Escape') {
      setEditing(null);
      setEditValue('');
      if (inputRef.current) inputRef.current.blur();
      return;
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

  return (
    <div className="sheet-view">
      <div className="sheet-toolbar">
        <button type="button" className="btn btn-ghost sheet-back" onClick={onBack}>
          ← К списку таблиц
        </button>
        <span className="sheet-title">{table.name || 'Таблица'}</span>
      </div>
      <div className="sheet-wrap">
        <div className="sheet-grid" style={{ '--cell-width': CELL_WIDTH, '--cell-height': CELL_HEIGHT }}>
          {/* Первая строка: угол + заголовки колонок A, B, C, ... */}
          <div className="sheet-header-row" style={{ height: HEADER_HEIGHT }}>
            <div className="sheet-corner" style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }} />
            <div className="sheet-col-headers" style={{ height: HEADER_HEIGHT }}>
              {Array.from({ length: COLS }, (_, i) => (
                <div key={i} className="sheet-col-header" style={{ width: CELL_WIDTH }}>
                  {columnLetter(i)}
                </div>
              ))}
            </div>
          </div>
          {/* Строки */}
          {Array.from({ length: ROWS }, (_, rowIndex) => (
            <div key={rowIndex} className="sheet-row-wrap" style={{ height: CELL_HEIGHT }}>
              <div
                className="sheet-row-header"
                style={{ width: ROW_HEADER_WIDTH, height: CELL_HEIGHT }}
              >
                {rowIndex + 1}
              </div>
              <div className="sheet-row" style={{ height: CELL_HEIGHT }}>
                {Array.from({ length: COLS }, (_, colIndex) => {
                  const isSelected = selected && selected.col === colIndex && selected.row === rowIndex;
                  const isEditing = editing && editing.col === colIndex && editing.row === rowIndex;
                  const value = getCellValue(colIndex, rowIndex);

                  return (
                    <div
                      key={colIndex}
                      className={`sheet-cell ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
                      style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                      onClick={() => {
                        if (isEditing) return;
                        startEdit(colIndex, rowIndex);
                      }}
                      onDoubleClick={() => startEdit(colIndex, rowIndex)}
                      onKeyDown={(e) => handleCellKeyDown(e, colIndex, rowIndex)}
                      tabIndex={0}
                    >
                      {isEditing ? (
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
                      ) : (
                        <span className="sheet-cell-value">{value || '\u00A0'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SheetView;
