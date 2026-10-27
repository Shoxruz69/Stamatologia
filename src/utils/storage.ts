import {
  Service,
  Doctor,
  Patient,
  Appointment,
  Payment,
  ClinicSettings,
} from '../types';
import {
  INITIAL_SERVICES,
  INITIAL_DOCTORS,
  INITIAL_PATIENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_PAYMENTS,
  INITIAL_SETTINGS,
} from './mockData';

export const STORAGE_KEYS = {
  SERVICES: 'dentacare_services_v3',
  DOCTORS: 'dentacare_doctors_v3',
  PATIENTS: 'dentacare_patients_v3',
  APPOINTMENTS: 'dentacare_appointments_v3',
  PAYMENTS: 'dentacare_payments_v3',
  SETTINGS: 'dentacare_settings_v3',
  STAFF: 'dentacare_staff_members_v3',
  SYNC_QUEUE: 'dentacare_sync_queue_v1',
};

export interface SyncQueueItem {
  id: string; // queue item ID
  entity: 'patient' | 'appointment' | 'payment' | 'doctor' | 'service';
  action: 'create' | 'update' | 'delete';
  entityId: string;
  data: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export const loadSyncQueue = (): SyncQueueItem[] => safeGetItem<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
export const saveSyncQueue = (queue: SyncQueueItem[]) => safeSetItem(STORAGE_KEYS.SYNC_QUEUE, queue);

// Xavfsiz tarzda localStorage dan o'qish va ma'lumotlarni tiklash/birlashtirish
export function safeGetItem<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(key);
      if (data) {
        return JSON.parse(data) as T;
      } else {
        if (fallback !== undefined) {
          window.localStorage.setItem(key, JSON.stringify(fallback));
        }
      }
    }
  } catch (err) {
    console.warn(`localStorage "${key}" o‘qishda xatolik:`, err);
  }
  return fallback;
}

// Xavfsiz tarzda localStorage ga kesh sifatida yozish
export function safeSetItem<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`localStorage "${key}" yozishda xatolik:`, err);
  }
}

export const loadInitialAppData = () => {
  return {
    services: safeGetItem<Service[]>(STORAGE_KEYS.SERVICES, INITIAL_SERVICES),
    doctors: safeGetItem<Doctor[]>(STORAGE_KEYS.DOCTORS, INITIAL_DOCTORS),
    patients: safeGetItem<Patient[]>(STORAGE_KEYS.PATIENTS, INITIAL_PATIENTS),
    appointments: safeGetItem<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS),
    payments: safeGetItem<Payment[]>(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS),
    settings: safeGetItem<ClinicSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS),
  };
};

export const saveServices = (services: Service[]) => safeSetItem(STORAGE_KEYS.SERVICES, services);
export const saveDoctors = (doctors: Doctor[]) => safeSetItem(STORAGE_KEYS.DOCTORS, doctors);
export const savePatients = (patients: Patient[]) => safeSetItem(STORAGE_KEYS.PATIENTS, patients);
export const saveAppointments = (appointments: Appointment[]) =>
  safeSetItem(STORAGE_KEYS.APPOINTMENTS, appointments);
export const savePayments = (payments: Payment[]) => safeSetItem(STORAGE_KEYS.PAYMENTS, payments);
export const saveSettings = (settings: ClinicSettings) => safeSetItem(STORAGE_KEYS.SETTINGS, settings);

export const resetAllDataToDefault = () => {
  saveServices(INITIAL_SERVICES);
  saveDoctors(INITIAL_DOCTORS);
  savePatients(INITIAL_PATIENTS);
  saveAppointments(INITIAL_APPOINTMENTS);
  savePayments(INITIAL_PAYMENTS);
  saveSettings(INITIAL_SETTINGS);
  return {
    services: INITIAL_SERVICES,
    doctors: INITIAL_DOCTORS,
    patients: INITIAL_PATIENTS,
    appointments: INITIAL_APPOINTMENTS,
    payments: INITIAL_PAYMENTS,
    settings: INITIAL_SETTINGS,
  };
};

/**
 * -------------------------------------------------------------
 * MAVJUD LOKAL MA'LUMOTLARNI ZAXIRALASH VA MIGRATSIYA FUNKSIYALARI
 * -------------------------------------------------------------
 */

export interface LocalBackupData {
  exportedAt: string;
  source: 'browser_local_storage';
  version: '1.0.0';
  stats: {
    patientsCount: number;
    appointmentsCount: number;
    paymentsCount: number;
    doctorsCount: number;
    servicesCount: number;
    totalDebt: number;
  };
  patients: Patient[];
  appointments: Appointment[];
  payments: Payment[];
  doctors: Doctor[];
  services: Service[];
  settings: ClinicSettings;
}

/**
 * Brauzerning localStorage xotirasidagi barcha mavjud ma'lumotlarni yig'ib olish
 */
export const getLocalMigrationPayload = (): LocalBackupData => {
  const data = loadInitialAppData();
  const totalDebt = (data.patients || []).reduce((sum, p) => sum + (p.debt || 0), 0);

  return {
    exportedAt: new Date().toISOString(),
    source: 'browser_local_storage',
    version: '1.0.0',
    stats: {
      patientsCount: (data.patients || []).length,
      appointmentsCount: (data.appointments || []).length,
      paymentsCount: (data.payments || []).length,
      doctorsCount: (data.doctors || []).length,
      servicesCount: (data.services || []).length,
      totalDebt,
    },
    patients: data.patients || [],
    appointments: data.appointments || [],
    payments: data.payments || [],
    doctors: data.doctors || [],
    services: data.services || [],
    settings: data.settings || INITIAL_SETTINGS,
  };
};

/**
 * Lokal ma'lumotlarni kompyuter/planshetga .json fayl sifatida yuklab olish (Download JSON Backup)
 */
export const downloadLocalBackupFile = (): boolean => {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    const payload = getLocalMigrationPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `DentaCare_lokal_zaxira_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Zaxira faylini yuklab olishda xatolik:', err);
    return false;
  }
};
