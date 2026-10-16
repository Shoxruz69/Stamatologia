import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { StaffRole, StaffMember, CurrentUser } from '../types';
import { apiClient } from '../services/apiClient';
import {
  getStoredStaffMembers,
  saveStaffMembersToStorage,
  getRememberedStaff,
  setRememberedStaff,
  registerOrUpdateStaffMember,
  getRoleDefaultColor,
  getRoleDescription,
  MASTER_ADMIN_CODE,
  DOCTOR_ACCESS_CODE,
  getSecurityAccessCodes,
  INITIAL_STAFF_MEMBERS,
  generateAvatarInitials,
} from '../utils/staffData';
import {
  ToothIcon,
  DoctorIcon,
  NurseIcon,
  ShieldCheckIcon,
  LockIcon,
  KeyIcon,
  BackspaceIcon,
  EyeIcon,
  CheckIcon,
  UsersIcon,
  CloseIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  BriefcaseIcon,
  LightbulbIcon,
  ZapIcon,
} from '../components/common/Icons';

type ViewMode = 'PIN_SCREEN' | 'REGISTER_SCREEN' | 'SETUP_SCREEN';

// Ro'yxatdan o'tish oynasini odatiy foydalanishdan yashirish bayrog'i
const SHOW_PUBLIC_REGISTRATION = false;

// 2-bo'lim ("Xodimni o'zgartirish" tugmasi)ni yashirish bayrog'i: faqat Menejer kirishi qoladi
const SHOW_SWITCH_STAFF_BUTTON = false;

