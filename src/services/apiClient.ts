import {
  Patient,
  Doctor,
  Service,
  Appointment,
  Payment,
  ClinicSettings,
  StaffMember,
  CurrentUser,
  PaymentMethod,
} from '../types';

/**
 * Backend API bazaviy manzilini aniqlash.
 * - Production (Render / Bulut): Hech qachon localhost'ga murojaat qilinmaydi.
 *   Agar EXPO_PUBLIC_API_URL berilgan bo'lsa undan, aks holda joriy Render origin'dan olinadi.
 * - Localhost (Mahalliy ishlab chiqish): faqat localhost:8081 / localhost:3000 paytida ishlatiladi.
 */
export const getApiBaseUrl = (): string => {
  const envUrl =
    typeof process !== 'undefined' &&
    process.env &&
    process.env.EXPO_PUBLIC_API_URL &&
    process.env.EXPO_PUBLIC_API_URL.trim() !== ''
      ? process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, '')
      : '';

  if (typeof window !== 'undefined' && window.location) {
    const { hostname, origin, port } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // 1. Production (Render, HTTPS yoki tashqi domen):
    if (!isLocalhost) {
      // Agar Render'da alohida frontend va backend bo'lib, EXPO_PUBLIC_API_URL kiritilgan bo'lsa:
      if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
      }
      // Yagona Render xizmati bo'lsa, xavfsiz origin (hech qachon localhost emas!):
      return origin;
    }

    // 2. Mahalliy ishlab chiqish (Faqat localhost / 127.0.0.1):
    if (envUrl && !envUrl.includes('192.168.')) {
      return envUrl;
    }

    if (port === '3000') {
      return '';
    }

    return `http://${hostname}:3000`;
  }

  // Brauzerdan tashqarida (build vaqti):
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  return '';
};

/**
 * Sozlamalar va interfeysda foydalanuvchiga ko'rsatiladigan haqiqiy backend manzili
 */
