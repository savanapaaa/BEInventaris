const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const [kategori] = await db.execute(
      'SELECT * FROM kategori ORDER BY nama ASC'
    );
    
    res.json({
      success: true,
      message: 'Data kategori berhasil diambil',
      data: kategori
    });
  } catch (error) {
    console.error('Get kategori error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil data kategori' 
    });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const kategoriId = parseInt(req.params.id);
    
    const [kategori] = await db.execute(
      'SELECT * FROM kategori WHERE id = ?',
      [kategoriId]
    );

    if (kategori.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Kategori tidak ditemukan' 
      });
    }

    res.json({
      success: true,
      message: 'Kategori berhasil diambil',
      data: kategori[0]
    });
  } catch (error) {
    console.error('Get kategori error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil kategori' 
    });
  }
});

// Create new category
router.post('/', authenticateToken, [
  body('nama').notEmpty().withMessage('Nama kategori diperlukan'),
  body('deskripsi').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Data tidak valid',
        errors: errors.array() 
      });
    }

    const { nama, deskripsi = '' } = req.body;

    // Check if category already exists
    const [existingKategori] = await db.execute(
      'SELECT id FROM kategori WHERE nama = ?',
      [nama]
    );

    if (existingKategori.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Kategori dengan nama tersebut sudah ada' 
      });
    }

    const [result] = await db.execute(
      'INSERT INTO kategori (nama, deskripsi, dibuat_pada) VALUES (?, ?, NOW())',
      [nama, deskripsi]
    );

    res.status(201).json({
      success: true,
      message: 'Kategori berhasil dibuat',
      data: {
        id: result.insertId,
        nama,
        deskripsi
      }
    });
  } catch (error) {
    console.error('Create kategori error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat membuat kategori' 
    });
  }
});

// Update category
router.put('/:id', authenticateToken, [
  body('nama').notEmpty().withMessage('Nama kategori diperlukan'),
  body('deskripsi').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Data tidak valid',
        errors: errors.array() 
      });
    }

    const kategoriId = parseInt(req.params.id);
    const { nama, deskripsi } = req.body;

    // Check if category exists
    const [existingKategori] = await db.execute(
      'SELECT id FROM kategori WHERE id = ?',
      [kategoriId]
    );

    if (existingKategori.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Kategori tidak ditemukan' 
      });
    }

    // Check if name already exists (excluding current category)
    const [duplicateKategori] = await db.execute(
      'SELECT id FROM kategori WHERE nama = ? AND id != ?',
      [nama, kategoriId]
    );

    if (duplicateKategori.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Kategori dengan nama tersebut sudah ada' 
      });
    }

    const [result] = await db.execute(
      'UPDATE kategori SET nama = ?, deskripsi = ? WHERE id = ?',
      [nama, deskripsi, kategoriId]
    );

    res.json({ 
      success: true,
      message: 'Kategori berhasil diupdate',
      data: {
        id: kategoriId,
        nama,
        deskripsi
      }
    });
  } catch (error) {
    console.error('Update kategori error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengupdate kategori' 
    });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const kategoriId = parseInt(req.params.id);

    // Check if category exists first
    const [existingKategori] = await db.execute(
      'SELECT id, nama FROM kategori WHERE id = ?',
      [kategoriId]
    );

    if (existingKategori.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Kategori tidak ditemukan' 
      });
    }

    // Check if category has products
    const [produk] = await db.execute(
      'SELECT id FROM produk WHERE kategori_id = ?',
      [kategoriId]
    );

    if (produk.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: `Tidak dapat menghapus kategori "${existingKategori[0].nama}" karena masih memiliki ${produk.length} produk. Hapus atau pindahkan produk terlebih dahulu.`
      });
    }

    const [result] = await db.execute('DELETE FROM kategori WHERE id = ?', [kategoriId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Kategori tidak ditemukan' 
      });
    }

    res.json({ 
      success: true,
      message: `Kategori "${existingKategori[0].nama}" berhasil dihapus`,
      data: {
        id: kategoriId,
        nama: existingKategori[0].nama
      }
    });
  } catch (error) {
    console.error('Delete kategori error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat menghapus kategori' 
    });
  }
});

module.exports = router;