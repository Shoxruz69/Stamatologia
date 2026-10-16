import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  SettingsIcon,
  CheckIcon,
  TrashIcon,
  LockIcon,
  KeyIcon,
  ShieldCheckIcon,
  DoctorIcon,
  NurseIcon,
  EyeIcon,
  EditIcon,
  LogOutIcon,
  UsersIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from '../components/common/Icons';
import {
  getSecurityAccessCodes,
  saveSecurityAccessCodes,
  getStoredStaffMembers,
  updateStaffPin,
  updateStaffMember,
  setRememberedStaff,
  generateAvatarInitials,
  SecurityAccessCodes,
} from '../utils/staffData';
import { StaffMember } from '../types';
import { getApiBaseUrl, getDisplayApiBaseUrl } from '../services/apiClient';

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateSettings,
    logout,
    currentUser,
    updateCurrentUser,
    showToast,
    serverStatus,
    dbStatus,
    lastSyncError,
    isSyncing,
    syncWithBackend,
    migrateLocalDataToPostgres,
    downloadLocalBackup,
  } = useApp();

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [showLegacyMigration, setShowLegacyMigration] = useState(false);

  const isManager = currentUser?.role === 'Menejer';

  // Ro'yxatdan o'tish ruxsat kodlari va xodim PIN-kodlarini boshqarish bo'limlarini odatiy foydalanishdan yashirish
  // (Kod va bazadan o'chirilmagan, kelgusida qayta faollashtirish mumkin)
  const SHOW_SECURITY_AND_PIN_MANAGEMENT = false;

  // --- 1. KLINIKA REKVIZITLARI STATE (Faqat Menejer uchun) ---
  const [clinicName, setClinicName] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [defaultDuration, setDefaultDuration] = useState('30');
  const [currency, setCurrency] = useState('UZS (so‘m)');

  // --- 2. SHAXSIY PROFIL & PIN STATE (Barcha xodimlar uchun) ---
  const [personalName, setPersonalName] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPersonalPins, setShowPersonalPins] = useState(false);

  // --- 3. RUXSAT KODLARI STATE (Faqat Menejer uchun) ---
  const [masterAdminCode, setMasterAdminCode] = useState('admin2026');
  const [doctorAccessCode, setDoctorAccessCode] = useState('doc777');
  const [nurseAccessCode, setNurseAccessCode] = useState('nurse2026');
  const [showAccessCodes, setShowAccessCodes] = useState(false);

  // --- 4. SHIFOKOR VA MEDSESTRALAR PIN BOSHQARUVI STATE (Menejer uchun) ---
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);
  const [editingStaffNewPin, setEditingStaffNewPin] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'All' | 'Shifokor' | 'Medsestra'>('All');

  // Boshlang'ich yuklash
  useEffect(() => {
    if (settings) {
      setClinicName(settings.name || '');
      setTagline(settings.tagline || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setWorkingHours(settings.workingHours || '');
      setDefaultDuration(settings.defaultAppointmentDuration?.toString() || '30');
      setCurrency(settings.currency || 'UZS (so‘m)');
    }

    if (currentUser) {
      setPersonalName(currentUser.name || '');
      setPersonalPhone(currentUser.title || '');
    }

    // Ruxsat kodlari va xodimlar ro'yxatini yuklash
    const codes = getSecurityAccessCodes();
    setMasterAdminCode(codes.masterAdminCode);
    setDoctorAccessCode(codes.doctorAccessCode);
    setNurseAccessCode(codes.nurseAccessCode);

    setStaffList(getStoredStaffMembers());
  }, [settings, currentUser]);

  // 1. Klinika rekvizitlarini saqlash
  const handleSaveClinicSettings = () => {
    if (!clinicName.trim()) {
      showToast('Klinika nomini kiritish majburiy!', 'error');
      return;
    }
    updateSettings({
      name: clinicName.trim(),
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      workingHours: workingHours.trim(),
      defaultAppointmentDuration: parseInt(defaultDuration, 10) || 30,
      currency: currency.trim(),
    });
  };

  // 2. Shaxsiy profil va PIN kodni yangilash
  const handleSavePersonalProfile = () => {
    const cleanName = personalName.trim();
    if (!cleanName) {
      showToast(isManager ? 'Menejer F.I.Sh kiritilishi majburiy!' : 'Ismingizni kiritish majburiy!', 'error');
      return;
    }

    const cleanNewPin = newPin.trim();
    const cleanConfirmPin = confirmPin.trim();

    // Agar PIN maydonlaridan birontasi to'ldirilgan bo'lsa
    if (cleanNewPin || cleanConfirmPin) {
      if (cleanNewPin.length !== 4) {
        showToast('Yangi PIN kod aynan 4 ta raqamdan iborat bo‘lishi kerak!', 'error');
        return;
      }
      if (!/^\d{4}$/.test(cleanNewPin)) {
        showToast('PIN kod faqat raqamlardan iborat bo‘lishi kerak!', 'error');
        return;
      }
      if (!cleanConfirmPin) {
        showToast('Iltimos, yangi PIN kodni tasdiqlang!', 'error');
        return;
      }
      if (cleanNewPin !== cleanConfirmPin) {
        showToast('Yangi PIN kod tasdiqlash bilan mos kelmadi! Ikkala maydonga bir xil kod kiriting.', 'error');
        return;
      }
    }

    // Agar non-manager bo'lsa va yangi PIN kiritilgan bo'lsa, joriy PIN tekshiruvi
    if (!isManager && cleanNewPin) {
      if (!currentPin.trim()) {
        showToast('Parolni o‘zgartirish uchun joriy PIN kodingizni kiriting!', 'error');
        return;
      }
      const allStaff = getStoredStaffMembers();
      const currentStaff = allStaff.find((s) => s.id === currentUser?.id);
      if (currentStaff && currentStaff.pin && currentPin.trim() !== currentStaff.pin) {
        showToast('Joriy PIN kod noto‘g‘ri kiritildi!', 'error');
        return;
      }
    }

    const targetStaffId = currentUser?.id || 'staff-man-0';
    const updatedPin = cleanNewPin ? cleanNewPin : (currentUser?.pin || '1234');
    const newAvatar = generateAvatarInitials(cleanName);

    // 1. currentUser holatini yangilash
    updateCurrentUser({
      name: cleanName,
      avatar: newAvatar,
      pin: updatedPin,
      title: personalPhone.trim() || currentUser?.title,
    });

    // 2. staffData dagi doimiy bazani yangilash
    if (cleanNewPin) {
      updateStaffPin(targetStaffId, cleanNewPin);
    }
    updateStaffMember(targetStaffId, {
      name: cleanName,
      avatar: newAvatar,
      pin: updatedPin,
    });

    // 3. Eslab qolingan xodimni ham yangilash
    const allStaff = getStoredStaffMembers();
    const updatedMember = allStaff.find((s) => s.id === targetStaffId) || allStaff.find((s) => s.role === 'Menejer');
    if (updatedMember) {
      setRememberedStaff({
        ...updatedMember,
        name: cleanName,
        avatar: newAvatar,
        pin: updatedPin,
      });
    }

    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setStaffList(allStaff);

    if (cleanNewPin) {
      showToast(isManager ? 'Menejer paroli (PIN-kod) muvaffaqiyatli yangilandi!' : 'PIN kod muvaffaqiyatli yangilandi!');
    } else {
      showToast('Profil ma’lumotlari muvaffaqiyatli saqlandi!');
    }
  };

  // 3. Tizim ruxsat kodlarini saqlash (Menejer)
  const handleSaveSecurityCodes = () => {
    if (!masterAdminCode.trim()) {
      showToast('Master admin kodi bo‘sh bo‘lishi mumkin emas!', 'error');
      return;
    }
    if (!doctorAccessCode.trim()) {
      showToast('Shifokorlik ruxsat kodi bo‘sh bo‘lishi mumkin emas!', 'error');
      return;
    }

    const newCodes: SecurityAccessCodes = {
      masterAdminCode: masterAdminCode.trim(),
      doctorAccessCode: doctorAccessCode.trim(),
      nurseAccessCode: nurseAccessCode.trim() || 'nurse2026',
    };
    saveSecurityAccessCodes(newCodes);
    showToast('Tizim ruxsat kodlari muvaffaqiyatli saqlandi!');
  };

  // 4. Menejer tomonidan xodimning PIN kodini o'zgartirish
  const handleSaveStaffPinByManager = () => {
    if (!editingStaffMember) return;
    if (editingStaffNewPin.trim().length !== 4 || !/^\d{4}$/.test(editingStaffNewPin.trim())) {
      showToast('PIN kod roppa-rosa 4 ta raqam bo‘lishi kerak (masalan: 1234)!', 'error');
      return;
    }

    updateStaffPin(editingStaffMember.id, editingStaffNewPin.trim());
    setStaffList(getStoredStaffMembers());
    showToast(`"${editingStaffMember.name}" xodimining PIN kodi muvaffaqiyatli yangilandi!`);
    setEditingStaffMember(null);
    setEditingStaffNewPin('');
  };

  // Filtrlangan xodimlar (Menejer uchun)
  const filteredStaff = staffList.filter((s) => {
    if (staffRoleFilter === 'All') return true;
    return s.role === staffRoleFilter;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ============================================================ */}
      {/* 1. SHIFOKOR VA MEDSESTRA UCHUN SOZLAMALAR (Shaxsiy sozlamalar) */}
      {/* ============================================================ */}
      {!isManager ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Shaxsiy Profil va Xavfsizlik Sozlamalari</Text>
            <Text style={styles.subtitle}>
              Profilingiz, ismingiz va tizimga kirish parolini (PIN-kod) o‘zgartiring
            </Text>
          </View>

          {/* Xodim kartasi */}
          <View style={styles.card}>
            <View style={styles.profileBadgeRow}>
              <View
                style={[
                  styles.avatarLargeCircle,
                  { backgroundColor: currentUser?.avatarColor || colors.primary },
                ]}
              >
                <Text style={styles.avatarLargeText}>
                  {currentUser?.avatar || currentUser?.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileCardName}>{currentUser?.name}</Text>
                <Text style={styles.profileCardTitle}>
                  {currentUser?.title || (currentUser?.role === 'Shifokor' ? 'Stomatolog-shifokor' : 'Hamshira')}
                </Text>
                <View style={styles.roleBadgeWrap}>
                  <Badge
                    status={currentUser?.role === 'Shifokor' ? 'Faol' : 'Kutilmoqda'}
                    size="sm"
                  />
                  <Text style={styles.roleBadgeText}>
                    {currentUser?.role === 'Shifokor' ? 'Shifokor' : 'Hamshira (Medsestra)'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>Profil Ma’lumotlarini Tahrirlash</Text>
            <Input
              label="F.I.Sh (To‘liq ismingiz)"
              required
              value={personalName}
              onChangeText={setPersonalName}
              placeholder="Masalan: Dr. Jamshid Karimov"
            />

            <Input
              label="Mutaxassislik yoki aloqa ma’lumoti"
              value={personalPhone}
              onChangeText={setPersonalPhone}
              placeholder="Masalan: Terapevt-stomatolog yoki +998 90 123 45 67"
            />
          </View>

          {/* Shaxsiy PIN-kod (Parol)ni o'zgartirish */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Tizimga Kirish PIN-kodi (Parol)</Text>
                <Text style={styles.cardSubtitle}>
                  Parolingizni yangilash uchun joriy PIN va yangi 4 xonali kodni kiriting
                </Text>
              </View>
              <TouchableOpacity
                style={styles.eyeToggleBtn}
                onPress={() => setShowPersonalPins(!showPersonalPins)}
              >
                <EyeIcon size={18} color={showPersonalPins ? colors.primary : colors.textMuted} />
                <Text style={styles.eyeToggleText}>
                  {showPersonalPins ? 'Yashirish' : 'Ko‘rsatish'}
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Joriy PIN kod"
              value={currentPin}
              onChangeText={(val) => setCurrentPin(val.replace(/\D/g, '').slice(0, 4))}
              placeholder="Masalan: 1234"
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry={!showPersonalPins}
            />

            <View style={styles.grid2}>
              <Input
                label="Yangi 4 xonali PIN kod"
                value={newPin}
                onChangeText={(val) => setNewPin(val.replace(/\D/g, '').slice(0, 4))}
                placeholder="Masalan: 5678"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={!showPersonalPins}
              />

              <Input
                label="Yangi PIN kodni tasdiqlang"
                value={confirmPin}
                onChangeText={(val) => setConfirmPin(val.replace(/\D/g, '').slice(0, 4))}
                placeholder="Yangi PINni qayta kiriting"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={!showPersonalPins}
              />
            </View>

            <View style={styles.saveBtnWrap}>
              <Button
                title="Profil va PIN kodni Saqlash"
                variant="primary"
                icon={<CheckIcon size={16} color="#FFF" />}
                onPress={handleSavePersonalProfile}
              />
            </View>
          </View>

          {/* Chiqish kartasi */}
          <View style={[styles.card, styles.logoutCard]}>
            <Text style={styles.cardTitle}>Tizimdan Chiqish</Text>
            <Text style={styles.cardSubtitle}>
              Amaliyot yakunlangach boshqa xodim kirishi uchun akkauntdan chiqishingiz mumkin
            </Text>
            <View style={{ alignItems: 'flex-start', marginTop: 8 }}>
              <Button
                title="Tizimdan Chiqish (Logout)"
                variant="danger"
                icon={<LogOutIcon size={16} color="#FFF" />}
                onPress={logout}
              />
            </View>
          </View>
        </>
      ) : (
        /* ============================================================ */
        /* 2. MENEJER UCHUN TO'LIQ SOZLAMALAR                           */
        /* ============================================================ */
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Tizim va Klinika Boshqaruv Sozlamalari</Text>
            <Text style={styles.subtitle}>
              {SHOW_SECURITY_AND_PIN_MANAGEMENT
                ? 'Klinika rekvizitlari, xavfsizlik kodlari, xodimlar parollari va tizim amallari'
                : 'Klinika rekvizitlari, shaxsiy parol va tizim amallari'}
            </Text>
          </View>

          {/* BO'LIM 1: KLINIKA REKVIZITLARI */}
          <View style={styles.card}>
            <View style={styles.sectionBadgeTitleRow}>
              <View style={styles.sectionBadgeIcon}>
                <SettingsIcon size={18} color="#0D9488" />
              </View>
              <Text style={styles.cardTitle}>1. Klinika Rekvizitlari va Ish Tartibi</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Ushbu ma’lumotlar to‘lov kvitansiyalari (cheklar) va bemorlarga yuboriladigan xabarlarda aks etadi.
            </Text>

            <Input
              label="Klinika nomi"
              required
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="DentaCare Stomatologiya Markazi"
            />

            <Input
              label="Shior (Tagline)"
              value={tagline}
              onChangeText={setTagline}
              placeholder="Sizning tabassumingiz — bizning faxrimiz"
            />

            <View style={styles.grid2}>
              <Input
                label="Klinika manzili"
                required
                value={address}
                onChangeText={setAddress}
                placeholder="Toshkent shahri, Amir Temur ko‘chasi, 45-uy"
                containerStyle={styles.gridCol}
              />

              <Input
                label="Aloqa telefoni"
                required
                value={phone}
                onChangeText={setPhone}
                placeholder="+998 71 200 40 50"
                keyboardType="phone-pad"
                containerStyle={styles.gridCol}
              />
            </View>

            <View style={styles.grid2}>
              <Input
                label="Ish vaqti grafigi"
                value={workingHours}
                onChangeText={setWorkingHours}
                placeholder="Dush - Shanba: 09:00 - 19:00"
                containerStyle={styles.gridCol}
              />

              <Input
                label="Standart qabul davomiyligi (daqiqa)"
                value={defaultDuration}
                onChangeText={setDefaultDuration}
                placeholder="30"
                keyboardType="numeric"
                suffix="daqiqa"
                containerStyle={styles.gridCol}
              />
            </View>

            <View style={styles.saveBtnWrap}>
              <Button
                title="Klinika Sozlamalarini Saqlash"
                variant="primary"
                icon={<CheckIcon size={16} color="#FFF" />}
                onPress={handleSaveClinicSettings}
              />
            </View>
          </View>

          {/* BO'LIM 2: MENEJERNING O'Z PAROLINI (PIN) O'ZGARTIRISH */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.sectionBadgeTitleRow}>
                <View style={[styles.sectionBadgeIcon, { backgroundColor: '#EFF6FF' }]}>
                  <LockIcon size={18} color="#2563EB" />
                </View>
                <Text style={styles.cardTitle}>2. Menejerning Shaxsiy Paroli (PIN-kod)</Text>
              </View>

              <TouchableOpacity
                style={styles.eyeToggleBtn}
                onPress={() => setShowPersonalPins(!showPersonalPins)}
              >
                <EyeIcon size={18} color={showPersonalPins ? colors.primary : colors.textMuted} />
                <Text style={styles.eyeToggleText}>
                  {showPersonalPins ? 'Yashirish' : 'PINni ko‘rish'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardSubtitle}>
              Menejer admin hisobingizga kirish uchun shaxsiy 4 xonali PIN kodingizni yangilang
            </Text>

            <Input
              label="Menejer F.I.Sh"
              value={personalName}
              onChangeText={setPersonalName}
              placeholder="Aziza Rustamova"
            />

            <View style={styles.grid2}>
              <Input
                label="Yangi 4 xonali PIN kod"
                value={newPin}
                onChangeText={(val) => {
                  const cleaned = val.replace(/\D/g, '').slice(0, 4);
                  setNewPin(cleaned);
                }}
                placeholder="Masalan: 4321"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={!showPersonalPins}
                containerStyle={styles.gridCol}
              />

              <Input
                label="Yangi PIN kodni tasdiqlang"
                value={confirmPin}
                onChangeText={(val) => {
                  const cleaned = val.replace(/\D/g, '').slice(0, 4);
                  setConfirmPin(cleaned);
                }}
                placeholder="Yangi PINni qayta kiriting"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={!showPersonalPins}
                containerStyle={styles.gridCol}
              />
            </View>

            <View style={styles.saveBtnWrap}>
              <Button
                title="Menejer Parolini Yangilash"
                variant="primary"
                icon={<CheckIcon size={16} color="#FFF" />}
                onPress={handleSavePersonalProfile}
              />
            </View>
          </View>

          {/* BO'LIM 3: TIZIM RUXSAT KODLARI VA BO'LIM 4: XODIM PIN KODLARI (HOZIRCHA YASHIRILGAN) */}
          {/* Kod va baza ma'lumotlari butunlay saqlangan, kerak bo'lganda SHOW_SECURITY_AND_PIN_MANAGEMENT orqali ochiladi */}
          {SHOW_SECURITY_AND_PIN_MANAGEMENT && (
            <>
              {/* BO'LIM 3: TIZIM RUXSAT KODLARI (XAVFSIZLIK KODLARI) */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.sectionBadgeTitleRow}>
                    <View style={[styles.sectionBadgeIcon, { backgroundColor: '#F0FDF4' }]}>
                      <ShieldCheckIcon size={18} color="#16A34A" />
                    </View>
                    <Text style={styles.cardTitle}>3. Tizim Ruxsat Kodlari (Kirish Kalitlari)</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.eyeToggleBtn}
                    onPress={() => setShowAccessCodes(!showAccessCodes)}
                  >
                    <EyeIcon size={18} color={showAccessCodes ? colors.primary : colors.textMuted} />
                    <Text style={styles.eyeToggleText}>
                      {showAccessCodes ? 'Yashirish' : 'Kodlarni ko‘rish'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardSubtitle}>
                  Yangi shifokorlar va xodimlar ro‘yxatdan o‘tayotganda so‘raladigan maxfiy tasdiq kodlarini o‘zgartiring:
                </Text>

                <Input
                  label="Bosh Admin Maxfiy Kodi (Master-kod)"
                  required
                  value={masterAdminCode}
                  onChangeText={setMasterAdminCode}
                  placeholder="admin2026"
                  secureTextEntry={!showAccessCodes}
                  hint="Yangi Menejer hisobini ochish uchun so‘raladigan maxsus kod"
                />

                <View style={styles.grid2}>
                  <Input
                    label="Shifokorlik Ruxsat Kodi"
                    required
                    value={doctorAccessCode}
                    onChangeText={setDoctorAccessCode}
                    placeholder="doc777"
                    secureTextEntry={!showAccessCodes}
                    hint="Shifokor profilini ro‘yxatdan o‘tkazish uchun kod"
                  />

                  <Input
                    label="Medsestralar Ruxsat Kodi"
                    value={nurseAccessCode}
                    onChangeText={setNurseAccessCode}
                    placeholder="nurse2026"
                    secureTextEntry={!showAccessCodes}
                    hint="Hamshiralar uchun belgilangan xavfsizlik kodi"
                  />
                </View>

                <View style={styles.saveBtnWrap}>
                  <Button
                    title="Ruxsat Kodlarini Saqlash"
                    variant="primary"
                    icon={<KeyIcon size={16} color="#FFF" />}
                    onPress={handleSaveSecurityCodes}
                  />
                </View>
              </View>

              {/* BO'LIM 4: SHIFOKOR VA MEDSESTRALAR PAROLLARINI BOSHQARISH */}
              <View style={styles.card}>
                <View style={styles.sectionBadgeTitleRow}>
                  <View style={[styles.sectionBadgeIcon, { backgroundColor: '#FDF2F8' }]}>
                    <UsersIcon size={18} color="#DB2777" />
                  </View>
                  <Text style={styles.cardTitle}>4. Shifokor va Medsestralar Parollarini Boshqarish</Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  Klinika xodimlari parolini (PIN-kod) unutganda yoki yangilash kerak bo‘lganda to‘g‘ridan-to‘g‘ri o‘zgartiring:
                </Text>

                {/* Filtr tugmalari */}
                <View style={styles.staffFilterRow}>
                  {(['All', 'Shifokor', 'Medsestra'] as const).map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.staffFilterPill,
                        staffRoleFilter === role && styles.staffFilterPillActive,
                      ]}
                      onPress={() => setStaffRoleFilter(role)}
                    >
                      <Text
                        style={[
                          styles.staffFilterPillText,
                          staffRoleFilter === role && styles.staffFilterPillTextActive,
                        ]}
                      >
                        {role === 'All' ? 'Barcha Xodimlar' : role === 'Shifokor' ? 'Shifokorlar' : 'Medsestralar'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Xodimlar ro'yxati */}
                <View style={styles.staffTableWrap}>
                  {filteredStaff.map((staff) => (
                    <View key={staff.id} style={styles.staffRowItem}>
                      <View style={styles.staffRowLeft}>
                        <View
                          style={[
                            styles.staffAvatarCircle,
                            { backgroundColor: staff.avatarColor || colors.primary },
                          ]}
                        >
                          <Text style={styles.staffAvatarText}>{staff.avatar}</Text>
                        </View>
                        <View>
                          <Text style={styles.staffRowName}>{staff.name}</Text>
                          <Text style={styles.staffRowTitle}>
                            {staff.title || (staff.role === 'Shifokor' ? 'Stomatolog' : 'Hamshira')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.staffRowRight}>
                        <View
                          style={[
                            styles.roleBadgeBox,
                            staff.role === 'Shifokor'
                              ? { backgroundColor: '#F0FDFA' }
                              : staff.role === 'Medsestra'
                              ? { backgroundColor: '#F5F3FF' }
                              : { backgroundColor: '#EFF6FF' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleBadgeBoxText,
                              staff.role === 'Shifokor'
                                ? { color: '#0D9488' }
                                : staff.role === 'Medsestra'
                                ? { color: '#8B5CF6' }
                                : { color: '#2563EB' },
                            ]}
                          >
                            {staff.role}
                          </Text>
                        </View>

                        <View style={styles.staffPinBox}>
                          <Text style={styles.staffPinLabel}>PIN: </Text>
                          <Text style={styles.staffPinVal}>{staff.pin}</Text>
                        </View>

                        <Button
                          title="PINni O‘zgartirish"
                          variant="outline"
                          size="sm"
                          icon={<EditIcon size={14} color={colors.textSecondary} />}
                          onPress={() => {
                            setEditingStaffMember(staff);
                            setEditingStaffNewPin(staff.pin);
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* BO'LIM: MARKAZIY POSTGRESQL BAZA & ZAXIRA BOSHQARUVI */}
          {/* BO'LIM 2: MARKAZIY POSTGRESQL BAZA (Render / Bulutli) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.sectionBadgeTitleRow}>
                <View style={[styles.sectionBadgeIcon, { backgroundColor: '#EFF6FF' }]}>
                  <SettingsIcon size={18} color="#2563EB" />
                </View>
                <Text style={styles.cardTitle}>Markaziy PostgreSQL Baza & Bulutli Ulanish</Text>
              </View>

              <View
                style={[
                  styles.dbHeaderBadge,
                  dbStatus === 'connected' ? styles.dbHeaderBadgeConnected : styles.dbHeaderBadgeOffline,
                ]}
              >
                <View
                  style={[
                    styles.dbHeaderDot,
                    dbStatus === 'connected' ? styles.dbHeaderDotConnected : styles.dbHeaderDotOffline,
                  ]}
                />
                <Text
                  style={[
                    styles.dbHeaderBadgeText,
                    dbStatus === 'connected' ? styles.dbHeaderBadgeTextConnected : styles.dbHeaderBadgeTextOffline,
                  ]}
                >
                  {dbStatus === 'connected' ? 'PostgreSQL Faol' : 'Baza bilan aloqa uzilgan'}
                </Text>
              </View>
            </View>

            <Text style={styles.cardSubtitle}>
              Barcha kompyuter va planshetlar internet orqali Render bulutidagi yagona markaziy bazaga ulanib ishlaydi.
            </Text>

            {/* Baza holati kartasi */}
            <View style={styles.dbInfoBox}>
              <View style={styles.dbInfoRow}>
                <Text style={styles.dbInfoLabel}>Ma’lumotlar bazasi:</Text>
                <Text style={styles.dbInfoValue}>PostgreSQL (Render Managed Database)</Text>
              </View>
              <View style={styles.dbInfoRow}>
                <Text style={styles.dbInfoLabel}>Backend API manzili:</Text>
                <Text style={styles.dbInfoValue}>{getDisplayApiBaseUrl()}</Text>
              </View>
              <View style={styles.dbInfoRow}>
                <Text style={styles.dbInfoLabel}>Ulanish holati:</Text>
                <Text
                  style={[
                    styles.dbInfoValue,
                    { color: dbStatus === 'connected' ? '#16A34A' : '#DC2626', fontWeight: '700' },
                  ]}
                >
                  {dbStatus === 'connected'
                    ? 'Markaziy PostgreSQL bazasiga muvaffaqiyatli ulangan'
                    : 'Baza ulanmagan (Serverga ulanib bo‘lmadi)'}
                </Text>
              </View>
              {lastSyncError && (
                <View style={styles.dbErrorNotice}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AlertTriangleIcon size={15} color="#D97706" />
                    <Text style={styles.dbErrorNoticeText}>{lastSyncError}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Ulanishni tekshirish va zaxira boshqaruvi */}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                title={isSyncing ? 'Tekshirilmoqda...' : 'Ulanishni Qayta Tekshirish'}
                variant="primary"
                disabled={isSyncing}
                onPress={syncWithBackend}
              />
              <Button
                title={showLegacyMigration ? 'Zaxira bo‘limini yashirish' : 'Eski zaxirani import qilish (Zarur bo‘lsa)'}
                variant="outline"
                onPress={() => setShowLegacyMigration(!showLegacyMigration)}
              />
            </View>

            {/* Eski ma'lumotlarni import qilish (faqat ochilganda ko'rinadi) */}
            {showLegacyMigration && (
              <View style={[styles.migrationActionsContainer, { marginTop: 16 }]}>
                <View style={styles.migrationActionCard}>
                  <Text style={styles.migrationActionTitle}>Lokal Zaxira Nusxasini Saqlash</Text>
                  <Text style={styles.migrationActionDesc}>
                    Brauzer xotirasidagi ma’lumotlarni xavfsiz JSON zaxira fayl qilib yuklab oling.
                  </Text>
                  <Button
                    title="Lokal Zaxira Faylini Yuklab Olish (.json)"
                    variant="outline"
                    onPress={downloadLocalBackup}
                  />
                </View>

                <View style={styles.migrationActionCard}>
                  <Text style={styles.migrationActionTitle}>PostgreSQL Bazasiga Import Qilish</Text>
                  <Text style={styles.migrationActionDesc}>
                    Eski lokal ma’lumotlarni markaziy PostgreSQL bazasiga import qiling.
                  </Text>
                  <Button
                    title={isMigrating ? 'Ko‘chirilmoqda...' : 'Markaziy Bazaga Import Qilish'}
                    variant="primary"
                    disabled={isMigrating}
                    onPress={() => setShowMigrateConfirm(true)}
                  />
                </View>
              </View>
            )}

            {/* Migratsiya natijasi / Solishtirish hisoboti (Reconciliation) */}
            {migrationResult && migrationResult.success && (
              <View style={styles.reconciliationBox}>
                <View style={styles.reconciliationHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CheckCircleIcon size={16} color="#059669" />
                    <Text style={styles.reconciliationTitle}>Migratsiya va Solishtirish Natijasi</Text>
                  </View>
                </View>
                <Text style={styles.reconciliationDesc}>
                  Lokal xotiradagi barcha yozuvlar tekshirilib, markaziy PostgreSQL bazasiga kiritildi:
                </Text>
                <View style={styles.reconciliationGrid}>
                  <View style={styles.reconciliationCol}>
                    <Text style={styles.reconciliationVal}>
                      {migrationResult.details?.imported?.patients ?? '—'}
                    </Text>
                    <Text style={styles.reconciliationLabel}>Ko‘chirilgan Bemorlar</Text>
                  </View>
                  <View style={styles.reconciliationCol}>
                    <Text style={styles.reconciliationVal}>
                      {migrationResult.details?.imported?.appointments ?? '—'}
                    </Text>
                    <Text style={styles.reconciliationLabel}>Ko‘chirilgan Qabullar</Text>
                  </View>
                  <View style={styles.reconciliationCol}>
                    <Text style={styles.reconciliationVal}>
                      {migrationResult.details?.imported?.payments ?? '—'}
                    </Text>
                    <Text style={styles.reconciliationLabel}>Ko‘chirilgan To‘lovlar</Text>
                  </View>
                  <View style={styles.reconciliationCol}>
                    <Text style={styles.reconciliationVal}>
                      {migrationResult.details?.databaseTotals?.totalRevenue
                        ? `${migrationResult.details.databaseTotals.totalRevenue.toLocaleString()} so‘m`
                        : '0 so‘m'}
                    </Text>
                    <Text style={styles.reconciliationLabel}>Bazadagi Jami Tushum</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </>
      )}

      {/* XODIMNING PIN KODINI O'ZGARTIRISH MODALI (MENEJER UCHUN) */}
      <Modal
        visible={!!editingStaffMember}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingStaffMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xodim PIN-kodini Yangilash</Text>
              <Text style={styles.modalSubtitle}>
                {editingStaffMember?.name} ({editingStaffMember?.role})
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalInputLabel}>Yangi 4 xonali PIN kodni kiriting:</Text>
              <TextInput
                style={styles.modalPinInput}
                value={editingStaffNewPin}
                onChangeText={setEditingStaffNewPin}
                placeholder="Masalan: 1234"
                keyboardType="numeric"
                maxLength={4}
                autoFocus={true}
              />
              <Text style={styles.modalInputHint}>
                Xodim tizimga kirishda ushbu yangi 4 xonali PIN koddan foydalanadi.
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <Button
                title="Bekor qilish"
                variant="outline"
                onPress={() => setEditingStaffMember(null)}
              />
              <Button
                title="PINni Saqlash"
                variant="primary"
                icon={<CheckIcon size={16} color="#FFF" />}
                onPress={handleSaveStaffPinByManager}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Migratsiya tasdiq dialogi */}
      <ConfirmDialog
        visible={showMigrateConfirm}
        title="PostgreSQL Bazasiga Ko‘chirish"
        message="Lokal xotiradagi barcha bemorlar, qabullar va to‘lovlar markaziy PostgreSQL bazasiga import qilinadi. Takroriy yozuvlar yaratilmaydi va mavjud ma’lumotlar yo‘qolmaydi. Davom ettirasizmi?"
        confirmText="Ko‘chirishni boshlash"
        isDestructive={false}
        onConfirm={async () => {
          setShowMigrateConfirm(false);
          setIsMigrating(true);
          const res = await migrateLocalDataToPostgres();
          setIsMigrating(false);
          setMigrationResult(res);
        }}
        onCancel={() => setShowMigrateConfirm(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 24,
    gap: 20,
    maxWidth: 960,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionBadgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid2: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  gridCol: {
    flex: 1,
    minWidth: 260,
  },
  saveBtnWrap: {
    alignItems: 'flex-start',
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },

  // Shaxsiy profil badge
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarLargeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileCardName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  profileCardTitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  eyeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  eyeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  logoutCard: {
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  // Menejer staff filter
  staffFilterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  staffFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  staffFilterPillActive: {
    backgroundColor: colors.primary,
  },
  staffFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  staffFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Xodimlar ro'yxati jadvali
  staffTableWrap: {
    gap: 10,
  },
  staffRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  staffRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  staffRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  staffRowTitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  staffRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleBadgeBox: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeBoxText: {
    fontSize: 11,
    fontWeight: '700',
  },
  staffPinBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  staffPinLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  staffPinVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.primaryDark,
    marginTop: 2,
    fontWeight: '600',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  modalPinInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 6,
    color: colors.text,
    backgroundColor: '#F8FAFC',
  },
  modalInputHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },

  // Database & Migration UI styles
  dbHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  dbHeaderBadgeConnected: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dbHeaderBadgeOffline: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dbHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dbHeaderDotConnected: {
    backgroundColor: '#16A34A',
  },
  dbHeaderDotOffline: {
    backgroundColor: '#DC2626',
  },
  dbHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dbHeaderBadgeTextConnected: {
    color: '#15803D',
  },
  dbHeaderBadgeTextOffline: {
    color: '#B91C1C',
  },
  dbInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  dbInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dbInfoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dbInfoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  dbErrorNotice: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dbErrorNoticeText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '500',
  },
  migrationActionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  migrationActionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
  },
  migrationActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  migrationActionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  reconciliationBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  reconciliationHeader: {
    marginBottom: 6,
  },
  reconciliationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  reconciliationDesc: {
    fontSize: 12,
    color: '#166534',
    marginBottom: 12,
  },
  reconciliationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reconciliationCol: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignItems: 'center',
  },
  reconciliationVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
  },
  reconciliationLabel: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
    textAlign: 'center',
  },
});
