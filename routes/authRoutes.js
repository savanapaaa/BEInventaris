const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// ============================================
// PUBLIC REGISTRATION (Opsi 1)
// ============================================
// Uncomment ini jika mau public registration

/*
router.post('/register', [
  body('nama_pengguna').isLength({ min: 3 }).withMessage('Nama pengguna minimal 3 karakter'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('kata_sandi').isLength({ min: 6 }).withMessage('Kata sandi minimal 6 karakter')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { nama_pengguna, email, kata_sandi } = req.body;

    // Check if user already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM pengguna WHERE email = ? OR nama_pengguna = ?',
      [email, nama_pengguna]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false,
        error: 'Email atau nama pengguna sudah digunakan' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(kata_sandi, saltRounds);

    // Insert user (default role: pengguna)
    const [result] = await db.execute(
      'INSERT INTO pengguna (nama_pengguna, email, kata_sandi, peran) VALUES (?, ?, ?, ?)',
      [nama_pengguna, email, hashedPassword, 'pengguna']
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Silakan login dengan akun Anda.',
      data: {
        id: result.insertId,
        nama_pengguna,
        email,
        peran: 'pengguna'
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Terjadi kesalahan server saat registrasi' 
    });
  }
});
*/

// ============================================
// ADMIN-ONLY REGISTRATION (Opsi 2 - Recommended)
// ============================================
router.post('/admin/register', 
  requireAdmin,
  [
    body('nama_pengguna')
      .isLength({ min: 3 })
      .withMessage('Nama pengguna minimal 3 karakter')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Nama pengguna hanya boleh huruf, angka, dan underscore'),
    body('email')
      .isEmail()
      .withMessage('Email tidak valid')
      .normalizeEmail(),
    body('kata_sandi')
      .isLength({ min: 6 })
      .withMessage('Kata sandi minimal 6 karakter')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Kata sandi harus mengandung huruf besar, huruf kecil, dan angka'),
    body('peran')
      .isIn(['admin', 'pengguna'])
      .withMessage('Peran harus admin atau pengguna')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { nama_pengguna, email, kata_sandi, peran = 'pengguna' } = req.body;

      // Check if user already exists
      const [existingUsers] = await db.execute(
        'SELECT id, email, nama_pengguna FROM pengguna WHERE email = ? OR nama_pengguna = ?',
        [email, nama_pengguna]
      );

      if (existingUsers.length > 0) {
        const existing = existingUsers[0];
        const conflict = existing.email === email ? 'Email' : 'Nama pengguna';
        return res.status(409).json({ 
          success: false,
          error: `${conflict} sudah digunakan oleh pengguna lain` 
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(kata_sandi, saltRounds);

      // Insert new user
      const [result] = await db.execute(
        'INSERT INTO pengguna (nama_pengguna, email, kata_sandi, peran) VALUES (?, ?, ?, ?)',
        [nama_pengguna, email, hashedPassword, peran]
      );

      // Log admin activity (if you have logging system)
      console.log(`Admin ${req.user.nama_pengguna} membuat akun baru: ${nama_pengguna} (${peran})`);

      res.status(201).json({
        success: true,
        message: `Pengguna ${nama_pengguna} berhasil didaftarkan sebagai ${peran}`,
        data: {
          id: result.insertId,
          nama_pengguna,
          email,
          peran,
          dibuat_oleh_admin: req.user.nama_pengguna,
          dibuat_pada: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Admin register error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Terjadi kesalahan server saat mendaftarkan pengguna' 
      });
    }
  }
);

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Email tidak valid').normalizeEmail(),
  body('kata_sandi').notEmpty().withMessage('Kata sandi diperlukan')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { email, kata_sandi } = req.body;

    // Find user with better error handling
    const [pengguna] = await db.execute(
      'SELECT id, nama_pengguna, email, kata_sandi, peran FROM pengguna WHERE email = ?',
      [email]
    );

    if (pengguna.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Email atau kata sandi salah' 
      });
    }

    const user = pengguna[0];

    // Check password
    const isValidPassword = await bcrypt.compare(kata_sandi, user.kata_sandi);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        error: 'Email atau kata sandi salah' 
      });
    }

    // Generate JWT with more secure payload
    const token = jwt.sign(
      { 
        userId: user.id, 
        nama_pengguna: user.nama_pengguna,
        email: user.email,
        peran: user.peran
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '24h',
        issuer: 'inventaris-api',
        audience: 'inventaris-client'
      }
    );

    // Update last login (optional)
    await db.execute(
      'UPDATE pengguna SET diperbarui_pada = NOW() WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        nama_pengguna: user.nama_pengguna,
        email: user.email,
        peran: user.peran
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Terjadi kesalahan server saat login' 
    });
  }
});

// Get all users (Admin only)
router.get('/admin/users', 
  requireAdmin,
  async (req, res) => {
    try {
      const halaman = parseInt(req.query.halaman) || 1;
      const batas = parseInt(req.query.batas) || 10;
      const offset = (halaman - 1) * batas;
      const cari = req.query.cari || '';

      let query = `
        SELECT id, nama_pengguna, email, peran, dibuat_pada, diperbarui_pada
        FROM pengguna 
      `;
      let queryParams = [];

      if (cari) {
        query += ` WHERE nama_pengguna LIKE ? OR email LIKE ? `;
        queryParams.push(`%${cari}%`, `%${cari}%`);
      }

      query += ` ORDER BY dibuat_pada DESC LIMIT ? OFFSET ?`;
      queryParams.push(batas, offset);

      const [users] = await db.execute(query, queryParams);

      // Count total
      let countQuery = 'SELECT COUNT(*) as total FROM pengguna';
      let countParams = [];

      if (cari) {
        countQuery += ' WHERE nama_pengguna LIKE ? OR email LIKE ?';
        countParams.push(`%${cari}%`, `%${cari}%`);
      }

      const [countResult] = await db.execute(countQuery, countParams);
      const total = countResult[0].total;
      const totalHalaman = Math.ceil(total / batas);

      res.json({
        success: true,
        data: users,
        pagination: {
          halaman,
          batas,
          total,
          totalHalaman,
          cari
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Gagal mengambil data pengguna' 
      });
    }
  }
);

// Delete user (Admin only)
router.delete('/admin/users/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Don't allow admin to delete themselves
      if (parseInt(id) === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: 'Tidak dapat menghapus akun sendiri'
        });
      }

      // Check if user exists
      const [users] = await db.execute(
        'SELECT nama_pengguna FROM pengguna WHERE id = ?',
        [id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pengguna tidak ditemukan'
        });
      }

      // Check if user has active borrowings
      const [activeBorrowings] = await db.execute(
        'SELECT COUNT(*) as count FROM peminjaman WHERE peminjam_id = ? AND status = "dipinjam"',
        [id]
      );

      if (activeBorrowings[0].count > 0) {
        return res.status(400).json({
          success: false,
          error: 'Tidak dapat menghapus pengguna yang masih memiliki peminjaman aktif'
        });
      }

      const deletedUser = users[0].nama_pengguna;
      await db.execute('DELETE FROM pengguna WHERE id = ?', [id]);

      console.log(`Admin ${req.user.nama_pengguna} menghapus pengguna: ${deletedUser}`);

      res.json({
        success: true,
        message: `Pengguna ${deletedUser} berhasil dihapus`
      });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        error: 'Gagal menghapus pengguna'
      });
    }
  }
);

module.exports = router;