export const getDisplayApiBaseUrl = (): string => {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export interface ApiHealthResponse {
  ok: boolean;
  status: string;
  version: string;
  serverTime: string;
  database: {
    engine: string;
    connected: boolean;
    lastError?: string | null;
    name?: string;
  };
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 soniya timeout

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);
    if (!res.ok || (data && data.ok === false)) {
      const errMsg = (data && (data.error || data.message)) || `Server xatosi (${res.status})`;
      const err = new Error(errMsg);
      (err as any).code = data && data.code;
      (err as any).status = res.status;
      (err as any).data = data;
      throw err;
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Serverga ulanish vaqti tugadi (Timeout: 10s). Iltimos, tarmoqni tekshiring.`);
    }
    throw err;
  }
}

export const apiClient = {
  getBaseUrl: getApiBaseUrl,

  // 1. Tizim va Baza tekshiruvi
  checkHealth: async (): Promise<ApiHealthResponse> => {
    try {
      return await request<ApiHealthResponse>('/api/health');
    } catch (err: any) {
      if (err.data && err.data.database) {
        return err.data as ApiHealthResponse;
      }
      throw err;
    }
  },

  // 1.1. Boshlang'ich tizim sozlash (Setup Onboarding)
  getSetupStatus: async (): Promise<{ ok: boolean; isSetupComplete: boolean; clinicName: string; clinicPhone?: string }> => {
    return request<{ ok: boolean; isSetupComplete: boolean; clinicName: string; clinicPhone?: string }>('/api/setup/status');
  },

  initializeSetup: async (data: {
    clinicName: string;
    adminName: string;
    adminPin: string;
    phone?: string;
  }): Promise<{ ok: true; user: CurrentUser; token: string; message: string }> => {
    return request<{ ok: true; user: CurrentUser; token: string; message: string }>('/api/setup/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 2. Auth & Login
  login: async (staffId: string, pin: string): Promise<{ ok: true; user: CurrentUser; token: string }> => {
    return request<{ ok: true; user: CurrentUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ staffId, pin }),
    });
  },

  updatePin: async (staffId: string, newPin: string): Promise<{ ok: true; message: string }> => {
    return request<{ ok: true; message: string }>('/api/auth/update-pin', {
      method: 'POST',
      body: JSON.stringify({ staffId, newPin }),
    });
  },

  // 3. Xodimlar
  getStaff: async (): Promise<StaffMember[]> => {
    const res = await request<{ ok: true; staff: StaffMember[] }>('/api/staff');
    return res.staff;
  },

  createStaff: async (staffData: any): Promise<StaffMember> => {
    const res = await request<{ ok: true; staff: StaffMember }>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
    return res.staff;
  },

  updateStaff: async (id: string, staffData: Partial<StaffMember>): Promise<StaffMember> => {
    const res = await request<{ ok: true; staff: StaffMember }>(`/api/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffData),
    });
    return res.staff;
  },

  // 4. Xizmatlar
  getServices: async (): Promise<Service[]> => {
    const res = await request<{ ok: true; services: Service[] }>('/api/services');
    return res.services;
  },

  createService: async (serviceData: Omit<Service, 'id'>): Promise<Service> => {
    const res = await request<{ ok: true; service: Service }>('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
    return res.service;
  },

  updateService: async (id: string, data: Partial<Service>): Promise<Service> => {
    const res = await request<{ ok: true; service: Service }>(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.service;
  },

  deleteService: async (id: string): Promise<boolean> => {
    await request(`/api/services/${id}`, { method: 'DELETE' });
    return true;
  },

  // 5. Shifokorlar
  getDoctors: async (): Promise<Doctor[]> => {
    const res = await request<{ ok: true; doctors: Doctor[] }>('/api/doctors');
    return res.doctors;
  },

  createDoctor: async (doctorData: Omit<Doctor, 'id'>): Promise<Doctor> => {
    const res = await request<{ ok: true; doctor: Doctor }>('/api/doctors', {
      method: 'POST',
      body: JSON.stringify(doctorData),
    });
    return res.doctor;
  },

  updateDoctor: async (id: string, data: Partial<Doctor>): Promise<Doctor> => {
    const res = await request<{ ok: true; doctor: Doctor }>(`/api/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.doctor;
  },

  deleteDoctor: async (id: string): Promise<boolean> => {
    await request(`/api/doctors/${id}`, { method: 'DELETE' });
    return true;
  },

  // 6. Bemorlar
  getPatients: async (): Promise<Patient[]> => {
    const res = await request<{ ok: true; patients: Patient[] }>('/api/patients');
    return res.patients;
  },

  createPatient: async (patientData: any): Promise<Patient> => {
    const res = await request<{ ok: true; patient: Patient }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
    return res.patient;
  },

  updatePatient: async (id: string, data: Partial<Patient>): Promise<Patient> => {
    const res = await request<{ ok: true; patient: Patient }>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.patient;
  },

  deletePatient: async (id: string): Promise<boolean> => {
    await request(`/api/patients/${id}`, { method: 'DELETE' });
    return true;
  },

  // 7. Qabullar
  getAppointments: async (): Promise<Appointment[]> => {
    const res = await request<{ ok: true; appointments: Appointment[] }>('/api/appointments');
    return res.appointments;
  },

  createAppointment: async (aptData: any): Promise<Appointment> => {
    const res = await request<{ ok: true; appointment: Appointment }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(aptData),
    });
    return res.appointment;
  },

  updateAppointment: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    const res = await request<{ ok: true; appointment: Appointment }>(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.appointment;
  },

  deleteAppointment: async (id: string): Promise<boolean> => {
    await request(`/api/appointments/${id}`, { method: 'DELETE' });
    return true;
  },

  // 8. To'lovlar
  getPayments: async (): Promise<Payment[]> => {
    const res = await request<{ ok: true; payments: Payment[] }>('/api/payments');
    return res.payments;
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    const res = await request<{ ok: true; payment: Payment }>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    return res.payment;
  },

  completePayment: async (id: string, paymentMethod: PaymentMethod = 'Naqd'): Promise<Payment> => {
    const res = await request<{ ok: true; payment: Payment }>(`/api/payments/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
    return res.payment;
  },

  refundPayment: async (id: string): Promise<Payment> => {
    const res = await request<{ ok: true; payment: Payment }>(`/api/payments/${id}/refund`, {
      method: 'POST',
    });
    return res.payment;
  },

  // 9. Sozlamalar
  getSettings: async (): Promise<ClinicSettings> => {
    const res = await request<{ ok: true; settings: ClinicSettings }>('/api/settings');
    return res.settings;
  },

  updateSettings: async (settingsData: Partial<ClinicSettings>): Promise<ClinicSettings> => {
    const res = await request<{ ok: true; settings: ClinicSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    });
    return res.settings;
  },

  // 10. Migratsiya & Zaxira
  getMigrationStats: async (): Promise<any> => {
    return request<any>('/api/migrate/stats');
  },

  importDataToPostgres: async (payload: any): Promise<any> => {
    return request<any>('/api/migrate/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  exportDatabaseBackup: async (): Promise<any> => {
    return request<any>('/api/migrate/export');
  },

  // 11. Barcha test ma'lumotlarini tozalash (Admin - Yangidek qilish)
  cleanTestData: async (): Promise<{ ok: boolean; message: string }> => {
    return request<{ ok: boolean; message: string }>('/api/admin/clean-transactions', {
      method: 'POST',
    });
  },
};
