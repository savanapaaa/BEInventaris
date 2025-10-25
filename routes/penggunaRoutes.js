const express = require('express');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [pengguna] = await db.execute(
      'SELECT id, nama_pengguna, email, peran, dibuat_pada FROM pengguna ORDER BY dibuat_pada DESC'
    );
    
    res.json({
      message: 'Data pengguna berhasil diambil',
      data: pengguna
    });
  } catch (error) {
    console.error('Get pengguna error:', error);
    res.status(500).json({ error: 'Error saat mengambil data pengguna' });
  }
});

// Get user profile
router.get('/profil', authenticateToken, async (req, res) => {
  try {
    const [pengguna] = await db.execute(
      'SELECT id, nama_pengguna, email, peran, dibuat_pada FROM pengguna WHERE id = ?',
      [req.user.userId]
    );

    if (pengguna.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Pengguna tidak ditemukan' 
      });
    }

    res.json({
      success: true,
      message: 'Profil pengguna berhasil diambil',
      data: pengguna[0]
    });
  } catch (error) {
    console.error('Get profil error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil profil pengguna' 
    });
  }
});

// Alias for profile (English route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [pengguna] = await db.execute(
      'SELECT id, nama_pengguna, email, peran, dibuat_pada FROM pengguna WHERE id = ?',
      [req.user.userId]
    );

    if (pengguna.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Pengguna tidak ditemukan' 
      });
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: pengguna[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error retrieving user profile' 
    });
  }
});

// Update own profile (user can update their own profile)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { nama_pengguna, email, no_telepon, alamat } = req.body;

    // Validate required fields
    if (!nama_pengguna || !email) {
      return res.status(400).json({ 
        success: false,
        error: 'Nama pengguna dan email diperlukan' 
      });
    }

    // Check if email already exists (excluding current user)
    const [existingUser] = await db.execute(
      'SELECT id FROM pengguna WHERE email = ? AND id != ?',
      [email, userId]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Email sudah digunakan pengguna lain' 
      });
    }

    const [result] = await db.execute(
      'UPDATE pengguna SET nama_pengguna = ?, email = ?, no_telepon = ?, alamat = ?, diperbarui_pada = NOW() WHERE id = ?',
      [nama_pengguna, email, no_telepon || null, alamat || null, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Pengguna tidak ditemukan' 
      });
    }

    // Return updated profile
    const [updatedUser] = await db.execute(
      'SELECT id, nama_pengguna, email, peran, no_telepon, alamat, dibuat_pada FROM pengguna WHERE id = ?',
      [userId]
    );

    res.json({ 
      success: true,
      message: 'Profil berhasil diupdate',
      data: updatedUser[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengupdate profil' 
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { kata_sandi_lama, kata_sandi_baru } = req.body;

    // Validate required fields
    if (!kata_sandi_lama || !kata_sandi_baru) {
      return res.status(400).json({ 
        success: false,
        error: 'Kata sandi lama dan baru diperlukan' 
      });
    }

    // Get current user data
    const [user] = await db.execute(
      'SELECT kata_sandi FROM pengguna WHERE id = ?',
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Pengguna tidak ditemukan' 
      });
    }

    // Verify old password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(kata_sandi_lama, user[0].kata_sandi);
    
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Kata sandi lama tidak valid' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(kata_sandi_baru, 12);

    // Update password
    const [result] = await db.execute(
      'UPDATE pengguna SET kata_sandi = ?, diperbarui_pada = NOW() WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ 
      success: true,
      message: 'Kata sandi berhasil diubah' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengubah kata sandi' 
    });
  }
});

// Update user (Admin can update any user, user can update own profile)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { nama_pengguna, email, peran } = req.body;

    // Check if user can update this profile
    if (req.user.peran !== 'admin' && req.user.userId !== userId) {
      return res.status(403).json({ error: 'Tidak dapat mengupdate pengguna lain' });
    }

    // Only admin can change role
    let updateFields = ['nama_pengguna = ?', 'email = ?'];
    let updateValues = [nama_pengguna, email];

    if (req.user.peran === 'admin' && peran) {
      updateFields.push('peran = ?');
      updateValues.push(peran);
    }

    updateValues.push(userId);

    const [result] = await db.execute(
      `UPDATE pengguna SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.json({ message: 'Pengguna berhasil diupdate' });
  } catch (error) {
    console.error('Update pengguna error:', error);
    res.status(500).json({ error: 'Error saat mengupdate pengguna' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent admin from deleting themselves
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
    }

    const [result] = await db.execute('DELETE FROM pengguna WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.json({ message: 'Pengguna berhasil dihapus' });
  } catch (error) {
    console.error('Delete pengguna error:', error);
    res.status(500).json({ error: 'Error saat menghapus pengguna' });
  }
});

module.exports = router;