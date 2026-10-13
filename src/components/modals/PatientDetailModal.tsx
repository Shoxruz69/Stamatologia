import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useApp } from '../../context/AppContext';
import { Patient, Appointment, Payment } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { colors } from '../../theme/colors';
import {
  PhoneIcon,
  MessageSquareIcon,
  TelegramIcon,
  CalendarIcon,
  CreditCardIcon,
  PlusIcon,
  CheckIcon,
  LinkIcon,
} from '../common/Icons';

interface PatientDetailModalProps {
  visible: boolean;
  onClose: () => void;
  patient?: Patient | null;
  patientId?: string | null;
  onOpenSmsModal: (patient: Patient) => void;
  onNewAppointment: (patient: Patient) => void;
  onNewPayment: (patient: Patient) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  visible,
  onClose,
  patient,
  patientId,
  onOpenSmsModal,
  onNewAppointment,
  onNewPayment,
}) => {
  const { patients, appointments, payments, updateAppointment, completePayment } = useApp();
  const [activeTab, setActiveTab] = useState<'appointments' | 'payments' | 'notes'>('appointments');

  // Aynan bosilgan qatorning ID raqami orqali bazadan (patients) yuklaymiz
  const targetPatient = useMemo(() => {
    const idToFind = patientId || patient?.id;
    if (idToFind) {
      const found = patients.find((p) => p && p.id === idToFind);
      if (found) return found;
    }
    // Agar ID orqali to'g'ridan-to'g'ri topilmasa, ismi orqali tekshirish
    if (patient?.fullName) {
      const pName = patient.fullName.trim().toLowerCase();
      const foundByName = patients.find(
        (p) => p && p.fullName && p.fullName.trim().toLowerCase() === pName
      );
      if (foundByName) return foundByName;
    }
    return patient || null;
  }, [patients, patient, patientId]);

  // Barcha hook'lar shartlarsiz yuqorida chaqirilishi shart (React Hooks qoidasi)
  const patientAppointments = useMemo(() => {
    if (!targetPatient) return [];
    const targetId = targetPatient.id;
    const targetName = targetPatient.fullName ? targetPatient.fullName.trim().toLowerCase() : '';
    return appointments.filter((a) => {
      if (!a) return false;
      if (targetId && a.patientId === targetId) return true;
      if (targetName && a.patientName && a.patientName.trim().toLowerCase() === targetName) return true;
      return false;
    });
  }, [appointments, targetPatient]);

  const patientPayments = useMemo(() => {
    if (!targetPatient) return [];
    const targetId = targetPatient.id;
    const targetName = targetPatient.fullName ? targetPatient.fullName.trim().toLowerCase() : '';
    return payments.filter((p) => {
      if (!p) return false;
      if (targetId && p.patientId === targetId) return true;
      if (targetName && p.patientName && p.patientName.trim().toLowerCase() === targetName) return true;
      return false;
    });
  }, [payments, targetPatient]);

  // Modal ko'rinmayotgan bo'lsa render qilmaymiz
  if (!visible) return null;

  // Agar bemor topilmasa, bo'sh sahifa o'rniga tushunarli xabar ko'rsatamiz
  if (!targetPatient) {
    return (
      <Modal
        visible={visible}
        onClose={onClose}
        title="Bemor kartasi"
        subtitle="Bemor ma’lumotlari"
        maxWidth={500}
        footer={
          <View style={styles.footerRow}>
            <Button title="Yopish" variant="outline" onPress={onClose} />
          </View>
        }
      >
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Bemor ma’lumotlari topilmadi</Text>
          <Text style={styles.emptySub}>
            Ushbu bemor haqida tizimda ma’lumot mavjud emas yoki ro‘yxatdan o‘chirilgan bo‘lishi mumkin.
          </Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={targetPatient.fullName || 'Bemor kartasi'}
      subtitle={`Bemor ID: ${targetPatient.id || '-'} • Ro‘yxatga olingan: ${formatDate(targetPatient.createdAt)}`}
      maxWidth={680}
      footer={
        <View style={styles.footerRow}>
          <Button
            title={targetPatient.telegramChatId ? "Telegram eslatma" : "Telegramni ulash"}
            variant="outline"
            icon={<TelegramIcon size={16} color={targetPatient.telegramChatId ? "#0284C7" : "#0D9488"} />}
            onPress={() => {
              onClose();
              onOpenSmsModal(targetPatient);
            }}
          />
          <Button
            title="+ Yangi Qabul"
            variant="primary"
            onPress={() => {
              onClose();
              onNewAppointment(targetPatient);
            }}
          />
        </View>
      }
    >
      {/* Bemor kartasi xulosasi (Aynan shu bemor ma'lumotlari) */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Telefon raqami:</Text>
          <Text style={styles.summaryValue}>{targetPatient.phone || 'Kiritilmagan'}</Text>

          <Text style={[styles.summaryLabel, { marginTop: 10 }]}>Manzili:</Text>
          <Text style={styles.summaryValue}>{targetPatient.address || 'Manzil kiritilmagan'}</Text>
        </View>

        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Jinsi & Tug‘ilgan sanasi:</Text>
          <Text style={styles.summaryValue}>
            {targetPatient.gender || 'Ko‘rsatilmagan'} • {formatDate(targetPatient.birthDate)}
          </Text>

          <Text style={[styles.summaryLabel, { marginTop: 10 }]}>Jami tashriflar soni:</Text>
          <Text style={styles.summaryValue}>{targetPatient.totalVisits ?? patientAppointments.length} ta</Text>
        </View>

        <View style={[styles.summaryCol, styles.debtCol]}>
          <Text style={styles.debtLabel}>Qarzdorlik holati:</Text>
          <Text
            style={[
              styles.debtAmount,
              { color: (targetPatient.debt || 0) > 0 ? colors.danger : colors.success },
            ]}
          >
            {formatCurrency(targetPatient.debt || 0)}
          </Text>
          {(targetPatient.debt || 0) > 0 && (
            <TouchableOpacity
              style={styles.payDebtBtn}
              onPress={() => {
                onClose();
                onNewPayment(targetPatient);
              }}
            >
              <Text style={styles.payDebtBtnText}>Qarzni to‘lash</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Telegram holati va ulash tugmasi */}
      <View
        style={[
          styles.telegramBar,
          targetPatient.telegramChatId ? styles.telegramBarConnected : styles.telegramBarUnconnected,
        ]}
      >
        <View style={styles.telegramBarLeft}>
          <TelegramIcon
            size={18}
            color={targetPatient.telegramChatId ? '#0284C7' : '#D97706'}
          />
          <View style={{ flex: 1 }}>
            {targetPatient.telegramChatId ? (
              <Text style={styles.telegramBarText}>
                <Text style={{ color: '#16A34A', fontWeight: '700' }}>Telegram ulangan: </Text>
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  {targetPatient.telegramUsername || `ID: ${targetPatient.telegramChatId}`}
                </Text>
              </Text>
            ) : (
              <Text style={styles.telegramBarText}>
                <Text style={{ color: '#D97706', fontWeight: '700' }}>Telegram ulanmagan </Text>
                <Text style={{ color: '#64748B', fontSize: 12 }}>
                  • Qabul xabarnomalari borishi uchun botga ulanishi zarur
                </Text>
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.telegramBarActionBtn,
            targetPatient.telegramChatId
              ? styles.telegramBarBtnConnected
              : styles.telegramBarBtnConnect,
          ]}
          onPress={() => {
            onClose();
            onOpenSmsModal(targetPatient);
          }}
          activeOpacity={0.8}
        >
            {!targetPatient.telegramChatId && (
              <LinkIcon size={13} color="#FFFFFF" />
            )}
            <Text
              style={[
                styles.telegramBarBtnText,
                targetPatient.telegramChatId ? { color: '#0284C7' } : { color: '#FFFFFF' },
              ]}
            >
              {targetPatient.telegramChatId ? 'Xabar yuborish' : 'Telegramni ulash'}
            </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('appointments')}
          style={[styles.tabBtn, activeTab === 'appointments' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.tabTextActive]}>
            Tashriflar tarixi ({patientAppointments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('payments')}
          style={[styles.tabBtn, activeTab === 'payments' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
            To‘lovlar tarixi ({patientPayments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('notes')}
          style={[styles.tabBtn, activeTab === 'notes' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
            Tibbiy qaydlar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Kontenti */}
      {activeTab === 'appointments' && (
        <View style={styles.historyList}>
          {patientAppointments.length === 0 ? (
            <Text style={styles.emptyText}>Ushbu bemorda hali qabullar qayd etilmagan.</Text>
          ) : (
            patientAppointments.map((apt) => {
              const linkedPayment = payments.find((p) => p && p.appointmentId === apt.id);
              const isCompleted = apt.status === 'Yakunlandi';

              return (
                <View key={apt.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={styles.dateTimeBadge}>
                      <Text style={styles.dateTimeText}>
                        {formatDate(apt.date)} • {apt.time || '-'}
                      </Text>
                    </View>
                    <Badge status={apt.status || 'Kutilmoqda'} size="sm" />
                  </View>
                  <Text style={styles.historyServiceName}>{apt.serviceName || 'Xizmat'}</Text>
                  <Text style={styles.historyDoctorName}>
                    Shifokor: {apt.doctorName || 'Tayinlanmagan'} • {formatCurrency(apt.servicePrice)}
                  </Text>
                  {apt.notes ? <Text style={styles.historyNotes}>Qayd: {apt.notes}</Text> : null}

                  {/* To'lov ma'lumoti */}
                  {linkedPayment && (
                    <View style={styles.linkedPayRow}>
                      {linkedPayment.status === 'To‘lash kerak' ? (
                        <View style={styles.payStatusTagPending}>
                          <CreditCardIcon size={13} color="#B45309" />
                          <Text style={styles.payStatusTextPending}>
                            To‘lov: To‘lash kerak ({formatCurrency(linkedPayment.debtAmount)})
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.payStatusTagPaid}>
                          <CheckIcon size={13} color="#065F46" />
                          <Text style={styles.payStatusTextPaid}>
                            To‘lov: {linkedPayment.status} ({formatCurrency(linkedPayment.paidAmount)})
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Qabul holatini tezkor boshqarish */}
                  <View style={styles.aptActionsRow}>
                    {!isCompleted ? (
                      <TouchableOpacity
                        style={styles.btnSetCompleted}
                        onPress={() => updateAppointment(apt.id, { status: 'Yakunlandi' })}
                      >
                        <CheckIcon size={14} color="#065F46" />
                        <Text style={styles.btnSetCompletedText}>“Yakunlandi” deb belgilash</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.completedActionsGroup}>
                        {linkedPayment && linkedPayment.status === 'To‘lash kerak' && (
                          <TouchableOpacity
                            style={styles.btnQuickPay}
                            onPress={() => completePayment(linkedPayment.id)}
                          >
                            <CheckIcon size={13} color="#FFFFFF" />
                            <Text style={styles.btnQuickPayText}>
                              To‘lash ({formatCurrency(linkedPayment.debtAmount)})
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.btnCancelApt}
                          onPress={() => updateAppointment(apt.id, { status: 'Bekor qilindi' })}
                        >
                          <Text style={styles.btnCancelAptText}>Bekor qilish</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {activeTab === 'payments' && (
        <View style={styles.historyList}>
          {patientPayments.length === 0 ? (
            <Text style={styles.emptyText}>Hali to‘lovlar amalga oshirilmagan.</Text>
          ) : (
            patientPayments.map((pay) => (
              <View key={pay.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.payReceipt}>Chek: {pay.receiptNumber || '-'}</Text>
                  <Badge status={pay.status || 'To‘lash kerak'} size="sm" />
                </View>
                <View style={styles.payAmountRow}>
                  <Text style={styles.payAmount}>
                    {pay.status === 'To‘lash kerak'
                      ? formatCurrency(pay.totalAmount)
                      : formatCurrency(pay.paidAmount)}
                  </Text>
                  <Text style={styles.payMethod}>({pay.paymentMethod || 'Naqd'})</Text>
                </View>
                <Text style={styles.payDate}>
                  Xizmat: {pay.serviceName || 'Xizmat'} • Sana: {formatDate(pay.date)} {pay.time || ''}
                </Text>
                {(pay.debtAmount || 0) > 0 && pay.status !== 'To‘lash kerak' ? (
                  <Text style={styles.payDebtNotice}>
                    Qarz qoldig‘i: {formatCurrency(pay.debtAmount)}
                  </Text>
                ) : null}

                {/* To'lash kerak bo'lsa, tezkor to'lash tugmasi */}
                {pay.status === 'To‘lash kerak' && (
                  <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                      style={styles.btnPayHistory}
                      onPress={() => completePayment(pay.id)}
                    >
                      <CheckIcon size={14} color="#FFFFFF" />
                      <Text style={styles.btnPayHistoryText}>
                        To‘lovni amalga oshirish (To‘landi)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'notes' && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Bemor kartasidagi tibbiy ko‘rsatmalar:</Text>
          <Text style={styles.notesBody}>
            {targetPatient.notes || 'Shifokor tomonidan hech qanday maxsus tibbiy qaydlar kiritilmagan.'}
          </Text>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  summaryCol: {
    flex: 1,
    minWidth: 180,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  debtCol: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  debtAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4,
  },
  payDebtBtn: {
    backgroundColor: colors.primarySoft,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  payDebtBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    // @ts-ignore
    cursor: 'pointer',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateTimeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historyServiceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  historyDoctorName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  payReceipt: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  payAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  payAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  payMethod: {
    fontSize: 12,
    color: colors.textMuted,
  },
  payDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  payDebtNotice: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    padding: 24,
    color: colors.textMuted,
    fontSize: 13,
  },
  notesContainer: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  notesBody: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 20,
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkedPayRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  payStatusTagPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payStatusTextPending: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  payStatusTagPaid: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payStatusTextPaid: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  aptActionsRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btnSetCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnSetCompletedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  completedActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnQuickPay: {
    backgroundColor: '#0D9488',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnQuickPayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnCancelApt: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  btnCancelAptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  btnPayHistory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D9488',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  btnPayHistoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  telegramBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  telegramBarConnected: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  telegramBarUnconnected: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  telegramBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  telegramBarText: {
    fontSize: 13,
    color: '#1E293B',
  },
  telegramBarActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  telegramBarBtnConnect: {
    backgroundColor: '#0D9488',
  },
  telegramBarBtnConnected: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  telegramBarBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
