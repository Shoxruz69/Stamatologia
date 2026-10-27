import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Appointment,
  ClinicSettings,
  Doctor,
  Patient,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Service,
  CurrentUser,
  SyncStatus,
} from '../types';
import {
  loadInitialAppData,
  saveAppointments,
  saveDoctors,
  savePatients,
  savePayments,
  saveServices,
  saveSettings,
  resetAllDataToDefault,
  clearClientTransactions,
  getLocalMigrationPayload,
  downloadLocalBackupFile,
  loadSyncQueue,
  saveSyncQueue,
  SyncQueueItem,
} from '../utils/storage';
import {
  getStoredCurrentUser,
  saveStoredCurrentUser,
  updateStaffMember,
  getRememberedStaff,
  setRememberedStaff,
  saveStaffMembersToStorage,
  generateAvatarInitials,
} from '../utils/staffData';
import {
  getPresetDates,
  formatUzbekPhoneNumber,
  extractPhoneDigits,
  arePhoneNumbersEqual,
} from '../utils/formatters';
import { ToastMessage } from '../components/common/Toast';
import { apiClient } from '../services/apiClient';

export type NavTab =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'services'
  | 'payments'
  | 'analytics'
  | 'reports'
  | 'settings';

export type ServerStatus = 'online' | 'offline' | 'checking';
export type DatabaseStatus = 'connected' | 'disconnected' | 'checking';

interface AppContextType {
  // Navigatsiya
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;

  // Global qidiruv
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Backend va Baza holati
  serverStatus: ServerStatus;
  dbStatus: DatabaseStatus;
  lastSyncError: string | null;
  isSyncing: boolean;
  pendingSyncCount: number;
  syncWithBackend: () => Promise<void>;
  migrateLocalDataToPostgres: () => Promise<{ success: boolean; message: string; details?: any }>;
  downloadLocalBackup: () => boolean;

  // Data
  services: Service[];
  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  payments: Payment[];
  settings: ClinicSettings;

  // Xizmatlar amallari
  addService: (service: Omit<Service, 'id'>) => boolean;
  updateService: (id: string, service: Partial<Service>) => boolean;
  deleteService: (id: string) => boolean;

  // Shifokorlar amallari
  addDoctor: (doctor: Omit<Doctor, 'id'>) => boolean;
  updateDoctor: (id: string, doctor: Partial<Doctor>) => boolean;
  deleteDoctor: (id: string) => boolean;

  // Bemorlar amallari
  addPatient: (patient: Omit<Patient, 'id' | 'totalVisits' | 'createdAt'>) => Patient;
  updatePatient: (id: string, patient: Partial<Patient>) => boolean;
  deletePatient: (id: string) => boolean;

