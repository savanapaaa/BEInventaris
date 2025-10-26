const fs = require('fs');
const path = require('path');

// Function to update terminology in a file
function updateTerminologyInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace in JSON responses
    const replacements = [
      // Field names in JSON responses
      { from: /nama_produk/g, to: 'nama_barang' },
      { from: /kode_produk/g, to: 'kode_barang' },
      { from: /deskripsi_produk/g, to: 'deskripsi_barang' },
      { from: /kategori_produk/g, to: 'kategori_barang' },
      
      // Messages and labels
      { from: /Manajemen Produk/g, to: 'Manajemen Barang' },
      { from: /Produk Tersedia/g, to: 'Barang Tersedia' },
      { from: /produk berhasil/g, to: 'barang berhasil' },
      { from: /Produk berhasil/g, to: 'Barang berhasil' },
      { from: /data produk/g, to: 'data barang' },
      { from: /Data produk/g, to: 'Data barang' },
      { from: /produk tidak/g, to: 'barang tidak' },
      { from: /Produk tidak/g, to: 'Barang tidak' },
      { from: /ID produk/g, to: 'ID barang' },
      
      // Keep database table names as 'produk' but update response field names
      // These will be handled differently - we'll alias them in SQL
    ];

    replacements.forEach(replacement => {
      if (replacement.from.test(content)) {
        content = content.replace(replacement.from, replacement.to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Function to add SQL aliases for produk -> barang
function updateSQLAliases(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Update SQL SELECT statements to use aliases
    const sqlReplacements = [
      { 
        from: /pr\.nama as nama_produk/g, 
        to: 'pr.nama as nama_barang, pr.nama as nama_produk' 
      },
      { 
        from: /pr\.kode as kode_produk/g, 
        to: 'pr.kode as kode_barang, pr.kode as kode_produk' 
      },
      { 
        from: /pr\.deskripsi as deskripsi_produk/g, 
        to: 'pr.deskripsi as deskripsi_barang, pr.deskripsi as deskripsi_produk' 
      }
    ];

    sqlReplacements.forEach(replacement => {
      if (replacement.from.test(content)) {
        content = content.replace(replacement.from, replacement.to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✓ Updated SQL aliases: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error updating SQL in ${filePath}:`, error.message);
    return false;
  }
}

// Files to update
const filesToUpdate = [
  './routes/produkRoutes.js',
  './routes/peminjamanRoutes.js',
  './routes/statsRoutes.js',
  './routes/laporanRoutes.js',
  './server.js'
];

console.log('🔄 Updating terminology from "produk" to "barang"...\n');

let totalUpdated = 0;

filesToUpdate.forEach(file => {
  if (fs.existsSync(file)) {
    const updated = updateTerminologyInFile(file);
    const sqlUpdated = updateSQLAliases(file);
    if (updated || sqlUpdated) {
      totalUpdated++;
    }
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log(`\n✅ Terminology update completed! Updated ${totalUpdated} files.`);
console.log('\n📝 Summary of changes:');
console.log('- nama_produk → nama_barang');
console.log('- kode_produk → kode_barang'); 
console.log('- deskripsi_produk → deskripsi_barang');
console.log('- Manajemen Produk → Manajemen Barang');
console.log('- Produk Tersedia → Barang Tersedia');
console.log('- Added SQL aliases for backward compatibility');

console.log('\n🔧 Database table names remain as "produk" for consistency.');
console.log('   Only JSON response field names have been updated.');