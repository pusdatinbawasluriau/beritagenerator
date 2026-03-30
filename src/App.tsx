import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  LogOut, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  ChevronRight,
  Menu,
  X,
  Download,
  ExternalLink,
  Code,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, Laporan, Role, DIVISI_OPTIONS, PENILAIAN_OPTIONS } from './types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'laporan' | 'pengaturan' | 'database'>('dashboard');
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, dinilai: 0, belum: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'laporan' | 'user' | 'nilai' | 'confirm_delete'>('laporan');
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'laporan' | 'user' } | null>(null);
  const [editingLaporan, setEditingLaporan] = useState<Laporan | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [rekapStats, setRekapStats] = useState<any[]>([]);
  const [webappUrl, setWebappUrl] = useState('');
  const [parentFolderId, setParentFolderId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setView('dashboard');
      if (parsedUser.role === 'admin' || parsedUser.role === 'atasan') {
        fetchGoogleSettings();
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchLaporan();
      fetchStats();
      if (user.role === 'admin' || user.role === 'atasan') {
        fetchUsers();
      }
      if (user.role === 'admin') {
        fetchRekapStats();
      }
    }
  }, [user, view]);

  const fetchRekapStats = async () => {
    try {
      const res = await fetch('/api/stats/rekap');
      const data = await res.json();
      setRekapStats(data);
    } catch (err) {
      console.error("Failed to fetch rekap stats:", err);
    }
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
  };

  const fetchLaporan = async () => {
    if (!user) return;
    const res = await fetch(`/api/laporan?role=${user.role}&nama=${encodeURIComponent(user.nama)}&divisi=${encodeURIComponent(user.divisi || '')}`);
    const data = await res.json();
    setLaporan(data);
  };

  const fetchStats = async () => {
    if (!user) return;
    const res = await fetch(`/api/stats?role=${user.role}&nama=${encodeURIComponent(user.nama)}&divisi=${encodeURIComponent(user.divisi || '')}`);
    const data = await res.json();
    setStats(data);
  };

  const fetchGoogleSettings = async () => {
    try {
      const res = await fetch('/api/google/settings');
      const data = await res.json();
      setWebappUrl(data.webappUrl);
      setParentFolderId(data.parentFolderId);
    } catch (err) {
      console.error("Failed to fetch Google settings:", err);
    }
  };

  const handleSaveWebappUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingUrl(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/google/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webappUrl, parentFolderId }),
      });
      if (res.ok) {
        setSyncStatus({ type: 'success', message: "URL Web App berhasil disimpan!" });
      } else {
        const data = await res.json();
        setSyncStatus({ type: 'error', message: data.message || "Gagal menyimpan URL" });
      }
    } catch (err) {
      console.error("Failed to save Google settings:", err);
      setSyncStatus({ type: 'error', message: "Terjadi kesalahan koneksi saat menyimpan URL" });
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleSyncGoogle = async () => {
    if (!user) return;
    if (!webappUrl) {
      alert("Silakan masukkan URL Web App terlebih dahulu");
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncStatus({ type: 'success', message: "Sinkronisasi ke Google Sheets Berhasil!" });
      } else {
        setSyncStatus({ type: 'error', message: data.message || "Gagal sinkronisasi" });
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncStatus({ type: 'error', message: "Terjadi kesalahan saat sinkronisasi. Pastikan URL Web App benar." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError('');
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        setView('dashboard');
      } else {
        setLoginError(data.message || 'Username atau password salah');
      }
    } catch (err) {
      setLoginError('Terjadi kesalahan koneksi ke server');
      console.error('Login error:', err);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError('');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok) {
        alert("Registrasi berhasil! Silakan login.");
        setIsRegistering(false);
      } else {
        setLoginError(result.message || 'Gagal mendaftar');
      }
    } catch (err) {
      setLoginError('Terjadi kesalahan koneksi ke server');
      console.error('Register error:', err);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleDownloadRekapBulanan = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'legal'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    const filteredLaporan = laporan.filter(l => {
      const date = new Date(l.tanggal);
      return (date.getMonth() + 1) === selectedMonth && date.getFullYear() === selectedYear;
    });

    const monthName = new Date(0, selectedMonth - 1).toLocaleString('id-ID', { month: 'long' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REKAPITULASI PENILAIAN KINERJA BULANAN PEGAWAI', centerX, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`BULAN: ${monthName.toUpperCase()} ${selectedYear}`, centerX, 22, { align: 'center' });

    const rekapData = users
      .filter(u => u.role !== 'admin')
      .map((u, index) => {
        const userLaporan = filteredLaporan.filter(l => l.nama_pegawai === u.nama);
        
        const counts = {
          sangatBaik: userLaporan.filter(l => l.nilai_atasan === 'Sangat Baik').length,
          baik: userLaporan.filter(l => l.nilai_atasan === 'Baik').length,
          butuhPerbaikan: userLaporan.filter(l => l.nilai_atasan === 'Butuh Perbaikan').length,
          kurang: userLaporan.filter(l => l.nilai_atasan === 'Kurang').length,
          sangatKurang: userLaporan.filter(l => l.nilai_atasan === 'Sangat Kurang').length,
        };

        return [
          index + 1,
          u.nama,
          u.role === 'atasan' ? 'Atasan / Koordinator' : 'Staf / Pelaksana',
          u.divisi || 'Bawaslu Provinsi Riau',
          counts.sangatBaik,
          counts.baik,
          counts.butuhPerbaikan,
          counts.kurang,
          counts.sangatKurang
        ];
      });

    autoTable(doc, {
      head: [['No', 'Nama Pegawai', 'Jabatan', 'Unit Kerja', 'Sangat Baik', 'Baik', 'Butuh Perbaikan', 'Kurang', 'Sangat Kurang']],
      body: rekapData,
      startY: 30,
      theme: 'grid',
      headStyles: { 
        fillColor: [255, 111, 0], 
        textColor: [255, 255, 255],
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold'
      },
      styles: { fontSize: 10, cellPadding: 3, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 50 },
        3: { cellWidth: 60 },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 25, halign: 'center' },
        6: { cellWidth: 35, halign: 'center' },
        7: { cellWidth: 25, halign: 'center' },
        8: { cellWidth: 35, halign: 'center' }
      },
      margin: { left: 10, right: 10 }
    });

    doc.save(`Rekap_Bulanan_${monthName}_${selectedYear}.pdf`);
  };

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
    localStorage.removeItem('user');
  };

  const handleSubmitLaporan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      tanggal: new Date().toISOString().split('T')[0],
      tanggal_pelaporan: formData.get('tanggal_pelaporan'),
      nama_pegawai: user?.nama,
      nip_pegawai: user?.nip,
      divisi: user?.divisi,
      rencana_kerja: formData.get('rencana_kerja'),
      rincian_kerja: formData.get('rincian_kerja'),
      output: formData.get('output'),
      bukti_link: formData.get('bukti_link'),
    };

    await fetch(editingLaporan ? `/api/laporan/${editingLaporan.id}` : '/api/laporan', {
      method: editingLaporan ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setIsModalOpen(false);
    setEditingLaporan(null);
    fetchLaporan();
  };

  const handleNilaiLaporan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLaporan) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      nilai_atasan: formData.get('nilai_atasan'),
      catatan_atasan: formData.get('catatan_atasan'),
      dinilai_oleh: user?.nama,
      status: 'Selesai',
      tanggal_penilaian: new Date().toISOString().split('T')[0],
    };

    await fetch(`/api/laporan/${editingLaporan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    // Otomatis simpan ke Google Drive jika webappUrl tersedia
    if (webappUrl) {
      try {
        const updatedItem = { ...editingLaporan, ...data };
        const doc = generateLaporanPDF(updatedItem);
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        
        // Cari user untuk mendapatkan drive_folder_id
        const employee = users.find(u => u.nama === updatedItem.nama_pegawai);
        if (employee?.drive_folder_id) {
          const date = new Date(updatedItem.tanggal);
          const monthName = date.toLocaleString('id-ID', { month: 'long' });
          const year = date.getFullYear();
          const folderName = `${monthName} ${year}`;

          // 1. Pastikan folder bulan ada
          const folderRes = await fetch(webappUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ensure_month_folder',
              parentFolderId: employee.drive_folder_id,
              folderName: folderName
            })
          });

          // Karena no-cors, kita tidak bisa baca response, tapi kita bisa coba upload langsung ke folder bulan jika kita punya ID-nya
          // Namun Apps Script ensure_month_folder mengembalikan ID. Tanpa CORS kita tidak bisa ambil ID.
          // Alternatif: Apps Script handle upload dan ensure folder sekaligus.
          
          await fetch(webappUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_pdf',
              parentFolderId: employee.drive_folder_id,
              folderName: folderName,
              fileName: `Laporan_WFA_${updatedItem.nama_pegawai}_${updatedItem.tanggal_pelaporan}.pdf`,
              base64: pdfBase64
            })
          });
        }
      } catch (err) {
        console.error("Gagal menyimpan PDF ke Drive:", err);
      }
    }

    setIsModalOpen(false);
    setEditingLaporan(null);
    fetchLaporan();
  };

  const handleDeleteLaporan = async (id: number) => {
    setItemToDelete({ id, type: 'laporan' });
    setModalType('confirm_delete');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      if (itemToDelete.type === 'laporan') {
        await fetch(`/api/laporan/${itemToDelete.id}`, { method: 'DELETE' });
        fetchLaporan();
      } else {
        const res = await fetch(`/api/users/${itemToDelete.id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchUsers();
        } else {
          const err = await res.json();
          alert(err.message || 'Gagal menghapus pengguna');
          console.error(err.message || 'Gagal menghapus pengguna');
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Terjadi kesalahan saat menghapus data');
    }
    
    setIsModalOpen(false);
    setItemToDelete(null);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      nama: formData.get('nama'),
      nip: formData.get('nip'),
      divisi: formData.get('divisi'),
      username: formData.get('username'),
      password: formData.get('password'),
      role: formData.get('role'),
    };

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setIsModalOpen(false);
      fetchUsers();
    } else {
      const err = await res.json();
      alert(err.message || 'Gagal menambahkan pengguna');
    }
  };

  const handleDeleteUser = async (id: number) => {
    setItemToDelete({ id, type: 'user' });
    setModalType('confirm_delete');
    setIsModalOpen(true);
  };

  const generateLaporanPDF = (item: Laporan) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      format: 'legal',
      unit: 'mm'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    
    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUMEN LAPORAN KINERJA HARIAN PEGAWAI', centerX, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text('YANG MELAKSANAKAN WORK FROM ANYWHERE (WFA)', centerX, 21, { align: 'center' });
    
    // Horizontal Line
    doc.setLineWidth(0.5);
    doc.line(15, 25, pageWidth - 15, 25);
    
    // Section A: Identitas Pegawai
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('A. IDENTITAS PEGAWAI', 15, 35);
    
    const identitasData = [
      ['Nama Lengkap', ':', item.nama_pegawai],
      ['NIP', ':', item.nip_pegawai || '-'],
      ['Jabatan', ':', 'Staf'],
      ['Unit Kerja', ':', 'Bawaslu Provinsi Riau'],
      ['Atasan Langsung', ':', item.dinilai_oleh || `Kepala Bagian ${item.divisi}`]
    ];
    
    autoTable(doc, {
      startY: 38,
      body: identitasData,
      theme: 'plain',
      styles: { cellPadding: 1.5, fontSize: 10, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 5 },
        2: { cellWidth: 'auto' }
      },
      margin: { left: 20 }
    });
    
    // Section B: Hasil Kerja
    const sectionBY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text('B. HASIL KERJA', 15, sectionBY);
    
    autoTable(doc, {
      startY: sectionBY + 3,
      head: [['No', 'Rencana Hasil Kerja', 'Uraian Rincian Kerja Harian', 'Output / Hasil', 'Tanggal Pelaporan', 'Tautan / Bukti Dukung']],
      body: [[
        '1.',
        item.rincian_kerja,
        item.rencana_kerja,
        item.output,
        item.tanggal_pelaporan,
        item.bukti_link
      ]],
      theme: 'grid',
      headStyles: { 
        fillColor: [240, 240, 240], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold', 
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1
      },
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 100 },
        3: { cellWidth: 50 },
        4: { cellWidth: 40, halign: 'center' },
        5: { cellWidth: 60 }
      },
      margin: { left: 10, right: 10 }
    });
    
    // Section C: Pengendalian Kinerja
    const sectionCY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text('C. PENGENDALIAN KINERJA (VERIFIKASI/PENILAIAN ATASAN LANGSUNG)', 15, sectionCY);
    
    autoTable(doc, {
      startY: sectionCY + 3,
      head: [['No', 'Uraian Pengendalian', 'Hasil Verifikasi / Penilaian Atasan']],
      body: [
        ['1.', 'Penilaian terhadap capaian kinerja harian pegawai', item.nilai_atasan || '-'],
        ['2.', 'Rekomendasi / Catatan Tindak Lanjut', item.catatan_atasan || '-']
      ],
      theme: 'grid',
      headStyles: { 
        fillColor: [240, 240, 240], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold', 
        halign: 'center',
        lineWidth: 0.1
      },
      styles: { fontSize: 10, cellPadding: 4, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 220 },
        2: { cellWidth: 'auto' }
      },
      margin: { left: 10, right: 10 }
    });
    
    // Footer / Signature
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    const pageHeight = doc.internal.pageSize.getHeight();

    // Check if signature fits on current page (approx 40mm height needed)
    if (finalY + 40 > pageHeight) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const date = new Date(dateStr);
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const signatureCenterX = pageWidth - 60;
    doc.text(`Pekanbaru, ${formatDate(item.tanggal)}`, signatureCenterX, finalY, { align: 'center' });
    doc.text(`Kepala Bagian ${item.divisi}`, signatureCenterX, finalY + 7, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.text(item.dinilai_oleh || '(....................................................)', signatureCenterX, finalY + 30, { align: 'center' });
    
    return doc;
  };

  const handleDownloadPDF = (item: Laporan) => {
    const doc = generateLaporanPDF(item);
    doc.save(`Laporan_WFA_${item.nama_pegawai}_${item.tanggal_pelaporan}.pdf`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="bg-[#ff6f00] p-8 text-center">
            <h1 className="text-white text-2xl font-bold">E-Laporan WFA</h1>
            <p className="text-white/80 text-sm mt-2">Bawaslu Provinsi Riau</p>
          </div>
          
          <div className="p-8">
            <div className="flex mb-6 bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => { setIsRegistering(false); setLoginError(''); }}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${!isRegistering ? 'bg-white text-[#ff6f00] shadow-sm' : 'text-gray-500'}`}
              >
                Login
              </button>
              <button 
                onClick={() => { setIsRegistering(true); setLoginError(''); }}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${isRegistering ? 'bg-white text-[#ff6f00] shadow-sm' : 'text-gray-500'}`}
              >
                Register
              </button>
            </div>

            {isRegistering ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input name="nama" type="text" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none" placeholder="Nama Lengkap" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                  <input name="nip" type="text" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none" placeholder="NIP" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Divisi</label>
                  <select name="divisi" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none">
                    <option value="">Pilih Divisi</option>
                    {DIVISI_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input name="username" type="text" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none" placeholder="Username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input name="password" type="password" required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none" placeholder="Password" />
                </div>
                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                <button disabled={isLoginLoading} className="w-full bg-[#ff6f00] text-white py-3 rounded-lg font-semibold hover:bg-[#e65100] transition-colors disabled:opacity-50">
                  {isLoginLoading ? 'Loading...' : 'Daftar Sekarang'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input 
                    name="username"
                    type="text" 
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] focus:border-transparent outline-none transition-all"
                    placeholder="Masukkan username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input 
                    name="password"
                    type="password" 
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] focus:border-transparent outline-none transition-all"
                    placeholder="Masukkan password"
                  />
                </div>
                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                <button 
                  disabled={isLoginLoading}
                  className="w-full bg-[#ff6f00] text-white py-3 rounded-lg font-semibold hover:bg-[#e65100] transition-colors disabled:opacity-50"
                >
                  {isLoginLoading ? 'Loading...' : 'Masuk'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <span className="font-bold text-[#ff6f00] text-xl">E-Laporan</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-gray-100 rounded">
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard />} 
            label="Dashboard" 
            active={view === 'dashboard'} 
            collapsed={!isSidebarOpen}
            onClick={() => setView('dashboard')}
          />
          <NavItem 
            icon={<FileText />} 
            label="Laporan" 
            active={view === 'laporan'} 
            collapsed={!isSidebarOpen}
            onClick={() => setView('laporan')}
          />
          {user.role === 'admin' && (
            <>
              <NavItem 
                icon={<Database />} 
                label="Database" 
                active={view === 'database'} 
                collapsed={!isSidebarOpen}
                onClick={() => setView('database')}
              />
              <NavItem 
                icon={<Settings />} 
                label="Pengaturan" 
                active={view === 'pengaturan'} 
                collapsed={!isSidebarOpen}
                onClick={() => setView('pengaturan')}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white h-16 border-bottom border-gray-200 flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold text-gray-800 capitalize">{view}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{user.nama}</p>
              <p className="text-xs text-gray-500 uppercase">{user.role} - {user.divisi || 'Admin'}</p>
            </div>
            <div className="w-10 h-10 bg-[#ff6f00] rounded-full flex items-center justify-center text-white font-bold">
              {user.nama.charAt(0)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {view === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Total Laporan" 
                  value={stats.total} 
                  icon={<FileText className="text-blue-600" />} 
                  color="blue"
                />
                <StatCard 
                  title="Sudah Dinilai" 
                  value={stats.dinilai} 
                  icon={<CheckCircle className="text-green-600" />} 
                  color="green"
                />
                <StatCard 
                  title="Belum Dinilai" 
                  value={stats.belum} 
                  icon={<Clock className="text-orange-600" />} 
                  color="orange"
                />
              </div>

              {user.role === 'admin' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Download Rekap Penilaian Bulanan</h3>
                    <p className="text-gray-500 text-sm">Unduh akumulasi penilaian harian pegawai dalam satu bulan.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
                      ))}
                    </select>
                    <select 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {[2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleDownloadRekapBulanan}
                      className="bg-[#ff6f00] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#e65100] transition-all flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              )}

              {user.role === 'staf' && user.drive_folder_id && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <img src="https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png" alt="Google Drive" className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Folder Laporan Drive</h4>
                      <p className="text-xs text-gray-500">Akses folder penyimpanan laporan Anda di Google Drive.</p>
                    </div>
                  </div>
                  <a 
                    href={`https://drive.google.com/drive/folders/${user.drive_folder_id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                  >
                    Buka Folder <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {user.role === 'admin' && rekapStats.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6">Tren Penilaian per Bulan</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rekapStats.reduce((acc: any[], curr: any) => {
                          const existing = acc.find(a => a.bulan === curr.bulan);
                          if (existing) {
                            existing.jumlah += curr.jumlah;
                          } else {
                            acc.push({ bulan: curr.bulan, jumlah: curr.jumlah });
                          }
                          return acc;
                        }, [])}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="bulan" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="jumlah" name="Total Laporan" fill="#ff6f00" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6">Distribusi Kriteria Penilaian</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={rekapStats.reduce((acc: any[], curr: any) => {
                              const existing = acc.find(a => a.name === curr.nilai_atasan);
                              if (existing) {
                                existing.value += curr.jumlah;
                              } else {
                                acc.push({ name: curr.nilai_atasan, value: curr.jumlah });
                              }
                              return acc;
                            }, [])}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={8}
                            dataKey="value"
                          >
                            {rekapStats.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold mb-4">Laporan Terbaru</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 text-sm uppercase">
                        <th className="pb-4 font-medium">Tanggal</th>
                        <th className="pb-4 font-medium">Nama Pegawai</th>
                        <th className="pb-4 font-medium">Status</th>
                        <th className="pb-4 font-medium">Penilaian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {laporan.slice(0, 5).map((item) => (
                        <tr key={item.id} className="text-sm">
                          <td className="py-4">{item.tanggal}</td>
                          <td className="py-4 font-medium">{item.nama_pegawai}</td>
                          <td className="py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'Selesai' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-4">{item.nilai_atasan || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'database' && user.role === 'admin' && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
                    <img src="https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png" alt="Google Sheets" className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Integrasi Google Sheets & Drive</h3>
                    <p className="text-gray-500 text-sm">Gunakan URL Web App dari Google Apps Script untuk sinkronisasi data dan pembuatan folder otomatis.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">URL Web App Google Apps Script</label>
                    <input 
                      type="text" 
                      value={webappUrl}
                      onChange={(e) => setWebappUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">ID Folder Induk (Drive)</label>
                    <input 
                      type="text" 
                      value={parentFolderId}
                      onChange={(e) => setParentFolderId(e.target.value)}
                      placeholder="ID Folder Google Drive"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveWebappUrl}
                      disabled={isSavingUrl}
                      className="flex-1 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
                    >
                      {isSavingUrl ? 'Menyimpan...' : 'Simpan URL'}
                    </button>
                    <button 
                      onClick={handleSyncGoogle}
                      disabled={isSyncing}
                      className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                      {isSyncing ? 'Sinkron...' : 'Sinkron Data'}
                    </button>
                  </div>
                </div>

                {syncStatus && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    syncStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                  }`}>
                    {syncStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{syncStatus.message}</span>
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-bold text-gray-700">Kode Google Apps Script (doPost)</span>
                  </div>
                  <pre className="text-[10px] bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto max-h-40">
{`function doGet(e) {
  return ContentService.createTextOutput("Web App E-Laporan Aktif. Gunakan POST request untuk sinkronisasi data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ error: "No data received" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var params = JSON.parse(e.postData.contents);
  var action = params.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Ensure Sheets exist
  var userSheet = ss.getSheetByName("Users") || ss.insertSheet("Users");
  var reportSheet = ss.getSheetByName("Reports") || ss.insertSheet("Reports");
  
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(["id", "username", "password", "nama", "nip", "role", "divisi", "drive_folder_id"]);
  }
  
  if (action === "register") {
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === params.username) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Username sudah ada" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Create Folder for User
    var parentFolder;
    try {
      if (params.parentFolderId) {
        parentFolder = DriveApp.getFolderById(params.parentFolderId);
      } else {
        parentFolder = DriveApp.getFileById(ss.getId()).getParents().next();
      }
    } catch (e) {
      // Fallback if ID is invalid
      parentFolder = DriveApp.getFileById(ss.getId()).getParents().next();
    }
    var folder = parentFolder.createFolder("Laporan - " + params.nama);
    var folderId = folder.getId();
    
    var newId = new Date().getTime(); // Use timestamp for unique ID
    userSheet.appendRow([newId, params.username, params.password, params.nama, params.nip, params.role, params.divisi, folderId]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      id: newId, 
      drive_folder_id: folderId 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "login") {
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === params.username && data[i][2] === params.password) {
        return ContentService.createTextOutput(JSON.stringify({ 
          success: true, 
          user: {
            id: data[i][0],
            username: data[i][1],
            nama: data[i][3],
            nip: data[i][4],
            role: data[i][5],
            divisi: data[i][6],
            drive_folder_id: data[i][7]
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Username atau password salah" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "create_user_folder") {
    var parentFolder = DriveApp.getFileById(ss.getId()).getParents().next();
    var folder = parentFolder.createFolder(params.nama);
    return ContentService.createTextOutput(JSON.stringify({ folderId: folder.getId() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "ensure_month_folder") {
    var parentFolder = DriveApp.getFolderById(params.parentFolderId);
    var folders = parentFolder.getFoldersByName(params.folderName);
    var targetFolder = folders.hasNext() ? folders.next() : parentFolder.createFolder(params.folderName);
    return ContentService.createTextOutput(JSON.stringify({ folderId: targetFolder.getId() }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "save_pdf") {
    var parentFolder = DriveApp.getFolderById(params.parentFolderId);
    var folders = parentFolder.getFoldersByName(params.folderName);
    var targetFolder = folders.hasNext() ? folders.next() : parentFolder.createFolder(params.folderName);
    
    var blob = Utilities.newBlob(Utilities.base64Decode(params.base64), "application/pdf", params.fileName);
    var file = targetFolder.createFile(blob);
    return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: file.getId() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "sync") {
    reportSheet.clearContents();
    var headers = ["id", "tanggal_input", "tanggal_pelaporan", "nama_pegawai", "nip", "divisi", "rencana_kerja", "rincian_kerja", "output", "bukti_link", "nilai_atasan", "catatan_atasan", "status", "dinilai_oleh", "tanggal_penilaian"];
    reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (params.data && params.data.length > 0) {
      var rows = params.data.map(function(row) {
        return headers.map(function(h) { return row[h] || ""; });
      });
      reportSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "delete_user") {
    var data = userSheet.getDataRange().getValues();
    var usernameToDelete = String(params.username).trim().toLowerCase();
    var deleted = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toLowerCase() === usernameToDelete) {
        userSheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, deleted: deleted }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "save_report") {
    var headers = ["id", "tanggal_input", "tanggal_pelaporan", "nama_pegawai", "nip", "divisi", "rencana_kerja", "rincian_kerja", "output", "bukti_link", "nilai_atasan", "catatan_atasan", "status", "dinilai_oleh", "tanggal_penilaian"];
    if (reportSheet.getLastRow() === 0) {
      reportSheet.appendRow(headers);
    }
    
    // Check if update or new
    var data = reportSheet.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.report.id) {
        rowIdx = i + 1;
        break;
      }
    }
    
    var rowData = headers.map(function(h) { return params.report[h]; });
    if (rowIdx > -1) {
      reportSheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
    } else {
      reportSheet.appendRow(rowData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "get_users") {
    var data = userSheet.getDataRange().getValues();
    var users = [];
    var headers = data[0];
    for (var i = 1; i < data.length; i++) {
      var user = {};
      for (var j = 0; j < headers.length; j++) {
        user[headers[j]] = data[i][j];
      }
      users.push(user);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, users: users }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`}
                  </pre>
                  <p className="text-[10px] text-gray-500 mt-2 italic">* Deploy kode di atas sebagai Web App dengan akses "Anyone" agar integrasi berjalan lancar.</p>
                </div>
              </div>
            </div>
          )}

          {view === 'laporan' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Daftar Laporan</h3>
                {user.role === 'staf' && (
                  <button 
                    onClick={() => {
                      setEditingLaporan(null);
                      setModalType('laporan');
                      setIsModalOpen(true);
                    }}
                    className="bg-[#ff6f00] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e65100] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Buat Laporan
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">No</th>
                        <th className="px-6 py-4 font-semibold">Tanggal</th>
                        <th className="px-6 py-4 font-semibold">Nama Pegawai</th>
                        <th className="px-6 py-4 font-semibold">Divisi</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Penilaian</th>
                        <th className="px-6 py-4 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {laporan.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm">{index + 1}</td>
                          <td className="px-6 py-4 text-sm">{item.tanggal}</td>
                          <td className="px-6 py-4 text-sm font-medium">{item.nama_pegawai}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.divisi}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                              item.status === 'Selesai' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">{item.nilai_atasan || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  setEditingLaporan(item);
                                  setModalType(user.role === 'atasan' && item.status === 'Pending' ? 'nilai' : 'laporan');
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Lihat/Edit"
                              >
                                {user.role === 'atasan' && item.status === 'Pending' ? <Edit className="w-4 h-4" /> : 
                                 user.role === 'staf' && item.status === 'Pending' ? <Edit className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => handleDownloadPDF(item)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {(user.role === 'admin' || (user.role === 'staf' && item.status === 'Pending')) && (
                                <button 
                                  onClick={() => handleDeleteLaporan(item.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'pengaturan' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Manajemen Pengguna</h3>
                <button 
                  onClick={() => {
                    setModalType('user');
                    setIsModalOpen(true);
                  }}
                  className="bg-[#ff6f00] text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Tambah Pengguna
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">No</th>
                        <th className="px-6 py-4 font-semibold">Nama</th>
                        <th className="px-6 py-4 font-semibold">Username</th>
                        <th className="px-6 py-4 font-semibold">Divisi</th>
                        <th className="px-6 py-4 font-semibold">Role</th>
                        <th className="px-6 py-4 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map((u, index) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium">{u.nama}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.username}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.divisi || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                              u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                              u.role === 'atasan' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {u.username !== 'admin' && (
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setEditingLaporan(null);
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-[#ff6f00] p-6 flex justify-between items-center">
                <h4 className="text-white font-bold text-lg">
                  {modalType === 'user' ? 'Tambah Pengguna Baru' : 
                   modalType === 'nilai' ? 'Penilaian Laporan' : 
                   editingLaporan ? 'Detail Laporan' : 
                   modalType === 'confirm_delete' ? 'Konfirmasi Hapus' : 'Buat Laporan Baru'}
                </h4>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setEditingLaporan(null);
                  setItemToDelete(null);
                }} className="text-white/80 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8">
                {modalType === 'confirm_delete' && (
                  <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                      <Trash2 className="w-10 h-10" />
                    </div>
                    <div>
                      <h5 className="text-xl font-bold text-gray-900">Apakah Anda yakin?</h5>
                      <p className="text-gray-500 mt-2">
                        Data {itemToDelete?.type === 'user' ? 'pengguna' : 'laporan'} ini akan dihapus secara permanen dan tidak dapat dikembalikan.
                      </p>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => {
                          setIsModalOpen(false);
                          setItemToDelete(null);
                        }}
                        className="flex-1 px-6 py-3 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={confirmDelete}
                        className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                      >
                        Ya, Hapus
                      </button>
                    </div>
                  </div>
                )}

                {modalType === 'user' && (
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                        <input name="nama" type="text" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]" placeholder="Nama Lengkap" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">NIP</label>
                        <input name="nip" type="text" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]" placeholder="NIP" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Divisi</label>
                      <select name="divisi" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]">
                        <option value="">Pilih Divisi</option>
                        {DIVISI_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input name="username" type="text" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]" placeholder="Username" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input name="password" type="password" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]" placeholder="Password" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select name="role" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]">
                        <option value="staf">Staf</option>
                        <option value="atasan">Atasan</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-[#ff6f00] text-white py-3 rounded-lg font-bold hover:bg-[#e65100] transition-colors mt-4">
                      Simpan Pengguna
                    </button>
                  </form>
                )}

                {modalType === 'laporan' && user.role === 'staf' && (
                  <form onSubmit={handleSubmitLaporan} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pegawai</label>
                        <input type="text" value={user.nama} disabled className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Divisi</label>
                        <input type="text" value={user.divisi || ''} disabled className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pelaporan</label>
                      <input 
                        name="tanggal_pelaporan"
                        type="date"
                        required
                        defaultValue={editingLaporan?.tanggal_pelaporan || new Date().toISOString().split('T')[0]}
                        disabled={editingLaporan?.status === 'Selesai'}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Uraian Rencana Kerja Harian</label>
                      <textarea 
                        name="rencana_kerja"
                        required
                        rows={3}
                        defaultValue={editingLaporan?.rencana_kerja || ''}
                        disabled={editingLaporan?.status === 'Selesai'}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none disabled:bg-gray-50"
                        placeholder="Jelaskan rencana kerja Anda hari ini..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rincian Hasil Kerja</label>
                      <textarea 
                        name="rincian_kerja"
                        required
                        rows={3}
                        defaultValue={editingLaporan?.rincian_kerja || ''}
                        disabled={editingLaporan?.status === 'Selesai'}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none disabled:bg-gray-50"
                        placeholder="Jelaskan rincian hasil kerja yang telah dicapai..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Output</label>
                      <input 
                        name="output"
                        type="text"
                        required
                        defaultValue={editingLaporan?.output || ''}
                        disabled={editingLaporan?.status === 'Selesai'}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none disabled:bg-gray-50"
                        placeholder="Contoh: 1 Laporan, 2 Dokumen, dll."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bukti Dukung (Link)</label>
                      <input 
                        name="bukti_link"
                        type="url"
                        required
                        defaultValue={editingLaporan?.bukti_link || ''}
                        disabled={editingLaporan?.status === 'Selesai'}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff6f00] outline-none disabled:bg-gray-50"
                        placeholder="https://drive.google.com/..."
                      />
                    </div>
                    {(!editingLaporan || editingLaporan.status === 'Pending') && (
                      <button className="w-full bg-[#ff6f00] text-white py-3 rounded-lg font-bold hover:bg-[#e65100] transition-colors">
                        {editingLaporan ? 'Simpan Perubahan' : 'Kirim Laporan ke Atasan'}
                      </button>
                    )}
                  </form>
                )}

                {(modalType === 'laporan' || modalType === 'nilai') && editingLaporan && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Pegawai</p>
                        <p className="font-medium">{editingLaporan.nama_pegawai}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Divisi</p>
                        <p className="font-medium">{editingLaporan.divisi}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Tanggal Pelaporan</p>
                        <p className="font-medium">{editingLaporan.tanggal_pelaporan}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Output</p>
                        <p className="font-medium">{editingLaporan.output}</p>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Rencana Kerja</p>
                        <p className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed">{editingLaporan.rencana_kerja}</p>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Rincian Hasil Kerja</p>
                        <p className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed">{editingLaporan.rincian_kerja}</p>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Bukti Dukung</p>
                        <a href={editingLaporan.bukti_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                          {editingLaporan.bukti_link}
                        </a>
                      </div>
                    </div>

                    {modalType === 'nilai' && user.role === 'atasan' && editingLaporan.status === 'Pending' ? (
                      <form onSubmit={handleNilaiLaporan} className="pt-6 border-t border-gray-100 space-y-4">
                        <h5 className="font-bold text-gray-800">Form Penilaian Atasan</h5>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hasil Penilaian</label>
                          <select 
                            name="nilai_atasan"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]"
                          >
                            <option value="">Pilih Penilaian</option>
                            {PENILAIAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Arahan dan Perbaikan Atasan</label>
                          <textarea 
                            name="catatan_atasan"
                            required
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#ff6f00]"
                            placeholder="Berikan catatan atau arahan..."
                          />
                        </div>
                        <button className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors">
                          Simpan Penilaian & Approve
                        </button>
                      </form>
                    ) : (
                      <div className="pt-6 border-t border-gray-100 space-y-4">
                        <h5 className="font-bold text-gray-800">Hasil Penilaian Atasan</h5>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-xs text-blue-400 uppercase font-bold mb-1">Nilai</p>
                            <p className="font-bold text-blue-900">{editingLaporan.nilai_atasan || 'Belum dinilai'}</p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Catatan Atasan</p>
                            <p className="text-sm italic">{editingLaporan.catatan_atasan || '-'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode, label: string, active: boolean, collapsed: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-[#ff6f00] text-white shadow-lg shadow-orange-200' 
          : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const colors: any = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50'
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 ${colors[color]} rounded-xl flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

