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
import { Button } from '../components/common/Button';
import { Select, DateInput } from '../components/common/Input';
import { RevenueChart } from '../components/charts/RevenueChart';
import {
  formatCurrency,
  formatDate,
  extractDateOnly,
  getDayWeekdayName,
  isDateInRange,
  generateDateRangeChartPoints,
} from '../utils/formatters';
import { exportToCSV } from '../utils/csvExporter';
import { DownloadIcon } from '../components/common/Icons';

type ReportType = 'sales' | 'payments' | 'debts' | 'appointments' | 'doctors';

const getColStyle = (type: ReportType, idx: number): { flex: number; minWidth: number } => {
  switch (type) {
    case 'sales':
      // ['Chek', 'Sana va vaqt', 'Bemor', 'Shifokor', 'Xizmat', 'Buyurtma summasi (UZS)', 'To‘langan (UZS)', 'Qarz', 'Holat']
      switch (idx) {
        case 0: return { flex: 1.1, minWidth: 120 };
        case 1: return { flex: 1.2, minWidth: 130 };
        case 2: return { flex: 1.3, minWidth: 130 };
        case 3: return { flex: 1.3, minWidth: 130 };
        case 4: return { flex: 2.2, minWidth: 190 };
        case 5: return { flex: 1.3, minWidth: 135 };
        case 6: return { flex: 1.3, minWidth: 130 };
        case 7: return { flex: 0.9, minWidth: 90 };
        case 8: return { flex: 1.0, minWidth: 100 };
        default: return { flex: 1, minWidth: 100 };
      }
    case 'payments':
      // ['Chek', 'Sana va vaqt', 'Bemor', 'Shifokor', 'To‘langan summa (UZS)', 'Qarz qoldig‘i', 'To‘lov usuli', 'Holat']
      switch (idx) {
        case 0: return { flex: 1.1, minWidth: 120 };
        case 1: return { flex: 1.2, minWidth: 130 };
        case 2: return { flex: 1.4, minWidth: 140 };
        case 3: return { flex: 1.4, minWidth: 140 };
        case 4: return { flex: 1.4, minWidth: 140 };
        case 5: return { flex: 1.1, minWidth: 110 };
        case 6: return { flex: 1.2, minWidth: 120 };
        case 7: return { flex: 1.0, minWidth: 100 };
        default: return { flex: 1, minWidth: 100 };
      }
    case 'debts':
      // ['Bemor F.I.Sh', 'Telefon', 'Yashash manzili', 'Oxirgi tashrif', 'Qarzdorlik (UZS)']
      switch (idx) {
        case 0: return { flex: 1.8, minWidth: 170 };
        case 1: return { flex: 1.3, minWidth: 130 };
        case 2: return { flex: 2.4, minWidth: 200 };
        case 3: return { flex: 1.2, minWidth: 120 };
        case 4: return { flex: 1.4, minWidth: 140 };
        default: return { flex: 1, minWidth: 120 };
      }
    case 'appointments':
      // ['Sana', 'Vaqt', 'Bemor', 'Shifokor', 'Xizmat', 'Narxi (UZS)', 'Holat']
      switch (idx) {
        case 0: return { flex: 1.0, minWidth: 110 };
        case 1: return { flex: 0.8, minWidth: 75 };
        case 2: return { flex: 1.5, minWidth: 140 };
        case 3: return { flex: 1.5, minWidth: 140 };
        case 4: return { flex: 2.2, minWidth: 190 };
        case 5: return { flex: 1.2, minWidth: 120 };
        case 6: return { flex: 1.0, minWidth: 100 };
        default: return { flex: 1, minWidth: 100 };
      }
    case 'doctors':
      // ['Shifokor F.I.Sh', 'Mutaxassislik', 'Telefon', 'Qabullar soni', 'Bandlik holati', 'Tushum (UZS)']
      switch (idx) {
        case 0: return { flex: 1.8, minWidth: 170 };
        case 1: return { flex: 1.5, minWidth: 140 };
        case 2: return { flex: 1.3, minWidth: 130 };
        case 3: return { flex: 1.1, minWidth: 110 };
        case 4: return { flex: 1.4, minWidth: 130 };
        case 5: return { flex: 1.4, minWidth: 140 };
        default: return { flex: 1, minWidth: 120 };
      }
  }
};

