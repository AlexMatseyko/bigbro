import { API_BASE } from '../config';

export async function fetchFiles(token) {
  const res = await fetch(`${API_BASE}/files`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({}))).message || 'Не удалось загрузить список файлов.');
  }
  return res.json();
}

export async function deleteFile(token, path) {
  const res = await fetch(`${API_BASE}/files`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ path })
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({}))).message || 'Не удалось удалить файл.');
  }
}

export async function uploadFile(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({}))).message || 'Не удалось загрузить файл.');
  }
  return res.json();
}

export function buildDownloadUrl(path) {
  return `${API_BASE}/files/download?path=${encodeURIComponent(path)}`;
}

