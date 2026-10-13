import { StaffMember, StaffRole, CurrentUser } from '../types';

export const MASTER_ADMIN_CODE = '';
export const DOCTOR_ACCESS_CODE = '';

const STORAGE_KEY_SECURITY_CODES = 'dentacare_security_codes_v4';

export interface SecurityAccessCodes {
  masterAdminCode: string;
  doctorAccessCode: string;
  nurseAccessCode: string;
}

export const getSecurityAccessCodes = (): SecurityAccessCodes => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY_SECURITY_CODES);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          masterAdminCode: parsed.masterAdminCode || '',
          doctorAccessCode: parsed.doctorAccessCode || '',
          nurseAccessCode: parsed.nurseAccessCode || '',
        };
      }
    }
  } catch (err) {
    console.warn('Ruxsat kodlarini yuklashda xatolik:', err);
  }
  return {
    masterAdminCode: '',
    doctorAccessCode: '',
    nurseAccessCode: '',
  };
};

export const saveSecurityAccessCodes = (codes: SecurityAccessCodes) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_SECURITY_CODES, JSON.stringify(codes));
    }
  } catch (err) {
    console.warn('Ruxsat kodlarini saqlashda xatolik:', err);
  }
};

const STORAGE_KEY_STAFF = 'dentacare_staff_members_v3';
const STORAGE_KEY_CURRENT_USER = 'dentacare_session_user_v2';

// Haqiqiy ishlab chiqarish: Boshlang'ich demo/soxta xodimlar bo'lmaydi
export const INITIAL_STAFF_MEMBERS: StaffMember[] = [];

// LocalStorage yordamchi funksiyalari
export const getStoredStaffMembers = (): StaffMember[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY_STAFF);
      if (saved) {
        return JSON.parse(saved);
      }
    }
  } catch (err) {
    console.warn('Xodimlarni yuklashda xatolik:', err);
  }
  return [];
};

export const saveStaffMembersToStorage = (staff: StaffMember[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(staff));
    }
  } catch (err) {
    console.warn('Xodimlarni saqlashda xatolik:', err);
  }
};

// Xodimning PIN kodini o'zgartirish yoki yangilash
export const updateStaffPin = (staffId: string, newPin: string): boolean => {
  const staff = getStoredStaffMembers();
  const idx = staff.findIndex((s) => s.id === staffId);
  if (idx !== -1) {
    staff[idx].pin = newPin.trim();
    saveStaffMembersToStorage(staff);

    // Eslab qolingan xodimni ham yangilash
    const remembered = getRememberedStaff();
    if (remembered && remembered.id === staffId) {
      setRememberedStaff({
        ...remembered,
        pin: newPin.trim(),
      });
    }
    return true;
  }
  return false;
};

// Xodim ma'lumotlarini (ism, telefon, lavozim, PIN) to'liq yangilash
export const updateStaffMember = (
  staffId: string,
  updates: Partial<StaffMember>
): boolean => {
  const staff = getStoredStaffMembers();
  const idx = staff.findIndex((s) => s.id === staffId);
  if (idx !== -1) {
    const updated = { ...staff[idx], ...updates };
    if (updates.name) {
      updated.avatar = generateAvatarInitials(updates.name);
    }
    staff[idx] = updated;
    saveStaffMembersToStorage(staff);

    // Eslab qolingan xodimni ham yangilash
    const remembered = getRememberedStaff();
    if (remembered && remembered.id === staffId) {
      setRememberedStaff(updated);
    }
    return true;
  }
  return false;
};

// Yangi xodim qo'shish
export const addNewStaffMember = (
  name: string,
  role: StaffRole,
  pin: string,
  title?: string
): StaffMember => {
  const staff = getStoredStaffMembers();
  const initials = generateAvatarInitials(name);
  const color = getRoleDefaultColor(role);

  const newMember: StaffMember = {
    id: `staff-custom-${Date.now()}`,
    name: name.trim(),
    role,
    pin: pin.trim(),
    avatar: initials,
    avatarColor: color,
    title: title || (role === 'Shifokor' ? 'Stomatolog-shifokor' : role === 'Medsestra' ? 'Hamshira' : 'Klinika menejeri'),
  };

  const updatedStaff = [newMember, ...staff];
  saveStaffMembersToStorage(updatedStaff);
  return newMember;
};