const isAmountCol = (type: ReportType, idx: number): boolean => {
  if (type === 'sales' && (idx === 5 || idx === 6 || idx === 7)) return true;
  if (type === 'payments' && (idx === 4 || idx === 5)) return true;
  if (type === 'debts' && idx === 4) return true;
  if (type === 'appointments' && idx === 5) return true;
  if (type === 'doctors' && (idx === 3 || idx === 5)) return true;
  return false;
};

const isStatusCol = (type: ReportType, idx: number): boolean => {
  if (type === 'sales' && idx === 8) return true;
  if (type === 'payments' && idx === 7) return true;
  if (type === 'appointments' && idx === 6) return true;
  if (type === 'doctors' && idx === 4) return true;
  return false;
};

const getStatusBadgeStyle = (statusStr: string) => {
  const s = String(statusStr).toLowerCase();
  if (s.includes('to‘landi') || s.includes('to\'landi') || s.includes('yakunlandi')) {
    return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
  }
  if (s.includes('qisman') || s.includes('qabulda') || s.includes('band')) {
    return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
  }
  if (s.includes('qarz') || s.includes('to‘lash kerak') || s.includes('to\'lash kerak') || s.includes('bekor')) {
    return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
  }
  if (s.includes('kutilmoqda') || s.includes('tasdiq') || s.includes('keldi')) {
    return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
  }
  return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
};

