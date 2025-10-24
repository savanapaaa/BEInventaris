const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('./riwayatRoutes');

const router = express.Router();

// Debug endpoint to test without auth
router.get('/test', async (req, res) => {
  try {
    const [peminjaman] = await db.execute(
      `SELECT COUNT(*) as total FROM peminjaman`
    );
    res.json({
      success: true,
      message: 'Database connection OK',
      count: peminjaman[0].total
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// Get all peminjaman with pagination and filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('GET /api/peminjaman - User:', req.user);
    
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const status = req.query.status || '';
    const peminjamId = req.query.peminjam_id || '';
    const produkId = req.query.produk_id || '';
    const offset = (halaman - 1) * batas;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      queryParams.push(status);
    }

    if (peminjamId) {
      whereClause += ' AND p.peminjam_id = ?';
      queryParams.push(peminjamId);
    }

    if (produkId) {
      whereClause += ' AND p.produk_id = ?';
      queryParams.push(produkId);
    }

    console.log('Query params:', queryParams);
    console.log('Where clause:', whereClause);

    // Get peminjaman with product and user info
    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_produk, 
              pm.nama_pengguna as nama_peminjam,
              pt.nama_pengguna as nama_petugas,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
       LEFT JOIN pengguna pt ON p.petugas_id = pt.id
       ${whereClause} 
       ORDER BY p.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, batas, offset]
    );

    console.log('Peminjaman found:', peminjaman.length);

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM peminjaman p ${whereClause}`,
      queryParams
    );

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    console.log('Total peminjaman:', total);

    res.json({
      success: true,
      data: peminjaman,
      pagination: {
        halaman,
        batas,
        total,
        totalHalaman
      }
    });
  } catch (error) {
    console.error('Error getting peminjaman:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Gagal mengambil data peminjaman',
      details: error.message,
      sql_error: error.sqlMessage || null
    });
  }
});

// Get peminjaman by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_produk, 
              pr.deskripsi as deskripsi_produk,
              pm.nama_pengguna as nama_peminjam,
              pm.email as email_peminjam,
              pt.nama_pengguna as nama_petugas,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
       LEFT JOIN pengguna pt ON p.petugas_id = pt.id
       WHERE p.id = ?`,
      [id]
    );

    if (peminjaman.length === 0) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    // Get perpanjangan history
    const [perpanjangan] = await db.execute(
      `SELECT pr.*, u.nama_pengguna as disetujui_oleh_nama
       FROM perpanjangan pr
       LEFT JOIN pengguna u ON pr.disetujui_oleh = u.id
       WHERE pr.peminjaman_id = ?
       ORDER BY pr.dibuat_pada DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...peminjaman[0],
        perpanjangan
      }
    });
  } catch (error) {
    console.error('Error getting peminjaman:', error);
    res.status(500).json({ error: 'Gagal mengambil detail peminjaman' });
  }
});

// Create new peminjaman (Pinjam barang)
router.post('/', [
  authenticateToken,
  body('produk_id').isInt({ min: 1 }).withMessage('ID produk harus berupa angka positif'),
  body('tanggal_kembali_rencana').isDate().withMessage('Tanggal kembali harus berupa tanggal yang valid'),
  body('keperluan').notEmpty().withMessage('Keperluan peminjaman harus diisi'),
  body('kondisi_pinjam').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { produk_id, tanggal_kembali_rencana, keperluan, kondisi_pinjam = 'Baik' } = req.body;
    const peminjam_id = req.user.userId;
    const petugas_id = req.user.userId; // For now, user creates their own borrowing
    const tanggal_pinjam = new Date().toISOString().split('T')[0];

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Check if product exists and available
      const [produk] = await db.execute(
        'SELECT * FROM produk WHERE id = ? FOR UPDATE',
        [produk_id]
      );

      if (produk.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Produk tidak ditemukan' });
      }

      if (produk[0].status_peminjaman !== 'tersedia') {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Produk tidak tersedia untuk dipinjam',
          status_saat_ini: produk[0].status_peminjaman
        });
      }

      // Validate return date (must be in future)
      const today = new Date().toISOString().split('T')[0];
      if (tanggal_kembali_rencana <= today) {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Tanggal kembali harus lebih dari hari ini'
        });
      }

      // Update product status
      await db.execute(
        'UPDATE produk SET status_peminjaman = ?, diperbarui_pada = NOW() WHERE id = ?',
        ['dipinjam', produk_id]
      );

      // Insert peminjaman record
      const [result] = await db.execute(
        `INSERT INTO peminjaman 
         (produk_id, peminjam_id, petugas_id, tanggal_pinjam, tanggal_kembali_rencana, keperluan, kondisi_pinjam) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [produk_id, peminjam_id, petugas_id, tanggal_pinjam, tanggal_kembali_rencana, keperluan, kondisi_pinjam]
      );

      const peminjamanId = result.insertId;

      // Log activity
      await logActivity(
        req.user.userId,
        'peminjaman',
        peminjamanId,
        'buat',
        null,
        {
          produk_id,
          tanggal_pinjam,
          tanggal_kembali_rencana,
          keperluan
        },
        `Meminjam ${produk[0].nama} untuk ${keperluan}`
      );

      await db.query('COMMIT');

      // Get created peminjaman with details
      const [newPeminjaman] = await db.execute(
        `SELECT p.*, pr.nama as nama_produk 
         FROM peminjaman p 
         LEFT JOIN produk pr ON p.produk_id = pr.id 
         WHERE p.id = ?`,
        [peminjamanId]
      );

      res.status(201).json({
        success: true,
        message: 'Peminjaman berhasil dibuat',
        data: newPeminjaman[0]
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating peminjaman:', error);
    res.status(500).json({ error: 'Gagal membuat peminjaman' });
  }
});

