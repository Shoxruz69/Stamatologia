import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { DateInput, Select } from '../components/common/Input';
import { RevenueChart } from '../components/charts/RevenueChart';
import { PaymentPieChart } from '../components/charts/PaymentPieChart';
import {
  formatCurrency,
  formatDate,
  extractDateOnly,
  isDateInRange,
  generateDateRangeChartPoints,
} from '../utils/formatters';
import { exportToCSV } from '../utils/csvExporter';
import {
  DownloadIcon,
  CreditCardIcon,
  AnalyticsIcon,
} from '../components/common/Icons';

export const AnalyticsScreen: React.FC = () => {
  const {
    payments,
    appointments,
    doctors,
    showToast,
    filterPreset,
    filterStartDate,
    filterEndDate,
    filterDoctorId,
    applyDatePreset,
    setFilterStartDate,
    setFilterEndDate,
    setFilterDoctorId,
  } = useApp();

  // 1. Sanalarni xavfsiz tozalash va to'g'ri tartiblash (vaqt mintaqasi siljishisiz)
  const rawStart = extractDateOnly(filterStartDate);
  const rawEnd = extractDateOnly(filterEndDate);

  const effectiveStartDate = rawStart && rawEnd && rawStart > rawEnd ? rawEnd : rawStart;
  const effectiveEndDate = rawStart && rawEnd && rawStart > rawEnd ? rawStart : rawEnd;

  // 2. To'lovlar va qabullarni aynan tanlangan sana oralig'i va shifokor bo'yicha qat'iy filtrlash
  // Savdo ko'rsatkichlari uchun to'lov sanasi (p.date), qabullar uchun qabul sanasi (a.date) ishlatiladi
  const periodPayments = useMemo(() => {
    return payments.filter((p) => {
      if (!isDateInRange(p.date, effectiveStartDate, effectiveEndDate)) return false;
      if (filterDoctorId && p.doctorId !== filterDoctorId) return false;
      return true;
    });
  }, [payments, effectiveStartDate, effectiveEndDate, filterDoctorId]);

  const periodAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (!isDateInRange(a.date, effectiveStartDate, effectiveEndDate)) return false;
      if (filterDoctorId && a.doctorId !== filterDoctorId) return false;
      return true;
    });
  }, [appointments, effectiveStartDate, effectiveEndDate, filterDoctorId]);

  // 3. Haqiqiy to'lov yozuvlaridan hisoblangan moliyaviy ko'rsatkichlar
  const totalRevenue = useMemo(
    () =>
      periodPayments
        .filter((p) => p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.totalAmount || 0), 0),
    [periodPayments]
  );

  const actualReceived = useMemo(
    () =>
      periodPayments
        .filter((p) => p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    [periodPayments]
  );

  const unpaidDebt = useMemo(
    () =>
      periodPayments
        .filter((p) => p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.debtAmount || 0), 0),
    [periodPayments]
  );

  const refundedAmount = useMemo(
    () =>
      periodPayments
        .filter((p) => p.status === 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    [periodPayments]
  );

  const paymentsCount = periodPayments.length;

  // 4. Naqd va Karta nisbati (amaldagi to'lovlardan)
  const cashAmount = useMemo(
    () =>
      periodPayments
        .filter((p) => p.paymentMethod === 'Naqd' && p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    [periodPayments]
  );

  const cardAmount = useMemo(
    () =>
      periodPayments
        .filter((p) => p.paymentMethod === 'Karta' && p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    [periodPayments]
  );

  const paymeAmount = useMemo(
    () =>
      periodPayments
        .filter((p) => p.paymentMethod === 'Payme / Click' && p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    [periodPayments]
  );

  const transferAmount = useMemo(
    () =>
      periodPayments
        .filter((p) => p.paymentMethod === 'O‘tkazma' && p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    [periodPayments]
  );

  // 5. Qabullar statistikasi (ushbu muddatdagi qabullar sanasi a.date bo'yicha)
  const totalAptsCount = periodAppointments.length;
  const attendedCount = periodAppointments.filter(
    (a) => a.status === 'Keldi' || a.status === 'Qabulda' || a.status === 'Yakunlandi'
  ).length;
  const cancelledCount = periodAppointments.filter((a) => a.status === 'Bekor qilindi').length;
  const pendingCount = periodAppointments.filter(
    (a) => a.status === 'Kutilmoqda' || a.status === 'Tasdiqlangan'
  ).length;

  // 6. Shifokorlar bo'yicha savdo va tushum taqsimoti
  const doctorSales = useMemo(() => {
    const list = filterDoctorId
      ? doctors.filter((d) => d.id === filterDoctorId)
      : doctors;

    return list
      .map((doc) => {
        const docApts = periodAppointments.filter(
          (a) => a.doctorId === doc.id && a.status !== 'Bekor qilindi'
        );
        const docPays = periodPayments.filter(
          (p) => p.doctorId === doc.id && p.status !== 'Qaytarilgan'
        );
        const rev = docPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

        return {
          id: doc.id,
          name: doc.fullName,
          specialty: doc.specialty,
          aptsCount: docApts.length,
          revenue: rev,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [doctors, periodAppointments, periodPayments, filterDoctorId]);

  // 7. Grafik nuqtalari: jami summalari ekrandagi ko'rsatkichlarga 100% teng bo'ladi
  const chartPoints = useMemo(() => {
    return generateDateRangeChartPoints(
      effectiveStartDate,
      effectiveEndDate,
      periodPayments
    );
  }, [effectiveStartDate, effectiveEndDate, periodPayments]);

  const pieItems = [
    { method: 'Naqd', amount: cashAmount, color: colors.success },
    { method: 'Karta', amount: cardAmount, color: '#0284C7' },
    { method: 'Payme / Click', amount: paymeAmount, color: '#0D9488' },
    { method: 'O‘tkazma', amount: transferAmount, color: colors.purple },
  ];

  // 8. CSV yuklab olish
  const handleExportCSV = () => {
    const headers = ['Ko‘rsatkich nomi', 'Qiymat (so‘m yoki soni)', 'Davr', 'Shifokor filtri'];

    const periodLabel = `${formatDate(effectiveStartDate)} dan ${formatDate(effectiveEndDate)} gacha`;
    const docLabel = filterDoctorId
      ? doctors.find((d) => d.id === filterDoctorId)?.fullName || 'Tanlangan shifokor'
      : 'Barcha shifokorlar';

    const rows = [
      ['Jami buyurtma savdosi', totalRevenue, periodLabel, docLabel],
      ['Haqiqiy kassa tushumi', actualReceived, periodLabel, docLabel],
      ['To‘lanmagan qarz qoldig‘i', unpaidDebt, periodLabel, docLabel],
      ['Jami to‘lovlar soni', paymentsCount, periodLabel, docLabel],
      ['Qaytarilgan mablag‘ (Refund)', refundedAmount, periodLabel, docLabel],
      ['Naqd pul tushumi', cashAmount, periodLabel, docLabel],
      ['Plastik karta tushumi', cardAmount, periodLabel, docLabel],
      ['Payme / Click tushumi', paymeAmount, periodLabel, docLabel],
      ['Bank o‘tkazmasi tushumi', transferAmount, periodLabel, docLabel],
      ['Jami rejalashtirilgan qabullar', totalAptsCount, periodLabel, docLabel],
      ['Kelgan bemorlar soni', attendedCount, periodLabel, docLabel],
      ['Bekor qilingan qabullar', cancelledCount, periodLabel, docLabel],
      ['Kutilayotgan qabullar', pendingCount, periodLabel, docLabel],
    ];

    const filename = `DentaCare_Savdo_Tahlili_${effectiveStartDate}_${effectiveEndDate}`;
    const success = exportToCSV(filename, headers, rows);
    if (success) {
      showToast('Savdo tahlili hisoboti muvaffaqiyatli CSV ga yuklandi!');
    } else {
      showToast('CSV eksport qilishda xatolik yuz berdi', 'error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Yuqori boshqaruv va sana filtri */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Savdo va Moliyaviy Tahlil</Text>
          <Text style={styles.subtitle}>
            Klinikaning real moliyaviy oqimlari, kassa taqsimoti va qabullar samaradorligi
          </Text>
        </View>

        <Button
          title="Hisobotni CSV yuklab olish"
          variant="outline"
          icon={<DownloadIcon size={16} color={colors.primary} />}
          onPress={handleExportCSV}
        />
      </View>

      {/* Davr va shifokor tanlash paneli */}
      <View style={styles.periodCard}>
        <View style={styles.presetButtons}>
          <TouchableOpacity
            onPress={() => applyDatePreset('today')}
            style={[styles.presetBtn, filterPreset === 'today' && styles.presetBtnActive]}
          >
            <Text
              style={[
                styles.presetBtnText,
                filterPreset === 'today' && styles.presetBtnTextActive,
              ]}
            >
              Bugun
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => applyDatePreset('week')}
            style={[styles.presetBtn, filterPreset === 'week' && styles.presetBtnActive]}
          >
            <Text
              style={[
                styles.presetBtnText,
                filterPreset === 'week' && styles.presetBtnTextActive,
              ]}
            >
              Oxirgi 7 kun
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => applyDatePreset('month')}
            style={[styles.presetBtn, filterPreset === 'month' && styles.presetBtnActive]}
          >
            <Text
              style={[
                styles.presetBtnText,
                filterPreset === 'month' && styles.presetBtnTextActive,
              ]}
            >
              Oxirgi 30 kun
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => applyDatePreset('custom')}
            style={[styles.presetBtn, filterPreset === 'custom' && styles.presetBtnActive]}
          >
            <Text
              style={[
                styles.presetBtnText,
                filterPreset === 'custom' && styles.presetBtnTextActive,
              ]}
            >
              Ixtiyoriy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sana tanlash inputlari va Shifokor filtri */}
        <View style={styles.filterInputsRow}>
          <View style={styles.dateCol}>
            <DateInput
              label="Boshlanish sanasi:"
              value={filterStartDate}
              onChangeDate={(d) => {
                setFilterStartDate(d);
                applyDatePreset('custom', d, filterEndDate);
              }}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          <Text style={styles.dateSeparator}>—</Text>

          <View style={styles.dateCol}>
            <DateInput
              label="Tugash sanasi:"
              value={filterEndDate}
              onChangeDate={(d) => {
                setFilterEndDate(d);
                applyDatePreset('custom', filterStartDate, d);
              }}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          <View style={styles.doctorCol}>
            <Select
              label="Shifokor bo‘yicha:"
              value={filterDoctorId}
              onValueChange={setFilterDoctorId}
              options={[
                { label: 'Barcha shifokorlar', value: '' },
                ...doctors.map((d) => ({ label: d.fullName, value: d.id })),
              ]}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
        </View>
      </View>

      {/* KPI Kartalari */}
      <View style={styles.kpiGrid}>
        <StatCard
          title="Jami Savdo"
          value={formatCurrency(totalRevenue)}
          subtitle="Buyurtmalar va xizmatlar umumiy qiymati"
          icon={<CreditCardIcon size={20} color={colors.primary} />}
          iconBg={colors.primaryLight}
        />

        <StatCard
          title="Haqiqiy Tushum"
          value={formatCurrency(actualReceived)}
          subtitle="Kassaga amalda to‘langan summa"
          icon={<CreditCardIcon size={20} color={colors.success} />}
          iconBg={colors.successLight}
        />

        <StatCard
          title="To‘lanmagan Qarz"
          value={formatCurrency(unpaidDebt)}
          subtitle="Ushbu davrdagi qarzdorlik qoldig‘i"
          icon={<CreditCardIcon size={20} color={colors.danger} />}
          iconBg={colors.dangerLight}
        />

        <StatCard
          title="To‘lovlar Soni"
          value={`${paymentsCount} ta`}
          subtitle="Ushbu davrdagi cheklar soni"
          icon={<AnalyticsIcon size={20} color="#0D9488" />}
          iconBg="#CCFBF1"
        />

        {refundedAmount > 0 && (
          <StatCard
            title="Qaytarilgan To‘lov"
            value={formatCurrency(refundedAmount)}
            subtitle="Bemorlarga qaytarilgan pul"
            icon={<CreditCardIcon size={20} color={colors.warning} />}
            iconBg={colors.warningLight}
          />
        )}
      </View>

      {/* Grafika bloki */}
      <View style={styles.chartsGrid}>
        <View style={styles.chartColMain}>
          <RevenueChart
            data={chartPoints}
            title={`Savdo Dinamikasi (${formatDate(effectiveStartDate)} — ${formatDate(effectiveEndDate)})`}
          />
        </View>
        <View style={styles.chartColSide}>
          <PaymentPieChart items={pieItems} totalAmount={actualReceived} />
        </View>
      </View>

      {/* QABULLAR VA SHIFOKORLAR SAMARADORLIGI */}
      <View style={styles.analyticsTablesRow}>
        {/* Shifokorlar savdosi */}
        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Shifokorlar Bo‘yicha Savdo Taqsimoti</Text>
          <Text style={styles.tableSubtitle}>Har bir mutaxassisning keltirgan tushumi va qabullari</Text>

          <View style={styles.doctorRankList}>
            {doctorSales.length === 0 ? (
              <Text style={styles.emptyNote}>Tanlangan muddatda ma’lumot mavjud emas</Text>
            ) : (
              doctorSales.map((doc, idx) => (
                <View key={doc.id} style={styles.docRankRow}>
                  <View style={styles.docRankBadge}>
                    <Text style={styles.docRankText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.docRankInfo}>
                    <Text style={styles.docRankName}>{doc.name}</Text>
                    <Text style={styles.docRankApts}>{doc.aptsCount} ta qabul o‘tkazgan</Text>
                  </View>
                  <View style={styles.docRankRev}>
                    <Text style={styles.docRankRevVal}>{formatCurrency(doc.revenue)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Qabullar va tashriflar ko'rsatkichlari */}
        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Qabullar va Tashriflar Ko‘rsatkichlari</Text>
          <Text style={styles.tableSubtitle}>Bemorlar oqimi va rejadagi qabullar holati</Text>

          <View style={styles.aptStatsList}>
            <View style={styles.aptStatRow}>
              <Text style={styles.aptStatLabel}>Jami rejalashtirilgan qabullar:</Text>
              <Text style={styles.aptStatVal}>{totalAptsCount} ta</Text>
            </View>

            <View style={styles.aptStatRow}>
              <Text style={styles.aptStatLabel}>Klinikaga kelgan bemorlar:</Text>
              <Text style={[styles.aptStatVal, { color: colors.success }]}>
                {attendedCount} ta ({totalAptsCount > 0 ? Math.round((attendedCount / totalAptsCount) * 100) : 0}%)
              </Text>
            </View>

            <View style={styles.aptStatRow}>
              <Text style={styles.aptStatLabel}>Bekor qilingan qabullar:</Text>
              <Text style={[styles.aptStatVal, { color: colors.danger }]}>
                {cancelledCount} ta
              </Text>
            </View>

            <View style={styles.aptStatRow}>
              <Text style={styles.aptStatLabel}>Kutilayotgan/Rejadagi:</Text>
              <Text style={[styles.aptStatVal, { color: colors.info }]}>
                {pendingCount} ta
              </Text>
            </View>
          </View>
        </View>
      </View>
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
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  periodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'column',
    gap: 14,
    position: 'relative',
    zIndex: 30,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    // @ts-ignore
    cursor: 'pointer',
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  filterInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    position: 'relative',
    zIndex: 30,
  },
  dateCol: {
    width: 160,
  },
  dateSeparator: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
    marginHorizontal: 2,
  },
  doctorCol: {
    width: 220,
    minWidth: 180,
    position: 'relative',
    zIndex: 30,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    position: 'relative',
    zIndex: 1,
  },
  chartsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  chartColMain: {
    flex: 2,
    minWidth: 420,
  },
  chartColSide: {
    flex: 1,
    minWidth: 300,
  },
  analyticsTablesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  tableCard: {
    flex: 1,
    minWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  tableSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  doctorRankList: {
    gap: 10,
  },
  docRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  docRankBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docRankText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  docRankInfo: {
    flex: 1,
  },
  docRankName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  docRankApts: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  docRankRev: {
    alignItems: 'flex-end',
  },
  docRankRevVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  aptStatsList: {
    gap: 14,
  },
  aptStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  aptStatLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  aptStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  emptyNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
});
