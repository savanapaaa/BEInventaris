const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Simpler CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/pengguna', require('./routes/penggunaRoutes'));
app.use('/api/produk', require('./routes/produkRoutes'));
app.use('/api/kategori', require('./routes/kategoriRoutes'));
app.use('/api/peminjaman', require('./routes/peminjamanRoutes'));
app.use('/api/riwayat', require('./routes/riwayatRoutes').router);
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/contact-person', require('./routes/contactRoutes'));
app.use('/api/laporan', require('./routes/laporanRoutes'));
// app.use('/api/upload', require('./routes/uploadRoutes')); // Temporarily disabled

// Alias routes
app.use('/api/dashboard', require('./routes/statsRoutes'));

// Simple login endpoint
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('./config/database');

app.post('/api/login', [
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

    // Find user
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

    // Generate JWT
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

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistem Peminjaman Inventaris API - FIXED VERSION',
    version: '1.0.0',
    status: 'Active',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err.stack);
  res.status(500).json({ 
    success: false,
    error: 'Terjadi kesalahan server!' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint tidak ditemukan!' 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fixed server berjalan di port ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
});

module.exports = app;