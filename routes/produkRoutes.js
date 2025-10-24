const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('./riwayatRoutes');

const router = express.Router();

// Get all products with pagination and search
router.get('/', async (req, res) => {
  try {
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const cari = req.query.cari || '';
    const kategoriId = req.query.kategori_id || '';
    const offset = (halaman - 1) * batas;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (cari) {
      whereClause += ' AND p.nama LIKE ?';
      queryParams.push(`%${cari}%`);
    }

    if (kategoriId) {
      whereClause += ' AND p.kategori_id = ?';
      queryParams.push(kategoriId);
    }

    // Get products with category name and borrowing status
    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori,
              CASE 
                WHEN p.status_peminjaman = 'tersedia' THEN 'Tersedia'
                WHEN p.status_peminjaman = 'dipinjam' THEN 'Sedang Dipinjam'
                WHEN p.status_peminjaman = 'maintenance' THEN 'Maintenance'
                ELSE 'Unknown'
              END as status_display
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       ${whereClause} 
       ORDER BY p.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, batas, offset]
    );

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM produk p ${whereClause}`,
      queryParams
    );

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      message: 'Data produk berhasil diambil',
      data: produk,
      paginasi: {
        halamanSaatIni: halaman,
        totalHalaman: totalHalaman,
        totalItem: total,
        itemPerHalaman: batas
      }
    });
  } catch (error) {
    console.error('Get produk error:', error);
    res.status(500).json({ error: 'Error saat mengambil data produk' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const produkId = parseInt(req.params.id);
    
    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori,
              CASE 
                WHEN p.status_peminjaman = 'tersedia' THEN 'Tersedia'
                WHEN p.status_peminjaman = 'dipinjam' THEN 'Sedang Dipinjam'
                WHEN p.status_peminjaman = 'maintenance' THEN 'Maintenance'
                ELSE 'Unknown'
              END as status_display
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       WHERE p.id = ?`,
      [produkId]
    );

    if (produk.length === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    // Get current borrowing info if product is borrowed
    let peminjamInfo = null;
    if (produk[0].status_peminjaman === 'dipinjam') {
      const [peminjaman] = await db.execute(
        `SELECT pm.nama_pengguna as nama_peminjam, p.tanggal_kembali_rencana
         FROM peminjaman p 
         LEFT JOIN pengguna pm ON p.peminjam_id = pm.id
         WHERE p.produk_id = ? AND p.status = 'dipinjam'`,
        [produkId]
      );
      if (peminjaman.length > 0) {
        peminjamInfo = peminjaman[0];
      }
    }

    res.json({
      message: 'Produk berhasil diambil',
      data: {
        ...produk[0],
        info_peminjaman: peminjamInfo
      }
    });
  } catch (error) {
    console.error('Get produk error:', error);
    res.status(500).json({ error: 'Error saat mengambil produk' });
  }
});