export const LoginScreen: React.FC = () => {
  const { login, showToast } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Oyna holati: 'PIN_SCREEN' | 'SETUP_SCREEN' | 'REGISTER_SCREEN'
  const [viewMode, setViewMode] = useState<ViewMode>('PIN_SCREEN');

  // Barcha xodimlar
  const [staffList, setStaffList] = useState<StaffMember[]>(() => getStoredStaffMembers());

  // Eslab qolingan / Faol xodim (Menejer hisobi bilan ochiladi)
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(() => {
    const all = getStoredStaffMembers();
    const remembered = getRememberedStaff();
    if (remembered && remembered.role === 'Menejer') return remembered;
    const manager = all.find((s) => s.role === 'Menejer');
    return manager || remembered || all[0] || null;
  });

  // Boshqa xodim sifatida kirish modali
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);

  // --- PAROL (PIN) OYNASI STATE ---
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const hiddenInputRef = useRef<TextInput>(null);

  // --- BIRINCHI ISHGA TUSHIRISH (SETUP / ONBOARDING) STATE ---
  const [setupClinicName, setSetupClinicName] = useState<string>('DentaCare Stomatologiya Markazi');
  const [setupAdminName, setSetupAdminName] = useState<string>('');
  const [setupAdminPin, setSetupAdminPin] = useState<string>('');
  const [setupConfirmPin, setSetupConfirmPin] = useState<string>('');
  const [setupPhone, setSetupPhone] = useState<string>('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState<boolean>(false);
  const [showSetupPin, setShowSetupPin] = useState<boolean>(false);

  // --- RO'YXATDAN O'TISH OYNASI STATE ---
  const [regRole, setRegRole] = useState<StaffRole>('Shifokor');
  const [regName, setRegName] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('');
  const [regSecurityCode, setRegSecurityCode] = useState<string>('');
  const [showSecurityCode, setShowSecurityCode] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Boshlang'ich yuklash: Serverda setup qilinganmi yoki yo'qligini tekshirish
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const setupInfo = await apiClient.getSetupStatus();
        if (isMounted) {
          if (!setupInfo.isSetupComplete) {
            setViewMode('SETUP_SCREEN');
            if (setupInfo.clinicName) setSetupClinicName(setupInfo.clinicName);
            return;
          }
        }
      } catch (err: any) {
        console.warn('Backend setup status tekshirishda xatolik:', err);
      }

      try {
        const serverStaff = await apiClient.getStaff();
        if (isMounted && Array.isArray(serverStaff)) {
          if (serverStaff.length === 0) {
            setViewMode('SETUP_SCREEN');
            return;
          }
          setStaffList(serverStaff);
          saveStaffMembersToStorage(serverStaff);
          const mgr = serverStaff.find((s) => s.role === 'Menejer') || serverStaff[0];
          setActiveStaff(mgr);
          setRememberedStaff(mgr);
          setViewMode('PIN_SCREEN');
          return;
        }
      } catch (err: any) {
        console.warn('Xodimlarni olishda xatolik:', err);
      }

      const all = getStoredStaffMembers();
      setStaffList(all);
      if (all.length === 0) {
        setViewMode('SETUP_SCREEN');
      } else {
        const remembered = getRememberedStaff();
        const active =
          (remembered && remembered.role === 'Menejer' ? remembered : null) ||
          all.find((s) => s.role === 'Menejer') ||
          all[0];
        setActiveStaff(active);
        setViewMode('PIN_SCREEN');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Har doim eng yangi state'ni saqlovchi ref'lar (closure muammosi bo'lmasligi uchun)
  const pinRef = useRef(pin);
  pinRef.current = pin;

  const activeStaffRef = useRef(activeStaff);
  activeStaffRef.current = activeStaff;

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  // Har safar PIN_SCREEN ga o'tganda inputga fokus va pinni tozalash
  useEffect(() => {
    if (viewMode === 'PIN_SCREEN') {
      setPin('');
      setPinError(null);
      setIsSuccess(false);
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 100);
    }
  }, [viewMode]);

  // Global jismoniy klaviatura (Physical Keyboard) tinglovchisi
  useEffect(() => {
    if (Platform.OS !== 'web' && typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Faqat PIN_SCREEN rejimida ishlaydi
      if (viewModeRef.current !== 'PIN_SCREEN') return;

      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;

      // Agar hiddenInputRef fokusda bo'lsa, onChangeText uni o'zi boshqaradi
      // @ts-ignore
      if (activeEl === hiddenInputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyPinAndLogin(pinRef.current);
        }
        return;
      }

      // Agar boshqa biror ochiq matn maydoni aktiv bo'lsa, xalaqit bermaymiz
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // 0-9 raqamlari (yuqori qatordagi va o'ng tarafdagi NumPad tugmalari)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const currentPin = pinRef.current;
        if (currentPin.length < 4) {
          const nextPin = currentPin + e.key;
          pinRef.current = nextPin;
          setPin(nextPin);
          setPinError(null);
          if (nextPin.length === 4) {
            verifyPinAndLogin(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        const nextPin = pinRef.current.slice(0, -1);
        pinRef.current = nextPin;
        setPin(nextPin);
        setPinError(null);
      } else if (e.key === 'Delete' || e.key === 'Escape') {
        e.preventDefault();
        pinRef.current = '';
        setPin('');
        setPinError(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        verifyPinAndLogin(pinRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- PAROL (PIN) OYNASI AMALLARI ---
  const handlePressDigit = (digit: string) => {
    const current = pinRef.current;
    if (current.length < 4) {
      const nextPin = current + digit;
      pinRef.current = nextPin;
      setPin(nextPin);
      setPinError(null);

      if (nextPin.length === 4) {
        verifyPinAndLogin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    const current = pinRef.current;
    const nextPin = current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setPinError(null);
  };

  const handleClearPin = () => {
    pinRef.current = '';
    setPin('');
    setPinError(null);
  };

  const verifyPinAndLogin = async (pinToTest?: string) => {
    const finalPin = pinToTest !== undefined ? pinToTest : pinRef.current;
    const staff = activeStaffRef.current;

    if (!staff) {
      setPinError('Xodim tanlanmagan!');
      return;
    }

    if (finalPin.length !== 4) {
      setPinError('Iltimos, 4 xonali PIN kodni to‘liq kiriting!');
      return;
    }

    // Har doim saqlash bazasidan eng so'nggi xodim ma'lumotini olamiz
    const allStaff = getStoredStaffMembers();
    const freshStaff = allStaff.find((s) => s.id === staff.id) || staff;

    // 1. Markaziy backend PostgreSQL orqali xavfsiz hesh tekshiruvi
    try {
      const serverAuth = await apiClient.login(freshStaff.id, finalPin);
      if (serverAuth && serverAuth.ok) {
        setIsSuccess(true);
        setPinError(null);
        setRememberedStaff(freshStaff);
        setTimeout(() => {
          login(serverAuth.user);
        }, 350);
        return;
      }
    } catch (apiErr: any) {
      if (apiErr.code === 'INVALID_PIN') {
        setPinError('PIN kod noto‘g‘ri! Qaytadan urinib ko‘ring.');
        setPin('');
        pinRef.current = '';
        return;
      }
      // Server ulanishi xatosi haqida aniq ma'lumot beramiz, demo fallbackga o'tmaymiz
      setPinError(`Serverga ulanib bo‘lmadi (${apiErr.message || 'Aloqa yo‘q'}). Server yoki internet ulanishini tekshiring.`);
      setPin('');
      pinRef.current = '';
      return;
    }
  };

  // --- BIRINCHI ISHGA TUSHIRISH (SETUP) AMALLARI ---
  const handleInitializeSetup = async () => {
    setSetupError(null);
    const clinicName = setupClinicName.trim();
    const adminName = setupAdminName.trim();
    const pin = setupAdminPin.trim();
    const confirm = setupConfirmPin.trim();

    if (!clinicName) {
      setSetupError('Iltimos, klinika nomini kiriting!');
      return;
    }
    if (!adminName) {
      setSetupError('Iltimos, boshqaruvchi (Admin) ismini kiriting!');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setSetupError('PIN kod aynan 4 ta raqamdan iborat bo‘lishi kerak!');
      return;
    }
    if (pin !== confirm) {
      setSetupError('Kiritilgan PIN kodlar bir-biriga mos kelmadi!');
      return;
    }

    setIsSubmittingSetup(true);
    try {
      const res = await apiClient.initializeSetup({
        clinicName,
        adminName,
        adminPin: pin,
        phone: setupPhone.trim(),
      });

      if (res && res.ok) {
        setRememberedStaff(res.user as any);
        saveStaffMembersToStorage([res.user as any]);
        showToast('Klinika tizimi muvaffaqiyatli ishga tushirildi!', 'success');
        login(res.user);
      }
    } catch (err: any) {
      setSetupError(err.message || 'Klinikani ishga tushirishda xatolik yuz berdi');
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // --- RO'YXATDAN O'TISH AMALLARI ---
  const handleSaveAndGoToPin = () => {
    const cleanName = regName.trim();
    const cleanPin = regPin.trim();

    if (!cleanName) {
      setRegError('Iltimos, ismingizni kiriting!');
      return;
    }

    const currentCodes = getSecurityAccessCodes();

    // 1. Menejer uchun Bosh Admin maxfiy kodi tekshiruvi
    if (regRole === 'Menejer') {
      if (regSecurityCode.trim() !== currentCodes.masterAdminCode) {
        setRegError('Bosh Admin maxfiy kodi noto‘g‘ri! Faqat klinika egasi Menejer akkauntini ocha oladi.');
        return;
      }
    }

    // 2. Shifokor uchun ruxsat kodi tekshiruvi
    if (regRole === 'Shifokor') {
      if (regSecurityCode.trim() !== currentCodes.doctorAccessCode) {
        setRegError('Shifokorlik ruxsat kodi noto‘g‘ri! Shifokor kodini qayta tekshiring.');
        return;
      }
    }

    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setRegError('Iltimos, 4 xonali raqamli PIN kod kiriting!');
      return;
    }

    // Xodimni saqlash va eslab qolish
    const savedStaff = registerOrUpdateStaffMember(cleanName, regRole, cleanPin);

    // Ro'yxatni yangilash
    const updatedList = getStoredStaffMembers();
    setStaffList(updatedList);
    setActiveStaff(savedStaff);

    showToast(`${savedStaff.name} (${savedStaff.role}) saqlandi! PIN kodingizni kiriting.`);

    // Parol oynasiga o'tish
    setRegError(null);
    setRegSecurityCode('');
    setViewMode('PIN_SCREEN');
  };

  // Mavjud xodimni tezkor tanlash
  const handleSelectExistingStaff = (staff: StaffMember) => {
    setRememberedStaff(staff);
    setActiveStaff(staff);
    setViewMode('PIN_SCREEN');
    showToast(`${staff.name} tanlandi!`);
  };

  // =========================================================================
  // 0-OYNA: KLINIKANI BIRINCHI ISHGA TUSHIRISH (BOSHLANG'ICH SOZLASH)
  // =========================================================================
  if (viewMode === 'SETUP_SCREEN' || !activeStaff) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.pinCard, { maxWidth: 520 }]}>
            {/* Logo va Sarlovha */}
            <View style={styles.cardHeader}>
              <View style={[styles.miniLogoBadge, { backgroundColor: '#0D9488' }]}>
                <ToothIcon size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.brandTitle}>DentaCare</Text>
              <Text style={styles.brandSubtitle}>Klinikani Ishga Tushirish</Text>
            </View>

            <View style={styles.setupBanner}>
              <ShieldCheckIcon size={20} color="#0D9488" />
              <Text style={styles.setupBannerText}>
                Xush kelibsiz! Tizimni haqiqiy klinikada ishlatish uchun klinika nomi va dastlabki Boshqaruvchi (Admin) 4 xonali shaxsiy PIN kodini o‘rnating.
              </Text>
            </View>

            {setupError ? (
              <View style={styles.setupErrorBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertTriangleIcon size={16} color="#DC2626" />
                  <Text style={styles.setupErrorText}>{setupError}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.setupForm}>
              {/* Klinika nomi */}
              <View style={styles.setupFieldGroup}>
                <Text style={styles.setupFieldLabel}>Klinika nomi *</Text>
                <TextInput
                  style={styles.setupInput}
                  value={setupClinicName}
                  onChangeText={setSetupClinicName}
                  placeholder="Masalan: DentaCare Stomatologiya Markazi"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>

              {/* Boshqaruvchi ismi */}
              <View style={styles.setupFieldGroup}>
                <Text style={styles.setupFieldLabel}>Boshqaruvchi (Admin) F.I.Sh *</Text>
                <TextInput
                  style={styles.setupInput}
                  value={setupAdminName}
                  onChangeText={setSetupAdminName}
                  placeholder="Masalan: Azizbek Karimov"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>

              {/* 4 xonali PIN kod */}
              <View style={styles.setupFieldGroup}>
                <Text style={styles.setupFieldLabel}>Yangi 4 xonali shaxsiy PIN kod *</Text>
                <View style={styles.setupPasswordWrap}>
                  <TextInput
                    style={styles.setupPasswordInput}
                    value={setupAdminPin}
                    onChangeText={(val) => {
                      const digitsOnly = val.replace(/\D/g, '').slice(0, 4);
                      setSetupAdminPin(digitsOnly);
                    }}
                    placeholder="4 ta raqam"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry={!showSetupPin}
                  />
                  <TouchableOpacity
                    style={styles.setupEyeBtn}
                    onPress={() => setShowSetupPin(!showSetupPin)}
                  >
                    <EyeIcon size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.setupFieldHint}>
                  Standart parollardan saqlaning. Bu PIN kod orqali tizimga kirasiz.
                </Text>
              </View>

              {/* PIN kodni tasdiqlash */}
              <View style={styles.setupFieldGroup}>
                <Text style={styles.setupFieldLabel}>PIN kodni tasdiqlang *</Text>
                <TextInput
                  style={styles.setupInput}
                  value={setupConfirmPin}
                  onChangeText={(val) => {
                    const digitsOnly = val.replace(/\D/g, '').slice(0, 4);
                    setSetupConfirmPin(digitsOnly);
                  }}
                  placeholder="PIN kodni qayta kiriting"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry={!showSetupPin}
                />
              </View>

              {/* Telefon raqami */}
              <View style={styles.setupFieldGroup}>
                <Text style={styles.setupFieldLabel}>Aloqa telefoni (ixtiyoriy)</Text>
                <TextInput
                  style={styles.setupInput}
                  value={setupPhone}
                  onChangeText={setSetupPhone}
                  placeholder="+998 90 123 45 67"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Ishga tushirish tugmasi */}
              <TouchableOpacity
                style={[
                  styles.setupSubmitBtn,
                  isSubmittingSetup && styles.setupSubmitBtnDisabled,
                ]}
                onPress={handleInitializeSetup}
                disabled={isSubmittingSetup}
                activeOpacity={0.85}
              >
                <Text style={styles.setupSubmitBtnText}>
                  {isSubmittingSetup ? 'Klinika sozlanmoqda...' : 'Tizimni Ishga Tushirish'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // 1-OYNA: PAROL (4 XONALI PIN) OYNASI (ASOSIY TEZKOR KIRISH)
  // =========================================================================
  if (viewMode === 'PIN_SCREEN') {
    const remembered = getRememberedStaff();
    const currentStaff = activeStaff || remembered || {
      id: 'manager-1',
      name: 'Menejer',
      role: 'Menejer' as StaffRole,
      avatar: 'M',
      avatarColor: '#2563EB',
      title: 'Klinika rahbari',
      pin: '',
    };
    const roleColor = getRoleDefaultColor(currentStaff.role);

    // =========================================================================
    // KOMPYUTER / DESKTOP KO'RINISHI (Markazlashgan oyna, tugmalarsiz, klaviatura)
    // =========================================================================
    if (isDesktop) {
      return (
        <View style={styles.desktopContainer}>
          {/* Orqa fondagi ambient doiralar (faqat estetik fon uchun) */}
          <View style={styles.ambientCircleBottomLeft} pointerEvents="none" />
          <View style={styles.ambientCircleTopRight} pointerEvents="none" />

          {/* Ekranning qoq o'rtasidagi asosiy oyna */}
          <View style={styles.desktopPinCard}>
            {/* Logo va Klinika nomi (Horizontal qator) */}
            <View style={styles.desktopLogoRow}>
              <View style={styles.desktopLogoBadge}>
                <ToothIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.desktopBrandTitle}>DentaCare</Text>
            </View>
            <Text style={styles.desktopBrandSubtitle}>Stomatologiya boshqaruv tizimi</Text>

            {/* ESLAB QOLINGAN XODIMNING KARTASI */}
            <View style={styles.desktopUserCard}>
              <View style={styles.desktopUserLeft}>
                <View
                  style={[
                    styles.desktopAvatar,
                    { backgroundColor: currentStaff.avatarColor || '#2563EB' },
                  ]}
                >
                  <Text style={styles.desktopAvatarText}>
                    {generateAvatarInitials(currentStaff.name)}
                  </Text>
                </View>
                <View style={styles.desktopUserInfo}>
                  <Text style={styles.desktopUserName}>{currentStaff.name || 'Menejer'}</Text>
                  <Text style={styles.desktopUserSub}>
                    {currentStaff.title ||
                      (currentStaff.role === 'Menejer'
                        ? 'Klinika rahbari'
                        : currentStaff.role === 'Shifokor'
                        ? 'Stomatolog-shifokor'
                        : 'Hamshira')}
                  </Text>
                </View>
              </View>

              {/* Status nishoni (Menejer) */}
              <View style={styles.desktopRoleBadge}>
                <View style={styles.desktopRoleDot} />
                <Text style={styles.desktopRoleText}>
                  {currentStaff.role ? currentStaff.role.toUpperCase() : 'MENEJER'}
                </Text>
              </View>
            </View>

            {/* PIN SOHASI */}
            <View style={styles.desktopPinSection}>
              <Text style={styles.desktopPinTitle}>4 xonali PIN-kod</Text>
              <Text style={styles.desktopPinSubtitle}>PIN-kodni klaviaturada kiriting</Text>

              {/* 4 ta PIN katagi */}
              <TouchableOpacity
                style={styles.desktopPinBoxesRow}
                activeOpacity={1}
                onPress={() => hiddenInputRef.current?.focus()}
              >
                {[0, 1, 2, 3].map((index) => {
                  const digit = pin[index];
                  const isActiveSlot = pin.length === index;
                  const isFilled = digit !== undefined;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.desktopPinBox,
                        isActiveSlot && styles.desktopPinBoxActive,
                        isFilled && styles.desktopPinBoxFilled,
                        pinError ? styles.desktopPinBoxError : null,
                      ]}
                    >
                      {isFilled ? (
                        showPin ? (
                          <Text style={styles.desktopPinDigitText}>{digit}</Text>
                        ) : (
                          <View
                            style={[
                              styles.desktopPinDotFilled,
                              pinError ? { backgroundColor: colors.danger } : null,
                            ]}
                          />
                        )
                      ) : (
                        <View style={styles.desktopPinDotEmpty} />
                      )}
                    </View>
                  );
                })}

                {/* Shaffof kiritish maydoni */}
                <TextInput
                  ref={hiddenInputRef}
                  style={styles.transparentInputOverlay}
                  keyboardType="number-pad"
                  // @ts-ignore
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChangeText={(text) => {
                    const numeric = text.replace(/[^0-9]/g, '').slice(0, 4);
                    pinRef.current = numeric;
                    setPin(numeric);
                    setPinError(null);
                    if (numeric.length === 4) {
                      verifyPinAndLogin(numeric);
                    }
                  }}
                  onSubmitEditing={() => verifyPinAndLogin(pinRef.current)}
                  autoFocus={Platform.OS === 'web'}
                />
              </TouchableOpacity>

              {/* Ko'rsatish tugmasi */}
              <View style={styles.desktopShowRow}>
                <TouchableOpacity
                  style={styles.desktopShowBtn}
                  onPress={() => setShowPin(!showPin)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.desktopShowText}>
                    {showPin ? 'Yashirish' : 'Ko‘rsatish'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Xatolik xabari */}
              {pinError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{pinError}</Text>
                </View>
              )}

              {/* Tizimga kirish tugmasi */}
              <TouchableOpacity
                style={[
                  styles.desktopSubmitBtn,
                  isSuccess && { backgroundColor: '#10B981' },
                ]}
                onPress={() => verifyPinAndLogin()}
                activeOpacity={0.85}
              >
                <Text style={styles.desktopSubmitBtnText}>
                  {isSuccess ? 'Tasdiqlandi! Kirilmoqda...' : 'Tizimga kirish'}
                </Text>
              </TouchableOpacity>

              {/* Pastki yordamchi matn */}
              <Text style={styles.desktopHelperText}>
                PIN-kodni raqamlar bilan yozing, alohida tugmalar kerak emas
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // =========================================================================
    // TELEFON / MOBILE KO'RINISHI (AVVALGI HOLAT VA ISHLASH TARTIBI SAQLANGAN)
    // =========================================================================
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pinCard}>
            {/* Logo va Klinika nomi */}
            <View style={styles.cardHeader}>
              <View style={[styles.miniLogoBadge, { backgroundColor: roleColor }]}>
                <ToothIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.brandTitle}>DentaCare</Text>
              <Text style={styles.brandSubtitle}>Stomatologiya Boshqaruv Tizimi</Text>
            </View>

            {/* ESLAB QOLINGAN XODIMNING KATTA KARTASI */}
            <View style={[styles.userProfileHero, { borderColor: roleColor + '40' }]}>
              <View
                style={[
                  styles.heroAvatar,
                  { backgroundColor: (activeStaff || currentStaff).avatarColor || roleColor },
                ]}
              >
                <Text style={styles.heroAvatarText}>{generateAvatarInitials((activeStaff || currentStaff).name)}</Text>
              </View>
              <View style={styles.heroUserInfo}>
                <Text style={styles.heroUserName}>{(activeStaff || currentStaff).name}</Text>
                <View style={styles.heroBadgeRow}>
                  <View
                    style={[
                      styles.heroRolePill,
                      { backgroundColor: roleColor + '20', borderColor: roleColor + '40' },
                    ]}
                  >
                    {activeStaff.role === 'Shifokor' ? (
                      <DoctorIcon size={12} color={roleColor} />
                    ) : activeStaff.role === 'Medsestra' ? (
                      <NurseIcon size={12} color={roleColor} />
                    ) : (
                      <BriefcaseIcon size={12} color={roleColor} />
                    )}
                    <Text style={[styles.heroRoleText, { color: roleColor }]}>
                      {activeStaff.role === 'Shifokor'
                        ? 'Shifokor'
                        : activeStaff.role === 'Medsestra'
                        ? 'Medsestra'
                        : 'Menejer'}
                    </Text>
                  </View>
                  {activeStaff.title ? (
                    <Text style={styles.heroTitleSub} numberOfLines={1}>
                      {activeStaff.title}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* PAROL (PIN) SOHASI */}
            <View style={styles.pinPromptSection}>
              <View style={styles.pinPromptHeader}>
                <LockIcon size={16} color={roleColor} />
                <Text style={styles.pinPromptTitle}>4 xonali PIN kodingizni kiriting</Text>
              </View>

              {/* 4 xonali PIN Slots va shaffof kiritish maydoni */}
              <View style={styles.pinSlotsContainer}>
                <View style={styles.pinSlotsRow}>
                  {[0, 1, 2, 3].map((index) => {
                    const digit = pin[index];
                    const isActiveSlot = pin.length === index;
                    const isFilled = digit !== undefined;

                    return (
                      <View
                        key={index}
                        style={[
                          styles.pinSlot,
                          isActiveSlot && [styles.pinSlotActive, { borderColor: roleColor }],
                          isFilled && [styles.pinSlotFilled, { borderColor: roleColor }],
                          pinError ? styles.pinSlotError : null,
                        ]}
                      >
                        {isFilled ? (
                          showPin ? (
                            <Text style={[styles.pinDigitText, { color: roleColor }]}>
                              {digit}
                            </Text>
                          ) : (
                            <View
                              style={[
                                styles.pinDot,
                                { backgroundColor: pinError ? colors.danger : roleColor },
                              ]}
                            />
                          )
                        ) : (
                          isActiveSlot && (
                            <View style={[styles.pinCursor, { backgroundColor: roleColor }]} />
                          )
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Shaffof kiritish maydoni: Slotlar ustida joylashgan bo'lib, klaviatura va telefonda to'g'ri ishlaydi */}
                <TextInput
                  ref={hiddenInputRef}
                  style={styles.transparentInputOverlay}
                  keyboardType="number-pad"
                  // @ts-ignore
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChangeText={(text) => {
                    const numeric = text.replace(/[^0-9]/g, '').slice(0, 4);
                    pinRef.current = numeric;
                    setPin(numeric);
                    setPinError(null);
                    if (numeric.length === 4) {
                      verifyPinAndLogin(numeric);
                    }
                  }}
                  autoFocus={Platform.OS === 'web'}
                />
              </View>

              {/* Show/Hide PIN toggle */}
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPin(!showPin)}
                activeOpacity={0.7}
              >
                <EyeIcon size={16} color={showPin ? roleColor : '#64748B'} />
                <Text style={styles.eyeBtnText}>{showPin ? 'Yashirish' : 'Ko‘rsatish'}</Text>
              </TouchableOpacity>

              {/* Xatolik xabari */}
              {pinError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{pinError}</Text>
                </View>
              )}

              {/* Sensorli NumPad */}
              <View style={styles.keypad}>
                <View style={styles.keypadRow}>
                  {['1', '2', '3'].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.keyBtn}
                      onPress={() => handlePressDigit(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keyBtnText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.keypadRow}>
                  {['4', '5', '6'].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.keyBtn}
                      onPress={() => handlePressDigit(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keyBtnText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.keypadRow}>
                  {['7', '8', '9'].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={styles.keyBtn}
                      onPress={() => handlePressDigit(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keyBtnText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.keypadRow}>
                  <TouchableOpacity
                    style={[styles.keyBtn, styles.keyBtnSpecial]}
                    onPress={handleClearPin}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keySpecialText}>C</Text>
                    <Text style={styles.keySpecialSub}>Tozalash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.keyBtn}
                    onPress={() => handlePressDigit('0')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keyBtnText}>0</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.keyBtn, styles.keyBtnSpecial]}
                    onPress={handleBackspace}
                    activeOpacity={0.7}
                  >
                    <BackspaceIcon size={20} color="#64748B" />
                    <Text style={styles.keySpecialSub}>O‘chirish</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Kirish Tugmasi */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: roleColor },
                  pin.length === 4 && styles.submitBtnReady,
                  isSuccess && { backgroundColor: '#10B981' },
                ]}
                onPress={() => verifyPinAndLogin()}
                activeOpacity={0.8}
              >
                {isSuccess ? (
                  <View style={styles.btnRow}>
                    <CheckIcon size={20} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Tasdiqlandi! Kirilmoqda...</Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <KeyIcon size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Tizimga Kirish</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 2-bo'lim ("Xodimni o'zgartirish" tugmasi) odatiy ko'rinishdan yashirilgan: faqat Menejerning o'zi kiradi */}
            {SHOW_SWITCH_STAFF_BUTTON && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.switchStaffCardBtn}
                  onPress={() => {
                    setStaffList(getStoredStaffMembers());
                    setShowStaffModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <UsersIcon size={18} color="#0D9488" />
                  <View style={styles.switchStaffTextWrap}>
                    <Text style={styles.switchStaffTitle}>
                      Xodimni o‘zgartirish
                    </Text>
                    <Text style={styles.switchStaffSub}>
                      Mavjud xodimni tanlash va 4 xonali PIN bilan kirish
                    </Text>
                  </View>
                  <Text style={styles.switchArrow}>→</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        {/* XODIMNI O'ZGARTIRISH MODALI (Kerak bo'lganda SHOW_SWITCH_STAFF_BUTTON orqali yoqiladi) */}
        {SHOW_SWITCH_STAFF_BUTTON && (
          <Modal
            visible={showStaffModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowStaffModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.staffModalCard}>
                <View style={styles.staffModalHeader}>
                  <View style={styles.staffModalTitleRow}>
                    <UsersIcon size={20} color="#0D9488" />
                    <Text style={styles.staffModalTitle}>Xodimni o‘zgartirish</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setShowStaffModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <CloseIcon size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.staffModalSubtitle}>
                  Klinikadagi mavjud xodim profilingizni tanlang va 4 xonali PIN-kodingizni kiriting:
                </Text>

                <ScrollView style={styles.staffListScroll} showsVerticalScrollIndicator={false}>
                  {staffList.map((member) => {
                    const roleCol = getRoleDefaultColor(member.role);
                    const isCurrent = activeStaff.id === member.id;

                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.staffPickerItem,
                          isCurrent && styles.staffPickerItemActive,
                        ]}
                        onPress={() => {
                          setActiveStaff(member);
                          setRememberedStaff(member);
                          setPin('');
                          setPinError(null);
                          setShowStaffModal(false);
                          setTimeout(() => {
                            hiddenInputRef.current?.focus();
                          }, 120);
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.staffPickerAvatar,
                            { backgroundColor: member.avatarColor || roleCol },
                          ]}
                        >
                          <Text style={styles.staffPickerAvatarText}>{generateAvatarInitials(member.name)}</Text>
                        </View>

                        <View style={styles.staffPickerInfo}>
                          <Text style={styles.staffPickerName}>{member.name}</Text>
                          <Text style={styles.staffPickerTitle} numberOfLines={1}>
                            {member.title ||
                              (member.role === 'Shifokor'
                                ? 'Stomatolog-shifokor'
                                : member.role === 'Medsestra'
                                ? 'Hamshira'
                                : 'Klinika menejeri')}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.staffPickerBadge,
                            {
                              backgroundColor:
                                member.role === 'Shifokor'
                                  ? '#F0FDFA'
                                  : member.role === 'Medsestra'
                                  ? '#F5F3FF'
                                  : '#EFF6FF',
                              borderColor:
                                member.role === 'Shifokor'
                                  ? '#99F6E4'
                                  : member.role === 'Medsestra'
                                  ? '#DDD6FE'
                                  : '#BFDBFE',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.staffPickerBadgeText,
                              {
                                color:
                                member.role === 'Shifokor'
                                  ? '#0D9488'
                                  : member.role === 'Medsestra'
                                  ? '#8B5CF6'
                                  : '#2563EB',
                              },
                            ]}
                          >
                            {member.role}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // =========================================================================
  // 2-OYNA: RO'YXATDAN O'TISH VA XODIM SOZLASH OYNASI (ODATIY KO'RINISHDA YASHIRILGAN)
  // (Kod, baza mantiqi va boshqaruv butunlay saqlab qolingan. Kerak bo'lganda SHOW_PUBLIC_REGISTRATION orqali yoqiladi)
  // =========================================================================
  if (SHOW_PUBLIC_REGISTRATION && viewMode === 'REGISTER_SCREEN') {
    const regRoleColor = getRoleDefaultColor(regRole);
    const currentRoleStaff = staffList.filter((s) => s.role === regRole);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.regCard}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.miniLogoBadge, { backgroundColor: regRoleColor }]}>
              <ToothIcon size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.brandTitle}>Xodim Ro‘yxatdan O‘tish</Text>
            <Text style={styles.brandSubtitle}>
              Sohangiz va ismingizni belgilang, 4 xonali PIN o‘rnating. Tizim sizni doimiy eslab qoladi!
            </Text>
          </View>

          {/* 1. SOHASINI TANLASH (Shifokor, Medsestra, Menejer) */}
          <View style={styles.regSection}>
            <Text style={styles.regSectionTitle}>1. Sohangizni (Lavozimingizni) tanlang:</Text>
            <View style={styles.rolesRow}>
              {/* Shifokor */}
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  regRole === 'Shifokor' && [
                    styles.roleCardActive,
                    { borderColor: '#0D9488', backgroundColor: '#F0FDFA' },
                  ],
                ]}
                onPress={() => {
                  setRegRole('Shifokor');
                  setRegSecurityCode('');
                  setRegError(null);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.roleIconWrap,
                    regRole === 'Shifokor' && { backgroundColor: '#0D9488' },
                  ]}
                >
                  <DoctorIcon
                    size={22}
                    color={regRole === 'Shifokor' ? '#FFFFFF' : '#0D9488'}
                  />
                </View>
                <Text
                  style={[
                    styles.roleTitle,
                    regRole === 'Shifokor' && { color: '#0F766E', fontWeight: '700' },
                  ]}
                >
                  Shifokor
                </Text>
                <Text style={styles.roleDesc}>Davolash & Qabullar</Text>
              </TouchableOpacity>

              {/* Medsestra */}
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  regRole === 'Medsestra' && [
                    styles.roleCardActive,
                    { borderColor: '#8B5CF6', backgroundColor: '#F5F3FF' },
                  ],
                ]}
                onPress={() => {
                  setRegRole('Medsestra');
                  setRegSecurityCode('');
                  setRegError(null);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.roleIconWrap,
                    regRole === 'Medsestra' && { backgroundColor: '#8B5CF6' },
                  ]}
                >
                  <NurseIcon
                    size={22}
                    color={regRole === 'Medsestra' ? '#FFFFFF' : '#8B5CF6'}
                  />
                </View>
                <Text
                  style={[
                    styles.roleTitle,
                    regRole === 'Medsestra' && { color: '#6D28D9', fontWeight: '700' },
                  ]}
                >
                  Medsestra
                </Text>
                <Text style={styles.roleDesc}>Hamshira & Muolaja</Text>
              </TouchableOpacity>

              {/* Menejer */}
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  regRole === 'Menejer' && [
                    styles.roleCardActive,
                    { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
                  ],
                ]}
                onPress={() => {
                  setRegRole('Menejer');
                  setRegSecurityCode('');
                  setRegError(null);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.roleIconWrap,
                    regRole === 'Menejer' && { backgroundColor: '#2563EB' },
                  ]}
                >
                  <ShieldCheckIcon
                    size={22}
                    color={regRole === 'Menejer' ? '#FFFFFF' : '#2563EB'}
                  />
                </View>
                <Text
                  style={[
                    styles.roleTitle,
                    regRole === 'Menejer' && { color: '#1D4ED8', fontWeight: '700' },
                  ]}
                >
                  Menejer
                </Text>
                <Text style={styles.roleDesc}>Kassa & Boshqaruv</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.roleNoteBox}>
              <LightbulbIcon size={14} color="#D97706" />
              <Text style={styles.roleNoteText}>{getRoleDescription(regRole)}</Text>
            </View>
          </View>

          {/* XAVFSIZLIK VA RUXSAT KODI TEKSHIRUVI */}
          {regRole === 'Menejer' && (
            <View style={styles.secBlockWrap}>
              <View style={styles.secBlockHeader}>
                <ShieldCheckIcon size={18} color="#2563EB" />
                <Text style={styles.secBlockTitle}>Bosh Admin Maxfiy Kodi (Master-kod):</Text>
              </View>
              <Text style={styles.secBlockSub}>
                Menejer akkauntida to‘liq kassa va hisobotlar bo‘lgani sababli, faqat klinika egasi kodini kiritib ocha oladi:
              </Text>
              <View style={styles.secInputRow}>
                <TextInput
                  style={[styles.regTextInput, { borderColor: '#2563EB', flex: 1 }]}
                  placeholder="Bosh admin parolini kiriting"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showSecurityCode}
                  value={regSecurityCode}
                  onChangeText={(t) => {
                    setRegSecurityCode(t);
                    setRegError(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.secEyeBtn}
                  onPress={() => setShowSecurityCode(!showSecurityCode)}
                >
                  <EyeIcon size={18} color={showSecurityCode ? '#2563EB' : '#64748B'} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.quickCodeBadge}
                onPress={() => {
                  const codes = getSecurityAccessCodes();
                  setRegSecurityCode(codes.masterAdminCode);
                  setRegError(null);
                }}
              >
                <ZapIcon size={12} color="#1D4ED8" />
                <Text style={styles.quickCodeBadgeText}>
                  Demo Master-kod: {getSecurityAccessCodes().masterAdminCode} (Kiritish)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {regRole === 'Shifokor' && (
            <View style={styles.secBlockWrap}>
              <View style={styles.secBlockHeader}>
                <DoctorIcon size={18} color="#0D9488" />
                <Text style={styles.secBlockTitle}>Shifokorlik Ruxsat Kodi:</Text>
              </View>
              <Text style={styles.secBlockSub}>
                Shifokor profilini faqat tasdiqlangan klinika stomatologlari ocha oladi:
              </Text>
              <View style={styles.secInputRow}>
                <TextInput
                  style={[styles.regTextInput, { borderColor: '#0D9488', flex: 1 }]}
                  placeholder="Shifokor kodini kiriting"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showSecurityCode}
                  value={regSecurityCode}
                  onChangeText={(t) => {
                    setRegSecurityCode(t);
                    setRegError(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.secEyeBtn}
                  onPress={() => setShowSecurityCode(!showSecurityCode)}
                >
                  <EyeIcon size={18} color={showSecurityCode ? '#0D9488' : '#64748B'} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.quickCodeBadge, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}
                onPress={() => {
                  const codes = getSecurityAccessCodes();
                  setRegSecurityCode(codes.doctorAccessCode);
                  setRegError(null);
                }}
              >
                <ZapIcon size={12} color="#0F766E" />
                <Text style={[styles.quickCodeBadgeText, { color: '#0F766E' }]}>
                  Demo Shifokor kodi: {getSecurityAccessCodes().doctorAccessCode} (Kiritish)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {regRole === 'Medsestra' && (
            <View style={styles.nurseNoticeBox}>
              <NurseIcon size={22} color="#8B5CF6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.nurseNoticeTitle}>Medsestra uchun ochiq ro‘yxatdan o‘tish</Text>
                <Text style={styles.nurseNoticeSub}>
                  Hamshiralar uchun tezkor ro‘yxatdan o‘tish. Barcha bemorlar, muolajalar va qabullarni boshqarishingiz mumkin.
                </Text>
              </View>
            </View>
          )}

          {/* 2. ISMINI KIRITISH (Masalan: Abdulloh) */}
          <View style={styles.regSection}>
            <Text style={styles.regSectionTitle}>2. Ismingizni kiriting:</Text>
            <TextInput
              style={[styles.regTextInput, { borderColor: regRoleColor }]}
              placeholder="Masalan: Abdulloh"
              placeholderTextColor="#94A3B8"
              value={regName}
              onChangeText={(text) => {
                setRegName(text);
                setRegError(null);
              }}
              autoCapitalize="words"
            />

            {/* Mavjud xodimlar ro'yxatidan tezkor tanlash */}
            {currentRoleStaff.length > 0 && (
              <View style={styles.quickStaffChipsWrap}>
                <Text style={styles.quickChipsTitle}>
                  Yoki avval ro‘yxatdan o‘tgan xodimlardan birini tanlang:
                </Text>
                <View style={styles.chipsRow}>
                  {currentRoleStaff.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.staffChip, { borderColor: regRoleColor }]}
                      onPress={() => handleSelectExistingStaff(s)}
                    >
                      <Text style={[styles.staffChipName, { color: regRoleColor }]}>
                        {s.name}
                      </Text>
                      <Text style={styles.staffChipArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* 3. 4 XONALI PIN KOD O'RNATISH */}
          <View style={styles.regSection}>
            <Text style={styles.regSectionTitle}>
              3. Kirish uchun 4 xonali PIN kod belgilang:
            </Text>
            <Text style={styles.regSectionSubtitle}>
              Ushbu 4 xonali PIN kod orqali keyingi safar to‘g‘ridan-to‘g‘ri kirasiz:
            </Text>
            <TextInput
              style={[styles.regPinInput, { borderColor: regRoleColor }]}
              placeholder="1234"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={4}
              value={regPin}
              onChangeText={(text) => {
                const numeric = text.replace(/[^0-9]/g, '').slice(0, 4);
                setRegPin(numeric);
                setRegError(null);
              }}
            />
          </View>

          {/* Xatolik xabari */}
          {regError && (
            <View style={styles.errorBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertCircleIcon size={16} color="#DC2626" />
                <Text style={styles.errorText}>{regError}</Text>
              </View>
            </View>
          )}

          {/* SAQLASH VA PIN OYNASIGA O'TISH TUGMASI */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: regRoleColor }]}
            onPress={handleSaveAndGoToPin}
            activeOpacity={0.8}
          >
            <View style={styles.btnRow}>
              <CheckIcon size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                Saqlash va PIN Oynasiga O‘tish →
              </Text>
            </View>
          </TouchableOpacity>

          {/* Agar avval eslab qolingan xodim bo'lsa, ortga qaytish */}
          {activeStaff && (
            <TouchableOpacity
              style={styles.cancelRegBtn}
              onPress={() => setViewMode('PIN_SCREEN')}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelRegText}>
                ← Ortga: "{activeStaff.name}" PIN oynasiga qaytish
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },

  // 1-OYNA: PIN CARD (Parol Oynasi)
  pinCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  miniLogoBadge: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Eslab qolingan foydalanuvchi kartasi
  userProfileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  heroAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  heroUserInfo: {
    flex: 1,
  },
  heroUserName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  heroRoleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitleSub: {
    fontSize: 11,
    color: '#64748B',
  },

  // PIN maydoni
  pinPromptSection: {
    alignItems: 'center',
    width: '100%',
  },
  pinPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  pinPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  pinSlotsContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pinSlotsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pinSlot: {
    width: 54,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSlotActive: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  pinSlotFilled: {
    backgroundColor: '#FFFFFF',
  },
  pinSlotError: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  pinDigitText: {
    fontSize: 22,
    fontWeight: '800',
  },
  pinCursor: {
    width: 2,
    height: 22,
    borderRadius: 1,
  },
  eyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginTop: 4,
    marginBottom: 12,
    // @ts-ignore
    cursor: 'pointer',
  },
  eyeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  transparentInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.0001,
    zIndex: 10,
    // @ts-ignore
    cursor: 'pointer',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Sensorli NumPad
  keypad: {
    width: '100%',
    gap: 8,
    marginBottom: 14,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keyBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  keyBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  keyBtnSpecial: {
    backgroundColor: '#F1F5F9',
  },
  keySpecialText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  keySpecialSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Kirish tugmasi
  submitBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // @ts-ignore
    cursor: 'pointer',
  },
  submitBtnReady: {
    transform: [{ scale: 1.01 }],
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickDemoBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
  },
  quickDemoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E',
  },

  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 18,
  },

  // Boshqa xodimga o'tish tugmasi
  switchStaffCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchStaffTextWrap: {
    flex: 1,
  },
  switchStaffTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  switchStaffSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  switchArrow: {
    fontSize: 16,
    color: '#0D9488',
    fontWeight: '700',
  },

  // 2-OYNA: RO'YXATDAN O'TISH KARTASI
  regCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
  },
  regSection: {
    marginBottom: 18,
  },
  regSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  regSectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleCardActive: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  roleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  roleNoteBox: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleNoteText: {
    fontSize: 11,
    color: '#475569',
  },

  regTextInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  quickStaffChipsWrap: {
    marginTop: 10,
  },
  quickChipsTitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
  },
  staffChipName: {
    fontSize: 12,
    fontWeight: '600',
  },
  staffChipArrow: {
    fontSize: 12,
    color: '#64748B',
  },

  regPinInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },

  cancelRegBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelRegText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  // Xavfsizlik kodi bloklari
  secBlockWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  secBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  secBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  secBlockSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  secInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secEyeBtn: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCodeBadge: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickCodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  // Medsestra xabari
  nurseNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  nurseNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7E22CE',
    marginBottom: 2,
  },
  nurseNoticeSub: {
    fontSize: 11,
    color: '#6B21A8',
    lineHeight: 16,
  },

  // Modal styles: Xodim tanlash (StaffPickerModal)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  staffModalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  staffModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  staffModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staffModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  staffModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  staffListScroll: {
    maxHeight: 380,
  },
  staffPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  staffPickerItemActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  staffPickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  staffPickerAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  staffPickerInfo: {
    flex: 1,
    marginRight: 8,
  },
  staffPickerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  staffPickerTitle: {
    fontSize: 11,
    color: '#64748B',
  },
  staffPickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  staffPickerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // --- SETUP ONBOARDING OYNASI STYLES ---
  setupBanner: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  setupBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#0F766E',
    lineHeight: 18,
    fontWeight: '500',
  },
  setupErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  setupErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  setupForm: {
    gap: 14,
  },
  setupFieldGroup: {
    gap: 6,
  },
  setupFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  setupFieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  setupInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  setupPasswordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  setupPasswordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  setupEyeBtn: {
    padding: 10,
  },
  setupSubmitBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  setupSubmitBtnDisabled: {
    opacity: 0.6,
  },
  setupSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // =========================================================================
  // DESKTOP / KOMPYUTER EKRANI STYLES (Mockup asosida)
  // =========================================================================
  desktopContainer: {
    flex: 1,
    backgroundColor: '#071524',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    // @ts-ignore
    minHeight: '100vh',
    width: '100%',
  },
  ambientCircleBottomLeft: {
    position: 'absolute',
    bottom: -160,
    left: -160,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: '#0D2744',
    opacity: 0.6,
  },
  ambientCircleTopRight: {
    position: 'absolute',
    top: -160,
    right: -160,
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: '#0D2744',
    opacity: 0.5,
  },
  desktopPinCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 44,
    paddingVertical: 38,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.35,
    shadowRadius: 50,
    elevation: 20,
  },
  desktopLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  desktopLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopBrandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  desktopBrandSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  desktopUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  desktopUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  desktopAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  desktopUserInfo: {
    justifyContent: 'center',
  },
  desktopUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  desktopUserSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  desktopRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F9F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  desktopRoleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
  },
  desktopRoleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  desktopPinSection: {
    width: '100%',
  },
  desktopPinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  desktopPinSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  desktopPinBoxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    position: 'relative',
    marginBottom: 8,
    width: '100%',
  },
  desktopPinBox: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopPinBoxActive: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  desktopPinBoxFilled: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
  },
  desktopPinBoxError: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  desktopPinDotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  desktopPinDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CBD5E1',
  },
  desktopPinDigitText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563EB',
  },
  desktopShowRow: {
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 4,
  },
  desktopShowBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  desktopShowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  desktopSubmitBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  desktopSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  desktopHelperText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 22,
  },
});

