const express = require('express');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Dashboard statistics endpoint
router.get('/', requireAuth, async (req, res) => {
  try {
    const { user } = req;
    const isAdmin = user.peran === 'admin';

    // Base statistics for all users
    const baseStats = {
      user: {
        nama_pengguna: user.nama_pengguna,
        peran: user.peran,
        email: user.email
      },
      timestamp: new Date().toISOString()
    };

    if (isAdmin) {
      // Admin gets full dashboard statistics
      const [totalPengguna] = await db.execute('SELECT COUNT(*) as total FROM pengguna');
      const [totalProduk] = await db.execute('SELECT COUNT(*) as total FROM produk');
      const [totalKategori] = await db.execute('SELECT COUNT(*) as total FROM kategori');
      
      const [peminjamanStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_peminjaman,
          SUM(CASE WHEN status = 'dipinjam' THEN 1 ELSE 0 END) as sedang_dipinjam,
          SUM(CASE WHEN status = 'dikembalikan' THEN 1 ELSE 0 END) as sudah_dikembalikan,
          SUM(CASE WHEN status = 'terlambat' THEN 1 ELSE 0 END) as terlambat,
          SUM(CASE WHEN status = 'hilang' THEN 1 ELSE 0 END) as hilang
        FROM peminjaman
      `);

      const [produkStats] = await db.execute(`
        SELECT 
          SUM(CASE WHEN status_peminjaman = 'tersedia' THEN 1 ELSE 0 END) as produk_tersedia,
          SUM(CASE WHEN status_peminjaman = 'dipinjam' THEN 1 ELSE 0 END) as produk_dipinjam,
          SUM(CASE WHEN status_peminjaman = 'maintenance' THEN 1 ELSE 0 END) as produk_maintenance
        FROM produk
      `);

      // Recent activities (last 10)
      const [recentActivities] = await db.execute(`
        SELECT 
          r.tabel_terkait,
          r.aksi,
          r.deskripsi,
          r.dibuat_pada,
          p.nama_pengguna
        FROM riwayat r
        LEFT JOIN pengguna p ON r.pengguna_id = p.id
        ORDER BY r.dibuat_pada DESC
        LIMIT 10
      `);

      // Overdue borrowings
      const [overdueBorrowings] = await db.execute(`
        SELECT COUNT(*) as total_terlambat
        FROM peminjaman 
        WHERE status = 'dipinjam' 
        AND tanggal_kembali_rencana < CURDATE()
      `);

      res.json({
        success: true,
        data: {
          ...baseStats,
          overview: {
            total_pengguna: totalPengguna[0].total,
            total_produk: totalProduk[0].total,
            total_kategori: totalKategori[0].total,
            ...peminjamanStats[0],
            ...produkStats[0],
            total_terlambat: overdueBorrowings[0].total_terlambat
          },
          recent_activities: recentActivities,
          alerts: {
            overdue_count: overdueBorrowings[0].total_terlambat,
            needs_attention: overdueBorrowings[0].total_terlambat > 0
          }
        }
      });

    } else {
      // Regular user gets limited statistics
      const [myBorrowings] = await db.execute(`
        SELECT 
          COUNT(*) as total_peminjaman_saya,
          SUM(CASE WHEN status = 'dipinjam' THEN 1 ELSE 0 END) as sedang_dipinjam,
          SUM(CASE WHEN status = 'dikembalikan' THEN 1 ELSE 0 END) as sudah_dikembalikan,
          SUM(CASE WHEN status = 'terlambat' THEN 1 ELSE 0 END) as terlambat_saya
        FROM peminjaman 
        WHERE peminjam_id = ?
      `, [user.userId]);

      const [myRecentBorrowings] = await db.execute(`
        SELECT 
          p.id,
          pr.nama as nama_barang,
          p.tanggal_pinjam,
          p.tanggal_kembali_rencana,
          p.status,
          DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
        FROM peminjaman p
        LEFT JOIN produk pr ON p.produk_id = pr.id
        WHERE p.peminjam_id = ? AND p.status IN ('dipinjam', 'terlambat')
        ORDER BY p.tanggal_pinjam DESC
        LIMIT 5
      `, [user.userId]);

      res.json({
        success: true,
        data: {
          ...baseStats,
          overview: {
            ...myBorrowings[0],
            is_user: true
          },
          my_borrowings: myRecentBorrowings,
          alerts: {
            overdue_count: myBorrowings[0].terlambat_saya,
            needs_attention: myBorrowings[0].terlambat_saya > 0
          }
        }
      });
    }

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil statistik dashboard'
    });
  }
});

// Quick stats for widgets
router.get('/quick', requireAuth, async (req, res) => {
  try {
    const { user } = req;
    
    if (user.peran === 'admin') {
      const [quickStats] = await db.execute(`
        SELECT 
          (SELECT COUNT(*) FROM pengguna) as total_users,
          (SELECT COUNT(*) FROM produk) as total_products,
          (SELECT COUNT(*) FROM peminjaman WHERE status = 'dipinjam') as active_borrowings,
          (SELECT COUNT(*) FROM peminjaman WHERE status = 'dipinjam' AND tanggal_kembali_rencana < CURDATE()) as overdue_borrowings
      `);

      res.json({
        success: true,
        data: quickStats[0]
      });
    } else {
      const [userStats] = await db.execute(`
        SELECT 
          COUNT(*) as my_total_borrowings,
          SUM(CASE WHEN status = 'dipinjam' THEN 1 ELSE 0 END) as my_active_borrowings,
          SUM(CASE WHEN status = 'terlambat' OR (status = 'dipinjam' AND tanggal_kembali_rencana < CURDATE()) THEN 1 ELSE 0 END) as my_overdue_borrowings
        FROM peminjaman 
        WHERE peminjam_id = ?
      `, [user.userId]);

      res.json({
        success: true,
        data: userStats[0]
      });
    }

  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil quick stats'
    });
  }
});

module.exports = router;