const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get user's history - UPDATED untuk frontend requirement
router.get('/', authenticateToken, async (req, res) => {
  try {
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 20;
    const tabel = req.query.tabel || '';
    const aksi = req.query.aksi || '';
    const showAll = req.query.showAll || false; // Admin bisa lihat semua
    const offset = (halaman - 1) * batas;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    // Filter berdasarkan user_id dari JWT kecuali admin yang request showAll
    if (req.user.peran !== 'admin' || !showAll) {
      whereClause += ' AND r.pengguna_id = ?';
      queryParams.push(req.user.userId);
    }

    if (tabel) {
      whereClause += ' AND r.tabel_terkait = ?';
      queryParams.push(tabel);
    }

    if (aksi) {
      whereClause += ' AND r.aksi = ?';
      queryParams.push(aksi);
    }

    // Get history with user info and include peminjaman data
    const [riwayat] = await db.execute(
      `SELECT r.*, 
              u.nama_pengguna,
              CASE 
                WHEN r.tabel_terkait = 'peminjaman' THEN 
                  (SELECT CONCAT(pr.nama, ' - ', pm.keperluan) 
                   FROM peminjaman pm 
                   LEFT JOIN produk pr ON pm.produk_id = pr.id 
                   WHERE pm.id = r.id_terkait)
                ELSE r.deskripsi 
              END as detail_aktivitas
       FROM riwayat r 
       LEFT JOIN pengguna u ON r.pengguna_id = u.id 
       ${whereClause} 
       ORDER BY r.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, batas, offset]
    );

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM riwayat r ${whereClause}`,
      queryParams
    );

    // Parse JSON data untuk frontend
    const riwayatParsed = riwayat.map(item => {
      let data_lama = null;
      let data_baru = null;
      
      // Safely parse JSON data
      try {
        data_lama = item.data_lama ? JSON.parse(item.data_lama) : null;
      } catch (error) {
        console.warn('Failed to parse data_lama:', error);
        data_lama = item.data_lama; // Keep original if parse fails
      }
      
      try {
        data_baru = item.data_baru ? JSON.parse(item.data_baru) : null;
      } catch (error) {
        console.warn('Failed to parse data_baru:', error);
        data_baru = item.data_baru; // Keep original if parse fails
      }
      
      return {
        ...item,
        data_lama,
        data_baru
      };
    });

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      success: true,
      message: 'Data riwayat berhasil diambil',
      data: riwayatParsed,
      pagination: {
        halaman: halaman,
        totalHalaman: totalHalaman,
        total: total,
        batas: batas
      }
    });
  } catch (error) {
    console.error('Get riwayat error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error saat mengambil data riwayat',
      details: error.message 
    });
  }
});

// Get history by table and record ID
router.get('/tabel/:tabel/:id', authenticateToken, async (req, res) => {
  try {
    const { tabel, id } = req.params;
    
    const [riwayat] = await db.execute(
      `SELECT r.*, u.nama_pengguna 
       FROM riwayat r 
       LEFT JOIN pengguna u ON r.pengguna_id = u.id 
       WHERE r.tabel_terkait = ? AND r.id_terkait = ?
       ORDER BY r.dibuat_pada DESC`,
      [tabel, id]
    );

    // Parse JSON data untuk frontend
    const riwayatParsed = riwayat.map(item => {
      let data_lama = null;
      let data_baru = null;
      
      try {
        data_lama = item.data_lama ? JSON.parse(item.data_lama) : null;
      } catch (error) {
        console.warn('Failed to parse data_lama:', error);
        data_lama = item.data_lama;
      }
      
      try {
        data_baru = item.data_baru ? JSON.parse(item.data_baru) : null;
      } catch (error) {
        console.warn('Failed to parse data_baru:', error);
        data_baru = item.data_baru;
      }
      
      return {
        ...item,
        data_lama,
        data_baru
      };
    });

    res.json({
      success: true,
      message: `Riwayat ${tabel} berhasil diambil`,
      data: riwayatParsed
    });
  } catch (error) {
    console.error('Get riwayat by table error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil riwayat',
      details: error.message 
    });
  }
});

// Get user's own history
router.get('/saya', authenticateToken, async (req, res) => {
  try {
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 20;
    const offset = (halaman - 1) * batas;

    const [riwayat] = await db.execute(
      `SELECT r.*, u.nama_pengguna 
       FROM riwayat r 
       LEFT JOIN pengguna u ON r.pengguna_id = u.id 
       WHERE r.pengguna_id = ?
       ORDER BY r.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [req.user.userId, batas, offset]
    );

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM riwayat WHERE pengguna_id = ?`,
      [req.user.userId]
    );

    // Parse JSON data untuk frontend
    const riwayatParsed = riwayat.map(item => {
      let data_lama = null;
      let data_baru = null;
      
      try {
        data_lama = item.data_lama ? JSON.parse(item.data_lama) : null;
      } catch (error) {
        console.warn('Failed to parse data_lama:', error);
        data_lama = item.data_lama;
      }
      
      try {
        data_baru = item.data_baru ? JSON.parse(item.data_baru) : null;
      } catch (error) {
        console.warn('Failed to parse data_baru:', error);
        data_baru = item.data_baru;
      }
      
      return {
        ...item,
        data_lama,
        data_baru
      };
    });

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      success: true,
      message: 'Riwayat aktivitas Anda berhasil diambil',
      data: riwayatParsed,
      pagination: {
        halaman: halaman,
        totalHalaman: totalHalaman,
        total: total,
        batas: batas
      }
    });
  } catch (error) {
    console.error('Get user riwayat error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil riwayat pengguna',
      details: error.message 
    });
  }
});

// Helper function to log activity (digunakan di routes lain)
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

module.exports = { router, logActivity };