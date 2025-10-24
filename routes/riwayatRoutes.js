const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get all history with pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 20;
    const tabel = req.query.tabel || '';
    const aksi = req.query.aksi || '';
    const offset = (halaman - 1) * batas;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (tabel) {
      whereClause += ' AND r.tabel_terkait = ?';
      queryParams.push(tabel);
    }

    if (aksi) {
      whereClause += ' AND r.aksi = ?';
      queryParams.push(aksi);
    }

    // Get history with user info
    const [riwayat] = await db.execute(
      `SELECT r.*, u.nama_pengguna 
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

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      message: 'Data riwayat berhasil diambil',
      data: riwayat,
      paginasi: {
        halamanSaatIni: halaman,
        totalHalaman: totalHalaman,
        totalItem: total,
        itemPerHalaman: batas
      }
    });
  } catch (error) {
    console.error('Get riwayat error:', error);
    res.status(500).json({ error: 'Error saat mengambil data riwayat' });
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

    res.json({
      message: `Riwayat ${tabel} berhasil diambil`,
      data: riwayat
    });
  } catch (error) {
    console.error('Get riwayat by table error:', error);
    res.status(500).json({ error: 'Error saat mengambil riwayat' });
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

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      message: 'Riwayat aktivitas Anda berhasil diambil',
      data: riwayat,
      paginasi: {
        halamanSaatIni: halaman,
        totalHalaman: totalHalaman,
        totalItem: total,
        itemPerHalaman: batas
      }
    });
  } catch (error) {
    console.error('Get user riwayat error:', error);
    res.status(500).json({ error: 'Error saat mengambil riwayat pengguna' });
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