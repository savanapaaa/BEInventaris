const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { uploadBuktiFotoMiddleware } = require('../middleware/uploadBuktiFoto');
const db = require('../config/database');
const path = require('path');

const router = express.Router();

// Helper function untuk log activity
const logActivity = async (penggunaId, tabelTerkait, idTerkait, aksi, dataLama = null, dataBaru = null, deskripsi = '') => {
  try {
    await db.execute(
      `INSERT INTO riwayat 
       (pengguna_id, tabel_terkait, id_terkait, aksi, data_lama, data_baru, deskripsi, dibuat_pada) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        penggunaId,
        tabelTerkait,
        idTerkait,
        aksi,
        dataLama ? JSON.stringify(dataLama) : null,
        dataBaru ? JSON.stringify(dataBaru) : null,
        deskripsi
      ]
    );
  } catch (error) {
    console.error('Log activity error:', error);
  }
};

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
    res.status(500).json({ 
      success: false,
      error: 'Database connection failed', 
      details: error.message 
    });
  }
});

// Get all peminjaman with pagination and filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('GET /api/peminjaman - User:', req.user?.userId);
    
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const status = req.query.status || '';
    const offset = (halaman - 1) * batas;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    // If not admin, only show user's own data
    if (req.user.peran !== 'admin') {
      whereClause += ' AND p.peminjam_id = ?';
      queryParams.push(req.user.userId);
    }

    if (status) {
      whereClause += ' AND p.status = ?';
      queryParams.push(status);
    }

    // Get peminjaman with product and user info
    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang, 
              pr.nama as produk_nama,
              pm.nama_pengguna as nama_peminjam,
              pm.nama_pengguna as nama_pengguna,
              pt.nama_pengguna as nama_petugas,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat,
              p.foto_bukti_pengembalian
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
       LEFT JOIN pengguna pt ON p.petugas_id = pt.id
       ${whereClause} 
       ORDER BY p.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, batas, offset]
    );

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM peminjaman p ${whereClause}`,
      queryParams
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
    console.error('Error getting peminjaman:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data peminjaman',
      details: error.message
    });
  }
});

// Get user's borrowings (current/active borrowings) - MOVED BEFORE /:id route
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const peminjam_id = req.user.userId;
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const offset = (halaman - 1) * batas;
    const status = req.query.status || 'all'; // all, dipinjam, completed, terlambat

    let whereClause = 'WHERE p.peminjam_id = ?';
    let queryParams = [peminjam_id];

    if (status !== 'all') {
      if (status === 'terlambat') {
        whereClause += ' AND p.status IN ("dipinjam") AND p.tanggal_kembali_rencana < CURDATE()';
      } else {
        whereClause += ' AND p.status = ?';
        queryParams.push(status);
      }
    }

    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang,
              pr.nama as produk_nama,
              pr.deskripsi as deskripsi_barang,
              k.nama as kategori_nama,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat,
              p.foto_bukti_pengembalian
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN kategori k ON pr.kategori_id = k.id
       ${whereClause}
       ORDER BY p.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, batas, offset]
    );

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM peminjaman p ${whereClause}`,
      queryParams
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
    console.error('Error getting user borrowings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data peminjaman user' 
    });
  }
});

// Get user's borrowing history - MOVED BEFORE /:id route  
router.get('/user/riwayat', authenticateToken, async (req, res) => {
  try {
    const peminjam_id = req.user.userId;
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const offset = (halaman - 1) * batas;

    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang,
              pr.nama as produk_nama,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat,
              p.foto_bukti_pengembalian
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
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil riwayat peminjaman' 
    });
  }
});

// Get peminjaman by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang, 
              pr.nama as produk_nama,
              pr.deskripsi as deskripsi_barang,
              pm.nama_pengguna as nama_peminjam,
              pm.nama_pengguna as nama_pengguna,
              pm.email as email_peminjam,
              pt.nama_pengguna as nama_petugas,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat,
              p.foto_bukti_pengembalian
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
       LEFT JOIN pengguna pt ON p.petugas_id = pt.id
       WHERE p.id = ?`,
      [id]
    );

    if (peminjaman.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Peminjaman tidak ditemukan' 
      });
    }

    res.json({
      success: true,
      data: peminjaman[0]
    });
  } catch (error) {
    console.error('Error getting peminjaman:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil detail peminjaman' 
    });
  }
});

