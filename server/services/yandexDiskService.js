const fetch = require('node-fetch');
const { parseStringPromise } = require('xml2js');

const WEBDAV_BASE_URL = 'https://webdav.yandex.ru';

const BASIC_USER = process.env.YANDEX_DISK_LOGIN;
const BASIC_PASSWORD = process.env.YANDEX_DISK_APP_PASSWORD;
const BASE_FOLDER = process.env.YANDEX_DISK_BASE_FOLDER || '0 Скрипты по вебинарам';

if (!BASIC_USER || !BASIC_PASSWORD) {
  console.warn('[YandexDisk] YANDEX_DISK_LOGIN or YANDEX_DISK_APP_PASSWORD is not set. Yandex Disk integration will not work.');
}

function getAuthHeaders(extra = {}) {
  if (!BASIC_USER || !BASIC_PASSWORD) return extra;
  const token = Buffer.from(`${BASIC_USER}:${BASIC_PASSWORD}`, 'utf8').toString('base64');
  return {
    Authorization: `Basic ${token}`,
    ...extra
  };
}

function buildPath(relativePath = '') {
  const base = `/${BASE_FOLDER}`;
  if (!relativePath) return encodeURI(base);
  return encodeURI(`${base}/${relativePath}`);
}

async function ensureBaseFolder() {
  if (!BASIC_USER || !BASIC_PASSWORD) return;
  const url = `${WEBDAV_BASE_URL}${buildPath()}`;
  const res = await fetch(url, {
    method: 'MKCOL',
    headers: getAuthHeaders()
  }).catch(() => null);
  if (!res) return;
  if (res.status === 201 || res.status === 405 || res.status === 409) {
    return;
  }
}

async function listFiles(folder = '') {
  if (!BASIC_USER || !BASIC_PASSWORD) {
    throw new Error('Yandex Disk credentials are not configured');
  }
  await ensureBaseFolder();

  // Нормализуем относительный путь подпапки (без ведущих/замыкающих слэшей)
  const normalizedFolder = String(folder || '').replace(/^\/+|\/+$/g, '');

  // Запрашиваем содержимое конкретной папки (корня или подпапки)
  const url = `${WEBDAV_BASE_URL}${buildPath(normalizedFolder)}`;
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: getAuthHeaders({
      // Нужны только непосредственные дети текущей папки
      Depth: '1'
    })
  });

  if (res.status === 404) {
    // Рабочая папка или дерево не найдены — считаем, что содержимого нет
    return [];
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex Disk list error: ${res.status} ${text}`);
  }

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });

  const responses = parsed['d:multistatus']?.['d:response'];
  if (!responses) return [];

  const items = Array.isArray(responses) ? responses : [responses];
  // Базовый href текущей папки (корень или подпапка)
  let baseHref = new URL(url).pathname;
  // Декодируем, чтобы формат совпадал с decodeURI(href)
  baseHref = decodeURI(baseHref);
  // Яндекс может возвращать с/без завершающего слеша — нормализуем
  baseHref = baseHref.replace(/\/+$/, '');

  const all = items
    .map((item) => {
      const href = item['d:href'];
      const propstat = item['d:propstat'];
      const prop = (Array.isArray(propstat) ? propstat[0] : propstat)['d:prop'];
      const resType = prop['d:resourcetype'];

      const isDir = !!(resType && resType['d:collection'] !== undefined);

      // Яндекс возвращает href с конечным / — уберём базовый путь и слэш
      let relativePath = decodeURI(href || '');
      if (relativePath.startsWith(baseHref)) {
        relativePath = relativePath.slice(baseHref.length);
      }
      // убираем ведущие/хвостовые слэши
      relativePath = relativePath.replace(/^\/+/, '').replace(/\/+$/, '');

      if (!relativePath) {
        // это сама корневая папка
        return null;
      }

      const displayName = prop['d:displayname'] || relativePath;
      const contentLength = Number(prop['d:getcontentlength'] || 0) || 0;
      const lastModified = prop['d:getlastmodified'] || null;

      return {
        name: displayName,
        path: relativePath,
        isDir,
        size: isDir ? null : contentLength,
        lastModified
      };
    })
    .filter(Boolean);

  // Мы запрашиваем содержимое уже конкретной папки с Depth: 1,
  // поэтому оставляем только непосредственных детей (без вложенных сегментов)
  const result = all.filter((it) => !String(it.path || '').includes('/'));

  return result.sort((a, b) => {
    // папки сверху, потом файлы по имени
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, 'ru');
  });
}

async function deleteFile(relativePath) {
  if (!BASIC_USER || !BASIC_PASSWORD) {
    throw new Error('Yandex Disk credentials are not configured');
  }
  const url = `${WEBDAV_BASE_URL}${buildPath(relativePath)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex Disk delete error: ${res.status} ${text}`);
  }
}

async function uploadFile(relativePath, buffer, contentType) {
  if (!BASIC_USER || !BASIC_PASSWORD) {
    throw new Error('Yandex Disk credentials are not configured');
  }
  await ensureBaseFolder();

  const url = `${WEBDAV_BASE_URL}${buildPath(relativePath)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders({
      'Content-Type': contentType || 'application/octet-stream'
    }),
    body: buffer
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex Disk upload error: ${res.status} ${text}`);
  }
}

async function downloadFile(relativePath) {
  if (!BASIC_USER || !BASIC_PASSWORD) {
    throw new Error('Yandex Disk credentials are not configured');
  }
  const url = `${WEBDAV_BASE_URL}${buildPath(relativePath)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex Disk download error: ${res.status} ${text}`);
  }
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const buffer = await res.buffer();
  return { buffer, contentType };
}

module.exports = {
  listFiles,
  deleteFile,
  uploadFile,
  downloadFile
};

