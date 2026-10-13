import { Doctor, Patient, Service, Appointment, Payment, ClinicSettings } from '../types';

// Haqiqiy ishlab chiqarish: Barcha ro'yxatlar bo'sh holatda boshlanadi
export const INITIAL_SERVICES: Service[] = [];
export const INITIAL_DOCTORS: Doctor[] = [];
export const INITIAL_PATIENTS: Patient[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_SETTINGS: ClinicSettings = {
  name: 'DentaCare Stomatologiya Markazi',
  tagline: 'Sog‘lom va chiroyli tabassum maskani',
  address: '',
  phone: '',
  workingHours: 'Dush - Shan: 09:00 - 18:00',
  defaultAppointmentDuration: 30,
  currency: 'so‘m',
  taxRatePercent: 0,
};
