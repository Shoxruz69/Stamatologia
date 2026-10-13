export type AppointmentStatus =
  | 'Kutilmoqda'
  | 'Tasdiqlangan'
  | 'Keldi'
  | 'Qabulda'
  | 'Jarayonda'
  | 'Yakunlandi'
  | 'Bekor qilindi'
  | 'Bekor qilish';

export type PaymentMethod = 'Naqd' | 'Karta' | 'O‘tkazma' | 'Payme / Click';

export type PaymentStatus =
  | 'To‘landi'
  | 'To‘lash kerak'
  | 'To‘langan'
  | 'Qisman to‘langan'
  | 'Bekor qilingan'
  | 'Qaytarilgan';

export type ServiceCategory =
  | 'Konsultatsiya'
  | 'Terapiya'
  | 'Jarrohlik'
  | 'Ortodontiya'
  | 'Gigiyena va profilaktika'
  | 'Rentgen va diagnostika'
  | 'Protezlash';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number; // Butun so'm
  durationMinutes: number; // Daqiqalarda
  isActive: boolean;
  description?: string;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  phone: string;
  workDays: string[]; // ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
  workHours: {
    start: string; // '09:00'
    end: string;   // '18:00'
  };
  isActive: boolean;
  avatarColor?: string;
}

export interface Patient {
  id: string;
  fullName: string;
  phone: string;
  gender: 'Erkak' | 'Ayol';
  birthDate?: string;
  address?: string;
  totalVisits: number;
  lastVisitDate?: string;
  debt: number; // Qarzdorlik (so'm)
  notes?: string;
  createdAt: string;
  telegramChatId?: string; // Bemorning Telegram chat ID raqami
  telegramUsername?: string; // Bemorning Telegram @username
  telegramConnectedAt?: string; // Telegram ulangan sana
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  date: string; // 'YYYY-MM-DD'
  time: string; // '09:30'
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
  paidAmount: number; // Ushbu qabul bo'yicha to'langan
  createdAt: string;
}

export interface Payment {
  id: string;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceName: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  date: string; // 'YYYY-MM-DD'
  time: string; // '14:20'
  notes?: string;
  receiptNumber: string;
}

export interface ClinicSettings {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  workingHours: string;
  defaultAppointmentDuration: number; // daqiqa
  currency: string;
  taxRatePercent: number;
}

export type StaffRole = 'Shifokor' | 'Medsestra' | 'Menejer';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  pin: string; // 4-xonali PIN kod (masalan '1234')
  avatar: string;
  avatarColor?: string;
  title?: string;
  phone?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  role: StaffRole;
  avatar: string;
  avatarColor?: string;
  title?: string;
  pin?: string;
}

