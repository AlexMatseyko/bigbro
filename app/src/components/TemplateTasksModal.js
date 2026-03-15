import React, { useState, useRef } from 'react';
import { extractHeadingsFromPdf } from '../utils/pdfHeadings';

/**
 * Создание шаблонной таблицы: 1) ввод количества задач (1–99) или 2) загрузка PDF (заголовки → A1, A2, …).
 */
function TemplateTasksModal({ open, onClose, onConfirmCount, onConfirmHeadings }) {
  const [mode, setMode] = useState('count'); // 'count' | 'pdf'
  const [count, setCount] = useState(5);
  const [pdfFile, setPdfFile] = useState(null);
  const [headings, setHeadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Выберите файл PDF.');
      return;
    }
    setError('');
    setLoading(true);
    setPdfFile(file);
    setHeadings([]);
    try {
      const lines = await extractHeadingsFromPdf(file);
      setHeadings(lines);
    } catch (err) {
      console.error('PDF parse error', err);
      setError('Не удалось прочитать PDF.');
      setHeadings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCount = (e) => {
    e.preventDefault();
    const n = Math.max(1, Math.min(99, parseInt(count, 10) || 1));
    onConfirmCount(n);
    setCount(5);
    setMode('count');
    onClose();
  };

  const handleSubmitPdf = (e) => {
    e.preventDefault();
    if (headings.length === 0) {
      setError('Загрузите PDF или введите количество задач.');
      return;
    }
    onConfirmHeadings(headings);
    setPdfFile(null);
    setHeadings([]);
    setError('');
    setMode('count');
    onClose();
  };

  const handleClose = () => {
    setMode('count');
    setPdfFile(null);
    setHeadings([]);
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Шаблонная таблица">
      <div className="modal-content template-tasks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Создать шаблонную таблицу</h3>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">&times;</button>
        </div>
        <div className="modal-body">
          <div className="template-tasks-tabs">
            <button
              type="button"
              className={`template-tasks-tab ${mode === 'count' ? 'active' : ''}`}
              onClick={() => setMode('count')}
            >
              Ввести количество
            </button>
            <button
              type="button"
              className={`template-tasks-tab ${mode === 'pdf' ? 'active' : ''}`}
              onClick={() => setMode('pdf')}
            >
              Загрузить PDF
            </button>
          </div>

          {mode === 'count' && (
            <form onSubmit={handleSubmitCount}>
              <label className="template-tasks-label">
                Количество задач (1–99):
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="template-tasks-input"
                />
              </label>
              <p className="template-tasks-hint">
                В колонке A: Задача 1, Задача 2, … Задача {Math.max(1, Math.min(99, parseInt(count, 10) || 1))}.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={handleClose}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать</button>
              </div>
            </form>
          )}

          {mode === 'pdf' && (
            <form onSubmit={handleSubmitPdf}>
              <label className="template-tasks-label">
                PDF-файл (заголовки станут задачами в A1, A2, …):
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfSelect}
                  className="template-tasks-file"
                />
              </label>
              {loading && <p className="template-tasks-hint">Загрузка…</p>}
              {error && <p className="template-tasks-error">{error}</p>}
              {headings.length > 0 && !loading && (
                <p className="template-tasks-hint">
                  Найдено строк (задач): {headings.length}. Будут записаны в A1–A{headings.length}.
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={handleClose}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={headings.length === 0}>
                  Создать таблицу
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateTasksModal;
