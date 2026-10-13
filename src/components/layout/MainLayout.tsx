import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { colors } from '../../theme/colors';

// Screens
import { DashboardScreen } from '../../screens/DashboardScreen';
import { AppointmentsScreen } from '../../screens/AppointmentsScreen';
import { PatientsScreen } from '../../screens/PatientsScreen';
import { DoctorsScreen } from '../../screens/DoctorsScreen';
import { ServicesScreen } from '../../screens/ServicesScreen';
import { PaymentsScreen } from '../../screens/PaymentsScreen';
import { AnalyticsScreen } from '../../screens/AnalyticsScreen';
import { ReportsScreen } from '../../screens/ReportsScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';

// Modals
import { AppointmentModal } from '../modals/AppointmentModal';
import { PatientModal } from '../modals/PatientModal';
import { PatientDetailModal } from '../modals/PatientDetailModal';
import { DoctorModal } from '../modals/DoctorModal';
import { ServiceModal } from '../modals/ServiceModal';
import { PaymentModal } from '../modals/PaymentModal';
import { ReceiptModal } from '../modals/ReceiptModal';
import { SmsTelegramModal } from '../modals/SmsTelegramModal';

// Toast
import { ToastContainer } from '../common/Toast';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { AlertTriangleIcon } from '../common/Icons';
import { Appointment, Doctor, Patient, Payment, Service } from '../../types';

