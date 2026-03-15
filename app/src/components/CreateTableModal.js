import React from 'react';

/**
 * Окно поверх: выбор «Создать пустую таблицу» или «Создать шаблонную таблицу».
 */
function CreateTableModal({ open, onClose, onEmpty, onTemplate }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Создать таблицу">
      <div className="modal-content create-table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Создать таблицу</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">&times;</button>
        </div>
        <div className="modal-body">
          <button type="button" className="create-table-option" onClick={onEmpty}>
            Создать пустую таблицу
          </button>
          <button type="button" className="create-table-option" onClick={onTemplate}>
            Создать шаблонную таблицу
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateTableModal;
