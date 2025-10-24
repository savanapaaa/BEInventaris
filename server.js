const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration - Properly configured for frontend
const corsOptions = {
  origin: [
    'http://localhost:3000',      // React/Next.js default
    'http://localhost:3001',      // Alternative port
    'http://127.0.0.1:3000',      // Alternative localhost
    'http://127.0.0.1:3001',      // Alternative localhost
    'https://inventaris-frontend.vercel.app', // Production (if needed)
    process.env.FRONTEND_URL      // From environment variable
  ].filter(Boolean), // Remove undefined values
  credentials: true,              // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization', 
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Allow-Headers'
  ],
  optionsSuccessStatus: 200       // For legacy browser support
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/pengguna', require('./routes/penggunaRoutes'));
app.use('/api/produk', require('./routes/produkRoutes'));
app.use('/api/kategori', require('./routes/kategoriRoutes'));
app.use('/api/peminjaman', require('./routes/peminjamanRoutes'));
app.use('/api/riwayat', require('./routes/riwayatRoutes').router);
app.use('/api/stats', require('./routes/statsRoutes'));

// Alias routes untuk kemudahan frontend
app.use('/api/dashboard', require('./routes/statsRoutes')); // Alias untuk stats

// Simple login endpoint (direct route untuk frontend)
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

    // Update last login
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

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistem Peminjaman Inventaris API',
    version: '1.0.0',
    status: 'Active',
    documentation: 'See FRONTEND-API-GUIDE.md for complete documentation',
    
    // QUICK REFERENCE FOR FRONTEND
    quick_start: {
      login: {
        method: 'POST',
        url: '/api/login',
        body: { email: 'admin@inventaris.com', kata_sandi: 'admin123' },
        note: 'Use kata_sandi NOT password'
      },
      dashboard: {
        method: 'GET', 
        url: '/api/stats',
        headers: { Authorization: 'Bearer <token>' }
      },
      products: {
        method: 'GET',
        url: '/api/produk',
        headers: { Authorization: 'Bearer <token>' }
      }
    },

    // ALL AVAILABLE ENDPOINTS
    endpoints: {
      // Authentication
      'POST /api/login': 'Login user (MAIN ENDPOINT)',
      'POST /api/auth/login': 'Login user (alternative)',
      'POST /api/auth/admin/register': 'Register new user (admin only)',
      
      // Dashboard & Stats  
      'GET /api/stats': 'Full dashboard statistics',
      'GET /api/stats/quick': 'Quick stats for widgets',
      
      // Products & Categories
      'GET /api/produk': 'Get all products (with pagination/search)',
      'GET /api/produk/:id': 'Get specific product',
      'GET /api/produk/status/tersedia': 'Get available products',
      'POST /api/produk': 'Create new product (auth required)',
      'PUT /api/produk/:id': 'Update product (auth required)',
      'DELETE /api/produk/:id': 'Delete product (auth required)',
      
      'GET /api/kategori': 'Get all categories (no auth)',
      'POST /api/kategori': 'Create category (auth required)',
      'PUT /api/kategori/:id': 'Update category (auth required)',
      'DELETE /api/kategori/:id': 'Delete category (auth required)',
      
      // Borrowing System
      'GET /api/peminjaman': 'Get borrowings (admin: all, user: own)',
      'GET /api/peminjaman/:id': 'Get specific borrowing',
      'POST /api/peminjaman': 'Create new borrowing',
      'PUT /api/peminjaman/:id/kembalikan': 'Return borrowed item',
      'POST /api/peminjaman/:id/perpanjang': 'Extend borrowing period',
      'GET /api/peminjaman/user/riwayat': 'Get user borrowing history',
      'GET /api/peminjaman/admin/terlambat': 'Get overdue borrowings (admin)',
      
      // User Management
      'GET /api/pengguna': 'Get all users (admin only)',
      'GET /api/pengguna/profil': 'Get own profile',
      'PUT /api/pengguna/:id': 'Update user profile',
      'DELETE /api/pengguna/:id': 'Delete user (admin only)',
      
      // Activity History
      'GET /api/riwayat': 'Get activity history',
      'GET /api/riwayat/saya': 'Get own activity history',
      'GET /api/riwayat/tabel/:tabel/:id': 'Get specific record history'
    },

    // FRONTEND DEVELOPER NOTES
    frontend_notes: {
      base_url: 'http://localhost:5000',
      authentication: 'Include Authorization: Bearer <token> header',
      field_names: 'Use Indonesian field names (kata_sandi, nama_pengguna)',
      response_format: 'All responses include success boolean',
      pagination: 'Use halaman & batas query params',
      error_handling: 'Check response.success and handle errors appropriately'
    },

    test_credentials: {
      admin: { email: 'admin@inventaris.com', kata_sandi: 'admin123' },
      user: { email: 'user@inventaris.com', kata_sandi: 'user123' },
      note: 'Import database.sql to get sample data'
    },

    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan server!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di port ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
});

module.exports = app;