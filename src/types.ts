export type Role = 'admin' | 'atasan' | 'staf';

export interface User {
  id: number;
  username: string;
  nama: string;
  nip: string | null;
  role: Role;
  divisi: string | null;
  drive_folder_id?: string | null;
}

export interface Laporan {
  id: number;
  tanggal: string;
  tanggal_pelaporan: string;
  nama_pegawai: string;
  nip_pegawai: string | null;
  divisi: string;
  rencana_kerja: string;
  rincian_kerja: string;
  output: string;
  bukti_link: string;
  nilai_atasan: string | null;
  catatan_atasan: string | null;
  status: string;
  dinilai_oleh: string | null;
  tanggal_penilaian: string | null;
}

export const DIVISI_OPTIONS = [
  "SDMO",
  "Penanganan Pelanggaran",
  "Penyelesaian Sengketa",
  "Hukum Humas data dan Informasi",
  "Pencegahan"
];

export const PENILAIAN_OPTIONS = [
  "Sangat Baik",
  "Baik",
  "Butuh Perbaikan",
  "Kurang",
  "Sangat Kurang"
];