// Get available products for borrowing
router.get('/status/tersedia', authenticateToken, async (req, res) => {
  try {
    const kategoriId = req.query.kategori_id || '';
    const cari = req.query.cari || '';
    
    let whereClause = 'WHERE p.status_peminjaman = "tersedia"';
    let queryParams = [];

    if (cari) {
      whereClause += ' AND p.nama LIKE ?';
      queryParams.push(`%${cari}%`);
    }

    if (kategoriId) {
      whereClause += ' AND p.kategori_id = ?';
      queryParams.push(kategoriId);
    }

    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       ${whereClause} 
       ORDER BY p.nama ASC`,
      queryParams
    );

    res.json({
      success: true,
      message: 'Produk tersedia berhasil diambil',
      data: produk
    });
  } catch (error) {
    console.error('Get available products error:', error);
    res.status(500).json({ error: 'Error saat mengambil produk tersedia' });
  }
});

// Create new product
router.post('/', authenticateToken, [
  body('nama').notEmpty().withMessage('Nama produk diperlukan'),
  body('kategori_id').isInt({ min: 1 }).withMessage('Kategori ID harus berupa angka positif'),
  body('jumlah_stok').isInt({ min: 0 }).withMessage('Jumlah stok harus berupa angka positif'),
  body('stok_minimum').isInt({ min: 0 }).withMessage('Stok minimum harus berupa angka positif')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      nama, 
      deskripsi = '', 
      kategori_id, 
      jumlah_stok, 
      stok_minimum = 0 
    } = req.body;

    // Check if product name already exists in same category
    const [existingProduk] = await db.execute(
      'SELECT id FROM produk WHERE nama = ? AND kategori_id = ?',
      [nama, kategori_id]
    );

    if (existingProduk.length > 0) {
      return res.status(400).json({ error: 'Produk dengan nama tersebut sudah ada dalam kategori ini' });
    }

    // Check if category exists
    const [kategori] = await db.execute(
      'SELECT id FROM kategori WHERE id = ?',
      [kategori_id]
    );

    if (kategori.length === 0) {
      return res.status(400).json({ error: 'Kategori tidak ditemukan' });
    }

    const [result] = await db.execute(
      `INSERT INTO produk 
       (nama, deskripsi, kategori_id, jumlah_stok, stok_minimum, dibuat_pada) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [nama, deskripsi, kategori_id, jumlah_stok, stok_minimum]
    );

    // Log activity
    await logActivity(
      req.user.userId,
      'produk',
      result.insertId,
      'buat',
      null,
      { nama, deskripsi, kategori_id, jumlah_stok, stok_minimum },
      `Membuat produk baru: ${nama}`
    );

    res.status(201).json({
      message: 'Produk berhasil dibuat',
      produkId: result.insertId
    });
  } catch (error) {
    console.error('Create produk error:', error);
    res.status(500).json({ error: 'Error saat membuat produk' });
  }
});

// Update product
router.put('/:id', authenticateToken, [
  body('nama').notEmpty().withMessage('Nama produk diperlukan'),
  body('kategori_id').isInt({ min: 1 }).withMessage('Kategori ID harus berupa angka positif'),
  body('jumlah_stok').isInt({ min: 0 }).withMessage('Jumlah stok harus berupa angka positif'),
  body('stok_minimum').isInt({ min: 0 }).withMessage('Stok minimum harus berupa angka positif')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const produkId = parseInt(req.params.id);
    const { nama, deskripsi, kategori_id, jumlah_stok, stok_minimum } = req.body;

    // Check if product exists
    const [existingProduk] = await db.execute(
      'SELECT id FROM produk WHERE id = ?',
      [produkId]
    );

    if (existingProduk.length === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    // Check if product name already exists in same category (excluding current product)
    const [duplicateProduk] = await db.execute(
      'SELECT id FROM produk WHERE nama = ? AND kategori_id = ? AND id != ?',
      [nama, kategori_id, produkId]
    );

    if (duplicateProduk.length > 0) {
      return res.status(400).json({ error: 'Produk dengan nama tersebut sudah ada dalam kategori ini' });
    }

    // Check if category exists
    const [kategori] = await db.execute(
      'SELECT id FROM kategori WHERE id = ?',
      [kategori_id]
    );

    if (kategori.length === 0) {
      return res.status(400).json({ error: 'Kategori tidak ditemukan' });
    }

    const [result] = await db.execute(
      `UPDATE produk 
       SET nama = ?, deskripsi = ?, kategori_id = ?, 
           jumlah_stok = ?, stok_minimum = ?, diperbarui_pada = NOW() 
       WHERE id = ?`,
      [nama, deskripsi, kategori_id, jumlah_stok, stok_minimum, produkId]
    );

    res.json({ message: 'Produk berhasil diupdate' });
  } catch (error) {
    console.error('Update produk error:', error);
    res.status(500).json({ error: 'Error saat mengupdate produk' });
  }
});

// Delete product
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const produkId = parseInt(req.params.id);

    const [result] = await db.execute('DELETE FROM produk WHERE id = ?', [produkId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    res.json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Delete produk error:', error);
    res.status(500).json({ error: 'Error saat menghapus produk' });
  }
});

// Get low stock products
router.get('/peringatan/stok-rendah', authenticateToken, async (req, res) => {
  try {
    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori 
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       WHERE p.jumlah_stok <= p.stok_minimum 
       ORDER BY p.jumlah_stok ASC`
    );

    res.json({
      message: 'Data produk dengan stok rendah berhasil diambil',
      data: produk
    });
  } catch (error) {
    console.error('Get stok rendah produk error:', error);
    res.status(500).json({ error: 'Error saat mengambil data produk stok rendah' });
  }
});

module.exports = router;