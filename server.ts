import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
  const dbPath = path.join(process.cwd(), "database.sqlite");
  console.log("Opening database at:", dbPath);
  db = new Database(dbPath);
} catch (error) {
  console.error("FAILED TO OPEN DATABASE:", error);
  process.exit(1);
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    nama TEXT,
    nip TEXT,
    role TEXT,
    divisi TEXT
  );

  CREATE TABLE IF NOT EXISTS google_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webapp_url TEXT
  );

  CREATE TABLE IF NOT EXISTS laporan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT,
    tanggal_pelaporan TEXT,
    nama_pegawai TEXT,
    nip_pegawai TEXT,
    divisi TEXT,
    rencana_kerja TEXT,
    rincian_kerja TEXT,
    output TEXT,
    bukti_link TEXT,
    nilai_atasan TEXT,
    catatan_atasan TEXT,
    status TEXT DEFAULT 'Pending',
    dinilai_oleh TEXT,
    tanggal_penilaian TEXT
  );
`);

// Migration for new columns
try { db.exec("ALTER TABLE laporan ADD COLUMN tanggal_pelaporan TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE laporan ADD COLUMN rincian_kerja TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE laporan ADD COLUMN output TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN nip TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN drive_folder_id TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE laporan ADD COLUMN nip_pegawai TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE laporan ADD COLUMN tanggal_penilaian TEXT;"); } catch (e) {}

// Seed default users
console.log("Verifying users...");

const insertUser = db.prepare("INSERT OR IGNORE INTO users (username, password, nama, nip, role, divisi) VALUES (?, ?, ?, ?, ?, ?)");
insertUser.run("admin", "admin", "Administrator", "198001012000011001", "admin", null);

// Ensure admin password is 'admin' if it was the default 'admin2026' or 'admin2025'
db.prepare("UPDATE users SET password = 'admin' WHERE username = 'admin' AND (password = 'admin2026' OR password = 'admin2025')").run();
db.prepare("UPDATE users SET password = 'hhdi' WHERE username = 'hhdi' AND password = 'hhdi2026'").run();
db.prepare("UPDATE users SET password = 'ppps' WHERE username = 'ppps' AND password = 'ppps2026'").run();
db.prepare("UPDATE users SET password = 'pencegahan' WHERE username = 'pencegahan' AND password = 'pencegahan2026'").run();
db.prepare("UPDATE users SET password = 'sdmo' WHERE username = 'sdmo' AND password = 'sdmo2026'").run();
db.prepare("UPDATE users SET password = 'staf' WHERE username = 'staf1' AND password = 'staf2026'").run();

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count <= 1) { // Only admin exists
  console.log("Seeding other default users...");
  insertUser.run("hhdi", "hhdi", "Dona Donora", "198505052010012001", "atasan", "Hukum Humas Data Informasi");
  insertUser.run("ppps", "ppps", "Gushendri", "198202022005011001", "atasan", "Penanganan Pelanggaran dan Penyelesaian Sengketa");
  insertUser.run("pencegahan", "pencegahan", "Tarmizi", "198808082015011001", "atasan", "Pencegahan");
  insertUser.run("sdmo", "sdmo", "Rizki Kurniawan", "199001012015011001", "atasan", "SDMO");
  insertUser.run("staf1", "staf", "Budi Santoso", "199505052020011001", "staf", "SDMO");
}

const allUsers = db.prepare("SELECT username, password FROM users").all();
console.log("Available users in DB:", JSON.stringify(allUsers));

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  console.log("Middleware configured.");

  // Helper to sync all data to Google Sheets
  async function syncAllToGoogle() {
    const settings = db.prepare("SELECT webapp_url FROM google_settings LIMIT 1").get() as any;
    if (!settings || !settings.webapp_url) return;

    try {
      const laporan = db.prepare("SELECT * FROM laporan ORDER BY tanggal DESC").all() as any[];
      const dataToSync = {
        action: "sync",
        data: laporan.map(l => ({
          id: l.id,
          tanggal_input: l.tanggal,
          tanggal_pelaporan: l.tanggal_pelaporan,
          nama_pegawai: l.nama_pegawai,
          nip: l.nip_pegawai,
          divisi: l.divisi,
          rencana_kerja: l.rencana_kerja,
          rincian_kerja: l.rincian_kerja,
          output: l.output,
          bukti_link: l.bukti_link,
          nilai_atasan: l.nilai_atasan,
          catatan_atasan: l.catatan_atasan,
          status: l.status,
          penilai: l.dinilai_oleh,
          tanggal_penilaian: l.tanggal_penilaian
        }))
      };
      await axios.post(settings.webapp_url, dataToSync, { timeout: 10000 });
    } catch (err) {
      console.error("Auto-sync error:", err);
    }
  }

  // Google Web App Routes
  app.get("/api/google/settings", (req, res) => {
    const settings = db.prepare("SELECT webapp_url FROM google_settings LIMIT 1").get() as any;
    res.json({ webappUrl: settings?.webapp_url || "" });
  });

  app.post("/api/google/settings", (req, res) => {
    const { webappUrl } = req.body;
    try {
      const existing = db.prepare("SELECT id FROM google_settings LIMIT 1").get();
      if (existing) {
        db.prepare("UPDATE google_settings SET webapp_url = ? WHERE id = ?").run(webappUrl, existing.id);
      } else {
        db.prepare("INSERT INTO google_settings (webapp_url) VALUES (?)").run(webappUrl);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving settings:", error.message);
      res.status(500).json({ message: "Gagal menyimpan: " + error.message });
    }
  });

  app.post("/api/google/sync", async (req, res) => {
    const settings = db.prepare("SELECT webapp_url FROM google_settings LIMIT 1").get() as any;
    
    if (!settings || !settings.webapp_url) {
      return res.status(400).json({ message: "URL Web App belum diatur" });
    }

    try {
      // Get all data
      const laporan = db.prepare("SELECT * FROM laporan ORDER BY tanggal DESC").all() as any[];
      
      const dataToSync = {
        action: "sync",
        data: laporan.map(l => ({
          id: l.id,
          tanggal_input: l.tanggal,
          tanggal_pelaporan: l.tanggal_pelaporan,
          nama_pegawai: l.nama_pegawai,
          nip: l.nip_pegawai,
          divisi: l.divisi,
          rencana_kerja: l.rencana_kerja,
          rincian_kerja: l.rincian_kerja,
          output: l.output,
          bukti_link: l.bukti_link,
          nilai_atasan: l.nilai_atasan,
          catatan_atasan: l.catatan_atasan,
          status: l.status,
          penilai: l.dinilai_oleh,
          tanggal_penilaian: l.tanggal_penilaian
        }))
      };

      // Send to Google Apps Script Web App
      const response = await axios.post(settings.webapp_url, dataToSync, { timeout: 10000 });

      if (response.status === 200) {
        res.json({ success: true });
      } else {
        throw new Error("Gagal mengirim data ke Web App");
      }
    } catch (error: any) {
      console.error("Sync Error:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      res.status(500).json({ message: "Gagal sinkronisasi data ke Google Sheets. Pastikan URL Web App benar dan dapat menerima POST request." });
    }
  });

  app.get("/api/stats/rekap", (req, res) => {
    // Group by month and rating
    const data = db.prepare(`
      SELECT 
        strftime('%Y-%m', tanggal_pelaporan) as bulan,
        nilai_atasan,
        COUNT(*) as jumlah
      FROM laporan
      WHERE status = 'Selesai' AND nilai_atasan IS NOT NULL
      GROUP BY bulan, nilai_atasan
      ORDER BY bulan ASC
    `).all() as any[];

    res.json(data);
  });

  // Helper to get Google Web App URL
  function getWebappUrl() {
    const settings = db.prepare("SELECT webapp_url FROM google_settings LIMIT 1").get() as any;
    return settings?.webapp_url || process.env.GOOGLE_WEBAPP_URL || "";
  }

  // API Routes
  app.post("/api/register", async (req, res) => {
    const { username, password, nama, nip, divisi } = req.body;
    const url = getWebappUrl();

    if (!url) {
      return res.status(400).json({ message: "URL Google Web App belum diatur di database/env" });
    }

    try {
      const response = await axios.post(url, {
        action: "register",
        username,
        password,
        nama,
        nip,
        role: "staf",
        divisi
      });

      if (response.data.success) {
        res.json({ success: true, id: response.data.id });
      } else {
        res.status(400).json({ message: response.data.message || "Gagal mendaftar" });
      }
    } catch (error: any) {
      console.error("Register error:", error.message);
      res.status(500).json({ message: "Gagal mendaftar ke Google Sheets" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const url = getWebappUrl();

    // Fallback for initial setup: allow admin/admin if no URL is set
    if (!url && username === "admin" && password === "admin") {
      const admin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
      return res.json(admin || { id: 1, username: "admin", role: "admin", nama: "Administrator" });
    }

    if (!url) {
      return res.status(400).json({ message: "URL Google Web App belum diatur. Gunakan admin/admin untuk masuk pertama kali." });
    }

    try {
      const response = await axios.post(url, {
        action: "login",
        username,
        password
      });

      if (response.data.success) {
        console.log(`Login successful via Google Sheets for: ${username}`);
        res.json(response.data.user);
      } else {
        res.status(401).json({ message: response.data.message || "Username atau password salah" });
      }
    } catch (error: any) {
      console.error("Login error:", error.message);
      res.status(500).json({ message: "Gagal verifikasi login ke Google Sheets" });
    }
  });

  app.get("/api/users", async (req, res) => {
    const url = getWebappUrl();
    if (!url) return res.json([]);

    try {
      const response = await axios.post(url, { action: "get_users" });
      res.json(response.data.users || []);
    } catch (error) {
      res.json([]);
    }
  });

  app.post("/api/users", async (req, res) => {
    const { username, password, nama, nip, role, divisi } = req.body;
    const url = getWebappUrl();
    if (!url) return res.status(400).json({ message: "URL not set" });

    try {
      const response = await axios.post(url, {
        action: "register",
        username,
        password,
        nama,
        nip,
        role,
        divisi
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ message: "Error" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const url = getWebappUrl();
    if (!url) return res.status(400).json({ message: "URL not set" });

    try {
      await axios.post(url, { action: "delete_user", userId: id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error" });
    }
  });

  app.get("/api/laporan", (req, res) => {
    const { role, nama, divisi } = req.query;
    let laporan;
    if (role === 'admin') {
      laporan = db.prepare("SELECT * FROM laporan ORDER BY tanggal DESC").all();
    } else if (role === 'atasan') {
      laporan = db.prepare("SELECT * FROM laporan WHERE LOWER(divisi) = LOWER(?) ORDER BY tanggal DESC").all(divisi);
    } else {
      laporan = db.prepare("SELECT * FROM laporan WHERE nama_pegawai = ? ORDER BY tanggal DESC").all(nama);
    }
    res.json(laporan);
  });

  app.post("/api/laporan", async (req, res) => {
    const { tanggal, tanggal_pelaporan, nama_pegawai, nip_pegawai, divisi, rencana_kerja, rincian_kerja, output, bukti_link } = req.body;
    
    // Find user to get drive_folder_id
    const user = db.prepare("SELECT id, drive_folder_id FROM users WHERE nama = ?").get(nama_pegawai) as any;
    
    const result = db.prepare("INSERT INTO laporan (tanggal, tanggal_pelaporan, nama_pegawai, nip_pegawai, divisi, rencana_kerja, rincian_kerja, output, bukti_link, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')")
      .run(tanggal, tanggal_pelaporan, nama_pegawai, nip_pegawai, divisi, rencana_kerja, rincian_kerja, output, bukti_link);
    const laporanId = result.lastInsertRowid;

    // Google Drive Month Folder Creation
    const settings = db.prepare("SELECT webapp_url FROM google_settings LIMIT 1").get() as any;
    if (settings?.webapp_url && user?.drive_folder_id) {
      try {
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const reportDate = new Date(tanggal_pelaporan);
        const monthName = monthNames[reportDate.getMonth()];
        const year = reportDate.getFullYear();
        const folderName = `${monthName} ${year}`;

        await axios.post(settings.webapp_url, {
          action: "ensure_month_folder",
          parentFolderId: user.drive_folder_id,
          folderName: folderName,
          laporanId: laporanId
        }, { timeout: 10000 });
      } catch (err) {
        console.error("Failed to ensure month folder in Google Drive:", err);
      }
    }

    // Auto-sync to Google Sheets
    syncAllToGoogle();

    res.json({ id: laporanId });
  });

  app.put("/api/laporan/:id", (req, res) => {
    const { id } = req.params;
    const { 
      tanggal_pelaporan, rencana_kerja, rincian_kerja, output, bukti_link,
      nilai_atasan, catatan_atasan, dinilai_oleh, status, tanggal_penilaian 
    } = req.body;

    if (nilai_atasan !== undefined) {
      // Supervisor rating update
      db.prepare("UPDATE laporan SET nilai_atasan = ?, catatan_atasan = ?, dinilai_oleh = ?, status = ?, tanggal_penilaian = ? WHERE id = ?")
        .run(nilai_atasan, catatan_atasan, dinilai_oleh, status, tanggal_penilaian, id);
    } else {
      // Staff content edit
      db.prepare("UPDATE laporan SET tanggal_pelaporan = ?, rencana_kerja = ?, rincian_kerja = ?, output = ?, bukti_link = ? WHERE id = ?")
        .run(tanggal_pelaporan, rencana_kerja, rincian_kerja, output, bukti_link, id);
    }

    // Auto-sync to Google Sheets
    syncAllToGoogle();

    res.json({ success: true });
  });

  app.delete("/api/laporan/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM laporan WHERE id = ?").run(id);
    
    // Auto-sync to Google Sheets
    syncAllToGoogle();

    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const { role, nama, divisi } = req.query;
    let total, dinilai, belum;

    if (role === 'admin') {
      total = db.prepare("SELECT COUNT(*) as count FROM laporan").get() as any;
      dinilai = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE status = 'Selesai'").get() as any;
      belum = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE status = 'Pending'").get() as any;
    } else if (role === 'atasan') {
      total = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE LOWER(divisi) = LOWER(?)").get(divisi) as any;
      dinilai = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE LOWER(divisi) = LOWER(?) AND status = 'Selesai'").get(divisi) as any;
      belum = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE LOWER(divisi) = LOWER(?) AND status = 'Pending'").get(divisi) as any;
    } else {
      total = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE nama_pegawai = ?").get(nama) as any;
      dinilai = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE nama_pegawai = ? AND status = 'Selesai'").get(nama) as any;
      belum = db.prepare("SELECT COUNT(*) as count FROM laporan WHERE nama_pegawai = ? AND status = 'Pending'").get(nama) as any;
    }

    res.json({ total: total.count, dinilai: dinilai.count, belum: belum.count });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite dev server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