// Ismdan avatar initsiallarini generatsiya qilish
export const generateAvatarInitials = (name: string): string => {
  const clean = name.replace(/^Dr\.\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'DC';
};

// Rol uchun mos ranglar
export const getRoleDefaultColor = (role: StaffRole): string => {
  switch (role) {
    case 'Shifokor':
      return '#0D9488'; // Teal
    case 'Medsestra':
      return '#8B5CF6'; // Violet
    case 'Menejer':
      return '#2563EB'; // Blue
    default:
      return '#0D9488';
  }
};

// Rol uchun o'zbekcha tavsif
export const getRoleDescription = (role: StaffRole): string => {
  switch (role) {
    case 'Shifokor':
      return 'Bemorlarni qabul qilish, davolash va tibbiy muolajalar';
    case 'Medsestra':
      return 'Shifokor assistenti, muolajalar va sterilizatsiya nazorati';
    case 'Menejer':
      return 'Klinika boshqaruvi, to‘lovlar, qabullar va umumiy hisobot';
    default:
      return '';
  }
};

// Saqlangan currentUser (Faqat faol oyna sessiyasi — sessionStorage da saqlanadi)
export const getStoredCurrentUser = (): CurrentUser | null => {
  try {
    // 1. Eski localStorage qoldiqlarini tozalash (foydalanuvchi loginni avtomatik chetlab o'tmasligi uchun)
    if (typeof window !== 'undefined' && window.localStorage) {
      if (window.localStorage.getItem('dentacare_current_user_v2')) {
        window.localStorage.removeItem('dentacare_current_user_v2');
      }
      if (window.localStorage.getItem(STORAGE_KEY_CURRENT_USER)) {
        window.localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      }
    }

    // 2. Faqat joriy brauzer oynasi/tabi sessiyasi (sessionStorage) dan tekshirish
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const data = window.sessionStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (data) {
        return JSON.parse(data) as CurrentUser;
      }
    }
  } catch (err) {
    console.warn('Session user yuklashda xatolik:', err);
  }

  // 3. Brauzer yopilib qayta ochilganda har doim login/parol so'ralishi uchun null qaytaramiz
  return null;
};

export const saveStoredCurrentUser = (user: any) => {
  try {
    // Sessiya uchun faqat sessionStorage ishlatiladi (oyna/tab yopilganda brauzer tomonidan tozalanadi)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (user) {
        // Xavfsizlik talabi: PIN / parol sessiyada saqlanmaydi
        const { pin: _removedPin, ...safeUser } = user;
        window.sessionStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(safeUser));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      }
    }

    // Doimiy localStorage da qoldirmaymiz
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('dentacare_current_user_v2');
      window.localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  } catch (err) {
    console.warn('Session user saqlashda xatolik:', err);
  }
};

// --- ESLAB QOLINGAN XODIM (Remembered Staff) ---
const STORAGE_KEY_REMEMBERED_STAFF = 'dentacare_remembered_staff_v3';

export const getRememberedStaff = (): StaffMember | null => {
  const allStaff = getStoredStaffMembers();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY_REMEMBERED_STAFF);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          const fresh = allStaff.find((s) => s.id === parsed.id);
          if (fresh) return fresh;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Remembered staff o‘qishda xatolik:', err);
  }
  const manager = allStaff.find((s) => s.role === 'Menejer');
  return manager || allStaff[0] || null;
};

export const setRememberedStaff = (staff: StaffMember) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_REMEMBERED_STAFF, JSON.stringify(staff));
    }
  } catch (err) {
    console.warn('Remembered staff saqlashda xatolik:', err);
  }
};

export const registerOrUpdateStaffMember = (
  name: string,
  role: StaffRole,
  pin: string
): StaffMember => {
  const staff = getStoredStaffMembers();
  const trimmedName = name.trim();
  const existingIdx = staff.findIndex(
    (s) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.role === role
  );

  let targetStaff: StaffMember;
  if (existingIdx !== -1) {
    staff[existingIdx].pin = pin.trim();
    targetStaff = staff[existingIdx];
    saveStaffMembersToStorage(staff);
  } else {
    targetStaff = addNewStaffMember(trimmedName, role, pin.trim());
  }

  setRememberedStaff(targetStaff);
  return targetStaff;
};

