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
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.json({
      message: 'Profil pengguna berhasil diambil',
      data: pengguna[0]
    });
  } catch (error) {
    console.error('Get profil error:', error);
    res.status(500).json({ error: 'Error saat mengambil profil pengguna' });
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