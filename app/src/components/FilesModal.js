import React, { useEffect, useState } from 'react';
import { fetchFiles, deleteFile, uploadFile, buildDownloadUrl } from '../api/filesApi';

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} КБ`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} МБ`;
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU');
}

function FilesModal({ open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const token = window.localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    setError('');
    fetchFiles(token)
      .then(setItems)
      .catch((err) => {
        console.error('Files list error', err);
        setError(err.message || 'Не удалось загрузить список файлов.');
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = window.localStorage.getItem('token');
    if (!token) return;
    setUploading(true);
    setError('');
    try {
      await uploadFile(token, file);
      const list = await fetchFiles(token);
      setItems(list);
    } catch (err) {
      console.error('Upload error', err);
      setError(err.message || 'Не удалось загрузить файл.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (path) => {
    if (!window.confirm('Удалить этот файл с Яндекс.Диска?')) return;
    const token = window.localStorage.getItem('token');
    if (!token) return;
    try {
      await deleteFile(token, path);
      setItems((prev) => prev.filter((it) => it.path !== path));
    } catch (err) {
      console.error('Delete error', err);
      setError(err.message || 'Не удалось удалить файл.');
    }
  };

  const handleOpen = (path) => {
    const url = buildDownloadUrl(path);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Файлы таблицы" onClick={onClose}>
      <div className="modal-content template-tasks-modal files-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Файлы (Яндекс.Диск)</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="files-modal-toolbar">
            <label className="btn btn-primary files-modal-upload-btn">
              Загрузить файл
              <input
                type="file"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            {uploading && <span className="files-modal-status">Загрузка…</span>}
          </div>
          {loading && <p className="files-modal-status">Загрузка списка файлов…</p>}
          {error && <p className="files-modal-error">{error}</p>}
          {!loading && !error && (
            <div className="files-modal-list-wrap">
              {items.length === 0 ? (
                <p className="files-modal-empty">В папке пока нет файлов.</p>
              ) : (
                <table className="files-modal-table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Размер</th>
                      <th>Изменён</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.path}>
                        <td>{it.name}</td>
                        <td>{formatSize(it.size)}</td>
                        <td>{formatDate(it.lastModified)}</td>
                        <td className="files-modal-actions">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => handleOpen(it.path)}
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => handleDelete(it.path)}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilesModal;

