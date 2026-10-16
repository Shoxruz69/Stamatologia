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
  getLocalMigrationPayload,
  downloadLocalBackupFile,
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
import { getPresetDates } from '../utils/formatters';
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
      // 1. Tizim va Baza salomatligini tekshirish
      const health = await apiClient.checkHealth();
      setServerStatus('online');

      if (health.database && health.database.connected) {
        setDbStatus('connected');

        // 2. Markaziy PostgreSQL bazasidan ma'lumotlarni yuklab olish
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

        if (Array.isArray(serverPatients)) {
          setPatients(serverPatients);
          savePatients(serverPatients);
        }

        if (Array.isArray(serverAppointments)) {
          setAppointments(serverAppointments);
          saveAppointments(serverAppointments);
        }

        if (Array.isArray(serverPayments)) {
          setPayments(serverPayments);
          savePayments(serverPayments);
        }

        if (Array.isArray(serverDoctors)) {
          setDoctors(serverDoctors);
          saveDoctors(serverDoctors);
        }

        if (Array.isArray(serverServices)) {
          setServices(serverServices);
          saveServices(serverServices);
        }

        if (serverSettings) {
          setSettings(serverSettings);
          saveSettings(serverSettings);
        }

        if (Array.isArray(serverStaff)) {
          saveStaffMembersToStorage(serverStaff);
        }
      } else {
        setDbStatus('disconnected');
        const dbErr =
          (health.database && health.database.lastError) ||
          'PostgreSQL ma’lumotlar bazasiga ulanib bo‘lmadi. Server/Docker sozlamalarini tekshiring.';
        setLastSyncError(dbErr);
      }
    } catch (err: any) {
      setServerStatus('offline');
      setDbStatus('disconnected');
      const msg = `Backend serverga (${apiClient.getBaseUrl()}) ulanib bo‘lmadi. LAN yoki server holatini tekshiring.`;
      setLastSyncError(msg);
      // Hech qachon mavjud ma'lumotlarni o'chirmaymiz; offline kesh saqlanadi
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Ilova ochilganda birinchi tekshirish
  useEffect(() => {
    syncWithBackend();
  }, [syncWithBackend]);

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
      id: `srv-${Date.now()}`,
    };
    const updated = [newService, ...services];
    setServices(updated);
    saveServices(updated);

    apiClient
      .createService(newService)
      .then(() => {
        showToast(`"${newService.name}" xizmati markaziy bazaga saqlandi!`);
      })
      .catch((err) => {
        setServices((prev) => {
          const reverted = prev.filter((s) => s.id !== newService.id);
          saveServices(reverted);
          return reverted;
        });
        showToast(
          `Xatolik: Server yoki PostgreSQL bazasiga ulanib bo‘lmadi (${err.message}). Xizmat bazaga saqlanmadi!`,
          'error',
          'Bazaga saqlanmadi'
        );
      });

    return true;
  };

  const updateService = (id: string, data: Partial<Service>) => {
    const updated = services.map((s) => (s.id === id ? { ...s, ...data } : s));
    setServices(updated);
    saveServices(updated);

    apiClient
      .updateService(id, data)
      .catch((err) => {
        showToast(`Xatolik: Xizmat yangilanishi bazaga saqlanmadi (${err.message})`, 'error');
      });
    showToast('Xizmat ma’lumotlari yangilandi!');
    return true;
  };

  const deleteService = (id: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    saveServices(updated);

    apiClient
      .deleteService(id)
      .catch((err) => {
        showToast(`Xatolik: Xizmat bazadan o‘chirilmadi (${err.message})`, 'error');
      });
    showToast('Xizmat o‘chirildi!', 'info');
    return true;
  };

  // --- SHIFOKORLAR ---
  const addDoctor = (data: Omit<Doctor, 'id'>) => {
    const newDoc: Doctor = {
      ...data,
      id: `doc-${Date.now()}`,
    };
    const updated = [...doctors, newDoc];
    setDoctors(updated);
    saveDoctors(updated);

    apiClient
      .createDoctor(newDoc)
      .then(() => {
        showToast(`"${newDoc.fullName}" shifokorlar safiga qo‘shildi!`);
      })
      .catch((err) => {
        setDoctors((prev) => {
          const reverted = prev.filter((d) => d.id !== newDoc.id);
          saveDoctors(reverted);
          return reverted;
        });
        showToast(
          `Xatolik: Server yoki PostgreSQL bazasiga ulanib bo‘lmadi (${err.message}). Shifokor bazaga saqlanmadi!`,
          'error',
          'Bazaga saqlanmadi'
        );
      });

    return true;
  };

  const updateDoctor = (id: string, data: Partial<Doctor>) => {
    const updated = doctors.map((d) => (d.id === id ? { ...d, ...data } : d));
    setDoctors(updated);
    saveDoctors(updated);

    apiClient
      .updateDoctor(id, data)
      .catch((err) => {
        showToast(`Xatolik: Shifokor ma'lumoti bazaga saqlanmadi (${err.message})`, 'error');
      });
    showToast('Shifokor ma’lumotlari saqlandi!');
    return true;
  };

  const deleteDoctor = (id: string) => {
    const updated = doctors.filter((d) => d.id !== id);
    setDoctors(updated);
    saveDoctors(updated);

    apiClient
      .deleteDoctor(id)
      .catch((err) => {
        showToast(`Xatolik: Shifokor bazadan o‘chirilmadi (${err.message})`, 'error');
      });
    showToast('Shifokor ro‘yxatdan o‘chirildi!', 'info');
    return true;
  };

  // --- BEMORLAR ---
  const addPatient = (data: Omit<Patient, 'id' | 'totalVisits' | 'createdAt'>): Patient => {
    const newPat: Patient = {
      ...data,
      id: `pat-${Date.now()}`,
      totalVisits: 0,
      createdAt: new Date().toISOString().split('T')[0],
      debt: data.debt || 0,
    };

    setPatients((prev) => {
      const updated = [newPat, ...prev];
      savePatients(updated);
      return updated;
    });

    apiClient
      .createPatient(newPat)
      .then((serverPat) => {
        if (serverPat && serverPat.id) {
          setPatients((prev) => {
            const synced = prev.map((p) => (p.id === newPat.id ? serverPat : p));
            savePatients(synced);
            return synced;
          });
        }
        showToast(`Bemor "${newPat.fullName}" markaziy bazaga kiritildi!`);
      })
      .catch((err) => {
        setPatients((prev) => {
          const reverted = prev.filter((p) => p.id !== newPat.id);
          savePatients(reverted);
          return reverted;
        });
        showToast(
          `Xatolik: Server yoki PostgreSQL bazasiga ulanib bo‘lmadi (${err.message}). Bemor markaziy bazaga saqlanmadi!`,
          'error',
          'Bazaga saqlanmadi'
        );
      });

    return newPat;
  };

  const updatePatient = (id: string, data: Partial<Patient>) => {
    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
      savePatients(updated);
      return updated;
    });

    apiClient
      .updatePatient(id, data)
      .catch((err) => {
        showToast(`Xatolik: Bemor ma'lumotlari bazaga saqlanmadi (${err.message})`, 'error');
      });
    showToast('Bemor ma’lumotlari muvaffaqiyatli yangilandi!');
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
      .catch((err) => {
        showToast(`Xatolik: Bemor bazadan o‘chirilmadi (${err.message})`, 'error');
      });
    showToast('Bemor o‘chirildi!', 'info');
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
      id: `apt-${Date.now()}`,
      paidAmount: 0,
      createdAt: new Date().toISOString().split('T')[0],
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
        id: `pay-${Date.now()}`,
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
        if (serverApt && newApt.status === 'Yakunlandi') {
          syncWithBackend();
        }
        showToast(`Qabul markaziy bazaga rejalashtirildi! (${data.date} ${data.time})`);
      })
      .catch((err) => {
        setAppointments((prev) => {
          const reverted = prev.filter((a) => a.id !== newApt.id);
          saveAppointments(reverted);
          return reverted;
        });
        showToast(
          `Xatolik: Qabul markaziy PostgreSQL bazasiga saqlanmadi (${err.message}).`,
          'error',
          'Bazaga saqlanmadi'
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

    const mergedApt: Appointment = { ...current, ...data };
    const updated = appointments.map((a) => (a.id === id ? mergedApt : a));
    setAppointments(updated);
    saveAppointments(updated);

    // Backend API ga yuborish
    apiClient
      .updateAppointment(id, data)
      .then(() => {
        if (mergedApt.status === 'Yakunlandi') {
          syncWithBackend();
        }
      })
      .catch((err) => {
        showToast(`Xatolik: Qabul o‘zgarishi bazaga saqlanmadi (${err.message})`, 'error');
      });

    showToast('Qabul ma’lumotlari yangilandi!');
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
      .catch((err) => {
        showToast(`Xatolik: Qabul bazadan o‘chirilmadi (${err.message})`, 'error');
      });
    showToast('Qabul o‘chirildi!', 'info');
    return true;
  };

  // --- TO'LOVLAR ---
  const addPayment = (data: Omit<Payment, 'id' | 'receiptNumber'>): Payment => {
    const randReceiptNum = `CH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalStatus: PaymentStatus =
      data.status || (data.debtAmount === 0 ? 'To‘landi' : 'Qisman to‘langan');

    const newPay: Payment = {
      ...data,
      id: `pay-${Date.now()}`,
      status: finalStatus,
      receiptNumber: randReceiptNum,
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
        if (serverPay && serverPay.id) {
          setPayments((prev) => prev.map((p) => (p.id === newPay.id ? serverPay : p)));
        }
        showToast(`To‘lov qabul qilindi! Chek: ${newPay.receiptNumber}`);
      })
      .catch((err) => {
        setPayments((prev) => {
          const reverted = prev.filter((p) => p.id !== newPay.id);
          savePayments(reverted);
          return reverted;
        });
        setPatients((prev) => {
          const pats = prev.map((p) => {
            if (p.id === data.patientId) {
              const origDebt = Math.max(0, Math.round((p.debt || 0) - (data.debtAmount || 0)));
              return { ...p, debt: origDebt };
            }
            return p;
          });
          savePatients(pats);
          return pats;
        });
        showToast(
          `Xatolik: To‘lov markaziy PostgreSQL bazasiga saqlanmadi (${err.message}).`,
          'error',
          'Bazaga saqlanmadi'
        );
      });

    return newPay;
  };

  const updatePayment = (id: string, data: Partial<Payment>) => {
    const current = payments.find((p) => p.id === id);
    if (!current) return false;

    const mergedPay: Payment = { ...current, ...data };
    setPayments((prev) => {
      const updated = prev.map((p) => (p.id === id ? mergedPay : p));
      savePayments(updated);
      return updated;
    });

    apiClient.createPayment(mergedPay).catch(() => {});
    showToast('To‘lov ma’lumotlari saqlandi!');
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

    apiClient.completePayment(paymentId, paymentMethod).catch(() => {});
    showToast(`To‘lov muvaffaqiyatli amalga oshirildi! Holati: "To‘landi"`, 'success');
    return true;
  };

  const refundPayment = (id: string) => {
    const target = payments.find((p) => p.id === id);
    if (!target) return false;

    setPayments((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, status: 'Qaytarilgan' as const } : p
      );
      savePayments(updated);
      return updated;
    });

    apiClient.refundPayment(id).catch(() => {});
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
