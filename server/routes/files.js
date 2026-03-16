const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  listFiles,
  deleteFile,
  uploadFile,
  downloadFile
} = require('../services/yandexDiskService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /files — список файлов/папок в рабочей папке Я.Диска
router.get('/', async (req, res) => {
  try {
    const folder = req.query.folder || '';
    const items = await listFiles(folder);
    res.json(items);
  } catch (err) {
    console.error('Error in GET /files:', err);
    res.status(500).json({ message: 'Не удалось загрузить список файлов Яндекс.Диска.' });
  }
});

// POST /files/upload — загрузка файла в рабочую папку
router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'Файл не найден в запросе.' });
  }
  const safeName = file.originalname || 'file';
  const relativePath = safeName;
  try {
    await uploadFile(relativePath, file.buffer, file.mimetype);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Error in POST /files/upload:', err);
    res.status(500).json({ message: 'Не удалось загрузить файл на Яндекс.Диск.' });
  }
});

// DELETE /files — удалить файл (body: { path })
router.delete('/', express.json(), async (req, res) => {
  const { path: relPath } = req.body || {};
  if (!relPath) {
    return res.status(400).json({ message: 'Не указан путь файла.' });
  }
  try {
    await deleteFile(relPath);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in DELETE /files:', err);
    res.status(500).json({ message: 'Не удалось удалить файл на Яндекс.Диске.' });
  }
});

// GET /files/download?path=...
router.get('/download', async (req, res) => {
  const relPath = req.query.path;
  if (!relPath) {
    return res.status(400).json({ message: 'Не указан путь файла.' });
  }
  try {
    const { buffer, contentType } = await downloadFile(relPath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(relPath)}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error in GET /files/download:', err);
    res.status(500).json({ message: 'Не удалось скачать файл с Яндекс.Диска.' });
  }
});

module.exports = router;

