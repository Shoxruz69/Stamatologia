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
import { Patient } from '../types';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  PlusIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  CreditCardIcon,
  CalendarIcon,
  CloseIcon,
  UsersIcon,
} from '../components/common/Icons';

interface PatientsScreenProps {
  onOpenNewModal: () => void;
  onEditPatient: (patient: Patient) => void;
  onViewPatient: (patient: Patient) => void;
  onQuickAppointment: (patient: Patient) => void;
  onQuickPayment: (patient: Patient) => void;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  onOpenNewModal,
  onEditPatient,
  onViewPatient,
  onQuickAppointment,
  onQuickPayment,
}) => {
  const { patients, deletePatient, searchQuery } = useApp();


  const [localSearch, setLocalSearch] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (filterDebtOnly && (p.debt || 0) <= 0) return false;

      const q = (searchQuery || localSearch).trim().toLowerCase();
      if (q) {
        const matchName = p.fullName.toLowerCase().includes(q);
        const matchPhone = p.phone.toLowerCase().includes(q);
        const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
        if (!matchName && !matchPhone && !matchAddress) return false;
      }
      return true;
    });
  }, [patients, searchQuery, localSearch, filterDebtOnly]);

  const totalPatientsCount = patients.length;
  const debtorsCount = patients.filter((p) => p.debt > 0).length;
  const totalDebtSum = patients.reduce((acc, p) => acc + (p.debt || 0), 0);

  return (
    <View style={styles.container}>
      {/* Yuqori xulosa va amallar */}
      <View style={styles.topBar}>
        <View style={styles.statsSummaryRow}>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeLabel}>Jami bemorlar:</Text>
            <Text style={styles.summaryBadgeVal}>{totalPatientsCount} nafar</Text>
          </View>

          <TouchableOpacity
            onPress={() => setFilterDebtOnly(!filterDebtOnly)}
            style={[
              styles.summaryBadge,
              filterDebtOnly && styles.summaryBadgeActive,
            ]}
          >
            <Text style={styles.summaryBadgeLabel}>Qarzdorlar:</Text>
            <Text style={[styles.summaryBadgeVal, { color: colors.danger }]}>
              {debtorsCount} nafar ({formatCurrency(totalDebtSum)})
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Yangi bemor qo‘shish"
          icon={<PlusIcon size={16} color="#FFF" />}
          onPress={onOpenNewModal}
        />
      </View>

      {/* Qidiruv va filtr satri */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <SearchIcon size={18} color={colors.textMuted} />
          <TextInput
            value={localSearch}
            onChangeText={setLocalSearch}
            placeholder="Bemorning ismi, familiyasi yoki telefoni bo‘yicha qidirish..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {localSearch.length > 0 && (
            <TouchableOpacity onPress={() => setLocalSearch('')} style={styles.clearBtn}>
              <CloseIcon size={12} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bemorlar jadvali */}
      <ScrollView style={styles.tableScrollView} showsVerticalScrollIndicator={true}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <View style={styles.tableContainer}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2, minWidth: 170 }]}>Bemor F.I.Sh</Text>
              <Text style={[styles.th, { flex: 1.4, minWidth: 140 }]}>Telefon</Text>
              <Text style={[styles.th, { width: 130 }]}>Oxirgi tashrif</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Tashriflar</Text>
              <Text style={[styles.th, { width: 130 }]}>Qarzdorlik</Text>
              <Text style={[styles.th, { width: 150, textAlign: 'center' }]}>Amallar</Text>
            </View>

          {/* Body */}
          {filteredPatients.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={{ marginBottom: 12 }}>
                <UsersIcon size={44} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {patients.length === 0 ? 'Bemorlar ro‘yxati bo‘sh' : 'Bemor topilmadi'}
              </Text>
              <Text style={styles.emptySub}>
                {patients.length === 0
                  ? 'Klinikada birinchi bemor kartochkasini yarating va davolashni boshlang'
                  : 'Qidiruv so‘zini o‘zgartiring yoki filtrni tozalang'}
              </Text>
              {patients.length === 0 && (
                <View style={{ marginTop: 16 }}>
                  <Button
                    title="Birinchi bemorni qo‘shish"
                    icon={<PlusIcon size={16} color="#FFF" />}
                    onPress={onOpenNewModal}
                  />
                </View>
              )}
            </View>
          ) : (
            filteredPatients.map((patient, idx) => (
              <View
                key={patient.id}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
              >
                {/* Bemor F.I.Sh */}
                <TouchableOpacity
                  style={{ flex: 2 }}
                  onPress={() => onViewPatient(patient)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.cellFullName}>{patient.fullName}</Text>
                    {patient.syncStatus === 'pending' && (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Sinxronlash kutilmoqda</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cellSubInfo}>
                    {patient.gender} • {patient.address || 'Manzil kiritilmagan'}
                  </Text>
                </TouchableOpacity>

                {/* Telefon */}
                <View style={{ flex: 1.4, minWidth: 140 }}>
                  <Text style={styles.cellPhone}>{patient.phone}</Text>
                </View>

                {/* Oxirgi tashrif */}
                <View style={{ width: 130 }}>
                  <Text style={styles.cellDate}>
                    {patient.lastVisitDate ? formatDate(patient.lastVisitDate) : 'Tashrif buyurmagan'}
                  </Text>
                </View>

                {/* Tashriflar soni */}
                <View style={{ width: 100, alignItems: 'center' }}>
                  <View style={styles.visitsBadge}>
                    <Text style={styles.visitsBadgeText}>{patient.totalVisits} ta</Text>
                  </View>
                </View>

                {/* Qarzdorlik */}
                <View style={{ width: 140 }}>
                  <Text
                    style={[
                      styles.cellDebt,
                      { color: patient.debt > 0 ? colors.danger : colors.success },
                    ]}
                  >
                    {patient.debt > 0 ? formatCurrency(patient.debt) : 'Qarz yo‘q'}
                  </Text>
                </View>

                {/* Amallar */}
                <View style={[styles.actionsCell, { width: 150 }]}>
                  {/* Bemor kartasini ko'rish */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onViewPatient(patient)}
                    // @ts-ignore
                    title="Bemor kartasini ko‘rish"
                  >
                    <EyeIcon size={15} color={colors.primary} />
                  </TouchableOpacity>

                  {/* Qabul yozish */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onQuickAppointment(patient)}
                    // @ts-ignore
                    title="Ushbu bemorga qabul yozish"
                  >
                    <CalendarIcon size={15} color={colors.purple} />
                  </TouchableOpacity>

                  {/* Tahrirlash */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onEditPatient(patient)}
                    // @ts-ignore
                    title="Tahrirlash"
                  >
                    <EditIcon size={15} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {/* O'chirish */}
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => setDeleteTarget(patient)}
                    // @ts-ignore
                    title="O‘chirish"
                  >
                    <TrashIcon size={15} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScrollView>

      {/* O'chirish tasdiqlash dialogi */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Bemorni o‘chirish"
        message={`Haqiqatdan ham "${deleteTarget?.fullName}" bemor kartochkasini tizimdan butunlay o‘chirib tashlamoqchimisiz?`}
        confirmText="O‘chirish"
        isDestructive={true}
        onConfirm={() => {
          if (deleteTarget) {
            deletePatient(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
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
    gap: 12,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // @ts-ignore
    cursor: 'pointer',
  },
  summaryBadgeActive: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  summaryBadgeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  summaryBadgeVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  searchRow: {
    marginBottom: 16,
  },
  searchBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    fontSize: 12,
    color: colors.textMuted,
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
    minWidth: 840,
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
  cellFullName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  cellSubInfo: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cellPhone: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  cellDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  visitsBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  visitsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  cellDebt: {
    fontSize: 13,
    fontWeight: '700',
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
  emptyWrap: {
    padding: 48,
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
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
});