export const ReportsScreen: React.FC = () => {
  const {
    payments,
    appointments,
    patients,
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

  const [reportType, setReportType] = React.useState<ReportType>('sales');

  // 1. Sanalarni xavfsiz tozalash va to'g'ri tartiblash (vaqt mintaqasi siljishisiz)
  const rawStart = extractDateOnly(filterStartDate);
  const rawEnd = extractDateOnly(filterEndDate);

  const effectiveStartDate = rawStart && rawEnd && rawStart > rawEnd ? rawEnd : rawStart;
  const effectiveEndDate = rawStart && rawEnd && rawStart > rawEnd ? rawStart : rawEnd;

  // 2. To'lovlar va qabullarni aynan tanlangan sana oralig'i va shifokor bo'yicha qat'iy filtrlash
  // Savdo ko'rsatkichlari uchun to'lov sanasi (p.date), qabullar uchun qabul sanasi (a.date) ishlatiladi
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (!isDateInRange(p.date, effectiveStartDate, effectiveEndDate)) return false;
      if (filterDoctorId && p.doctorId !== filterDoctorId) return false;
      return true;
    });
  }, [payments, effectiveStartDate, effectiveEndDate, filterDoctorId]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (!isDateInRange(a.date, effectiveStartDate, effectiveEndDate)) return false;
      if (filterDoctorId && a.doctorId !== filterDoctorId) return false;
      return true;
    });
  }, [appointments, effectiveStartDate, effectiveEndDate, filterDoctorId]);

  // 3. Hisobot turi bo'yicha ma'lumotlar to'plami va jami hisoblar
  const reportData = useMemo(() => {
    switch (reportType) {
      case 'sales': {
        // Savdo hisoboti: buyurtmalar va to'lovlar umumiy savdo qiymati (p.date bo'yicha)
        const validPays = filteredPayments.filter((p) => p.status !== 'Qaytarilgan');
        const rows = validPays.map((p) => [
          p.receiptNumber,
          `${extractDateOnly(p.date)} ${p.time || ''}`.trim(),
          p.patientName,
          p.doctorName,
          p.serviceName,
          p.totalAmount,
          p.paidAmount,
          p.debtAmount,
          p.status,
        ]);
        const total = validPays.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
        const totalPaid = validPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
        const totalDebt = validPays.reduce((acc, p) => acc + (p.debtAmount || 0), 0);

        return {
          headers: [
            'Chek',
            'Sana va vaqt',
            'Bemor',
            'Shifokor',
            'Xizmat',
            'Buyurtma summasi (UZS)',
            'To‘langan (UZS)',
            'Qarz',
            'Holat',
          ],
          rows,
          total,
          totalPaid,
          totalDebt,
          totalCount: validPays.length,
          unit: 'so‘m',
        };
      }
      case 'payments': {
        // To'lovlar hisoboti: kassaga haqiqiy kelib tushgan summa (p.date bo'yicha)
        const validPays = filteredPayments.filter((p) => p.status !== 'Qaytarilgan');
        const rows = filteredPayments.map((p) => [
          p.receiptNumber,
          `${extractDateOnly(p.date)} ${p.time || ''}`.trim(),
          p.patientName,
          p.doctorName,
          p.paidAmount,
          p.debtAmount,
          p.paymentMethod,
          p.status,
        ]);
        const total = validPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
        const totalDebt = validPays.reduce((acc, p) => acc + (p.debtAmount || 0), 0);

        return {
          headers: [
            'Chek',
            'Sana va vaqt',
            'Bemor',
            'Shifokor',
            'To‘langan summa (UZS)',
            'Qarz qoldig‘i',
            'To‘lov usuli',
            'Holat',
          ],
          rows,
          total,
          totalDebt,
          totalCount: filteredPayments.length,
          unit: 'so‘m',
        };
      }
      case 'debts': {
        // Qarzdorlik hisoboti: bemorlarning amaldagi qarzlari
        const debtorPatients = patients.filter((p) => (p.debt || 0) > 0);
        const rows = debtorPatients.map((p) => [
          p.fullName,
          p.phone,
          p.address || '-',
          p.lastVisitDate ? formatDate(p.lastVisitDate) : '-',
          p.debt,
        ]);
        const total = debtorPatients.reduce((acc, p) => acc + (p.debt || 0), 0);

        return {
          headers: ['Bemor F.I.Sh', 'Telefon', 'Yashash manzili', 'Oxirgi tashrif', 'Qarzdorlik (UZS)'],
          rows,
          total,
          totalCount: debtorPatients.length,
          unit: 'so‘m',
        };
      }
      case 'appointments': {
        // Qabullar hisoboti: rejalashtirilgan va o'tkazilgan qabullar (a.date bo'yicha)
        const rows = filteredAppointments.map((a) => [
          extractDateOnly(a.date),
          a.time,
          a.patientName,
          a.doctorName,
          a.serviceName,
          a.servicePrice || 0,
          a.status,
        ]);

        return {
          headers: ['Sana', 'Vaqt', 'Bemor', 'Shifokor', 'Xizmat', 'Narxi (UZS)', 'Holat'],
          rows,
          total: filteredAppointments.length,
          totalCount: filteredAppointments.length,
          unit: 'ta',
        };
      }
      case 'doctors': {
        // Shifokorlar bandligi hisoboti: har bir shifokorning tanlangan davrdagi qabullari va holati
        const list = filterDoctorId
          ? doctors.filter((d) => d.id === filterDoctorId)
          : doctors;

        let totalPeriodApts = 0;
        const rows = list.map((doc) => {
          const docApts = filteredAppointments.filter(
            (a) => a.doctorId === doc.id && a.status !== 'Bekor qilindi'
          );
          totalPeriodApts += docApts.length;

          const docPays = filteredPayments.filter(
            (p) => p.doctorId === doc.id && p.status !== 'Qaytarilgan'
          );
          const docRev = docPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

          let occStatus = `${docApts.length} ta qabul`;
          if (effectiveStartDate === effectiveEndDate) {
            const weekday = getDayWeekdayName(effectiveStartDate);
            const isWorkDay =
              Array.isArray(doc.workDays) &&
              doc.workDays.some((wDay) => {
                const w = String(wDay).toLowerCase().trim();
                const d = weekday.toLowerCase().trim();
                return w === d || w.startsWith(d.slice(0, 3)) || d.startsWith(w.slice(0, 3));
              });

            if (!isWorkDay && docApts.length === 0) {
              occStatus = 'Dam olish kuni';
            } else if (docApts.length === 0) {
              occStatus = 'Bo‘sh (qabul yo‘q)';
            } else if (docApts.length >= 5) {
              occStatus = `To‘liq band (${docApts.length} ta)`;
            } else {
              occStatus = `Qabulda (${docApts.length} ta)`;
            }
          }

          return [
            doc.fullName,
            doc.specialty,
            doc.phone,
            docApts.length,
            occStatus,
            docRev,
          ];
        });

        return {
          headers: [
            'Shifokor F.I.Sh',
            'Mutaxassislik',
            'Telefon',
            'Qabullar soni',
            'Bandlik holati',
            'Tushum (UZS)',
          ],
          rows,
          total: totalPeriodApts,
          totalCount: list.length,
          unit: 'ta',
        };
      }
    }
  }, [
    reportType,
    filteredPayments,
    filteredAppointments,
    patients,
    doctors,
    filterDoctorId,
    effectiveStartDate,
    effectiveEndDate,
  ]);

  // 4. Grafik ma'lumotlari: aynan tanlangan muddat va to'lovlar bo'yicha jami summaga 100% teng
  const chartPoints = useMemo(() => {
    return generateDateRangeChartPoints(
      effectiveStartDate,
      effectiveEndDate,
      filteredPayments
    );
  }, [effectiveStartDate, effectiveEndDate, filteredPayments]);

  // 5. CSV yuklab olish
  const handleExportCSV = () => {
    const filename = `DentaCare_${reportType}_hisoboti_${effectiveStartDate}_${effectiveEndDate}`;

    // Oxirgi satrga umumiy natijalarni (Jami) qo'shish
    const exportRows = [...reportData.rows];
    if (reportType === 'sales') {
      exportRows.push([
        'JAMI / NATIJA',
        '',
        '',
        '',
        `${reportData.totalCount} ta to‘lov`,
        reportData.total,
        (reportData as any).totalPaid ?? '',
        (reportData as any).totalDebt ?? '',
        '',
      ]);
    } else if (reportType === 'payments') {
      exportRows.push([
        'JAMI / NATIJA',
        '',
        '',
        '',
        reportData.total,
        (reportData as any).totalDebt ?? '',
        '',
        `${reportData.totalCount} ta to‘lov`,
      ]);
    } else if (reportType === 'debts') {
      exportRows.push([
        'JAMI QARZDORLIK',
        '',
        '',
        `${reportData.totalCount} nafar bemor`,
        reportData.total,
      ]);
    } else if (reportType === 'appointments') {
      exportRows.push([
        'JAMI QABULLAR',
        '',
        '',
        '',
        `${reportData.totalCount} ta qabul`,
        '',
        '',
      ]);
    } else if (reportType === 'doctors') {
      exportRows.push([
        'JAMI KO‘RSATKICHLAR',
        '',
        '',
        `${reportData.total} ta qabul`,
        '',
        '',
      ]);
    }

    const success = exportToCSV(filename, reportData.headers, exportRows);
    if (success) {
      showToast('Hisobot CSV formatida muvaffaqiyatli yuklab olindi!');
    } else {
      showToast('Eksport qilishda xatolik yuz berdi', 'error');
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'sales':
        return 'Savdo va Buyurtmalar Hisoboti';
      case 'payments':
        return 'Barcha To‘lovlar va Kassa Tushumi Hisoboti';
      case 'debts':
        return 'Qarzdor Bemorlar Ro‘yxati va Hisoboti';
      case 'appointments':
        return 'Qabullar va Tashriflar Tahliliy Hisoboti';
      case 'doctors':
        return 'Shifokorlar Bandligi va Qabullar Hisoboti';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Yuqori boshqaruv */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Klinika Hisobotlari</Text>
          <Text style={styles.subtitle}>
            Kerakli yo‘nalish va sana oralig‘ini tanlab, to‘liq CSV fayl sifatida yuklab oling
          </Text>
        </View>

        <Button
          title="CSV Faylni Yuklab Olish"
          icon={<DownloadIcon size={16} color="#FFF" />}
          onPress={handleExportCSV}
        />
      </View>

      {/* Hisobot turlari kartochkalari */}
      <View style={styles.typeCardsRow}>
        <TouchableOpacity
          onPress={() => setReportType('sales')}
          style={[styles.typeCard, reportType === 'sales' && styles.typeCardActive]}
        >
          <Text style={[styles.typeCardTitle, reportType === 'sales' && styles.typeCardTitleActive]}>
            1. Savdo Hisoboti
          </Text>
          <Text style={styles.typeCardSub}>Xizmatlar va buyurtma qiymati</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setReportType('payments')}
          style={[styles.typeCard, reportType === 'payments' && styles.typeCardActive]}
        >
          <Text style={[styles.typeCardTitle, reportType === 'payments' && styles.typeCardTitleActive]}>
            2. To‘lovlar Hisoboti
          </Text>
          <Text style={styles.typeCardSub}>Kassaga haqiqiy kirim tushumi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setReportType('debts')}
          style={[styles.typeCard, reportType === 'debts' && styles.typeCardActive]}
        >
          <Text style={[styles.typeCardTitle, reportType === 'debts' && styles.typeCardTitleActive]}>
            3. Qarzdorlik Hisoboti
          </Text>
          <Text style={styles.typeCardSub}>Bemorlarning qoldiq qarzlari</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setReportType('appointments')}
          style={[styles.typeCard, reportType === 'appointments' && styles.typeCardActive]}
        >
          <Text style={[styles.typeCardTitle, reportType === 'appointments' && styles.typeCardTitleActive]}>
            4. Qabullar Hisoboti
          </Text>
          <Text style={styles.typeCardSub}>Bemorlar oqimi va holatlari</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setReportType('doctors')}
          style={[styles.typeCard, reportType === 'doctors' && styles.typeCardActive]}
        >
          <Text style={[styles.typeCardTitle, reportType === 'doctors' && styles.typeCardTitleActive]}>
            5. Shifokorlar Bandligi
          </Text>
          <Text style={styles.typeCardSub}>Kunlik va davriy bandlik</Text>
        </TouchableOpacity>
      </View>

      {/* Sana va Shifokor filtrlari */}
      <View style={styles.filtersBar}>
        {reportType !== 'debts' && (
          <>
            {/* Tezkor preset tugmalari */}
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
          </>
        )}

        <View style={styles.reportSummaryBadge}>
          <Text style={styles.repSumLabel}>
            {reportType === 'appointments' || reportType === 'doctors'
              ? 'Jami qabullar:'
              : reportType === 'debts'
              ? 'Jami qarz:'
              : 'Jami summa:'}
          </Text>
          <Text style={styles.repSumVal}>
            {reportData.unit === 'ta'
              ? `${reportData.total} ta`
              : formatCurrency(reportData.total)}
          </Text>
        </View>
      </View>

      {/* Hisobot grafigi (Savdo va to'lovlar hisobotida dinamik grafik) */}
      {(reportType === 'sales' || reportType === 'payments') && (
        <View style={styles.chartSection}>
          <RevenueChart
            data={chartPoints}
            title={`${getReportTitle()} Dinamikasi (${formatDate(effectiveStartDate)} — ${formatDate(effectiveEndDate)})`}
          />
        </View>
      )}

      {/* Oldindan ko'rish jadvali */}
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>{getReportTitle()}</Text>
          <Text style={styles.previewCount}>
            {reportData.rows.length} ta yozuv topildi
          </Text>
        </View>

        <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={true}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            <View style={styles.tableInner}>
              {/* Table Header */}
              <View style={styles.thRow}>
                {reportData.headers.map((h, i) => {
                  const colStyle = getColStyle(reportType, i);
                  const isAmount = isAmountCol(reportType, i);
                  return (
                    <Text
                      key={i}
                      style={[
                        styles.thCell,
                        colStyle,
                        isAmount && styles.thCellRight,
                      ]}
                    >
                      {h}
                    </Text>
                  );
                })}
              </View>

              {/* Table Body */}
              {reportData.rows.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Tanlangan muddatda ma’lumot topilmadi (0 ta yozuv)</Text>
                </View>
              ) : (
                reportData.rows.map((row, rIdx) => (
                  <View key={rIdx} style={[styles.trRow, rIdx % 2 === 1 && styles.trAlt]}>
                    {row.map((cell, cIdx) => {
                      const colStyle = getColStyle(reportType, cIdx);
                      const isNumber = typeof cell === 'number';
                      const isAmount = isAmountCol(reportType, cIdx);
                      const isStatus = isStatusCol(reportType, cIdx);

                      if (isStatus) {
                        const bStyle = getStatusBadgeStyle(String(cell ?? ''));
                        return (
                          <View
                            key={cIdx}
                            style={[
                              styles.tdCellWrapper,
                              colStyle,
                            ]}
                          >
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: bStyle.bg,
                                  borderColor: bStyle.border,
                                },
                              ]}
                            >
                              <Text style={[styles.statusText, { color: bStyle.text }]}>
                                {String(cell ?? '')}
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View
                          key={cIdx}
                          style={[
                            styles.tdCellWrapper,
                            colStyle,
                            isAmount && styles.tdCellWrapperRight,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tdCell,
                              isNumber && styles.tdNumber,
                              isAmount && styles.tdRight,
                            ]}
                          >
                            {typeof cell === 'number' && reportType === 'doctors' && cIdx === 3
                              ? `${cell} ta`
                              : typeof cell === 'number' && cIdx !== 1
                              ? formatCurrency(cell)
                              : String(cell ?? '')}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </ScrollView>
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
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  typeCardsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  typeCard: {
    flex: 1,
    minWidth: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    // @ts-ignore
    cursor: 'pointer',
  },
  typeCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDFA',
  },
  typeCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  typeCardTitleActive: {
    color: colors.primaryDark,
  },
  typeCardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  filtersBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'column',
    gap: 12,
    position: 'relative',
    zIndex: 30,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 11,
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
  reportSummaryBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repSumLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  repSumVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  chartSection: {
    marginBottom: 6,
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 260,
    position: 'relative',
    zIndex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FAFAFA',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  previewCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewScroll: {
    maxHeight: 540,
    width: '100%',
  },
  horizontalScrollContent: {
    minWidth: '100%',
    flexGrow: 1,
  },
  tableInner: {
    width: '100%',
    minWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingRight: 8,
  },
  thCellRight: {
    textAlign: 'right',
    paddingRight: 12,
  },
  trRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    width: '100%',
  },
  trAlt: {
    backgroundColor: '#FAFAFA',
  },
  tdCellWrapper: {
    paddingRight: 8,
    justifyContent: 'center',
  },
  tdCellWrapperRight: {
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  tdCell: {
    fontSize: 13,
    color: colors.text,
  },
  tdRight: {
    textAlign: 'right',
  },
  tdNumber: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
