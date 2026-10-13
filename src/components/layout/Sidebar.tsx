
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useApp, NavTab } from '../../context/AppContext';
import { colors } from '../../theme/colors';
import {
  DashboardIcon,
  CalendarIcon,
  UsersIcon,
  DoctorIcon,
  ServicesIcon,
  CreditCardIcon,
  AnalyticsIcon,
  ReportIcon,
  SettingsIcon,
  ToothIcon,
  CloseIcon,
  LogOutIcon,
} from '../common/Icons';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const { currentTab, setCurrentTab, currentUser, logout } = useApp();

  const isManager = currentUser?.role === 'Menejer';

  const menuItems: { id: NavTab; title: string; icon: any }[] = [
    { id: 'dashboard', title: 'Bosh sahifa', icon: DashboardIcon },
    { id: 'appointments', title: 'Qabullar', icon: CalendarIcon },
    { id: 'patients', title: 'Bemorlar', icon: UsersIcon },
    { id: 'doctors', title: 'Shifokorlar', icon: DoctorIcon },
    { id: 'services', title: 'Xizmatlar', icon: ServicesIcon },
    ...(isManager
      ? [
          { id: 'payments' as NavTab, title: 'To‘lovlar', icon: CreditCardIcon },
          { id: 'analytics' as NavTab, title: 'Savdo tahlili', icon: AnalyticsIcon },
          { id: 'reports' as NavTab, title: 'Hisobotlar', icon: ReportIcon },
        ]
      : []),
    { id: 'settings', title: 'Sozlamalar', icon: SettingsIcon },
  ];

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Brand Logo: Clean tooth icon + DentaCare */}
      <View style={styles.brandHeader}>
        <View style={styles.logoRow}>
          <ToothIcon size={26} color="#0D9488" />
          <Text style={styles.brandTitle}>
            <Text style={styles.brandTitleDenta}>Denta</Text>
            <Text style={styles.brandTitleCare}>Care</Text>
          </Text>
        </View>

        {isMobileOpen && (
          <TouchableOpacity onPress={onCloseMobile} style={styles.mobileCloseBtn}>
            <CloseIcon size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>


      {/* 3. Menyu ro'yxati (Pill uslubi) */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.menuList}>
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            const IconComponent = item.icon;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelectTab(item.id)}
                activeOpacity={0.7}
                style={[
                  styles.menuItem,
                  isActive && styles.menuItemActive,
                ]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconBox}>
                    <IconComponent
                      size={18}
                      color={isActive ? '#0F766E' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.menuItemText,
                      isActive && styles.menuItemTextActive,
                    ]}
                  >
                    {item.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 4. Pastki Chiqish tugmasi */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.7}>
          <LogOutIcon size={14} color="#EF4444" />
          <Text style={styles.logoutText}>Chiqish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 230,
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    // @ts-ignore
    userSelect: 'none',
  },
  brandHeader: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandTitleDenta: {
    color: '#0F172A',
    fontWeight: '800',
  },
  brandTitleCare: {
    color: '#0D9488',
    fontWeight: '800',
  },
  mobileCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  profileAvatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#CCFBF1',
    borderWidth: 2,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  profileAvatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  profileRoleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D9488',
    marginTop: 2,
    textAlign: 'center',
  },
  editPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 5,
    // @ts-ignore
    cursor: 'pointer',
  },
  editPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },

  // Menyu
  menuScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuList: {
    gap: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    // @ts-ignore
    cursor: 'pointer',
  },
  menuItemActive: {
    backgroundColor: '#D1F5EC',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  menuItemTextActive: {
    color: '#0F766E',
    fontWeight: '700',
  },

  // Footer & Theme Switch
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    // @ts-ignore
    cursor: 'pointer',
  },
  logoutText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
});

