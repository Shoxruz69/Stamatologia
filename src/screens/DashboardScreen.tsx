import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Appointment, AppointmentStatus } from '../types';
import { PlusIcon } from '../components/common/Icons';
import {
  getTodayDateString,
  formatNumber,
  formatCurrency,
} from '../utils/formatters';

interface DashboardScreenProps {
  onOpenAppointmentModal: () => void;
  onOpenPatientModal: () => void;
  onOpenPaymentModal: () => void;
  onViewAppointment: (apt: any) => void;
}

// Mln formatlash yordamchilari
const formatMlnText = (amount: number): string => {
  if (amount >= 1000000) {
    const val = (amount / 1000000).toFixed(2).replace('.', ',');
    const clean = val.replace(/,00$/, '').replace(/,(\d)0$/, ',$1');
    return `${clean} mln so‘m`;
  }
  return formatCurrency(amount);
};

const formatMlnShort = (amount: number): string => {
  if (amount >= 1000000) {
    const val = (amount / 1000000).toFixed(2).replace('.', ',');
    const clean = val.replace(/,00$/, '').replace(/,(\d)0$/, ',$1');
    return `${clean} mln`;
  }
  return formatCurrency(amount);
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenAppointmentModal,
  onOpenPatientModal,
  onOpenPaymentModal,
  onViewAppointment,
}) => {
  const {
    appointments,
    patients,
    payments,
    currentUser,
    setCurrentTab,
    updateAppointment,
    showToast,
  } = useApp();

  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  const todayStr = getTodayDateString();

  // Foydalanuvchi rollari: Menejer, Hamshira (Medsestra) yoki Shifokor (Doctor)
  const isManager = currentUser?.role === 'Menejer';
  const isNurse = currentUser?.role === 'Medsestra';

  // 1. Ism va vaqtga qarab salomlashuv
  const staffFirstName = useMemo(() => {
    if (!currentUser?.name) {
      if (isManager) return 'Aziza';
      return isNurse ? 'Dilnoza' : 'Shahnoza';
    }
    const clean = currentUser.name.replace(/^(Dr\.|Hamshira|Menejer)\s*/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts[0] || (isManager ? 'Aziza' : isNurse ? 'Dilnoza' : 'Shahnoza');
  }, [currentUser, isNurse, isManager]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Xayrli tong';
    if (hour >= 12 && hour < 18) return 'Xayrli kun';
    return 'Xayrli kech';
  }, []);

  // 2. Bugungi qabullarni hisoblash
  const todayAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === todayStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, todayStr]);

  // 3. Ko'rsatkichlar hisobi (Haqiqiy holat bo'yicha)
  const totalTodayCount = useMemo(() => {
    return todayAppointments.length;
  }, [todayAppointments]);

  const attendedCount = useMemo(() => {
    return todayAppointments.filter(
      (a) => a.status === 'Yakunlandi' || a.status === 'Keldi' || a.status === 'Qabulda'
    ).length;
  }, [todayAppointments]);

  const pendingCount = useMemo(() => {
    return todayAppointments.filter(
      (a) => a.status === 'Kutilmoqda' || a.status === 'Tasdiqlangan'
    ).length;
  }, [todayAppointments]);

  const confirmedCount = useMemo(() => {
    return todayAppointments.filter((a) => a.status === 'Tasdiqlangan').length;
  }, [todayAppointments]);

  const waitingQueueCount = useMemo(() => {
    return todayAppointments.filter(
      (a) => a.status === 'Keldi' || a.status === 'Qabulda'
    ).length;
  }, [todayAppointments]);

  // Qabul navbati jadvali uchun qabullar
  const displayAppointments = useMemo(() => {
    return todayAppointments.slice(0, 5);
  }, [todayAppointments]);

  // 4. Haftalik qabul oqimi va tushum grafigi (Haqiqiy joriy hafta)
  const currentWeekMetrics = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);

    const dayLabels = ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Sha', 'Ya'];
    const aptList: { day: string; dateStr: string; value: number }[] = [];
    const payList: { day: string; dateStr: string; value: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().split('T')[0];

      const aCnt = appointments.filter(
        (a) => a.date === dStr && a.status !== 'Bekor qilindi'
      ).length;
      aptList.push({ day: dayLabels[i], dateStr: dStr, value: aCnt });

      const pSum = payments
        .filter((p) => p.date === dStr && p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.paidAmount || 0), 0);
      payList.push({
        day: dayLabels[i],
        dateStr: dStr,
        value: Math.round((pSum / 1000000) * 10) / 10,
      });
    }

    return { aptList, payList };
  }, [appointments, payments]);

  const [activeDayIdx, setActiveDayIdx] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });

  const weeklyData = currentWeekMetrics.aptList;
  const maxWeeklyValue = Math.max(10, ...weeklyData.map((w) => w.value));

  // 5. Hamshira uchun: Kutish zalidagi haqiqiy bemorlar ro'yxati
  const nurseWaitingQueue = useMemo(() => {
    return todayAppointments
      .filter((a) => a.status === 'Keldi' || a.status === 'Qabulda' || a.status === 'Kutilmoqda')
      .map((a) => ({
        id: a.id,
        initial: (a.patientName || 'B').slice(0, 1).toUpperCase(),
        initialBg: a.status === 'Qabulda' ? '#DBEAFE' : a.status === 'Keldi' ? '#CCFBF1' : '#FEF3C7',
        initialColor: a.status === 'Qabulda' ? '#1D4ED8' : a.status === 'Keldi' ? '#0F766E' : '#B45309',
        name: a.patientName,
        subtext: `${a.doctorName || 'Shifokor'} • ${a.time}`,
        statusText: a.status === 'Qabulda' ? 'Qabulda' : a.status === 'Keldi' ? 'Kutish zalida' : 'Kutilmoqda',
        statusColor: a.status === 'Qabulda' ? '#2563EB' : a.status === 'Keldi' ? '#0D9488' : '#F59E0B',
      }));
  }, [todayAppointments]);

  // 6. Shifokor uchun: So'nggi tashriflar ro'yxati
  const doctorRecentVisits = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          !currentUser ||
          currentUser.role !== 'Shifokor' ||
          a.doctorId === currentUser.id ||
          a.doctorName.toLowerCase().includes(currentUser.name.toLowerCase())
      )
      .filter((a) => a.status === 'Yakunlandi' || a.status === 'Qabulda')
      .slice(-4)
      .reverse()
      .map((a) => ({
        id: a.id,
        initial: (a.patientName || 'B').slice(0, 1).toUpperCase(),
        initialBg: '#CCFBF1',
        initialColor: '#0F766E',
        name: a.patientName,
        subtext: `${a.serviceName} • ${a.date}`,
        statusText: a.status === 'Yakunlandi' ? 'Qabul yakunlandi' : 'Qabulda',
        statusColor: '#0D9488',
      }));
  }, [appointments, currentUser]);

  // Hamshira uchun tezkor amallar: Bemor kelganini belgilash
  const handleToggleArrival = (apt: any) => {
    if (apt.id && !apt.id.startsWith('mock-')) {
      const nextStatus: AppointmentStatus =
        apt.status === 'Kutilmoqda' || apt.status === 'Tasdiqlangan'
          ? 'Keldi'
          : apt.status === 'Keldi'
          ? 'Qabulda'
          : 'Yakunlandi';

      updateAppointment(apt.id, { status: nextStatus });
      showToast(`"${apt.patientName}" holati yangilandi: ${nextStatus}!`);
    } else {
      showToast(`"${apt.patientName}" kutish zalida ro‘yxatga olindi!`);
    }
  };

  // Holat pilli uchun rang va yozuv
  const renderStatusBadge = (apt: any) => {
    let bgColor = '#10B981';
    let label = isNurse && apt.nurseStatusLabel ? apt.nurseStatusLabel : apt.status;

    if (isNurse) {
      if (label === 'Keldi') {
        bgColor = '#10B981'; // Green
      } else if (label === 'Kutish zalida' || apt.status === 'Qabulda') {
        bgColor = '#3B82F6'; // Blue
        label = 'Kutish zalida';
      } else if (label === 'Kutilmoqda') {
        bgColor = '#F59E0B'; // Amber
      } else if (label === 'Tasdiqlangan' || label === 'Tasdiqlandi') {
        bgColor = '#8B5CF6'; // Purple
        label = 'Tasdiqlandi';
      } else {
        bgColor = '#10B981';
      }
    } else {
      // Shifokor uchun
      switch (apt.status) {
        case 'Yakunlandi':
        case 'Keldi':
          bgColor = '#10B981';
          label = 'Yakunlandi';
          break;
        case 'Qabulda':
          bgColor = '#3B82F6';
          label = 'Qabulda';
          break;
        case 'Kutilmoqda':
          bgColor = '#F59E0B';
          label = 'Kutilmoqda';
          break;
        case 'Tasdiqlangan':
        case 'Tasdiqlandi':
          bgColor = '#8B5CF6';
          label = 'Tasdiqlandi';
          break;
        case 'Bekor qilindi':
          bgColor = '#EF4444';
          label = 'Bekor qilindi';
          break;
        default:
          bgColor = '#10B981';
          label = apt.status;
      }
    }

    return (
      <TouchableOpacity
        style={[styles.statusPill, { backgroundColor: bgColor }]}
        onPress={() => (isNurse ? handleToggleArrival(apt) : onViewAppointment(apt))}
        activeOpacity={0.8}
        // @ts-ignore
        title={isNurse ? 'Kelganini belgilash uchun bosing' : 'Tafsilotlar'}
      >
        <Text style={styles.statusPillText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // MENEJER (ADMINISTRATOR) STATISTIKALARI VA MA'LUMOTLARI
  // ============================================================
  const currentMonthStr = todayStr.substring(0, 7); // 'YYYY-MM'

  // Bugungi to'lovlar
  const managerTodayPayments = useMemo(() => {
    return payments.filter(
      (p) =>
        p.date === todayStr &&
        p.status !== 'Qaytarilgan' &&
        p.status !== 'Bekor qilingan'
    );
  }, [payments, todayStr]);

  // 1. Bugungi savdo va tushgan to'lov (Haqiqiy to'lovlar summasi)
  const { todaySalesFormatted, todayPaidFormatted } = useMemo(() => {
    const totalSales = managerTodayPayments.reduce(
      (acc, p) => acc + (p.totalAmount || 0),
      0
    );
    const totalPaid = managerTodayPayments.reduce(
      (acc, p) => acc + (p.paidAmount || 0),
      0
    );

    return {
      todaySalesFormatted: formatMlnText(totalSales),
      todayPaidFormatted: formatMlnShort(totalPaid),
    };
  }, [managerTodayPayments]);

  // 2. Oylik tushum (Haqiqiy joriy oy to'lovlari)
  const monthlyRevenueRaw = useMemo(() => {
    return payments
      .filter(
        (p) =>
          p.status !== 'Qaytarilgan' &&
          p.date &&
          p.date.startsWith(currentMonthStr)
      )
      .reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  }, [payments, currentMonthStr]);

  const monthlyRevenueFormatted = useMemo(() => {
    return formatMlnText(monthlyRevenueRaw);
  }, [monthlyRevenueRaw]);

  // 3. Qarzdorlik (Haqiqiy qarzlar summasi)
  const { totalDebtRaw, totalDebtFormatted, totalDebtShortFormatted, unpaidPatientsCount } =
    useMemo(() => {
      const realDebt = payments
        .filter((p) => p.status !== 'Qaytarilgan')
        .reduce((acc, p) => acc + (p.debtAmount || 0), 0);

      const debtorsSet = new Set(
        payments
          .filter((p) => (p.debtAmount || 0) > 0)
          .map((p) => p.patientId)
      );

      return {
        totalDebtRaw: realDebt,
        totalDebtFormatted: formatMlnText(realDebt),
        totalDebtShortFormatted: formatMlnShort(realDebt),
        unpaidPatientsCount: debtorsSet.size,
      };
    }, [payments]);

  // 4. Yangi bemorlar soni (Shu oy ro'yxatdan o'tganlar)
  const newPatientsThisMonth = useMemo(() => {
    return patients.filter(
      (p) => p.createdAt && p.createdAt.startsWith(currentMonthStr)
    ).length;
  }, [patients, currentMonthStr]);

  // 5. Haftalik tushum chart state
  const [managerActiveDayIdx, setManagerActiveDayIdx] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });

  const managerWeeklyData = currentWeekMetrics.payList;
  const maxManagerWeeklyValue = Math.max(
    5,
    ...managerWeeklyData.map((m) => m.value)
  );

  // 6. So'nggi to'lovlar jadvali
  const displayManagerPayments = useMemo(() => {
    if (!payments || payments.length === 0) {
      return [];
    }

    const sorted = [...payments]
      .filter((p) => p.status !== 'Bekor qilingan')
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

    const colorsList = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

    return sorted.slice(0, 4).map((p, i) => {
      const pat = patients.find((pt) => pt.id === p.patientId);
      const isPart = p.status === 'Qisman to‘langan' || (p.debtAmount || 0) > 0;
      return {
        id: p.id,
        time: p.time || '10:00',
        patientName: p.patientName,
        patientPhone: pat?.phone || '',
        serviceInfo: `${p.serviceName ? p.serviceName.split('(')[0].trim() : 'Xizmat'} · ${formatNumber(p.totalAmount)}`,
        statusLabel: isPart ? 'Qisman' : 'To‘landi',
        statusColor: isPart ? '#F59E0B' : colorsList[i % colorsList.length],
      };
    });
  }, [payments, patients]);

  // 7. Eng ko'p tanlangan xizmatlar (Haqiqiy to'lovlardan)
  const managerTopServices = useMemo(() => {
    const svcMap: Record<string, { name: string; count: number; totalAmount: number }> = {};
    const paidPayments = payments.filter((p) => p.status !== 'Qaytarilgan');
    const totalAllPaid = paidPayments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);

    paidPayments.forEach((p) => {
      const sName = p.serviceName ? p.serviceName.split('(')[0].trim() : 'Muolaja';
      if (!svcMap[sName]) {
        svcMap[sName] = { name: sName, count: 0, totalAmount: 0 };
      }
      svcMap[sName].count += 1;
      svcMap[sName].totalAmount += (p.paidAmount || 0);
    });

    const sorted = Object.values(svcMap).sort((a, b) => b.totalAmount - a.totalAmount);
    const colors = [
      { bg: '#CCFBF1', text: '#0F766E' },
      { bg: '#DBEAFE', text: '#1D4ED8' },
      { bg: '#FEF3C7', text: '#B45309' },
    ];

    return sorted.slice(0, 3).map((s, idx) => {
      const pct = totalAllPaid > 0 ? Math.round((s.totalAmount / totalAllPaid) * 100) : 0;
      const color = colors[idx % colors.length];
      return {
        id: `top-svc-${idx}`,
        initial: s.name.slice(0, 1).toUpperCase(),
        initialBg: color.bg,
        initialColor: color.text,
        name: s.name,
        subtext: `${s.count} ta xizmat · ${formatMlnShort(s.totalAmount)} so‘m`,
        percentageText: `Jami savdoning ${pct}%`,
      };
    });
  }, [payments]);

  // ============================================================
  // MENEJER BOSH SAHIFASI
  // ============================================================
  if (isManager) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ============================================================ */}
        {/* 1. YUQORI SARLAVHA VA HISOBOTNI KO'RISH TUGMASI             */}
        {/* ============================================================ */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingTitle}>{greeting}!</Text>
            <Text style={styles.greetingSub}>
              Klinika faoliyatining bugungi ko‘rsatkichlari
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addAppointmentBtn}
            onPress={() => setCurrentTab('reports')}
            activeOpacity={0.85}
          >
            <PlusIcon size={16} color="#FFFFFF" />
            <Text style={styles.addAppointmentBtnText}>Hisobotni ko‘rish</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* 2. TOP 4 TA MOLIYAVIY KO'RSATKICH KARTALARI                 */}
        {/* ============================================================ */}
        <View style={[styles.metricsRow, isMobile && styles.metricsRowMobile]}>
          {/* Karta 1: Bugungi savdo */}
          <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
            <View style={[styles.metricIconSquare, { backgroundColor: '#10B981' }]}>
              <Text style={styles.metricIconChar}>S</Text>
            </View>
            <Text style={styles.metricLabel}>BUGUNGI SAVDO</Text>
            <Text style={styles.metricValue}>{todaySalesFormatted}</Text>
            <Text style={styles.metricSub}>Tushgan to‘lov: {todayPaidFormatted}</Text>
          </View>

          {/* Karta 2: Oylik tushum */}
          <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
            <View style={[styles.metricIconSquare, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.metricIconChar}>T</Text>
            </View>
            <Text style={styles.metricLabel}>OYLIK TUSHUM</Text>
            <Text style={styles.metricValue}>{monthlyRevenueFormatted}</Text>
            <Text style={styles.metricSub}>O‘tgan oyga nisbatan +12%</Text>
          </View>

          {/* Karta 3: Qarzdorlik */}
          <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
            <View style={[styles.metricIconSquare, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.metricIconChar}>Q</Text>
            </View>
            <Text style={styles.metricLabel}>QARZDORLIK</Text>
            <Text style={styles.metricValue}>{totalDebtFormatted}</Text>
            <Text style={styles.metricSub}>
              {unpaidPatientsCount} ta bemorda to‘lanmagan
            </Text>
          </View>

          {/* Karta 4: Yangi bemorlar */}
          <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
            <View style={[styles.metricIconSquare, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.metricIconChar}>B</Text>
            </View>
            <Text style={styles.metricLabel}>YANGI BEMORLAR</Text>
            <Text style={styles.metricValue}>{newPatientsThisMonth} nafar</Text>
            <Text style={styles.metricSub}>Shu oy ro‘yxatdan o‘tgan</Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* 3. O'RTA QATOR: SO'NGGI TO'LOVLAR VA HAFTALIK TUSHUM        */}
        {/* ============================================================ */}
        <View style={[styles.twoColRow, isMobile && styles.twoColRowMobile]}>
          {/* CHAP KARTA: SO'NGGI TO'LOVLAR JADVALI */}
          <View style={[styles.panelCard, styles.flex1]}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>So‘nggi to‘lovlar</Text>
                <Text style={styles.panelSubtitle}>
                  Bugungi xizmatlardan kelib tushgan to‘lovlar
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCurrentTab('payments')}
                activeOpacity={0.7}
                style={styles.linkRow}
              >
                <Text style={styles.linkText}>Barchasini ko‘rish →</Text>
              </TouchableOpacity>
            </View>

            {/* Jadval */}
            <View style={styles.tableWrapper}>
              <View style={styles.tableHeadRow}>
                <Text style={[styles.thText, { width: 64 }]}>VAQT</Text>
                <Text style={[styles.thText, { flex: 1.4 }]}>BEMOR</Text>
                <Text style={[styles.thText, { flex: 1.4 }]}>XIZMAT / SUMMA</Text>
                <Text style={[styles.thText, { width: 104, textAlign: 'center' }]}>
                  HOLAT
                </Text>
              </View>

              {displayManagerPayments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Hozircha to‘lovlar yo‘q</Text>
                  <Text style={styles.emptySubtitle}>Bugungi xizmatlar bo‘yicha to‘lovlar hali kiritilmagan</Text>
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setCurrentTab('payments')}
                  >
                    <Text style={styles.emptyAddBtnText}>+ Birinchi to‘lovni kiritish</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                displayManagerPayments.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id || idx}
                    style={[
                      styles.tableRow,
                      idx === displayManagerPayments.length - 1 && styles.tableRowLast,
                    ]}
                    onPress={() => {
                      setCurrentTab('payments');
                      showToast(`"${item.patientName}" to‘lov tafsilotlari`, 'info');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 64 }}>
                      <Text style={styles.cellTime}>{item.time}</Text>
                    </View>

                    <View style={{ flex: 1.4, paddingRight: 6 }}>
                      <Text style={styles.cellPatientName} numberOfLines={1}>
                        {item.patientName}
                      </Text>
                      <Text style={styles.cellPatientPhone} numberOfLines={1}>
                        {item.patientPhone}
                      </Text>
                    </View>

                    <View style={{ flex: 1.4, paddingRight: 6 }}>
                      <Text style={styles.cellServiceName} numberOfLines={1}>
                        {item.serviceInfo}
                      </Text>
                    </View>

                    <View style={{ width: 104, alignItems: 'center' }}>
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: item.statusColor },
                        ]}
                      >
                        <Text style={styles.statusPillText}>{item.statusLabel}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>

          {/* O'NG KARTA: HAFTALIK TUSHUM BAR CHART */}
          <View style={[styles.panelCard, styles.flex1]}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>Haftalik tushum</Text>
                <Text style={styles.panelSubtitle}>
                  Kunlar bo‘yicha tushum (mln so‘m)
                </Text>
              </View>

              <TouchableOpacity
                style={styles.dropdownPill}
                onPress={() => showToast('Bu haftalik tushum statistikasi', 'info')}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownPillText}>Bu hafta ⌄</Text>
              </TouchableOpacity>
            </View>

            {/* Chart */}
            <View style={styles.chartContainer}>
              <View style={styles.yAxisWrapper}>
                {[20, 15, 10, 5].map((val) => (
                  <View key={val} style={styles.gridLineRow}>
                    <Text style={styles.yAxisLabel}>{val}</Text>
                    <View style={styles.gridLine} />
                  </View>
                ))}
              </View>

              <View style={styles.barsAreaRow}>
                {managerWeeklyData.map((item, idx) => {
                  const isHighlight = managerActiveDayIdx === idx;
                  const barHeight = Math.round((item.value / maxManagerWeeklyValue) * 110);

                  return (
                    <TouchableOpacity
                      key={item.day}
                      style={styles.barColumn}
                      onPress={() => setManagerActiveDayIdx(idx)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.barTopValue,
                          isHighlight && styles.barTopValueHighlight,
                        ]}
                      >
                        {item.value}
                      </Text>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barStick,
                            { height: barHeight },
                            isHighlight
                              ? styles.barStickHighlight
                              : styles.barStickNormal,
                          ]}
                        />
                      </View>

                      <Text
                        style={[
                          styles.dayLabel,
                          isHighlight && styles.dayLabelHighlight,
                        ]}
                      >
                        {item.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* 4. PASTKI QATOR: TUSHUM VA QARZDORLIK / TOP XIZMATLAR       */}
        {/* ============================================================ */}
        <View style={[styles.twoColRow, isMobile && styles.twoColRowMobile]}>
          {/* CHAP KARTA: TUSHUM VA QARZDORLIK */}
          <View style={[styles.panelCard, styles.flex1]}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>Tushum va qarzdorlik</Text>
                <Text style={styles.panelSubtitle}>
                  Klinikaning joriy moliyaviy holati
                </Text>
              </View>
            </View>

            <View style={styles.examBoxesRow}>
              {/* Box 1 (Mint) */}
              <View style={styles.examBoxMint}>
                <Text style={styles.examBoxMintLabel}>HAQIQIY TUSHUM</Text>
                <Text style={styles.examBoxBigNumber}>{monthlyRevenueFormatted}</Text>
                <Text style={styles.examBoxSub}>Hisobga tushgan mablag‘</Text>
              </View>

              {/* Box 2 (Gray) */}
              <View style={styles.examBoxGray}>
                <Text style={styles.examBoxGrayLabel}>TO‘LANMAGAN QARZ</Text>
                <Text style={styles.examBoxBigNumber}>{totalDebtShortFormatted}</Text>
                <Text style={styles.examBoxSub}>Bemorlar bo‘yicha qoldiq</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      monthlyRevenueRaw + totalDebtRaw > 0
                        ? `${Math.min(100, Math.round((monthlyRevenueRaw / (monthlyRevenueRaw + totalDebtRaw)) * 100))}%`
                        : '0%',
                  },
                ]}
              />
            </View>
          </View>

          {/* O'NG KARTA: ENG KO'P TANLANGAN XIZMATLAR */}
          <View style={[styles.panelCard, styles.flex1]}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>Eng ko‘p tanlangan xizmatlar</Text>
                <Text style={styles.panelSubtitle}>
                  Oy boshidan buyon tushgan savdo
                </Text>
              </View>
            </View>

            <View style={styles.recentListWrap}>
              {managerTopServices.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Xizmatlar tahlili hali yo‘q</Text>
                  <Text style={styles.emptySubtitle}>Bemorlarga ko‘rsatilgan xizmatlar va to‘lovlar tarixi kutilmoqda</Text>
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setCurrentTab('services')}
                  >
                    <Text style={styles.emptyAddBtnText}>+ Xizmatlar ro‘yxatini ko‘rish</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                managerTopServices.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentItemRow}
                    onPress={() => {
                      setCurrentTab('services');
                      showToast(`"${item.name}" xizmati ma’lumotlari`, 'info');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentItemLeft}>
                      <View
                        style={[
                          styles.recentAvatarCircle,
                          { backgroundColor: item.initialBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.recentAvatarText,
                            { color: item.initialColor },
                          ]}
                        >
                          {item.initial}
                        </Text>
                      </View>

                      <View>
                        <Text style={styles.recentPatientName}>{item.name}</Text>
                        <Text style={styles.recentReasonText}>{item.subtext}</Text>
                      </View>
                    </View>

                    <Text style={[styles.recentStatusRight, { color: '#0D9488' }]}>
                      {item.percentageText}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* 5. FOOTER                                                    */}
        {/* ============================================================ */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            DentaCare • Menejer boshqaruv paneli
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ============================================================
  // HAMSHIRA VA SHIFOKOR BOSH SAHIFASI (O'ZGARISHLARSIZ SAQLANDI)
  // ============================================================
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ============================================================ */}
      {/* 1. YUQORI SARLAVHA VA QABUL QO'SHISH TUGMASI                */}
      {/* ============================================================ */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingTitle}>
            {greeting}, {staffFirstName}!
          </Text>
          <Text style={styles.greetingSub}>
            {isNurse
              ? 'Bugungi qabul va bemorlar holati'
              : 'Bugun klinikadagi ishlaringiz qisqacha'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addAppointmentBtn}
          onPress={onOpenAppointmentModal}
          activeOpacity={0.85}
        >
          <PlusIcon size={16} color="#FFFFFF" />
          <Text style={styles.addAppointmentBtnText}>Qabul qo‘shish</Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================ */}
      {/* 2. TOP 4 TA ASOSIY KO'RSATKICH KARTALARI                    */}
      {/* ============================================================ */}
      <View style={[styles.metricsRow, isMobile && styles.metricsRowMobile]}>
        {/* Karta 1 */}
        <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
          <View style={[styles.metricIconSquare, { backgroundColor: '#10B981' }]}>
            <Text style={styles.metricIconChar}>{isNurse ? 'Q' : 'B'}</Text>
          </View>
          <Text style={styles.metricLabel}>
            {isNurse ? 'BUGUNGI QABULLAR' : 'BUGUNGI BEMORLAR'}
          </Text>
          <Text style={styles.metricValue}>
            {isNurse ? `${totalTodayCount} ta` : `${totalTodayCount} nafar`}
          </Text>
          <Text style={styles.metricSub}>
            {isNurse ? 'Bugungi jadval bo‘yicha' : 'Qabul jadvalidagi bemorlar'}
          </Text>
        </View>

        {/* Karta 2 */}
        <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
          <View style={[styles.metricIconSquare, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.metricIconChar}>{isNurse ? 'K' : 'Q'}</Text>
          </View>
          <Text style={styles.metricLabel}>
            {isNurse ? 'BEMOR KELDI' : 'QABUL QILINGAN'}
          </Text>
          <Text style={styles.metricValue}>{attendedCount} nafar</Text>
          <Text style={styles.metricSub}>
            {isNurse
              ? `${pendingCount} nafar hali kelmadi`
              : `${pendingCount} ta bemor navbatda`}
          </Text>
        </View>

        {/* Karta 3 */}
        <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
          <View style={[styles.metricIconSquare, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.metricIconChar}>T</Text>
          </View>
          <Text style={styles.metricLabel}>
            {isNurse ? 'TASDIQLANGAN' : 'QABULLAR'}
          </Text>
          <Text style={styles.metricValue}>{confirmedCount} ta</Text>
          <Text style={styles.metricSub}>Rejadagi tasdiqlangan qabullar</Text>
        </View>

        {/* Karta 4 */}
        <View style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
          <View style={[styles.metricIconSquare, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.metricIconChar}>{isNurse ? 'N' : 'K'}</Text>
          </View>
          <Text style={styles.metricLabel}>
            {isNurse ? 'KUTISH ZALIDA' : 'NAV спор / KUTILMOQDA'}
          </Text>
          <Text style={styles.metricValue}>{waitingQueueCount} nafar</Text>
          <Text style={styles.metricSub}>
            {isNurse ? 'Qabulga navbat kutmoqda' : 'Kutish zali yoki qabulda'}
          </Text>
        </View>
      </View>

      {/* ============================================================ */}
      {/* 3. O'RTA QATOR: JADVAL VA HAFTALIK OQIM                       */}
      {/* ============================================================ */}
      <View style={[styles.twoColRow, isMobile && styles.twoColRowMobile]}>
        {/* CHAP KARTA: QABUL NAVBATI (Hamshira) / BUGUNGI QABULLAR (Shifokor) */}
        <View style={[styles.panelCard, styles.flex1]}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>
                {isNurse ? 'Qabul navbati' : 'Bugungi qabullar'}
              </Text>
              <Text style={styles.panelSubtitle}>
                {isNurse
                  ? 'Bemorlar, shifokorlar va qabul vaqti'
                  : 'Bemorlar va qabul vaqtlari'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCurrentTab('appointments')}
              activeOpacity={0.7}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>Jadvalni ko‘rish →</Text>
            </TouchableOpacity>
          </View>

          {/* Jadval */}
          <View style={styles.tableWrapper}>
            {/* Table Header */}
            <View style={styles.tableHeadRow}>
              <Text style={[styles.thText, { width: 64 }]}>VAQT</Text>
              <Text style={[styles.thText, { flex: 1.4 }]}>BEMOR</Text>
              <Text style={[styles.thText, { flex: 1.4 }]}>
                {isNurse ? 'SHIFOKOR' : 'MUROJAAT'}
              </Text>
              <Text style={[styles.thText, { width: 104, textAlign: 'center' }]}>HOLAT</Text>
            </View>

            {/* Table Rows */}
            {displayAppointments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Bugun uchun qabullar yo‘q</Text>
                <Text style={styles.emptySubtitle}>Bugungi jadval bo‘yicha qabullar rejalashtirilmagan</Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={onOpenAppointmentModal}
                >
                  <Text style={styles.emptyAddBtnText}>+ Yangi qabul qo‘shish</Text>
                </TouchableOpacity>
              </View>
            ) : (
              displayAppointments.map((apt, idx) => (
                <TouchableOpacity
                  key={apt.id || idx}
                  style={[
                    styles.tableRow,
                    idx === displayAppointments.length - 1 && styles.tableRowLast,
                  ]}
                  onPress={() => onViewAppointment(apt)}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 64 }}>
                    <Text style={styles.cellTime}>{apt.time}</Text>
                  </View>

                  <View style={{ flex: 1.4, paddingRight: 6 }}>
                    <Text style={styles.cellPatientName} numberOfLines={1}>
                      {apt.patientName}
                    </Text>
                    <Text style={styles.cellPatientPhone} numberOfLines={1}>
                      {apt.patientPhone}
                    </Text>
                  </View>

                  <View style={{ flex: 1.4, paddingRight: 6 }}>
                    <Text style={styles.cellServiceName} numberOfLines={1}>
                      {isNurse
                        ? apt.doctorName || 'Shifokor'
                        : apt.serviceName}
                    </Text>
                  </View>

                  <View style={{ width: 104, alignItems: 'center' }}>
                    {renderStatusBadge(apt)}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* O'NG KARTA: HAFTALIK QABUL OQIMI (BAR CHART) */}
        <View style={[styles.panelCard, styles.flex1]}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>
                {isNurse ? 'Haftalik qabul oqimi' : 'Haftalik tashriflar'}
              </Text>
              <Text style={styles.panelSubtitle}>Qabul qilingan bemorlar soni</Text>
            </View>

            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => showToast('Joriy hafta statistikasi', 'info')}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownPillText}>Bu hafta ⌄</Text>
            </TouchableOpacity>
          </View>

          {/* Bar Chart Area */}
          <View style={styles.chartContainer}>
            {/* Y-Axis Labels & Horizontal Grid Lines */}
            <View style={styles.yAxisWrapper}>
              {[20, 15, 10, 5].map((val) => (
                <View key={val} style={styles.gridLineRow}>
                  <Text style={styles.yAxisLabel}>{val}</Text>
                  <View style={styles.gridLine} />
                </View>
              ))}
            </View>

            {/* Bars Row */}
            <View style={styles.barsAreaRow}>
              {weeklyData.map((item, idx) => {
                const isHighlight = activeDayIdx === idx;
                const barHeight = Math.round((item.value / maxWeeklyValue) * 110);

                return (
                  <TouchableOpacity
                    key={item.day}
                    style={styles.barColumn}
                    onPress={() => setActiveDayIdx(idx)}
                    activeOpacity={0.8}
                  >
                    {/* Value above bar */}
                    <Text
                      style={[
                        styles.barTopValue,
                        isHighlight && styles.barTopValueHighlight,
                      ]}
                    >
                      {item.value}
                    </Text>

                    {/* Bar stick */}
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barStick,
                          { height: barHeight },
                          isHighlight
                            ? styles.barStickHighlight
                            : styles.barStickNormal,
                        ]}
                      />
                    </View>

                    {/* Day Label */}
                    <Text
                      style={[
                        styles.dayLabel,
                        isHighlight && styles.dayLabelHighlight,
                      ]}
                    >
                      {item.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* ============================================================ */}
      {/* 4. PASTKI QATOR: TAYYORGARLIK VA KUTISH ZALI / RECENT VISITS  */}
      {/* ============================================================ */}
      <View style={[styles.twoColRow, isMobile && styles.twoColRowMobile]}>
        {/* CHAP KARTA: QABULGA TAYYORGARLIK (Hamshira) / TEKSHIRUVLAR (Shifokor) */}
        <View style={[styles.panelCard, styles.flex1]}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>
                {isNurse ? 'Qabulga tayyorgarlik' : 'Bugungi ko‘riklar holati'}
              </Text>
              <Text style={styles.panelSubtitle}>
                {isNurse
                  ? 'Tasdiqlash va kelish holati'
                  : 'Bugungi qabullar va ko‘riklar holati'}
              </Text>
            </View>
          </View>

          {/* 2 Ta Kichik Quti */}
          <View style={styles.examBoxesRow}>
            {/* Box 1 (Mint) */}
            <View style={styles.examBoxMint}>
              <Text style={styles.examBoxMintLabel}>
                {isNurse ? 'KELGAN BEMORLAR' : 'YAKUNLANGAN'}
              </Text>
              <Text style={styles.examBoxBigNumber}>
                {attendedCount} ta
              </Text>
              <Text style={styles.examBoxSub}>
                {isNurse
                  ? 'Klinikaga kelgan yoki qabulda'
                  : 'Qabul yakunlandi'}
              </Text>
            </View>

            {/* Box 2 (Gray) */}
            <View style={styles.examBoxGray}>
              <Text style={styles.examBoxGrayLabel}>
                {isNurse ? 'KUTILMOQDA' : 'KUTILAYOTGAN'}
              </Text>
              <Text style={styles.examBoxBigNumber}>{pendingCount} ta</Text>
              <Text style={styles.examBoxSub}>
                {isNurse
                  ? 'Kutilayotgan qabullar'
                  : 'Rejadagi qabullar'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    totalTodayCount > 0
                      ? `${Math.min(100, Math.round((attendedCount / totalTodayCount) * 100))}%`
                      : '0%',
                },
              ]}
            />
          </View>
        </View>

        {/* O'NG KARTA: KUTISH ZALIDAGI BEMORLAR (Hamshira) / SO'NGGI TASHRIFLAR (Shifokor) */}
        <View style={[styles.panelCard, styles.flex1]}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>
                {isNurse ? 'Kutish zalidagi bemorlar' : 'So‘nggi tashriflar'}
              </Text>
              <Text style={styles.panelSubtitle}>
                {isNurse
                  ? 'Navbat va shifokor bo‘yicha holat'
                  : 'Bemor kartasini ochish uchun nomini tanlang'}
              </Text>
            </View>
          </View>

          {/* Ro'yxat */}
          <View style={styles.recentListWrap}>
            {(isNurse ? nurseWaitingQueue : doctorRecentVisits).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  {isNurse ? 'Kutish zalida bemorlar yo‘q' : 'Yaqinda tashriflar mavjud emas'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isNurse
                    ? 'Bemor klinikaga kelganda ro‘yxatda paydo bo‘ladi'
                    : 'Yakunlangan qabullar tarixi bu yerda ko‘rinadi'}
                </Text>
              </View>
            ) : (
              (isNurse ? nurseWaitingQueue : doctorRecentVisits).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recentItemRow}
                  onPress={() =>
                    showToast(
                      isNurse
                        ? `"${item.name}" qabul xonasiga chaqirilmoqda`
                        : `"${item.name}" bemor kartasi ochilmoqda`,
                      'info'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.recentItemLeft}>
                    <View
                      style={[
                        styles.recentAvatarCircle,
                        { backgroundColor: item.initialBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.recentAvatarText,
                          { color: item.initialColor },
                        ]}
                      >
                        {item.initial}
                      </Text>
                    </View>

                    <View>
                      <Text style={styles.recentPatientName}>{item.name}</Text>
                      <Text style={styles.recentReasonText}>{item.subtext}</Text>
                    </View>
                  </View>

                  <Text style={[styles.recentStatusRight, { color: item.statusColor }]}>
                    {item.statusText}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </View>

      {/* ============================================================ */}
      {/* 5. FOOTER                                                    */}
      {/* ============================================================ */}
      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>
          {isNurse
            ? 'DentaCare • Hamshira uchun boshqaruv paneli'
            : 'DentaCare • Shifokor uchun boshqaruv paneli'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  content: {
    padding: 24,
    gap: 20,
    width: '100%',
  },

  // 1. Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  headerLeft: {
    gap: 2,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  greetingSub: {
    fontSize: 13,
    color: '#64748B',
  },
  addAppointmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    // @ts-ignore
    cursor: 'pointer',
  },
  addAppointmentBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // 2. Top 4 Metric Cards
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metricsRowMobile: {
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  metricCardMobile: {
    minWidth: '47%',
  },
  metricIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricIconChar: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  metricSub: {
    fontSize: 11,
    color: '#94A3B8',
  },

  // Two Column Layout
  twoColRow: {
    flexDirection: 'row',
    gap: 20,
  },
  twoColRowMobile: {
    flexDirection: 'column',
  },
  flex1: {
    flex: 1,
  },

  // Panel Card Base
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  panelSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  linkRow: {
    paddingVertical: 2,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  dropdownPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  dropdownPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // Qabullar Jadvali
  tableWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cellTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D9488',
  },
  cellPatientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cellPatientPhone: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  cellServiceName: {
    fontSize: 12,
    color: '#334155',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Haftalik Tashriflar Bar Chart
  chartContainer: {
    height: 195,
    position: 'relative',
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  yAxisWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
    justifyContent: 'space-between',
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisLabel: {
    width: 24,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  barsAreaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginLeft: 26,
    height: 170,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 32,
    height: '100%',
    // @ts-ignore
    cursor: 'pointer',
  },
  barTopValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  barTopValueHighlight: {
    color: '#0D9488',
    fontWeight: '800',
  },
  barTrack: {
    height: 115,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  barStick: {
    width: 18,
    borderRadius: 9,
  },
  barStickNormal: {
    backgroundColor: '#E2E8F0',
  },
  barStickHighlight: {
    backgroundColor: '#0D9488',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  dayLabelHighlight: {
    color: '#0D9488',
    fontWeight: '800',
  },

  // Tekshiruvlar / Tayyorgarlik (Pastki Chap)
  examBoxesRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  examBoxMint: {
    flex: 1,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 16,
  },
  examBoxMintLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  examBoxGray: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
  },
  examBoxGrayLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  examBoxBigNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  examBoxSub: {
    fontSize: 11,
    color: '#64748B',
  },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 5,
  },

  // Kutish Zali / So'nggi Tashriflar (Pastki O'ng)
  recentListWrap: {
    gap: 12,
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    // @ts-ignore
    cursor: 'pointer',
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentAvatarText: {
    fontWeight: '800',
    fontSize: 14,
  },
  recentPatientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  recentReasonText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  recentStatusRight: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Bo'sh holat (Empty state)
  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyAddBtn: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#0D9488',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },

  // Footer
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
