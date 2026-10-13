import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Doctor } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { DateInput } from '../components/common/Input';
import {
  formatCurrency,
  formatDate,
  formatDateWithWeekday,
  getDayWeekdayName,
  getTodayDateString,
  addDays,
} from '../utils/formatters';
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  DoctorIcon,
  CalendarIcon,
  CreditCardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../components/common/Icons';

interface DoctorsScreenProps {
  onOpenNewModal: () => void;
  onEditDoctor: (doctor: Doctor) => void;
}

export const DoctorsScreen: React.FC<DoctorsScreenProps> = ({
  onOpenNewModal,
  onEditDoctor,
}) => {
  const { doctors, appointments, payments, deleteDoctor, currentUser } = useApp();

  const todayStr = getTodayDateString();
  const [filterDate, setFilterDate] = useState(todayStr);
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);

  // Tanlangan sanani xavfsiz tozalash (YYYY-MM-DD)
  const cleanFilterDate = useMemo(() => {
    return String(filterDate || '').trim().split('T')[0].split(' ')[0] || todayStr;
  }, [filterDate, todayStr]);

  // Tanlangan sananing hafta kuni (masalan, "Dushanba")
  const currentWeekday = useMemo(() => {
    return getDayWeekdayName(cleanFilterDate);
  }, [cleanFilterDate]);

  // Har bir shifokorning tanlangan sanadagi bandligi va umumiy statistikasi
  const doctorOccupancyData = useMemo(() => {
    const data: Record<
      string,
      {
        totalApts: number;
        totalRevenue: number;
        todayApts: typeof appointments;
        todayCount: number;
        isWorkDay: boolean;
        occupancyLabel: string;
        badgeBg: string;
        badgeBorder: string;
        badgeColor: string;
        dotColor: string;
      }
    > = {};

    doctors.forEach((doc) => {
      // 1. Shifokorning barcha qabullari va umumiy tushumi (doimiy profil statistikasi)
      const docAllApts = appointments.filter(
        (a) => a.doctorId === doc.id && a.status !== 'Bekor qilindi'
      );
      const docPays = payments.filter(
        (p) => p.doctorId === doc.id && p.status !== 'Qaytarilgan'
      );
      const totalRev = docPays.reduce((acc, p) => acc + p.paidAmount, 0);

      // 2. Tanlangan sanadagi qabullari (saralangan holda)
      const dayApts = appointments
        .filter((a) => {
          if (a.doctorId !== doc.id) return false;
          if (a.status === 'Bekor qilindi') return false;
          const aDate = String(a.date || '').trim().split('T')[0].split(' ')[0];
          return aDate === cleanFilterDate;
        })
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      // 3. Shifokorning ushbu hafta kunida ishlashi tekshiruvi
      const isWorkDay = Array.isArray(doc.workDays) && doc.workDays.some((wDay) => {
        const w = String(wDay).toLowerCase().trim();
        const d = currentWeekday.toLowerCase().trim();
        return w === d || w.startsWith(d.slice(0, 3)) || d.startsWith(w.slice(0, 3));
      });

      // 4. Bandlik holatini hisoblash
      let occupancyLabel = 'Bo‘sh (qabul yo‘q)';
      let badgeBg = '#ECFDF5';
      let badgeBorder = '#A7F3D0';
      let badgeColor = '#059669';
      let dotColor = '#10B981';

      if (!isWorkDay && dayApts.length === 0) {
        occupancyLabel = 'Dam olish kuni';
        badgeBg = '#F1F5F9';
        badgeBorder = '#CBD5E1';
        badgeColor = '#64748B';
        dotColor = '#94A3B8';
      } else if (dayApts.length >= 5) {
        occupancyLabel = `To‘liq band (${dayApts.length} ta)`;
        badgeBg = '#FEF3C7';
        badgeBorder = '#FDE68A';
        badgeColor = '#B45309';
        dotColor = '#F59E0B';
      } else if (dayApts.length > 0) {
        occupancyLabel = `Qabulda (${dayApts.length} ta)`;
        badgeBg = '#E0F2FE';
        badgeBorder = '#BAE6FD';
        badgeColor = '#0284C7';
        dotColor = '#0EA5E9';
      }

      data[doc.id] = {
        totalApts: docAllApts.length,
        totalRevenue: totalRev,
        todayApts: dayApts,
        todayCount: dayApts.length,
        isWorkDay,
        occupancyLabel,
        badgeBg,
        badgeBorder,
        badgeColor,
        dotColor,
      };
    });

    return data;
  }, [doctors, appointments, payments, cleanFilterDate, currentWeekday]);

  return (
    <View style={styles.container}>
      {/* Yuqori boshqaruv */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.sectionTitle}>Klinika Shifokorlari ({doctors.length})</Text>
          <Text style={styles.sectionSubtitle}>
            Mutaxassislar ish jadvali va real vaqt bandlik holati
          </Text>
        </View>

        <View style={styles.topBarActions}>
          {/* Tezkor sana tugmalari */}
          <View style={styles.quickDateRow}>
            <TouchableOpacity
              onPress={() => setFilterDate(addDays(cleanFilterDate, -1))}
              style={styles.quickDateBtn}
              accessibilityLabel="Oldingi kun"
            >
              <Text style={styles.quickDateBtnText}>‹ Oldingi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterDate(todayStr)}
              style={[
                styles.quickDateBtn,
                cleanFilterDate === todayStr && styles.quickDateBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.quickDateBtnText,
                  cleanFilterDate === todayStr && styles.quickDateBtnTextActive,
                ]}
              >
                Bugun
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterDate(addDays(todayStr, 1))}
              style={[
                styles.quickDateBtn,
                cleanFilterDate === addDays(todayStr, 1) && styles.quickDateBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.quickDateBtnText,
                  cleanFilterDate === addDays(todayStr, 1) && styles.quickDateBtnTextActive,
                ]}
              >
                Ertaga
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterDate(addDays(cleanFilterDate, 1))}
              style={styles.quickDateBtn}
              accessibilityLabel="Keyingi kun"
            >
              <Text style={styles.quickDateBtnText}>Keyingi ›</Text>
            </TouchableOpacity>
          </View>

          {/* Sana tanlash kalendari */}
          <View style={styles.dateFilterWrap}>
            <DateInput
              label="Bandlik sanasi:"
              value={cleanFilterDate}
              onChangeDate={(d) => setFilterDate(d)}
              containerStyle={{ marginBottom: 0, width: 175 }}
            />
          </View>

          <Button
            title="Yangi shifokor"
            icon={<PlusIcon size={16} color="#FFF" />}
            onPress={onOpenNewModal}
            style={styles.newDoctorBtn}
          />
        </View>
      </View>

      {/* Shifokorlar kartalari tarmog'i */}
      <ScrollView style={styles.cardsScroll} contentContainerStyle={styles.cardsGrid}>
        {doctors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={{ marginBottom: 16 }}>
              <DoctorIcon size={48} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Shifokorlar ro‘yxati bo‘sh</Text>
            <Text style={styles.emptySubtitle}>
              Klinika shifokorlarini ro‘yxatdan o‘tkazing va ularga qabullarni biriktiring.
            </Text>
            <View style={{ marginTop: 20 }}>
              <Button
                title="Birinchi shifokorni qo‘shish"
                icon={<PlusIcon size={16} color="#FFF" />}
                onPress={onOpenNewModal}
              />
            </View>
          </View>
        ) : (
          doctors.map((doctor) => {
          const occ = doctorOccupancyData[doctor.id] || {
            totalApts: 0,
            totalRevenue: 0,
            todayApts: [],
            todayCount: 0,
            isWorkDay: true,
            occupancyLabel: 'Bo‘sh',
            badgeBg: '#ECFDF5',
            badgeBorder: '#A7F3D0',
            badgeColor: '#059669',
            dotColor: '#10B981',
          };

          return (
            <View key={doctor.id} style={styles.doctorCard}>
              {/* Doctor Header */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: doctor.avatarColor || colors.primary },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {doctor.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </Text>
                </View>

                <View style={styles.headerInfo}>
                  <Text style={styles.doctorName}>{doctor.fullName}</Text>
                  <Text style={styles.specialtyText}>{doctor.specialty}</Text>
                  <Text style={styles.phoneText}>{doctor.phone}</Text>
                </View>
              </View>

              {/* Doimiy ish jadvali */}
              <View style={styles.scheduleBox}>
                <Text style={styles.scheduleTitle}>Haftalik ish jadvali:</Text>
                <View style={styles.daysRow}>
                  {doctor.workDays?.map((day, idx) => (
                    <View key={idx} style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{day.slice(0, 4)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.hoursText}>
                  Ish vaqti: {doctor.workHours?.start} - {doctor.workHours?.end}
                </Text>
              </View>

              {/* Bandlik holati (Tanlangan sanaga bog'liq va darhol yangilanadi) */}
              <View style={styles.occupancyBox}>
                <View style={styles.occupancyHeader}>
                  <View style={styles.occupancyTitleWrap}>
                    <CalendarIcon size={13} color={colors.primaryDark} />
                    <Text style={styles.occupancyTitle}>
                      {formatDateWithWeekday(cleanFilterDate)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: occ.badgeBg,
                        borderColor: occ.badgeBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: occ.dotColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: occ.badgeColor },
                      ]}
                    >
                      {occ.occupancyLabel}
                    </Text>
                  </View>
                </View>

                {occ.todayApts.length > 0 ? (
                  <View style={styles.todayAptsChips}>
                    {occ.todayApts.map((a) => (
                      <View key={a.id} style={styles.aptChip}>
                        <Text style={styles.aptChipTime}>{a.time}</Text>
                        <Text style={styles.aptChipPatient} numberOfLines={1}>
                          {a.patientName}
                        </Text>
                        <Text style={styles.aptChipStatus}>• {a.status}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noAptsText}>
                    {occ.isWorkDay
                      ? 'Ushbu sanada hozircha qabul yozilmagan (shifokor bo‘sh)'
                      : 'Shifokorning haftalik jadvaliga ko‘ra bugun dam olish kuni'}
                  </Text>
                )}
              </View>

              {/* Statistik ko'rsatkichlar */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Jami qabullar</Text>
                  <Text style={styles.statVal}>{occ.totalApts} ta</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Jami tushum</Text>
                  <Text style={[styles.statVal, { color: colors.primaryDark }]}>
                    {formatCurrency(occ.totalRevenue)}
                  </Text>
                </View>
              </View>

              {/* Card Footer Amallari */}
              <View style={styles.cardFooter}>
                <Button
                  title="Tahrirlash"
                  variant="outline"
                  size="sm"
                  icon={<EditIcon size={14} color={colors.textSecondary} />}
                  onPress={() => onEditDoctor(doctor)}
                />
                <Button
                  title="O‘chirish"
                  variant="ghost"
                  size="sm"
                  icon={<TrashIcon size={14} color={colors.danger} />}
                  onPress={() => setDeleteTarget(doctor)}
                />
              </View>
            </View>
          );
        })
      )}
      </ScrollView>

      {/* O'chirish tasdiqlash */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Shifokorni o‘chirish"
        message={`"${deleteTarget?.fullName}" shifokor ro‘yxatdan o‘chirilsinmi?`}
        confirmText="O‘chirish"
        isDestructive={true}
        onConfirm={() => {
          if (deleteTarget) {
            deleteDoctor(deleteTarget.id);
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
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  topBarLeft: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  dateFilterWrap: {
    alignSelf: 'flex-end',
    width: 175,
  },
  quickDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  quickDateBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  quickDateBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickDateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickDateBtnTextActive: {
    color: '#FFFFFF',
  },
  newDoctorBtn: {
    height: 42,
    minHeight: 42,
    justifyContent: 'center',
  },
  cardsScroll: {
    flex: 1,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    paddingBottom: 24,
  },
  doctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    flex: 1,
    minWidth: 280,
    maxWidth: 560,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  specialtyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginTop: 1,
  },
  phoneText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  scheduleBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  scheduleTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  dayBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  hoursText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  occupancyBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  occupancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  occupancyTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  occupancyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  todayAptsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aptChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  aptChipTime: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  aptChipPatient: {
    fontSize: 11,
    color: colors.text,
    maxWidth: 95,
  },
  aptChipStatus: {
    fontSize: 10,
    color: colors.textMuted,
  },
  noAptsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 2,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  emptyContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
  },
});