  // Qabullar amallari
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'paidAmount'>) => {
    success: boolean;
    error?: string;
  };
  updateAppointment: (id: string, appointment: Partial<Appointment>) => {
    success: boolean;
    error?: string;
  };
  cancelAppointment: (id: string, reason?: string) => boolean;
  deleteAppointment: (id: string) => boolean;

  // To'lovlar amallari
  addPayment: (payment: Omit<Payment, 'id' | 'receiptNumber'>) => Payment;
  updatePayment: (id: string, payment: Partial<Payment>) => boolean;
  completePayment: (paymentId: string, paymentMethod?: PaymentMethod) => boolean;
  refundPayment: (id: string) => boolean;

  // Sozlamalar
  updateSettings: (newSettings: Partial<ClinicSettings>) => void;
  resetAllData: () => void;
  cleanAllTestData: () => Promise<boolean>;

  // Savdo tahlili va Hisobotlar uchun umumiy sana va shifokor filtrlari
  filterPreset: 'today' | 'week' | 'month' | 'custom';
  setFilterPreset: (preset: 'today' | 'week' | 'month' | 'custom') => void;
  filterStartDate: string;
  setFilterStartDate: (date: string) => void;
  filterEndDate: string;
  setFilterEndDate: (date: string) => void;
  filterDoctorId: string;
  setFilterDoctorId: (doctorId: string) => void;
  applyDatePreset: (
    preset: 'today' | 'week' | 'month' | 'custom',
    customStart?: string,
    customEnd?: string
  ) => void;

  // Bildirishnomalar
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  dismissToast: (id: string) => void;

  // Foydalanuvchi auth
  currentUser: CurrentUser | null;
  logout: () => void;
  login: (user: CurrentUser) => void;
  updateCurrentUser: (updates: Partial<CurrentUser>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Initial data from safety offline storage (Boshlang'ich tezkor render uchun)
  const [services, setServices] = useState<Service[]>(() => loadInitialAppData().services);
  const [doctors, setDoctors] = useState<Doctor[]>(() => loadInitialAppData().doctors);
  const [patients, setPatients] = useState<Patient[]>(() => loadInitialAppData().patients);
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadInitialAppData().appointments);
  const [payments, setPayments] = useState<Payment[]>(() => loadInitialAppData().payments);
  const [settings, setSettings] = useState<ClinicSettings>(() => loadInitialAppData().settings);

  // Server & Baza holati
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [dbStatus, setDbStatus] = useState<DatabaseStatus>('checking');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => loadSyncQueue().length);

  // Sync Navbati yordamchisi
  const enqueueSyncItem = useCallback((item: SyncQueueItem) => {
    const queue = loadSyncQueue();
    const existingIndex = queue.findIndex(
      (q) => q.entity === item.entity && q.entityId === item.entityId
    );
    let nextQueue: SyncQueueItem[];
    if (existingIndex >= 0) {
      const existing = queue[existingIndex];
      if (existing.action === 'create' && item.action === 'update') {
        nextQueue = [...queue];
        nextQueue[existingIndex] = {
          ...existing,
          data: { ...existing.data, ...item.data },
          timestamp: Date.now(),
        };
      } else if (item.action === 'delete') {
        if (existing.action === 'create') {
          nextQueue = queue.filter((_, idx) => idx !== existingIndex);
        } else {
          nextQueue = [...queue];
          nextQueue[existingIndex] = item;
        }
      } else {
        nextQueue = [...queue];
        nextQueue[existingIndex] = item;
      }
    } else {
      nextQueue = [...queue, item];
    }
    saveSyncQueue(nextQueue);
    setPendingSyncCount(nextQueue.length);
  }, []);

  // Offline navbatdagi amallarni serverga ketma-ket yuborish
  const processSyncQueue = useCallback(async (): Promise<number> => {
    const queue = loadSyncQueue();
    if (queue.length === 0) {
      setPendingSyncCount(0);
      return 0;
    }

    const remaining: SyncQueueItem[] = [];
    for (const item of queue) {
      try {
        if (item.action === 'create') {
          if (item.entity === 'patient') await apiClient.createPatient(item.data);
          else if (item.entity === 'appointment') await apiClient.createAppointment(item.data);
          else if (item.entity === 'payment') await apiClient.createPayment(item.data);
          else if (item.entity === 'doctor') await apiClient.createDoctor(item.data);
          else if (item.entity === 'service') await apiClient.createService(item.data);
        } else if (item.action === 'update') {
          if (item.entity === 'patient') await apiClient.updatePatient(item.entityId, item.data);
          else if (item.entity === 'appointment') await apiClient.updateAppointment(item.entityId, item.data);
          else if (item.entity === 'payment') await apiClient.createPayment({ id: item.entityId, ...item.data });
          else if (item.entity === 'doctor') await apiClient.updateDoctor(item.entityId, item.data);
          else if (item.entity === 'service') await apiClient.updateService(item.entityId, item.data);
        } else if (item.action === 'delete') {
          if (item.entity === 'patient') await apiClient.deletePatient(item.entityId);
          else if (item.entity === 'appointment') await apiClient.deleteAppointment(item.entityId);
          else if (item.entity === 'payment') await apiClient.refundPayment(item.entityId);
          else if (item.entity === 'doctor') await apiClient.deleteDoctor(item.entityId);
          else if (item.entity === 'service') await apiClient.deleteService(item.entityId);
        }
      } catch (err: any) {
        console.warn(`Sinxronlash navbat elementi (${item.entity}:${item.entityId}) xatosi:`, err);
        remaining.push(item);
      }
    }

    saveSyncQueue(remaining);
    setPendingSyncCount(remaining.length);
    return remaining.length;
  }, []);

  // Savdo tahlili va Hisobotlar uchun umumiy filtrlash holati
  const defaultDates = getPresetDates('month');
  const [filterPreset, setFilterPreset] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [filterStartDate, setFilterStartDate] = useState(defaultDates.startDate);
  const [filterEndDate, setFilterEndDate] = useState(defaultDates.endDate);
  const [filterDoctorId, setFilterDoctorId] = useState('');

  const applyDatePreset = (
    preset: 'today' | 'week' | 'month' | 'custom',
    customStart?: string,
    customEnd?: string
  ) => {
    setFilterPreset(preset);
    const dates = getPresetDates(preset, customStart || filterStartDate, customEnd || filterEndDate);
    setFilterStartDate(dates.startDate);
    setFilterEndDate(dates.endDate);
  };

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    return getStoredCurrentUser();
  });

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
      const id = Date.now().toString() + Math.random().toString().slice(2, 6);
      setToasts((prev) => [...prev, { id, message, type, title }]);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * ===================================================================
   * MARKAZIY BACKEND VA POSTGRESQL BILAN SINXRONLASH
   * ===================================================================
   */
  const syncWithBackend = useCallback(async () => {
    setIsSyncing(true);
    setLastSyncError(null);

    try {
      // 1. Haqiqiy PostgreSQL bazasi salomatligini ping orqali tekshirish
      const health = await apiClient.checkHealth();

      if (health.database && health.database.connected) {
        setServerStatus('online');
        setDbStatus('connected');

        // 2. Offline vaqtida to'plangan navbatni serverga yuborish
        await processSyncQueue();

        // 3. Markaziy PostgreSQL bazasidan so'nggi ma'lumotlarni yuklab olish
        const [
          serverPatients,
          serverAppointments,
          serverPayments,
          serverDoctors,
          serverServices,
          serverSettings,
          serverStaff,
        ] = await Promise.all([
          apiClient.getPatients(),
          apiClient.getAppointments(),
          apiClient.getPayments(),
          apiClient.getDoctors(),
          apiClient.getServices(),
          apiClient.getSettings().catch(() => null),
          apiClient.getStaff().catch(() => null),
        ]);

        // Serverdan kelgan ma'lumotlarni lokal pending (sinxronlanmagan) yozuvlar bilan birlashtiramiz (Merge without duplicate)
        if (Array.isArray(serverPatients)) {
          setPatients((prev) => {
            const pending = prev.filter((p) => p.syncStatus === 'pending');
            const serverIds = new Set(serverPatients.map((p) => p.id));
            const unmergedPending = pending.filter((p) => {
              if (serverIds.has(p.id)) return false;
              if (p.phone && serverPatients.some((sp) => arePhoneNumbersEqual(sp.phone, p.phone))) {
                return false;
              }
              return true;
            });
            const merged: Patient[] = [
              ...unmergedPending,
              ...serverPatients.map((p) => ({ ...p, syncStatus: 'synced' as SyncStatus })),
            ];
            savePatients(merged);
            return merged;
          });
        }

        if (Array.isArray(serverAppointments)) {
          setAppointments((prev) => {
            const pending = prev.filter((a) => a.syncStatus === 'pending');
            const serverIds = new Set(serverAppointments.map((a) => a.id));
            const unmergedPending = pending.filter((a) => !serverIds.has(a.id));
            const merged: Appointment[] = [
              ...unmergedPending,
              ...serverAppointments.map((a) => ({ ...a, syncStatus: 'synced' as SyncStatus })),
            ];
            saveAppointments(merged);
            return merged;
          });
        }

        if (Array.isArray(serverPayments)) {
          setPayments((prev) => {
            const pending = prev.filter((p) => p.syncStatus === 'pending');
            const serverIds = new Set(serverPayments.map((p) => p.id));
            const unmergedPending = pending.filter((p) => !serverIds.has(p.id));
            const merged: Payment[] = [
              ...unmergedPending,
              ...serverPayments.map((p) => ({ ...p, syncStatus: 'synced' as SyncStatus })),
            ];
            savePayments(merged);
            return merged;
          });
        }

        if (Array.isArray(serverDoctors)) {
          setDoctors((prev) => {
            const pending = prev.filter((d) => d.syncStatus === 'pending');
            const serverIds = new Set(serverDoctors.map((d) => d.id));
            const unmergedPending = pending.filter((d) => !serverIds.has(d.id));
            const merged: Doctor[] = [
              ...unmergedPending,
              ...serverDoctors.map((d) => ({ ...d, syncStatus: 'synced' as SyncStatus })),
            ];
            saveDoctors(merged);
            return merged;
          });
        }

        if (Array.isArray(serverServices)) {
          setServices((prev) => {
            const pending = prev.filter((s) => s.syncStatus === 'pending');
            const serverIds = new Set(serverServices.map((s) => s.id));
            const unmergedPending = pending.filter((s) => !serverIds.has(s.id));
            const merged: Service[] = [
              ...unmergedPending,
              ...serverServices.map((s) => ({ ...s, syncStatus: 'synced' as SyncStatus })),
            ];
            saveServices(merged);
            return merged;
          });
        }

        if (serverSettings) {
          setSettings(serverSettings);
          saveSettings(serverSettings);
        }

        if (Array.isArray(serverStaff)) {
          saveStaffMembersToStorage(serverStaff);
        }
      } else {
        setServerStatus('online');
        setDbStatus('disconnected');
        const dbErr =
          (health.database && health.database.lastError) ||
          'PostgreSQL ma’lumotlar bazasiga ulanib bo‘lmadi. Server/Docker holatini tekshiring.';
        setLastSyncError(dbErr);
      }
    } catch (err: any) {
      setServerStatus('offline');
      setDbStatus('disconnected');
      const msg = `Backend serverga (${apiClient.getBaseUrl()}) ulanib bo‘lmadi. Internet yoki tarmoq holatini tekshiring.`;
      setLastSyncError(msg);
      // Hech qachon mavjud ma'lumotlarni o'chirmaymiz; offline kesh saqlanadi
    } finally {
      setIsSyncing(false);
    }
  }, [processSyncQueue]);

  // Ilova ochilganda, internet ulanganda va har 25 soniyada haqiqiy holatni tekshirish
  useEffect(() => {
    syncWithBackend();

    const handleOnline = () => {
      showToast('Internet aloqasi tiklandi. Ma’lumotlar tekshirilmoqda...', 'info');
      syncWithBackend();
    };

    const handleOffline = () => {
      setServerStatus('offline');
      setDbStatus('disconnected');
      showToast('Internet aloqasi uzildi. O‘zgarishlar qurilmada xavfsiz saqlanadi.', 'error');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    const heartbeatInterval = setInterval(async () => {
      try {
        const health = await apiClient.checkHealth();
        if (health.database && health.database.connected) {
          setServerStatus('online');
          setDbStatus('connected');
          const q = loadSyncQueue();
          if (q.length > 0) {
            syncWithBackend();
          }
        } else {
          setServerStatus('online');
          setDbStatus('disconnected');
        }
      } catch {
        setServerStatus('offline');
        setDbStatus('disconnected');
      }
    }, 25000);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      clearInterval(heartbeatInterval);
    };
  }, [syncWithBackend, showToast]);

  /**
   * Lokal ma'lumotlarni markaziy PostgreSQL bazasiga ko'chirish (Admin migratsiyasi)
   */
  const migrateLocalDataToPostgres = async () => {
    try {
      const payload = getLocalMigrationPayload();
      const res = await apiClient.importDataToPostgres(payload);

      // Yangi bazadan ma'lumotlarni qayta yuklaymiz
      await syncWithBackend();

      showToast('Lokal ma’lumotlar PostgreSQL markaziy bazasiga muvaffaqiyatli ko‘chirildi!', 'success');
      return {
        success: true,
        message: res.message || 'Muvaffaqiyatli ko‘chirildi',
        details: res,
      };
    } catch (err: any) {
      const msg = err.message || 'Migratsiyada xatolik yuz berdi';
      showToast(msg, 'error', 'Migratsiya xatosi');
      return { success: false, message: msg };
    }
  };

  /**
   * Lokal ma'lumotlarni JSON fayl sifatida yuklab olish
   */
  const downloadLocalBackup = () => {
    const success = downloadLocalBackupFile();
    if (success) {
      showToast('Lokal zaxira fayli kompyuteringizga yuklab olindi!', 'success');
    } else {
      showToast('Zaxirani yuklab olishda xatolik yuz berdi', 'error');
    }
    return success;
  };

  // --- XIZMATLAR ---
  const addService = (data: Omit<Service, 'id'>) => {
    const newService: Service = {
      ...data,
      id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      syncStatus: 'pending',
    };
    const updated = [newService, ...services];
    setServices(updated);
    saveServices(updated);

    apiClient
      .createService(newService)
      .then(() => {
        setServices((prev) => {
          const synced = prev.map((s) => (s.id === newService.id ? { ...s, syncStatus: 'synced' as SyncStatus } : s));
          saveServices(synced);
          return synced;
        });
        showToast(`"${newService.name}" xizmati markaziy bazaga saqlandi!`);
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'service',
          entityId: newService.id,
          action: 'create',
          data: newService,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast(
          `Aloqa yo‘q: "${newService.name}" xizmati qurilmada saqlandi. Aloqa tiklangach bazaga yuboriladi.`,
          'info',
          'Sinxronlash kutilmoqda'
        );
      });

    return true;
  };

  const updateService = (id: string, data: Partial<Service>) => {
    const updated = services.map((s) => (s.id === id ? { ...s, ...data, syncStatus: 'pending' as SyncStatus } : s));
    setServices(updated);
    saveServices(updated);

    apiClient
      .updateService(id, data)
      .then(() => {
        setServices((prev) => {
          const synced = prev.map((s) => (s.id === id ? { ...s, syncStatus: 'synced' as SyncStatus } : s));
          saveServices(synced);
          return synced;
        });
        showToast('Xizmat ma’lumotlari yangilandi!');
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'service',
          entityId: id,
          action: 'update',
          data,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast('Aloqa yo‘q: Xizmat o‘zgarishi qurilmada saqlandi (Sinxronlash kutilmoqda).', 'info');
      });

    return true;
  };

  const deleteService = (id: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    saveServices(updated);

    apiClient
      .deleteService(id)
      .then(() => {
        showToast('Xizmat o‘chirildi!', 'info');
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'service',
          entityId: id,
          action: 'delete',
          timestamp: Date.now(),
        });
        showToast('Xizmat o‘chirildi (Sinxronlash kutilmoqda)', 'info');
      });

    return true;
  };

  // --- SHIFOKORLAR ---
  const addDoctor = (data: Omit<Doctor, 'id'>) => {
    const newDoc: Doctor = {
      ...data,
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      syncStatus: 'pending',
    };
    const updated = [...doctors, newDoc];
    setDoctors(updated);
    saveDoctors(updated);

    apiClient
      .createDoctor(newDoc)
      .then(() => {
        setDoctors((prev) => {
          const synced = prev.map((d) => (d.id === newDoc.id ? { ...d, syncStatus: 'synced' as SyncStatus } : d));
          saveDoctors(synced);
          return synced;
        });
        showToast(`"${newDoc.fullName}" shifokorlar safiga qo‘shildi!`);
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'doctor',
          entityId: newDoc.id,
          action: 'create',
          data: newDoc,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast(
          `Aloqa yo‘q: "${newDoc.fullName}" qurilmada saqlandi. Aloqa tiklangach bazaga yuboriladi.`,
          'info',
          'Sinxronlash kutilmoqda'
        );
      });

    return true;
  };

  const updateDoctor = (id: string, data: Partial<Doctor>) => {
    const updated = doctors.map((d) => (d.id === id ? { ...d, ...data, syncStatus: 'pending' as SyncStatus } : d));
    setDoctors(updated);
    saveDoctors(updated);

    apiClient
      .updateDoctor(id, data)
      .then(() => {
        setDoctors((prev) => {
          const synced = prev.map((d) => (d.id === id ? { ...d, syncStatus: 'synced' as SyncStatus } : d));
          saveDoctors(synced);
          return synced;
        });
        showToast('Shifokor ma’lumotlari saqlandi!');
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'doctor',
          entityId: id,
          action: 'update',
          data,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast('Aloqa yo‘q: Shifokor o‘zgarishi qurilmada saqlandi (Sinxronlash kutilmoqda).', 'info');
      });

    return true;
  };

  const deleteDoctor = (id: string) => {
    const updated = doctors.filter((d) => d.id !== id);
    setDoctors(updated);
    saveDoctors(updated);

    apiClient
      .deleteDoctor(id)
      .then(() => {
        showToast('Shifokor ro‘yxatdan o‘chirildi!', 'info');
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'doctor',
          entityId: id,
          action: 'delete',
          timestamp: Date.now(),
        });
        showToast('Shifokor o‘chirildi (Sinxronlash kutilmoqda)', 'info');
      });

    return true;
  };

  // --- BEMORLAR ---
  const addPatient = (data: Omit<Patient, 'id' | 'totalVisits' | 'createdAt'>): Patient => {
    const normalizedPhone = data.phone ? formatUzbekPhoneNumber(data.phone) : '';

    // Telefon takroriyligini tekshirish (faqat telefon raqam kiritilgan bo'lsa)
    if (normalizedPhone) {
      const existingWithSamePhone = patients.find((p) => arePhoneNumbersEqual(p.phone, normalizedPhone));
      if (existingWithSamePhone) {
        showToast(
          `Ushbu telefon raqam (${normalizedPhone}) bilan "${existingWithSamePhone.fullName}" allaqachon mavjud!`,
          'error',
          'Bemor allaqachon ro‘yxatda mavjud'
        );
        return existingWithSamePhone;
      }
    }

    const newPat: Patient = {
      ...data,
      phone: normalizedPhone || data.phone || '',
      id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      totalVisits: 0,
      createdAt: new Date().toISOString().split('T')[0],
      debt: data.debt || 0,
      syncStatus: 'pending',
    };

    setPatients((prev) => {
      const updated = [newPat, ...prev];
      savePatients(updated);
      return updated;
    });

    apiClient
      .createPatient(newPat)
      .then((serverPat) => {
        setPatients((prev) => {
          const synced = prev.map((p) =>
            p.id === newPat.id ? { ...(serverPat || p), syncStatus: 'synced' as SyncStatus } : p
          );
          savePatients(synced);
          return synced;
        });
        showToast(`Bemor "${newPat.fullName}" markaziy bazaga saqlandi!`);
      })
      .catch((err) => {
        // MUHIM: Tarmoq uzilganda ma'lumotni HECH QACHON O'CHIRMAYMIZ!
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'patient',
          entityId: newPat.id,
          action: 'create',
          data: newPat,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast(
          `Aloqa yo‘q: Bemor "${newPat.fullName}" qurilmada saqlandi. Aloqa tiklanganda markaziy bazaga avtomatik yuboriladi.`,
          'info',
          'Sinxronlash kutilmoqda'
        );
      });

    return newPat;
  };

  const updatePatient = (id: string, data: Partial<Patient>) => {
    let normData = { ...data };
    if (data.phone) {
      normData.phone = formatUzbekPhoneNumber(data.phone);
      // Telefon dublikati tekshirish (o'zidan boshqa bemorlar bilan)
      const existing = patients.find((p) => p.id !== id && arePhoneNumbersEqual(p.phone, normData.phone));
      if (existing) {
        showToast(
          `Ushbu telefon (${normData.phone}) bilan boshqa bemor ("${existing.fullName}") mavjud!`,
          'error',
          'Telefon raqam band'
        );
        return false;
      }
    }

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...normData, syncStatus: 'pending' as SyncStatus } : p));
      savePatients(updated);
      return updated;
    });

    apiClient
      .updatePatient(id, normData)
      .then((serverPat) => {
        setPatients((prev) => {
          const synced = prev.map((p) => (p.id === id ? { ...(serverPat || p), syncStatus: 'synced' as SyncStatus } : p));
          savePatients(synced);
          return synced;
        });
        showToast('Bemor ma’lumotlari muvaffaqiyatli yangilandi!');
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'patient',
          entityId: id,
          action: 'update',
          data: normData,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast('Aloqa yo‘q: Bemor o‘zgarishi qurilmada saqlandi (Sinxronlash kutilmoqda).', 'info');
      });

    return true;
  };

  const deletePatient = (id: string) => {
    setPatients((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePatients(updated);
      return updated;
    });

    apiClient
      .deletePatient(id)
      .then(() => {
        showToast('Bemor o‘chirildi!', 'info');
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'patient',
          entityId: id,
          action: 'delete',
          timestamp: Date.now(),
        });
        showToast('Bemor o‘chirildi (Sinxronlash kutilmoqda)', 'info');
      });

    return true;
  };

  // --- QABULLAR (CONFLICT CHECK BILAN) ---
  const checkDoctorConflict = (
    doctorId: string,
    date: string,
    time: string,
    excludeAppointmentId?: string
  ): boolean => {
    return appointments.some((apt) => {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;
      if (apt.doctorId !== doctorId) return false;
      if (apt.date !== date) return false;
      if (apt.status === 'Bekor qilindi') return false;
      return apt.time === time;
    });
  };

  const addAppointment = (data: Omit<Appointment, 'id' | 'createdAt' | 'paidAmount'>): { success: boolean; error?: string } => {
    // 1. Shifokor bandligi lokal tekshiruvi
    if (checkDoctorConflict(data.doctorId, data.date, data.time)) {
      showToast(
        `Xatolik: Shifokor tanlangan vaqtda (${data.time}) allaqachon boshqa qabulda band!`,
        'error',
        'Vaqt to‘qnashuvi'
      );
      return {
        success: false,
        error: `Tanlangan shifokor ushbu vaqtda (${data.time}) band. Iltimos, boshqa vaqtni tanlang.`,
      };
    }

    const newApt: Appointment = {
      ...data,
      id: `apt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      paidAmount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      syncStatus: 'pending',
    };

    // 2. Lokal holatni zudlik bilan yangilash
    setAppointments((prev) => {
      const updated = [newApt, ...prev];
      saveAppointments(updated);
      return updated;
    });

    setPatients((prev) => {
      const pUpdated = prev.map((p) => {
        if (p.id === data.patientId) {
          return {
            ...p,
            totalVisits: p.totalVisits + 1,
            lastVisitDate: data.date,
          };
        }
        return p;
      });
      savePatients(pUpdated);
      return pUpdated;
    });

    // Qabul "Yakunlandi" holatida bo'lsa, to'lov shakllantirish
    if (newApt.status === 'Yakunlandi') {
      const price = newApt.servicePrice || 0;
      const randReceiptNum = `CH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newPay: Payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        appointmentId: newApt.id,
        patientId: newApt.patientId,
        patientName: newApt.patientName,
        doctorId: newApt.doctorId,
        doctorName: newApt.doctorName,
        serviceName: newApt.serviceName,
        totalAmount: price,
        paidAmount: 0,
        debtAmount: price,
        paymentMethod: 'Naqd',
        status: 'To‘lash kerak',
        date: newApt.date,
        time: newApt.time,
        receiptNumber: randReceiptNum,
        notes: `Qabul yakunlandi (${newApt.date} ${newApt.time})`,
        syncStatus: 'pending',
      };

      setPayments((prev) => {
        const pList = [newPay, ...prev];
        savePayments(pList);
        return pList;
      });

      if (price > 0) {
        setPatients((prev) => {
          const pUpdated = prev.map((p) =>
            p.id === newApt.patientId ? { ...p, debt: Math.round((p.debt || 0) + price) } : p
          );
          savePatients(pUpdated);
          return pUpdated;
        });
      }
    }

    // 3. Backend API ga asinxron yuborish
    apiClient
      .createAppointment(newApt)
      .then((serverApt) => {
        setAppointments((prev) => {
          const synced = prev.map((a) =>
            a.id === newApt.id ? { ...(serverApt || a), syncStatus: 'synced' as SyncStatus } : a
          );
          saveAppointments(synced);
          return synced;
        });
        if (newApt.status === 'Yakunlandi') {
          syncWithBackend();
        }
        showToast(`Qabul markaziy bazaga saqlandi! (${data.date} ${data.time})`);
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'appointment',
          entityId: newApt.id,
          action: 'create',
          data: newApt,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast(
          `Aloqa yo‘q: Qabul qurilmada saqlandi. Aloqa tiklanganda markaziy bazaga yuboriladi.`,
          'info',
          'Sinxronlash kutilmoqda'
        );
      });

    return { success: true };
  };

  const updateAppointment = (id: string, data: Partial<Appointment>): { success: boolean; error?: string } => {
    const current = appointments.find((a) => a.id === id);
    if (!current) return { success: false, error: 'Qabul topilmadi' };

    const targetDoctorId = data.doctorId || current.doctorId;
    const targetDate = data.date || current.date;
    const targetTime = data.time || current.time;

    if (
      (data.time && data.time !== current.time) ||
      (data.date && data.date !== current.date) ||
      (data.doctorId && data.doctorId !== current.doctorId)
    ) {
      if (checkDoctorConflict(targetDoctorId, targetDate, targetTime, id)) {
        showToast(
          `Xatolik: Shifokor ushbu vaqtda (${targetTime}) boshqa qabulda band!`,
          'error',
          'Vaqt to‘qnashuvi'
        );
        return {
          success: false,
          error: `Shifokor ${targetTime} vaqtida band.`,
        };
      }
    }

    const mergedApt: Appointment = { ...current, ...data, syncStatus: 'pending' as SyncStatus };
    const updated = appointments.map((a) => (a.id === id ? mergedApt : a));
    setAppointments(updated);
    saveAppointments(updated);

    // Backend API ga yuborish
    apiClient
      .updateAppointment(id, data)
      .then((serverApt) => {
        setAppointments((prev) => {
          const synced = prev.map((a) =>
            a.id === id ? { ...(serverApt || a), syncStatus: 'synced' as SyncStatus } : a
          );
          saveAppointments(synced);
          return synced;
        });
        if (mergedApt.status === 'Yakunlandi') {
          syncWithBackend();
        }
        showToast('Qabul ma’lumotlari yangilandi!');
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'appointment',
          entityId: id,
          action: 'update',
          data,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast('Aloqa yo‘q: Qabul o‘zgarishi qurilmada saqlandi (Sinxronlash kutilmoqda).', 'info');
      });

    return { success: true };
  };

  const cancelAppointment = (id: string, reason?: string) => {
    const res = updateAppointment(id, {
      status: 'Bekor qilindi',
      notes: reason ? `[Bekor sababi: ${reason}]` : undefined,
    });
    return res.success;
  };

  const deleteAppointment = (id: string) => {
    setAppointments((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      saveAppointments(updated);
      return updated;
    });

    apiClient
      .deleteAppointment(id)
      .then(() => {
        showToast('Qabul o‘chirildi!', 'info');
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'appointment',
          entityId: id,
          action: 'delete',
          timestamp: Date.now(),
        });
        showToast('Qabul o‘chirildi (Sinxronlash kutilmoqda)', 'info');
      });

    return true;
  };

  // --- TO'LOVLAR ---
  const addPayment = (data: Omit<Payment, 'id' | 'receiptNumber'>): Payment => {
    const randReceiptNum = `CH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalStatus: PaymentStatus =
      data.status || (data.debtAmount === 0 ? 'To‘landi' : 'Qisman to‘langan');

    const newPay: Payment = {
      ...data,
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: finalStatus,
      receiptNumber: randReceiptNum,
      syncStatus: 'pending',
    };

    setPayments((prev) => {
      const updated = [newPay, ...prev];
      savePayments(updated);
      return updated;
    });

    // Bemorning qarzini yangilash
    setPatients((prev) => {
      const pats = prev.map((p) => {
        if (p.id === data.patientId) {
          const newDebt = Math.max(0, Math.round((p.debt || 0) + data.debtAmount));
          return { ...p, debt: newDebt };
        }
        return p;
      });
      savePatients(pats);
      return pats;
    });

    // Backend API ga yuborish
    apiClient
      .createPayment(newPay)
      .then((serverPay) => {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === newPay.id ? { ...(serverPay || p), syncStatus: 'synced' as SyncStatus } : p
          )
        );
        showToast(`To‘lov qabul qilindi! Chek: ${newPay.receiptNumber}`);
      })
      .catch((err) => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'payment',
          entityId: newPay.id,
          action: 'create',
          data: newPay,
          timestamp: Date.now(),
        });
        setDbStatus('disconnected');
        showToast(
          `Aloqa yo‘q: To‘lov qurilmada saqlandi. Aloqa tiklanganda markaziy bazaga yuboriladi.`,
          'info',
          'Sinxronlash kutilmoqda'
        );
      });

    return newPay;
  };

  const updatePayment = (id: string, data: Partial<Payment>) => {
    const current = payments.find((p) => p.id === id);
    if (!current) return false;

    const mergedPay: Payment = { ...current, ...data, syncStatus: 'pending' as SyncStatus };
    setPayments((prev) => {
      const updated = prev.map((p) => (p.id === id ? mergedPay : p));
      savePayments(updated);
      return updated;
    });

    apiClient
      .createPayment(mergedPay)
      .then((serverPay) => {
        setPayments((prev) =>
          prev.map((p) => (p.id === id ? { ...(serverPay || p), syncStatus: 'synced' as SyncStatus } : p))
        );
        showToast('To‘lov ma’lumotlari saqlandi!');
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'payment',
          entityId: id,
          action: 'update',
          data: mergedPay,
          timestamp: Date.now(),
        });
        showToast('To‘lov o‘zgarishi saqlandi (Sinxronlash kutilmoqda)', 'info');
      });

    return true;
  };

  const completePayment = (paymentId: string, paymentMethod: PaymentMethod = 'Naqd') => {
    const target = payments.find((p) => p.id === paymentId);
    if (!target) return false;

    const remainingDebt = target.debtAmount > 0 ? target.debtAmount : target.totalAmount - target.paidAmount;

    setPayments((prev) => {
      const updatedPayments = prev.map((p) => {
        if (p.id === paymentId) {
          return {
            ...p,
            status: 'To‘landi' as PaymentStatus,
            paidAmount: p.totalAmount,
            debtAmount: 0,
            paymentMethod: paymentMethod || p.paymentMethod || 'Naqd',
            syncStatus: 'pending' as SyncStatus,
          };
        }
        return p;
      });
      savePayments(updatedPayments);
      return updatedPayments;
    });

    if (remainingDebt > 0) {
      setPatients((prev) => {
        const pats = prev.map((p) => {
          if (p.id === target.patientId) {
            return { ...p, debt: Math.max(0, Math.round((p.debt || 0) - remainingDebt)) };
          }
          return p;
        });
        savePatients(pats);
        return pats;
      });
    }

    apiClient
      .completePayment(paymentId, paymentMethod)
      .then(() => {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, syncStatus: 'synced' as SyncStatus } : p))
        );
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'payment',
          entityId: paymentId,
          action: 'update',
          data: { status: 'To‘landi', paidAmount: target.totalAmount, debtAmount: 0, paymentMethod },
          timestamp: Date.now(),
        });
      });

    showToast(`To‘lov muvaffaqiyatli amalga oshirildi! Holati: "To‘landi"`, 'success');
    return true;
  };

  const refundPayment = (id: string) => {
    const target = payments.find((p) => p.id === id);
    if (!target) return false;

    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, status: 'Qaytarilgan' as const, syncStatus: 'pending' as SyncStatus } : p
      );
      savePayments(updated);
      return updated;
    });

    apiClient
      .refundPayment(id)
      .then(() => {
        setPayments((prev) =>
          prev.map((p) => (p.id === id ? { ...p, syncStatus: 'synced' as SyncStatus } : p))
        );
      })
      .catch(() => {
        enqueueSyncItem({
          id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entity: 'payment',
          entityId: id,
          action: 'update',
          data: { status: 'Qaytarilgan' },
          timestamp: Date.now(),
        });
      });

    showToast(`To‘lov bekor qilinib, ${target.paidAmount} so‘m qaytarildi!`, 'info');
    return true;
  };

  // --- SOZLAMALAR ---
  const updateSettings = (newSettings: Partial<ClinicSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);

    apiClient.updateSettings(updated).catch(() => {});
    showToast('Klinika sozlamalari muvaffaqiyatli saqlandi!');
  };

  const resetAllData = () => {
    const reset = resetAllDataToDefault();
    setServices(reset.services);
    setDoctors(reset.doctors);
    setPatients(reset.patients);
    setAppointments(reset.appointments);
    setPayments(reset.payments);
    setSettings(reset.settings);
    showToast('Barcha demo ma’lumotlar boshlang‘ich holatga qaytarildi!', 'info');
  };

  const cleanAllTestData = async (): Promise<boolean> => {
    try {
      // 1. Backend PostgreSQL bazasidan tozalash
      try {
        await apiClient.cleanTestData();
      } catch (err: any) {
        console.warn('Backend tozalashda xatolik:', err?.message || err);
      }

      // 2. Lokal xotira va state'ni 0 ga tushirish
      clearClientTransactions();
      setPatients([]);
      setAppointments([]);
      setPayments([]);
      setPendingSyncCount(0);

      showToast(
        'Barcha test bemorlar, qabullar va to‘lovlar tozalandi! Tizim yangi klinika uchun tayyor.',
        'success'
      );
      return true;
    } catch (err: any) {
      showToast('Tozalashda xatolik: ' + (err?.message || 'Noma’lum xatolik'), 'error');
      return false;
    }
  };

  // --- AUTH ---
  const logout = () => {
    setCurrentUser(null);
    saveStoredCurrentUser(null);
    showToast('Tizimdan muvaffaqiyatli chiqdingiz', 'info');
  };

  const login = (user: CurrentUser) => {
    setCurrentUser(user);
    saveStoredCurrentUser(user);
    setCurrentTab('dashboard');
    showToast(`Xush kelibsiz, ${user.name}! (${user.role})`);
  };

  const updateCurrentUser = (updates: Partial<CurrentUser>) => {
    if (!currentUser) return;
    const nextName = updates.name !== undefined ? updates.name.trim() : currentUser.name;
    const nextAvatar = nextName ? generateAvatarInitials(nextName) : (updates.avatar || currentUser.avatar);
    const updated: CurrentUser = {
      ...currentUser,
      ...updates,
      name: nextName,
      avatar: nextAvatar,
    };
    setCurrentUser(updated);
    saveStoredCurrentUser(updated);
    updateStaffMember(updated.id, {
      name: updated.name,
      avatar: nextAvatar,
      pin: updated.pin,
      title: updated.title,
    });
    const remembered = getRememberedStaff();
    if (remembered && (remembered.id === updated.id || remembered.role === 'Menejer')) {
      setRememberedStaff({
        ...remembered,
        name: updated.name,
        avatar: nextAvatar,
        pin: updated.pin || remembered.pin,
      });
    }

    // Backend PostgreSQL ga ham yangilanishni yuborish
    apiClient.updateStaff(updated.id, {
      name: updated.name,
      avatar: nextAvatar,
      title: updated.title,
      pin: updated.pin,
    }).catch(() => {});

    if (updated.pin) {
      apiClient.updatePin(updated.id, updated.pin).catch(() => {});
    }

    showToast('Profil ma’lumotlari muvaffaqiyatli yangilandi!');
  };

  return (
    <AppContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        searchQuery,
        setSearchQuery,
        serverStatus,
        dbStatus,
        lastSyncError,
        isSyncing,
        pendingSyncCount,
        syncWithBackend,
        migrateLocalDataToPostgres,
        downloadLocalBackup,
        services,
        doctors,
        patients,
        appointments,
        payments,
        settings,
        addService,
        updateService,
        deleteService,
        addDoctor,
        updateDoctor,
        deleteDoctor,
        addPatient,
        updatePatient,
        deletePatient,
        addAppointment,
        updateAppointment,
        cancelAppointment,
        deleteAppointment,
        addPayment,
        updatePayment,
        completePayment,
        refundPayment,
        updateSettings,
        resetAllData,
        cleanAllTestData,
        toasts,
        showToast,
        dismissToast,
        currentUser,
        logout,
        login,
        updateCurrentUser,
        filterPreset,
        setFilterPreset,
        filterStartDate,
        setFilterStartDate,
        filterEndDate,
        setFilterEndDate,
        filterDoctorId,
        setFilterDoctorId,
        applyDatePreset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