export const MainLayout: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    currentUser,
    toasts,
    dismissToast,
    lastSyncError,
    serverStatus,
    syncWithBackend,
    isSyncing,
  } = useApp();
  const { width } = useWindowDimensions();



  const isMobile = width < 1024;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Menejer bo'lmagan xodimlar uchun to'lovlar, savdo tahlili va hisobotlarni yopish
  useEffect(() => {
    if (
      currentUser?.role !== 'Menejer' &&
      ['payments', 'analytics', 'reports'].includes(currentTab)
    ) {
      setCurrentTab('dashboard');
    }
  }, [currentTab, currentUser]);

  // Modallar holati
  const [aptModalVisible, setAptModalVisible] = useState(false);
  const [aptToEdit, setAptToEdit] = useState<Appointment | null>(null);

  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);

  const [patientDetailVisible, setPatientDetailVisible] = useState(false);
  const [selectedPatientIdForDetail, setSelectedPatientIdForDetail] = useState<string | null>(null);
  const [selectedPatientForDetail, setSelectedPatientForDetail] = useState<Patient | null>(null);

  const [doctorModalVisible, setDoctorModalVisible] = useState(false);
  const [doctorToEdit, setDoctorToEdit] = useState<Doctor | null>(null);

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [preselectedPatientForPay, setPreselectedPatientForPay] = useState<Patient | null>(null);

  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);

  const [smsModalVisible, setSmsModalVisible] = useState(false);
  const [smsPatient, setSmsPatient] = useState<Patient | null>(null);

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onOpenAppointmentModal={() => {
              setAptToEdit(null);
              setAptModalVisible(true);
            }}
            onOpenPatientModal={() => {
              setPatientToEdit(null);
              setPatientModalVisible(true);
            }}
            onOpenPaymentModal={() => {
              setPaymentToEdit(null);
              setPreselectedPatientForPay(null);
              setPaymentModalVisible(true);
            }}
            onViewAppointment={(apt) => {
              setAptToEdit(apt);
              setAptModalVisible(true);
            }}
          />
        );
      case 'appointments':
        return (
          <AppointmentsScreen
            onOpenNewModal={() => {
              setAptToEdit(null);
              setAptModalVisible(true);
            }}
            onEditAppointment={(apt) => {
              setAptToEdit(apt);
              setAptModalVisible(true);
            }}
            onOpenPatientDetail={(patientId) => {
              setSelectedPatientIdForDetail(patientId);
              setPatientDetailVisible(true);
            }}
          />
        );
      case 'patients':
        return (
          <PatientsScreen
            onOpenNewModal={() => {
              setPatientToEdit(null);
              setPatientModalVisible(true);
            }}
            onEditPatient={(p) => {
              setPatientToEdit(p);
              setPatientModalVisible(true);
            }}
            onViewPatient={(p) => {
              setSelectedPatientIdForDetail(p.id);
              setSelectedPatientForDetail(p);
              setPatientDetailVisible(true);
            }}
            onOpenSmsModal={(p) => {
              setSmsPatient(p);
              setSmsModalVisible(true);
            }}
            onQuickAppointment={(p) => {
              setAptToEdit(null);
              setAptModalVisible(true);
            }}
            onQuickPayment={(p) => {
              setPreselectedPatientForPay(p);
              setPaymentToEdit(null);
              setPaymentModalVisible(true);
            }}
          />
        );
      case 'doctors':
        return (
          <DoctorsScreen
            onOpenNewModal={() => {
              setDoctorToEdit(null);
              setDoctorModalVisible(true);
            }}
            onEditDoctor={(d) => {
              setDoctorToEdit(d);
              setDoctorModalVisible(true);
            }}
          />
        );
      case 'services':
        return (
          <ServicesScreen
            onOpenNewModal={() => {
              setServiceToEdit(null);
              setServiceModalVisible(true);
            }}
            onEditService={(s) => {
              setServiceToEdit(s);
              setServiceModalVisible(true);
            }}
          />
        );
      case 'payments':
        return (
          <PaymentsScreen
            onOpenNewModal={() => {
              setPaymentToEdit(null);
              setPreselectedPatientForPay(null);
              setPaymentModalVisible(true);
            }}
            onEditPayment={(pay) => {
              setPaymentToEdit(pay);
              setPaymentModalVisible(true);
            }}
            onViewReceipt={(pay) => {
              setSelectedPaymentForReceipt(pay);
              setReceiptModalVisible(true);
            }}
          />
        );
      case 'analytics':
        return <AnalyticsScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return null;
    }
  };


  return (
    <View style={styles.outerContainer}>
      <View style={styles.innerCanvas}>
        {/* 1. Desktop Sidebar */}
        {!isMobile && (
          <View style={styles.desktopSidebar}>
            <Sidebar />
          </View>
        )}

        {/* 2. Mobile Drawer Sidebar (Overlay) */}
        {isMobile && mobileMenuOpen && (
          <View style={styles.mobileOverlay}>
            <TouchableOpacity
              style={styles.mobileBackdrop}
              activeOpacity={1}
              onPress={() => setMobileMenuOpen(false)}
            />
            <View style={styles.mobileSidebarContainer}>
              <Sidebar
                isMobileOpen={true}
                onCloseMobile={() => setMobileMenuOpen(false)}
              />
            </View>
          </View>
        )}

        {/* 3. Main Area */}
        <View style={styles.mainArea}>
          <Header
            showMenuButton={isMobile}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
            onOpenQuickAppointment={() => {
              setAptToEdit(null);
              setAptModalVisible(true);
            }}
            onOpenQuickPatient={() => {
              setPatientToEdit(null);
              setPatientModalVisible(true);
            }}
            onOpenQuickPayment={() => {
              setPaymentToEdit(null);
              setPreselectedPatientForPay(null);
              setPaymentModalVisible(true);
            }}
          />

          {/* Server / Baza holati haqida ogohlantirish banneri */}
          {lastSyncError && (
            <View style={styles.syncAlertBanner}>
              <View style={styles.syncAlertLeft}>
                <AlertTriangleIcon size={18} color="#D97706" />
                <View style={styles.syncAlertTextCol}>
                  <Text style={styles.syncAlertTitle}>
                    {serverStatus === 'offline'
                      ? 'Markaziy serverga ulanish kutilmoqda (Offline kesh rejimi)'
                      : 'PostgreSQL bazasi bilan aloqa uzilgan'}
                  </Text>
                  <Text style={styles.syncAlertDesc} numberOfLines={2}>
                    {lastSyncError} — Kiritilgan yangi ma’lumotlar lokal xotirada xavfsiz saqlanmoqda.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.syncRetryBtn}
                onPress={syncWithBackend}
                disabled={isSyncing}
                activeOpacity={0.7}
              >
                <Text style={styles.syncRetryText}>
                  {isSyncing ? 'Tekshirilmoqda...' : 'Qayta tekshirish'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.screenWrapper}>{renderCurrentScreen()}</View>
        </View>
      </View>

      {/* BARCHA MODAL OYNALAR */}
      <AppointmentModal
        visible={aptModalVisible}
        onClose={() => setAptModalVisible(false)}
        appointmentToEdit={aptToEdit}
      />

      <PatientModal
        visible={patientModalVisible}
        onClose={() => setPatientModalVisible(false)}
        patientToEdit={patientToEdit}
      />

      <ErrorBoundary
        fallbackTitle="Bemor kartasini yuklashda xatolik yuz berdi"
        onReset={() => {
          setPatientDetailVisible(false);
          setSelectedPatientIdForDetail(null);
          setSelectedPatientForDetail(null);
        }}
      >
        <PatientDetailModal
          visible={patientDetailVisible}
          onClose={() => {
            setPatientDetailVisible(false);
            setSelectedPatientIdForDetail(null);
            setSelectedPatientForDetail(null);
          }}
          patientId={selectedPatientIdForDetail}
          patient={selectedPatientForDetail}
          onOpenSmsModal={(p) => {
            setSmsPatient(p);
            setSmsModalVisible(true);
          }}
          onNewAppointment={() => {
            setAptToEdit(null);
            setAptModalVisible(true);
          }}
          onNewPayment={(p) => {
            setPreselectedPatientForPay(p);
            setPaymentToEdit(null);
            setPaymentModalVisible(true);
          }}
        />
      </ErrorBoundary>

      <DoctorModal
        visible={doctorModalVisible}
        onClose={() => setDoctorModalVisible(false)}
        doctorToEdit={doctorToEdit}
      />

      <ServiceModal
        visible={serviceModalVisible}
        onClose={() => setServiceModalVisible(false)}
        serviceToEdit={serviceToEdit}
      />

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        preselectedPatient={preselectedPatientForPay}
        paymentToEdit={paymentToEdit}
        onPaymentSuccess={(createdPay) => {
          setSelectedPaymentForReceipt(createdPay);
          setReceiptModalVisible(true);
        }}
      />

      <ReceiptModal
        visible={receiptModalVisible}
        onClose={() => setReceiptModalVisible(false)}
        payment={selectedPaymentForReceipt}
      />

      <SmsTelegramModal
        visible={smsModalVisible}
        onClose={() => setSmsModalVisible(false)}
        patient={smsPatient}
      />

      {/* Bildirishnomalar */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  innerCanvas: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  desktopSidebar: {
    height: '100%',
    zIndex: 10,
  },
  mobileOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
  },
  mobileBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  mobileSidebarContainer: {
    width: 260,
    height: '100%',
    zIndex: 10000,
  },
  mainArea: {
    flex: 1,
    flexDirection: 'column',
    height: '100%',
  },
  screenWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  syncAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  syncAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  syncAlertIcon: {
    fontSize: 18,
  },
  syncAlertTextCol: {
    flex: 1,
  },
  syncAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  syncAlertDesc: {
    fontSize: 12,
    color: '#B45309',
  },
  syncRetryBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