// Create new peminjaman (Pinjam barang)
router.post('/', [
  authenticateToken,
  body('produk_id').isInt({ min: 1 }).withMessage('ID barang harus berupa angka positif'),
  body('tanggal_kembali_rencana').isDate().withMessage('Tanggal kembali harus berupa tanggal yang valid'),
  body('keperluan').notEmpty().withMessage('Keperluan peminjaman harus diisi'),
  body('kondisi_pinjam').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { produk_id, tanggal_kembali_rencana, keperluan, kondisi_pinjam = 'Baik' } = req.body;
    const peminjam_id = req.user.userId;
    const petugas_id = req.user.userId;
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
        return res.status(404).json({ 
          success: false,
          error: 'Barang tidak ditemukan' 
        });
      }

      if (produk[0].status_peminjaman !== 'tersedia') {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          error: 'Barang tidak tersedia untuk dipinjam',
          status_saat_ini: produk[0].status_peminjaman
        });
      }

      // Validate return date
      const today = new Date().toISOString().split('T')[0];
      if (tanggal_kembali_rencana <= today) {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
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
        `SELECT p.*, pr.nama as nama_barang 
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
    res.status(500).json({ 
      success: false,
      error: 'Gagal membuat peminjaman' 
    });
  }
});

// Return borrowed item (Kembalikan barang) with photo evidence
router.put('/:id/kembalikan', [
  authenticateToken,
  uploadBuktiFotoMiddleware, // Handle file upload first
  body('kondisi_kembali').notEmpty().withMessage('Kondisi pengembalian harus diisi'),
  body('catatan').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { kondisi_kembali, catatan = '' } = req.body;
    const tanggal_kembali_aktual = new Date().toISOString().split('T')[0];
    
    // Get foto bukti URL if file uploaded
    let foto_bukti_url = null;
    if (req.file) {
      foto_bukti_url = `/uploads/bukti-pengembalian/${req.file.filename}`;
    }

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Get peminjaman details dengan validasi user ownership
      const [peminjaman] = await db.execute(
        'SELECT * FROM peminjaman WHERE id = ? FOR UPDATE',
        [id]
      );

      if (peminjaman.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ 
          success: false,
          error: 'Peminjaman tidak ditemukan' 
        });
      }

      // Check if user owns this borrowing (unless admin)
      if (req.user.peran !== 'admin' && peminjaman[0].peminjam_id !== req.user.userId) {
        await db.query('ROLLBACK');
        return res.status(403).json({ 
          success: false,
          error: 'Anda tidak memiliki akses untuk mengembalikan peminjaman ini' 
        });
      }

      if (peminjaman[0].status === 'dikembalikan') {
        await db.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          error: 'Barang sudah dikembalikan sebelumnya' 
        });
      }

      // Calculate denda if late
      let denda = 0;
      const hariTerlambat = Math.max(0, 
        Math.floor((new Date(tanggal_kembali_aktual) - new Date(peminjaman[0].tanggal_kembali_rencana)) / (1000 * 60 * 60 * 24))
      );
      
      if (hariTerlambat > 0) {
        denda = hariTerlambat * 5000; // Rp 5000 per hari
      }

      // Update peminjaman with photo evidence
      await db.execute(
        `UPDATE peminjaman 
         SET tanggal_kembali_aktual = ?, kondisi_kembali = ?, catatan = ?, 
             denda = ?, status = 'dikembalikan', 
             foto_bukti_pengembalian = ?, catatan_pengembalian = ?,
             diperbarui_pada = NOW()
         WHERE id = ?`,
        [tanggal_kembali_aktual, kondisi_kembali, catatan, denda, foto_bukti_url, catatan, id]
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
          kondisi_kembali,
          foto_bukti_pengembalian: foto_bukti_url || null,
          denda: denda > 0 ? denda : null
        },
        `Mengembalikan barang${denda > 0 ? ` dengan denda Rp ${denda.toLocaleString()}` : ''}${foto_bukti_url ? ' dengan foto bukti' : ''}`
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Barang berhasil dikembalikan',
        data: {
          id: parseInt(id),
          tanggal_kembali_aktual,
          kondisi_kembali,
          denda,
          hari_terlambat: hariTerlambat,
          foto_bukti_pengembalian: foto_bukti_url || null,
          catatan_pengembalian: catatan,
          status: 'dikembalikan'
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error returning item:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengembalikan barang' 
    });
  }
});

// Get overdue borrowings (Admin only)
router.get('/admin/terlambat', requireAdmin, async (req, res) => {
  try {
    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang,
              pr.nama as produk_nama,
              pm.nama_pengguna as nama_peminjam,
              pm.nama_pengguna as nama_pengguna,
              pm.email as email_peminjam,
              DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat,
              p.foto_bukti_pengembalian
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
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data peminjaman terlambat' 
    });
  }
});

module.exports = router;