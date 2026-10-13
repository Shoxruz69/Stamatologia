import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Payment } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Select, DateInput } from '../components/common/Input';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  PlusIcon,
  SearchIcon,
  EditIcon,
  PrinterIcon,
  TrashIcon,
  CheckIcon,
} from '../components/common/Icons';

interface PaymentsScreenProps {
  onOpenNewModal: () => void;
  onEditPayment: (payment: Payment) => void;
  onViewReceipt: (payment: Payment) => void;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  onOpenNewModal,
  onEditPayment,
  onViewReceipt,
}) => {
  const { payments, refundPayment, searchQuery, completePayment } = useApp();

  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);

  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (methodFilter && pay.paymentMethod !== methodFilter) return false;
      if (statusFilter && pay.status !== statusFilter) return false;
      if (dateFilter && pay.date !== dateFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchPatient = pay.patientName.toLowerCase().includes(q);
        const matchReceipt = pay.receiptNumber.toLowerCase().includes(q);
        const matchService = pay.serviceName.toLowerCase().includes(q);
        const matchDoctor = pay.doctorName.toLowerCase().includes(q);
        if (!matchPatient && !matchReceipt && !matchService && !matchDoctor) return false;
      }
      return true;
    });
  }, [payments, methodFilter, statusFilter, dateFilter, searchQuery]);

  // Moliyaviy xulosa
  const totalReceived = useMemo(
    () => payments.filter((p) => p.status !== 'Qaytarilgan').reduce((acc, p) => acc + p.paidAmount, 0),
    [payments]
  );
  const totalDebtBalance = useMemo(
    () => payments.filter((p) => p.status !== 'Qaytarilgan').reduce((acc, p) => acc + (p.debtAmount || 0), 0),
    [payments]
  );
  const totalRefunded = useMemo(
    () => payments.filter((p) => p.status === 'Qaytarilgan').reduce((acc, p) => acc + p.paidAmount, 0),
    [payments]
  );

  return (
    <View style={styles.container}>
      {/* Yuqori KPI va kassa paneli */}
      <View style={styles.topBar}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Jami qabul qilingan tushum</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {formatCurrency(totalReceived)}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Qoldiq qarzlar</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>
              {formatCurrency(totalDebtBalance)}
            </Text>
          </View>

          {totalRefunded > 0 && (
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Qaytarilgan mablag‘</Text>
              <Text style={[styles.kpiValue, { color: colors.textSecondary }]}>
                {formatCurrency(totalRefunded)}
              </Text>
            </View>
          )}
        </View>

        <Button
          title="To‘lov kiritish (Kassa)"
          icon={<PlusIcon size={16} color="#FFF" />}
          onPress={onOpenNewModal}
        />
      </View>

      {/* Filtrlar satri */}
      <View style={styles.filterBar}>
        <View style={styles.filterCol}>
          <Select
            label="To‘lov turi:"
            value={methodFilter}
            onValueChange={setMethodFilter}
            options={[
              { label: 'Barcha usullar', value: '' },
              { label: 'Naqd pul', value: 'Naqd' },
              { label: 'Plastik karta', value: 'Karta' },
              { label: 'Payme / Click', value: 'Payme / Click' },
              { label: 'O‘tkazma', value: 'O‘tkazma' },
            ]}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        <View style={styles.filterCol}>
          <Select
            label="To‘lov holati:"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { label: 'Barcha holatlar', value: '' },
              { label: 'To‘lash kerak', value: 'To‘lash kerak' },
              { label: 'To‘landi', value: 'To‘landi' },
              { label: 'To‘langan', value: 'To‘langan' },
              { label: 'Qisman to‘langan', value: 'Qisman to‘langan' },
              { label: 'Qaytarilgan', value: 'Qaytarilgan' },
              { label: 'Bekor qilingan', value: 'Bekor qilingan' },
            ]}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        <View style={styles.filterCol}>
          <DateInput
            label="Sana:"
            value={dateFilter}
            onChangeDate={setDateFilter}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {(methodFilter || statusFilter || dateFilter) ? (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setMethodFilter('');
              setStatusFilter('');
              setDateFilter('');
            }}
          >
            <Text style={styles.resetBtnText}>Filtrni tozalash</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* To'lovlar jadvali */}
      <ScrollView style={styles.tableScrollView} showsVerticalScrollIndicator={true}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <View style={styles.tableContainer}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { width: 130 }]}>Chek / Sana</Text>
              <Text style={[styles.th, { flex: 1.5, minWidth: 140 }]}>Bemor</Text>
              <Text style={[styles.th, { flex: 1.5, minWidth: 150 }]}>Xizmat & Shifokor</Text>
              <Text style={[styles.th, { width: 130 }]}>To‘langan</Text>
              <Text style={[styles.th, { width: 110 }]}>Qarz</Text>
              <Text style={[styles.th, { width: 120 }]}>Usuli</Text>
              <Text style={[styles.th, { width: 120 }]}>Holat</Text>
              <Text style={[styles.th, { width: 130, textAlign: 'center' }]}>Amallar</Text>
            </View>

          {/* Body */}
          {filteredPayments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>💳</Text>
              <Text style={styles.emptyTitle}>
                {payments.length === 0 ? 'To‘lovlar tarixi bo‘sh' : 'To‘lov topilmadi'}
              </Text>
              <Text style={styles.emptySub}>
                {payments.length === 0
                  ? 'Klinikada ko‘rsatilgan xizmatlar uchun birinchi to‘lovni qabul qiling'
                  : 'Filtrlarni o‘zgartiring yoki qidiruv so‘zini tozalang'}
              </Text>
              {payments.length === 0 && (
                <View style={{ marginTop: 16 }}>
                  <Button
                    title="Birinchi to‘lovni kiritish"
                    icon={<PlusIcon size={16} color="#FFF" />}
                    onPress={onOpenNewModal}
                  />
                </View>
              )}
            </View>
          ) : (
            filteredPayments.map((pay, idx) => (
              <View
                key={pay.id}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 && styles.tableRowAlt,
                  pay.status === 'Qaytarilgan' && styles.tableRowRefunded,
                ]}
              >
                {/* Chek & Sana */}
                <View style={{ width: 130 }}>
                  <Text style={styles.cellReceipt}>{pay.receiptNumber}</Text>
                  <Text style={styles.cellDate}>
                    {formatDate(pay.date)} • {pay.time}
                  </Text>
                </View>

                {/* Bemor */}
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.cellPatient}>{pay.patientName}</Text>
                </View>

                {/* Xizmat & Shifokor */}
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.cellService}>{pay.serviceName}</Text>
                  <Text style={styles.cellDoctor}>{pay.doctorName}</Text>
                </View>

                {/* To'langan summa */}
                <View style={{ width: 130 }}>
                  <Text style={styles.cellPaid}>{formatCurrency(pay.paidAmount)}</Text>
                  <Text style={styles.cellTotal}>Jami: {formatCurrency(pay.totalAmount)}</Text>
                </View>

                {/* Qarz qoldig'i */}
                <View style={{ width: 110 }}>
                  <Text
                    style={[
                      styles.cellDebt,
                      { color: pay.debtAmount > 0 ? colors.danger : colors.textMuted },
                    ]}
                  >
                    {pay.debtAmount > 0 ? formatCurrency(pay.debtAmount) : 'Yo‘q'}
                  </Text>
                </View>

                {/* To'lov usuli */}
                <View style={{ width: 120 }}>
                  <Text style={styles.cellMethod}>{pay.paymentMethod}</Text>
                </View>

                {/* Holat */}
                <View style={{ width: 120 }}>
                  <Badge status={pay.status} size="sm" />
                </View>

                {/* Amallar */}
                <View style={[styles.actionsCell, { width: 140 }]}>
                  {pay.status === 'To‘lash kerak' ? (
                    <TouchableOpacity
                      style={styles.payActionBtn}
                      onPress={() => completePayment(pay.id)}
                      // @ts-ignore
                      title="To‘lovni amalga oshirish (To‘landi)"
                    >
                      <CheckIcon size={13} color="#FFFFFF" />
                      <Text style={styles.payActionBtnText}>To‘lash</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Chek ko'rish / chop etish */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onViewReceipt(pay)}
                    // @ts-ignore
                    title="Kvitansiya (Chek) ko‘rish"
                  >
                    <PrinterIcon size={15} color={colors.primary} />
                  </TouchableOpacity>

                  {/* Tahrirlash */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onEditPayment(pay)}
                    // @ts-ignore
                    title="Tahrirlash"
                  >
                    <EditIcon size={15} color={colors.accent} />
                  </TouchableOpacity>

                  {/* Qaytarish (Refund) */}
                  {pay.status !== 'Qaytarilgan' && pay.status !== 'To‘lash kerak' && (
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => setRefundTarget(pay)}
                      // @ts-ignore
                      title="Mablag‘ni qaytarish"
                    >
                      <TrashIcon size={15} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScrollView>

      {/* Pulni qaytarish tasdiqlash */}
      <ConfirmDialog
        visible={!!refundTarget}
        title="To‘lovni qaytarish (Refund)"
        message={`Chek: ${refundTarget?.receiptNumber} bo‘yicha to‘langan ${formatCurrency(refundTarget?.paidAmount)} so‘m bemorga qaytarilsinmi? Ushbu summa bemor hisobiga qarz sifatida qayta yoziladi.`}
        confirmText="Qaytarish"
        isDestructive={true}
        onConfirm={() => {
          if (refundTarget) {
            refundPayment(refundTarget.id);
            setRefundTarget(null);
          }
        }}
        onCancel={() => setRefundTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-end',
    marginBottom: 16,
    zIndex: 20,
  },
  filterCol: {
    flex: 1,
    minWidth: 160,
  },
  resetBtn: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-end',
    // @ts-ignore
    cursor: 'pointer',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tableScrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  horizontalScrollContent: {
    minWidth: '100%',
    flexGrow: 1,
  },
  tableContainer: {
    width: '100%',
    minWidth: 900,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableRowRefunded: {
    backgroundColor: '#FEF2F2',
    opacity: 0.7,
  },
  cellReceipt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  cellDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cellPatient: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  cellService: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  cellDoctor: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cellPaid: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  cellTotal: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  cellDebt: {
    fontSize: 13,
    fontWeight: '700',
  },
  cellMethod: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionsCell: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  payActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    // @ts-ignore
    cursor: 'pointer',
  },
  payActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
});
