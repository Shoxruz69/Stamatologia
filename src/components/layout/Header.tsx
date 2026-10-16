import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { colors } from '../../theme/colors';
import {
  SearchIcon,
  BellIcon,
  MenuIcon,
  PlusIcon,
  CalendarIcon,
  UsersIcon,
  CreditCardIcon,
  LockIcon,
  CloseIcon,
} from '../common/Icons';
import { getRoleDefaultColor, generateAvatarInitials } from '../../utils/staffData';

interface HeaderProps {
  showMenuButton?: boolean;
  onToggleMobileMenu: () => void;
  onOpenQuickAppointment: () => void;
  onOpenQuickPatient: () => void;
  onOpenQuickPayment: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  showMenuButton = false,
  onToggleMobileMenu,
  onOpenQuickAppointment,
  onOpenQuickPatient,
  onOpenQuickPayment,
}) => {
  const {
    currentTab,
    searchQuery,
    setSearchQuery,
    currentUser,
    logout,
    appointments,
    showToast,
    dbStatus,
    serverStatus,
    syncWithBackend,
    isSyncing,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Bugungi sanadagi kutilayotgan yoki tasdiqlangan qabullar
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingApts = appointments.filter(
    (a) => a.date === todayStr && (a.status === 'Kutilmoqda' || a.status === 'Tasdiqlangan')
  );

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Boshqaruv Paneli', desc: 'Klinika faoliyati va umumiy ko‘rsatkichlar' };
      case 'appointments':
        return { title: 'Qabullar jadvali', desc: 'Bemorlar qabuli, shifokorlar vaqti va holatlar' };
      case 'patients':
        return { title: 'Bemorlar Bazasi', desc: 'Barcha ro‘yxatga olingan bemorlar va ularning tarixi' };
      case 'doctors':
        return { title: 'Shifokorlar Tarkibi', desc: 'Mutaxassislar ro‘yxati, jadval va samaradorlik' };
      case 'services':
        return { title: 'Xizmatlar va Narxlar', desc: 'Stomatologik muolajalar va narxlar boshqaruvi' };
      case 'payments':
        return { title: 'To‘lovlar va Kassa', desc: 'Kirim, kassa amallari, qarzlar va cheklar' };
      case 'analytics':
        return { title: 'Savdo Tahlili', desc: 'Moliyaviy hisobotlar, taqqoslash va dinamika' };
      case 'reports':
        return { title: 'Klinika Hisobotlari', desc: 'Batafsil ma’lumotlar va CSV eksport' };
      case 'settings':
        return { title: 'Tizim Sozlamalari', desc: 'Klinika parametrlari va ma’lumotlar boshqaruvi' };
    }
  };

  const { title, desc } = getPageTitle();

  return (
    <View style={styles.header}>
      {/* Chap qism: Planshet menyu tugmasi va Sahifa nomi */}
      <View style={styles.leftSection}>
        {showMenuButton && (
          <TouchableOpacity
            onPress={onToggleMobileMenu}
            style={styles.mobileMenuBtn}
            // @ts-ignore
            accessibilityLabel="Menyuni ochish"
          >
            <MenuIcon size={22} color={colors.text} />
          </TouchableOpacity>
        )}

        <View style={styles.pageInfo}>
          <Text style={styles.pageTitle}>{title}</Text>
        </View>
      </View>

      {/* O'rta qism: Global Qidiruv */}
      <View style={styles.centerSection}>
        <View
          // @ts-ignore
          dataSet={{ inputContainer: 'true' }}
          style={styles.searchBox}
        >
          <SearchIcon size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Bemor yoki xizmat qidirish..."
            placeholderTextColor={colors.textMuted}
            // @ts-ignore
            dataSet={{ innerInput: 'true' }}
            underlineColorAndroid="transparent"
            style={[
              styles.searchInput,
              Platform.OS === 'web' && ({
                outlineStyle: 'none',
                outlineWidth: 0,
                borderWidth: 0,
                backgroundColor: 'transparent',
              } as any),
            ]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <CloseIcon size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* O'ng qism: Baza holati va "SH" Profil Avatari */}
      <View style={styles.rightSection}>
        {/* PostgreSQL / Server Holati Ko'rsatkichi */}
        <TouchableOpacity
          style={[
            styles.dbStatusPill,
            dbStatus === 'connected' ? styles.dbStatusPillOnline : styles.dbStatusPillOffline,
          ]}
          onPress={syncWithBackend}
          disabled={isSyncing}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.dbStatusDot,
              dbStatus === 'connected' ? styles.dbStatusDotOnline : styles.dbStatusDotOffline,
            ]}
          />
          <Text
            style={[
              styles.dbStatusText,
              dbStatus === 'connected' ? styles.dbStatusTextOnline : styles.dbStatusTextOffline,
            ]}
          >
            {isSyncing ? 'Sinxronlanmoqda...' : dbStatus === 'connected' ? 'PostgreSQL' : 'Offline'}
          </Text>
        </TouchableOpacity>

        <View style={styles.relativeWrap}>
          <TouchableOpacity
            onPress={() => setShowProfileMenu(!showProfileMenu)}
            style={styles.headerAvatarBtn}
            activeOpacity={0.8}
            // @ts-ignore
            title="Profil"
          >
            <View
              style={[
                styles.headerAvatarCircle,
                { backgroundColor: currentUser?.avatarColor || '#1D4ED8' },
              ]}
            >
              <Text style={styles.headerAvatarText}>
                {generateAvatarInitials(currentUser?.name)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Web Backdrop to close profile menu on outside click */}
          {showProfileMenu && Platform.OS === 'web' && (
            // @ts-ignore
            <div
              onClick={() => setShowProfileMenu(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9998,
                cursor: 'default',
              }}
            />
          )}

          {/* Profil ochiluvchi menyusi (Ixcham karta) */}
          {showProfileMenu && (
            <View style={styles.profilePopover}>
              <View style={styles.popAvatarRow}>
                <View
                  style={[
                    styles.headerAvatarCircleSmall,
                    { backgroundColor: currentUser?.avatarColor || '#1D4ED8' },
                  ]}
                >
                  <Text style={styles.headerAvatarTextSmall}>
                    {generateAvatarInitials(currentUser?.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profilePopName}>
                    {currentUser?.name || 'Menejer'}
                  </Text>
                  <Text style={styles.profilePopRole}>
                    {currentUser?.role === 'Menejer'
                      ? 'Klinika menejeri'
                      : currentUser?.role === 'Shifokor'
                      ? 'Stomatolog-shifokor'
                      : 'Hamshira'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 72,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 900,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileMenuBtn: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  pageInfo: {
    flexDirection: 'column',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    display: 'none',
  },
  centerSection: {
    flex: 1,
    maxWidth: 380,
    marginHorizontal: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: colors.text,
    // @ts-ignore
    outline: 'none',
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 22,
    gap: 6,
    // @ts-ignore
    cursor: 'pointer',
  },
  quickBtnAppointment: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  quickBtnPatient: {
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  quickBtnPayment: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  relativeWrap: {
    position: 'relative',
  },
  headerAvatarBtn: {
    padding: 2,
    borderRadius: 22,
    // @ts-ignore
    cursor: 'pointer',
  },
  headerAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  headerAvatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarTextSmall: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  profilePopover: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 9999,
  },
  popAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profilePopRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
    // @ts-ignore
    cursor: 'pointer',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  profileInfo: {
    display: 'flex',
  },
  profileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  profileRole: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dropdownPopover: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    padding: 12,
    zIndex: 9999,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  dropdownClose: {
    fontSize: 12,
    color: colors.primary,
  },
  dropdownEmpty: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 8,
    textAlign: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifTime: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  notifDetails: {
    flex: 1,
  },
  notifPatient: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  notifDoctor: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  profilePopName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  profileRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  roleBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pinSecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pinSecText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  profilePopTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    // @ts-ignore
    cursor: 'pointer',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  dbStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 8,
    // @ts-ignore
    cursor: 'pointer',
  },
  dbStatusPillOnline: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dbStatusPillOffline: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dbStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dbStatusDotOnline: {
    backgroundColor: '#16A34A',
  },
  dbStatusDotOffline: {
    backgroundColor: '#DC2626',
  },
  dbStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dbStatusTextOnline: {
    color: '#15803D',
  },
  dbStatusTextOffline: {
    color: '#B91C1C',
  },
});