// Return borrowed item (Kembalikan barang)
router.put('/:id/kembalikan', [
  authenticateToken,
  body('kondisi_kembali').notEmpty().withMessage('Kondisi pengembalian harus diisi'),
  body('catatan').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { kondisi_kembali, catatan = '' } = req.body;
    const tanggal_kembali_aktual = new Date().toISOString().split('T')[0];

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Get peminjaman details
      const [peminjaman] = await db.execute(
        'SELECT * FROM peminjaman WHERE id = ? FOR UPDATE',
        [id]
      );

      if (peminjaman.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
      }

      if (peminjaman[0].status === 'dikembalikan') {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Barang sudah dikembalikan sebelumnya' });
      }

      // Calculate denda if late
      let denda = 0;
      const hariTerlambat = Math.max(0, 
        Math.floor((new Date(tanggal_kembali_aktual) - new Date(peminjaman[0].tanggal_kembali_rencana)) / (1000 * 60 * 60 * 24))
      );
      
      if (hariTerlambat > 0) {
        denda = hariTerlambat * 5000; // Rp 5000 per hari
      }

      // Update peminjaman
      await db.execute(
        `UPDATE peminjaman 
         SET tanggal_kembali_aktual = ?, kondisi_kembali = ?, catatan = ?, 
             denda = ?, status = 'dikembalikan', diperbarui_pada = NOW()
         WHERE id = ?`,
        [tanggal_kembali_aktual, kondisi_kembali, catatan, denda, id]
      );

      // Update product status back to available
      await db.execute(
        'UPDATE produk SET status_peminjaman = ?, diperbarui_pada = NOW() WHERE id = ?',
        ['tersedia', peminjaman[0].produk_id]
      );

      // Log activity
      await logActivity(
        req.user.userId,
        'peminjaman',
        id,
        'ubah',
        { status: peminjaman[0].status },
        { 
          status: 'dikembalikan', 
          tanggal_kembali_aktual,
          denda: denda > 0 ? denda : null
        },
        `Mengembalikan barang${denda > 0 ? ` dengan denda Rp ${denda.toLocaleString()}` : ''}`
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Barang berhasil dikembalikan',
        data: {
          tanggal_kembali_aktual,
          kondisi_kembali,
          denda,
          hari_terlambat: hariTerlambat
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error returning item:', error);
    res.status(500).json({ error: 'Gagal mengembalikan barang' });
  }
});

// Extend borrowing period (Perpanjang peminjaman)
router.post('/:id/perpanjang', [
  authenticateToken,
  body('tanggal_kembali_baru').isDate().withMessage('Tanggal kembali baru harus berupa tanggal yang valid'),
  body('alasan').notEmpty().withMessage('Alasan perpanjangan harus diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { tanggal_kembali_baru, alasan } = req.body;
    const disetujui_oleh = req.user.userId;

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Get current peminjaman
      const [peminjaman] = await db.execute(
        'SELECT * FROM peminjaman WHERE id = ? FOR UPDATE',
        [id]
      );

      if (peminjaman.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
      }

      if (peminjaman[0].status !== 'dipinjam' && peminjaman[0].status !== 'terlambat') {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Peminjaman tidak dapat diperpanjang' });
      }

      const tanggal_kembali_lama = peminjaman[0].tanggal_kembali_rencana;

      // Validate new return date
      if (tanggal_kembali_baru <= tanggal_kembali_lama) {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Tanggal kembali baru harus lebih dari tanggal kembali sebelumnya'
        });
      }

      // Insert perpanjangan record
      await db.execute(
        `INSERT INTO perpanjangan 
         (peminjaman_id, tanggal_kembali_lama, tanggal_kembali_baru, alasan, disetujui_oleh) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, tanggal_kembali_lama, tanggal_kembali_baru, alasan, disetujui_oleh]
      );

      // Update peminjaman
      await db.execute(
        `UPDATE peminjaman 
         SET tanggal_kembali_rencana = ?, status = 'dipinjam', diperbarui_pada = NOW()
         WHERE id = ?`,
        [tanggal_kembali_baru, id]
      );

      // Log activity
      await logActivity(
        req.user.userId,
        'peminjaman',
        id,
        'ubah',
        { tanggal_kembali_rencana: tanggal_kembali_lama },
        { tanggal_kembali_rencana: tanggal_kembali_baru },
        `Memperpanjang peminjaman hingga ${tanggal_kembali_baru}. Alasan: ${alasan}`
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Peminjaman berhasil diperpanjang',
        data: {
          tanggal_kembali_lama,
          tanggal_kembali_baru,
          alasan
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error extending borrowing:', error);
    res.status(500).json({ error: 'Gagal memperpanjang peminjaman' });
  }
});

// Get user's borrowing history
router.get('/user/riwayat', authenticateToken, async (req, res) => {
  try {
    const peminjam_id = req.user.userId;
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const offset = (halaman - 1) * batas;

    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_produk,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       WHERE p.peminjam_id = ?
       ORDER BY p.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [peminjam_id, batas, offset]
    );

    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM peminjaman WHERE peminjam_id = ?',
      [peminjam_id]
    );

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      success: true,
      data: peminjaman,
      pagination: {
        halaman,
        batas,
        total,
        totalHalaman
      }
    });
  } catch (error) {
    console.error('Error getting user borrowing history:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat peminjaman' });
  }
});

// Get overdue borrowings (Admin only)
router.get('/admin/terlambat', requireAdmin, async (req, res) => {
  try {
    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_produk,
              pm.nama_pengguna as nama_peminjam,
              pm.email as email_peminjam,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id
       WHERE p.status IN ('dipinjam', 'terlambat') 
       AND p.tanggal_kembali_rencana < CURDATE()
       ORDER BY p.tanggal_kembali_rencana ASC`
    );

    res.json({
      success: true,
      data: peminjaman
    });
  } catch (error) {
    console.error('Error getting overdue borrowings:', error);
    res.status(500).json({ error: 'Gagal mengambil data peminjaman terlambat' });
  }
});

module.exports = router;