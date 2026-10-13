import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Appointment, AppointmentStatus } from '../types';
import {
  CalendarIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../components/common/Icons';
import { Select } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { AppointmentStatusModal } from '../components/modals/AppointmentStatusModal';
import { formatDate, formatCurrency } from '../utils/formatters';
import { sendRealSms, sendTelegramToPatient } from '../services/smsService';

interface AppointmentsScreenProps {
  onOpenNewModal: () => void;
  onEditAppointment: (apt: Appointment) => void;
  onOpenPatientDetail: (patientId: string) => void;
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

const UZ_DAYS_UPPER = [
  'YAKSHANBA',
  'DUSHANBA',
  'SESHANBA',
  'CHORSHANBA',
  'PAYSHANBA',
  'JUMA',
  'SHANBA',
];

// Sanani kunlar miqdoriga siljitish
const shiftDateString = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + days);
  const nextY = dateObj.getFullYear();
  const nextM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const nextD = String(dateObj.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
};

// Kun ustuni sarlavhasi ma'lumotlari (CHORSHANBA, 7-oktabr)
const getDayHeaderInfo = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekdayUpper = UZ_DAYS_UPPER[dateObj.getDay()];
  const dayDate = `${d}-${UZ_MONTHS[m - 1]}`;
  return { weekdayUpper, dayDate };
};

// 3 kunlik sana oralig'i sarlavhasi (masalan, 7–9 oktabr 2026)
const getDateRangeTitle = (startStr: string, endStr: string): string => {
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y3, m3, d3] = endStr.split('-').map(Number);
  if (m1 === m3 && y1 === y3) {
    return `${d1}–${d3} ${UZ_MONTHS[m1 - 1]} ${y1}`;
  }
  if (y1 === y3) {
    return `${d1}-${UZ_MONTHS[m1 - 1]} – ${d3}-${UZ_MONTHS[m3 - 1]} ${y1}`;
  }
  return `${d1}-${UZ_MONTHS[m1 - 1]} ${y1} – ${d3}-${UZ_MONTHS[m3 - 1]} ${y3}`;
};

// Holat ranglari
const getStatusBadgeStyle = (status: AppointmentStatus) => {
  switch (status) {
    case 'Keldi':
      return { bg: '#DCFCE7', text: '#15803D' };
    case 'Jarayonda':
      return { bg: '#DCFCE7', text: '#059669' };
    case 'Qabulda':
      return { bg: '#F3E8FF', text: '#7E22CE' };
    case 'Tasdiqlangan':
      return { bg: '#DBEAFE', text: '#1D4ED8' };
    case 'Kutilmoqda':
      return { bg: '#FEF3C7', text: '#B45309' };
    case 'Yakunlandi':
      return { bg: '#F1F5F9', text: '#475569' };
    case 'Bekor qilindi':
    case 'Bekor qilish':
      return { bg: '#FEE2E2', text: '#DC2626' };
    default:
      return { bg: '#F1F5F9', text: '#475569' };
  }
};

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({
  onOpenNewModal,
  onEditAppointment,
  onOpenPatientDetail,
}) => {
  const {
    appointments,
    doctors,
    patients,
    payments,
    updateAppointment,
    showToast,
    searchQuery,
    setCurrentTab,
    setSearchQuery,
  } = useApp();

  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  // 1. Joriy 3 kunlik ko'rinish boshlanish sanasi (Namunada 2026-10-07)
  const [startDate, setStartDate] = useState<string>('2026-10-07');

  // Filtrlar
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Status almashtirish modali
  const [statusModalApt, setStatusModalApt] = useState<Appointment | null>(null);

  // 2. HAQIQIY SICHQONCHA / SENSORLI DRAG & DROP HOLATI
  const [draggingApt, setDraggingApt] = useState<Appointment | null>(null);
  const [dragOverColumnDate, setDragOverColumnDate] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ustun DOM elementlariga to'g'ridan-to'g'ri ref'lar (BoundingRect uchun)
  const columnRefs = useRef<{ [date: string]: any }>({});

  // Drag tracking ref
  const dragTrackerRef = useRef<{
    isDown: boolean;
    isDragging: boolean;
    startX: number;
    startY: number;
    apt: Appointment | null;
  }>({
    isDown: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    apt: null,
  });

  // Sudrash tugagandan keyin tasodifiy bosish (click) hodisasini bloklash
  const justDraggedRef = useRef<boolean>(false);

  // Ikki marta bosish (Double Click) vaqt hisoblagichi
  const lastClickTimeRef = useRef<{ [id: string]: number }>({});

  // Mobil qurilmalar uchun tezkor ko'chirish modal oynasi
  const [mobileMoveTargetApt, setMobileMoveTargetApt] = useState<Appointment | null>(null);

  // Yuborilgan SMS'lar qaydnomasi (takroriy yuborilishni cheklash uchun)
  const sentSmsLogsRef = useRef<Set<string>>(new Set());

  // 3 kunlik sanalar ro'yxati
  const currentThreeDays = useMemo(() => {
    return [
      startDate,
      shiftDateString(startDate, 1),
      shiftDateString(startDate, 2),
    ];
  }, [startDate]);

  // Sarlavhadagi sana matni
  const dateRangeTitle = useMemo(() => {
    return getDateRangeTitle(currentThreeDays[0], currentThreeDays[2]);
  }, [currentThreeDays]);

  // Filtrlangan qabullar
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (selectedDoctorId && apt.doctorId !== selectedDoctorId) return false;
      if (selectedStatus && apt.status !== selectedStatus) return false;

      // Global qidiruv
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = apt.patientName.toLowerCase().includes(q);
        const matchPhone = apt.patientPhone.includes(q);
        const matchDoc = apt.doctorName.toLowerCase().includes(q);
        const matchSrv = apt.serviceName.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchDoc && !matchSrv) return false;
      }

      return true;
    });
  }, [appointments, selectedDoctorId, selectedStatus, searchQuery]);

  // Jami filtrdan o'tgan qabullar soni
  const totalFilteredCount = filteredAppointments.length;

  // ============================================================
  // KURSOR OSTIDAGI KUN USTUNINI 100% ANIQ ANIQLASH (BoundingRect)
  // ============================================================
  const findColumnAtCoordinates = useCallback(
    (clientX: number, clientY: number): string | null => {
      for (const dayDate of currentThreeDays) {
        const el = columnRefs.current[dayDate];
        if (el && typeof el.getBoundingClientRect === 'function') {
          const rect = el.getBoundingClientRect();
          if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          ) {
            return dayDate;
          }
        }
      }

      // Fallback: document.elementFromPoint
      if (typeof document !== 'undefined') {
        try {
          const elem = document.elementFromPoint(clientX, clientY);
          const col = elem?.closest('[data-day-col]') || elem?.closest('[id^="day-column-"]');
          if (col) {
            const d = col.getAttribute('data-day-col') || col.id.replace('day-column-', '');
            if (d) return d;
          }
        } catch {}
      }

      return null;
    },
    [currentThreeDays]
  );

  // ============================================================
  // QABULNI BOSHQA KUNGA KO'CHIRISH VA AVTOMATIK SMS YUBORISH
  // ============================================================
  const handleMoveAppointment = useCallback(
    (aptId: string, targetDate: string) => {
      const targetApt = appointments.find((a) => a.id === aptId);
      if (!targetApt) return;

      const oldDate = targetApt.date;
      if (oldDate === targetDate) {
        // O'sha kunning o'ziga qo'yildi - hech narsa o'zgarmaydi
        return;
      }

      // 1. Qabulni yangi kunga ko'chirish
      const res = updateAppointment(aptId, { date: targetDate });
      if (res && res.success === false) {
        showToast(
          res.error || 'Qabulni ko‘chirishda xatolik yuz berdi. Joyiga qaytarildi.',
          'error',
          'Xatolik'
        );
        return;
      }

      // 2. Sana formatlash va Telegram eslatma matnini shakllantirish
      const formattedOldDate = formatDate(oldDate);
      const formattedNewDate = formatDate(targetDate);
      const telegramMessage = `Assalomu alaykum, ${targetApt.patientName}! DentaCare klinikasidagi qabulingiz ${formattedOldDate}dan ${formattedNewDate}ga, soat ${targetApt.time}ga ko‘chirildi.`;

      // 3. Telegram orqali yuborish tekshiruvi
      const logKey = `${aptId}_${targetDate}`;
      if (sentSmsLogsRef.current.has(logKey)) {
        showToast(
          `Qabul ${formattedNewDate}ga ko‘chirildi.`,
          'success',
          'Qabul ko‘chirildi'
        );
        return;
      }

      sentSmsLogsRef.current.add(logKey);

      // Bemorning Telegram bog'langanligini tekshirish
      const matchedPatient = patients.find(
        (p) =>
          p.id === targetApt.patientId ||
          (p.fullName && targetApt.patientName && p.fullName.trim().toLowerCase() === targetApt.patientName.trim().toLowerCase())
      );

      if (matchedPatient?.telegramChatId) {
        sendTelegramToPatient(matchedPatient.telegramChatId, telegramMessage)
          .then((res) => {
            if (res.success) {
              showToast(
                `Qabul yangi kunga ko‘chirildi va Telegram bot orqali bemorga eslatma yuborildi.`,
                'success',
                'Telegram xabarnomasi yuborildi'
              );
            } else {
              showToast(
                `Qabul ko‘chirildi, ammo Telegram orqali yetkazilmadi: ${res.message}`,
                'info',
                'Telegram ulanmagan'
              );
            }
          })
          .catch(() => {
            showToast(
              `Qabul ko‘chirildi, biroq Telegram orqali yuborishda xatolik yuz berdi.`,
              'info',
              'Telegram xatosi'
            );
          });
      } else {
        // Telegram ulanmagan bemorga yuborilgan deb ko'rsatilmaydi; aniq bildiriladi
        showToast(
          `Qabul ${formattedNewDate}ga ko‘chirildi, ammo Telegram ulanmagan. Iltimos, bemor botda Start tugmasini bossin.`,
          'info',
          'Telegram ulanmagan'
        );
      }
    },
    [appointments, patients, updateAppointment, showToast]
  );

  // ============================================================
  // GLOBAL SICHQONCHA VA SENSORLI HARAKAT EVENTLARI (DRAG & DROP)
  // ============================================================
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Sichqoncha harakati
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragTrackerRef.current.isDown || !dragTrackerRef.current.apt) return;

      const dx = Math.abs(e.clientX - dragTrackerRef.current.startX);
      const dy = Math.abs(e.clientY - dragTrackerRef.current.startY);

      // 4px dan ortiq harakat bo'lgandagina sudrash faollashadi
      if (!dragTrackerRef.current.isDragging && (dx > 4 || dy > 4)) {
        dragTrackerRef.current.isDragging = true;
        setDraggingApt(dragTrackerRef.current.apt);
      }

      if (dragTrackerRef.current.isDragging) {
        setCursorPos({ x: e.clientX, y: e.clientY });

        const targetCol = findColumnAtCoordinates(e.clientX, e.clientY);
        setDragOverColumnDate(targetCol);
      }
    };

    // Sichqoncha tugmasini qo'yib yuborish (Drop)
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (!dragTrackerRef.current.isDown) return;

      const { isDragging, apt } = dragTrackerRef.current;
      dragTrackerRef.current.isDown = false;

      if (isDragging && apt) {
        // Sudrash tugagani belgilandi (tahrirlash oynasi ochilib ketmasligi uchun)
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 350);

        const targetDate = findColumnAtCoordinates(e.clientX, e.clientY);

        if (targetDate && targetDate !== apt.date) {
          handleMoveAppointment(apt.id, targetDate);
        } else if (targetDate === apt.date) {
          // O'sha kunning o'ziga qo'yildi
        } else {
          showToast(
            'Qabul ko‘chirilmadi (karta ustundan tashqariga tashlandi).',
            'info'
          );
        }
      }

      dragTrackerRef.current.isDragging = false;
      dragTrackerRef.current.apt = null;
      setDraggingApt(null);
      setDragOverColumnDate(null);
    };

    // Sensorli ekran harakati (Touch Move)
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!dragTrackerRef.current.isDown || !dragTrackerRef.current.apt) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = Math.abs(touch.clientX - dragTrackerRef.current.startX);
      const dy = Math.abs(touch.clientY - dragTrackerRef.current.startY);

      if (!dragTrackerRef.current.isDragging && (dx > 8 || dy > 8)) {
        dragTrackerRef.current.isDragging = true;
        setDraggingApt(dragTrackerRef.current.apt);
      }

      if (dragTrackerRef.current.isDragging) {
        if (e.cancelable) e.preventDefault();
        setCursorPos({ x: touch.clientX, y: touch.clientY });

        const targetCol = findColumnAtCoordinates(touch.clientX, touch.clientY);
        setDragOverColumnDate(targetCol);
      }
    };

    // Sensorli ekran barmoqni ko'tarish (Touch End)
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (!dragTrackerRef.current.isDown) return;

      const { isDragging, apt } = dragTrackerRef.current;
      dragTrackerRef.current.isDown = false;

      if (isDragging && apt) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 350);

        const touch = e.changedTouches[0];
        if (touch) {
          const targetDate = findColumnAtCoordinates(touch.clientX, touch.clientY);
          if (targetDate && targetDate !== apt.date) {
            handleMoveAppointment(apt.id, targetDate);
          }
        }
      }

      dragTrackerRef.current.isDragging = false;
      dragTrackerRef.current.apt = null;
      setDraggingApt(null);
      setDragOverColumnDate(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [findColumnAtCoordinates, handleMoveAppointment, showToast]);

  // ============================================================
  // KARTANI BOSGANDA BOSHLASH (MouseDown)
  // ============================================================
  const handleCardPointerDown = (apt: Appointment, e: any) => {
    // Faqat sichqonchaning chap tugmasi bo'lsa
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;

    dragTrackerRef.current = {
      isDown: true,
      isDragging: false,
      startX: clientX,
      startY: clientY,
      apt,
    };

    setCursorPos({ x: clientX, y: clientY });
  };

  // Tahrirlangan qabulni kuzatish (agar sanasi o'zgarsa, ushbu sanani jadvalda ko'rsatish uchun)
  const lastEditedAptRef = useRef<{ id: string; prevDate: string } | null>(null);

  // Tahrirlash oynasida sana o'zgartirilib saqlansa, jadvalni yangi sana ko'rinadigan qilib siljitish
  useEffect(() => {
    if (lastEditedAptRef.current) {
      const updatedApt = appointments.find((a) => a.id === lastEditedAptRef.current?.id);
      if (updatedApt && updatedApt.date !== lastEditedAptRef.current.prevDate) {
        const targetDate = updatedApt.date;
        if (!currentThreeDays.includes(targetDate)) {
          if (targetDate <= '2026-10-06') {
            setStartDate('2026-10-04');
          } else if (targetDate <= '2026-10-09') {
            setStartDate('2026-10-07');
          } else if (targetDate <= '2026-10-12') {
            setStartDate('2026-10-10');
          } else {
            setStartDate(targetDate);
          }
        }
      }
      lastEditedAptRef.current = null;
    }
  }, [appointments, currentThreeDays]);

  // ============================================================
  // QABUL KARTASINI BOSGANDA TAHRIRLASH OYNASINI OCHISH
  // ============================================================
  const handleCardClick = (apt: Appointment) => {
    // Agar sudrab tashlangan bo'lsa, tahrirlash ochilmaydi
    if (justDraggedRef.current || dragTrackerRef.current.isDragging) return;

    lastEditedAptRef.current = { id: apt.id, prevDate: apt.date };
    onEditAppointment(apt);
  };

  // Navigatsiya tugmasi matnlari
  const isFirstPage = startDate === '2026-10-07';
  const leftSubText = isFirstPage ? 'Oldingi 3 kun' : 'Keyingi 3 kun';
  const rightLabelText = isFirstPage ? 'Keyingi 3 kun' : 'Oldingi 3 kun';

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >


        {/* ============================================================ */}
        {/* YAGONA IXCHAM BOSHQARUV QATORI (Mockupga 100% mos)           */}
        {/* ============================================================ */}
        <View style={styles.unifiedTopBar}>
          {/* Chap guruh: Qabullar, 3 kunlik ko'rinish, Shifokor, Holat, Jami, (<), 7–9 oktabr */}
          <View style={styles.unifiedLeftGroup}>
            {/* 1. Qabullar pill */}
            <TouchableOpacity
              style={styles.qabullarPill}
              onPress={() => {
                setSelectedDoctorId('');
                setSelectedStatus('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.qabullarPillText}>Qabullar</Text>
            </TouchableOpacity>

            {/* 2. 3 kunlik ko'rinish pill */}
            <View style={styles.viewModePill}>
              <Text style={styles.viewModePillText}>3 kunlik ko‘rinish</Text>
            </View>

            {/* 3. Shifokor filtri */}
            <View style={styles.compactFilterItem}>
              <Select
                size="sm"
                value={selectedDoctorId}
                onValueChange={setSelectedDoctorId}
                options={[
                  { label: 'Shifokor: Barchasi', value: '' },
                  ...doctors.map((d) => ({
                    label: d.fullName,
                    value: d.id,
                  })),
                ]}
                containerStyle={{ marginBottom: 0, minWidth: 160 }}
              />
            </View>

            {/* 4. Holat filtri */}
            <View style={styles.compactFilterItem}>
              <Select
                size="sm"
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                options={[
                  { label: 'Holat: Barchasi', value: '' },
                  { label: 'Holat: Kutilmoqda', value: 'Kutilmoqda' },
                  { label: 'Holat: Tasdiqlangan', value: 'Tasdiqlangan' },
                  { label: 'Holat: Keldi', value: 'Keldi' },
                  { label: 'Holat: Qabulda', value: 'Qabulda' },
                  { label: 'Holat: Yakunlandi', value: 'Yakunlandi' },
                  { label: 'Holat: Bekor qilindi', value: 'Bekor qilindi' },
                ]}
                containerStyle={{ marginBottom: 0, minWidth: 155 }}
              />
            </View>

            {/* 5. Jami qabullar soni */}
            <Text style={styles.totalCountText}>Jami: {totalFilteredCount} ta</Text>

            {/* 6. Oldingi 3 kun tugmasi (<) */}
            <TouchableOpacity
              style={styles.navArrowBtnPrev}
              onPress={() => setStartDate((prev) => shiftDateString(prev, -3))}
              activeOpacity={0.7}
              // @ts-ignore
              title="Oldingi 3 kunga o‘tish"
            >
              <ChevronLeftIcon size={14} color="#0F172A" />
            </TouchableOpacity>

            {/* 7. Sana oralig'i sarlavhasi (7–9 oktabr 2026) */}
            <Text style={styles.dateRangeText}>{dateRangeTitle}</Text>
          </View>

          {/* O'ng guruh: + Yangi qabul, Keyingi 3 kun, (>) */}
          <View style={styles.unifiedRightGroup}>
            {/* + Yangi qabul tugmasi */}
            <TouchableOpacity
              style={styles.newAptCompactBtn}
              onPress={onOpenNewModal}
              activeOpacity={0.85}
            >
              <Text style={styles.newAptCompactBtnText}>+ Yangi qabul</Text>
            </TouchableOpacity>

            {/* Keyingi 3 kun matni */}
            <TouchableOpacity
              onPress={() => setStartDate((prev) => shiftDateString(prev, 3))}
              activeOpacity={0.7}
            >
              <Text style={styles.nextThreeDaysText}>Keyingi 3 kun</Text>
            </TouchableOpacity>

            {/* Keyingi 3 kun o'q tugmasi (>) */}
            <TouchableOpacity
              style={styles.navArrowBtnNext}
              onPress={() => setStartDate((prev) => shiftDateString(prev, 3))}
              activeOpacity={0.85}
              // @ts-ignore
              title="Keyingi 3 kunga o‘tish"
            >
              <ChevronRightIcon size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* 4. ASOSIY 3 KUNLIK USTUNLAR VA QABULLAR KARTALARI            */}
        {/* ============================================================ */}
        <View
          style={[
            styles.columnsContainer,
            isMobile && styles.columnsContainerMobile,
          ]}
        >
          {currentThreeDays.map((dayDate) => {
            const dayInfo = getDayHeaderInfo(dayDate);
            const dayApts = filteredAppointments
              .filter((a) => a.date === dayDate)
              .sort((a, b) => a.time.localeCompare(b.time));

            const isHovered = dragOverColumnDate === dayDate;

            return (
              <View
                key={dayDate}
                ref={(el: any) => {
                  if (el) {
                    columnRefs.current[dayDate] = el;
                    if (typeof el.setAttribute === 'function') {
                      el.setAttribute('data-day-col', dayDate);
                    }
                  }
                }}
                // @ts-ignore
                dataSet={{ dayCol: dayDate }}
                nativeID={`day-column-${dayDate}`}
                style={[
                  styles.dayColumn,
                  isHovered && styles.dayColumnHovered,
                ]}
              >
                {/* Ustun Sarlavhasi (CHORSHANBA, 7-oktabr, 4 ta qabul) */}
                <View style={styles.colHeaderRow}>
                  <View>
                    <Text style={styles.colDayName}>{dayInfo.weekdayUpper}</Text>
                    <Text style={styles.colDayDate}>{dayInfo.dayDate}</Text>
                  </View>
                  <Text style={styles.colCountBadge}>
                    {dayApts.length} ta qabul
                  </Text>
                </View>

                {/* Sudrab kelganda tushirish indikatori */}
                {isHovered && (
                  <View style={styles.dropIndicatorBox}>
                    <Text style={styles.dropIndicatorText}>
                      ⬇ {dayInfo.weekdayUpper} ({dayInfo.dayDate})ga ko‘chirish uchun qo‘yib yuboring
                    </Text>
                  </View>
                )}

                {/* Qabullar ro'yxati yoki bo'sh holat */}
                <View style={styles.colCardsList}>
                  {dayApts.length === 0 ? (
                    <View style={styles.emptyColBox}>
                      <Text style={styles.emptyColText}>
                        Hozircha ko‘rsatiladigan qabul yo‘q
                      </Text>
                      <Text style={styles.emptyColSub}>
                        Qabul qo‘shilsa, shu yerda ko‘rinadi
                      </Text>
                    </View>
                  ) : (
                    dayApts.map((apt) => {
                      const isBeingDragged = draggingApt?.id === apt.id;
                      const badgeStyle = getStatusBadgeStyle(apt.status);

                      return (
                        <View
                          key={apt.id}
                          style={[
                            styles.aptCard,
                            isBeingDragged && styles.aptCardGhost,
                          ]}
                          // @ts-ignore
                          onMouseDown={(e: any) => handleCardPointerDown(apt, e)}
                          onTouchStart={(e: any) => handleCardPointerDown(apt, e)}
                          // @ts-ignore
                          onClick={() => handleCardClick(apt)}
                          // @ts-ignore
                          onDoubleClick={() => {
                            if (!justDraggedRef.current && !dragTrackerRef.current.isDragging) {
                              onEditAppointment(apt);
                            }
                          }}
                        >
                          {/* Yuqori qator: Vaqt va Holat pilli */}
                          <View style={styles.cardTopRow}>
                            <Text style={styles.cardTimeText}>{apt.time}</Text>
                            <View
                              style={[
                                styles.cardStatusPill,
                                { backgroundColor: badgeStyle.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.cardStatusText,
                                  { color: badgeStyle.text },
                                ]}
                              >
                                {apt.status}
                              </Text>
                            </View>
                          </View>

                          {/* Bemor ismi */}
                          <TouchableOpacity
                            onPress={(e: any) => {
                              // @ts-ignore
                              if (e && e.stopPropagation) e.stopPropagation();
                              if (apt.patientId && onOpenPatientDetail) {
                                onOpenPatientDetail(apt.patientId);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.cardPatientName} numberOfLines={1}>
                              {apt.patientName}
                            </Text>
                          </TouchableOpacity>

                          {/* Shifokor ismi */}
                          <Text style={styles.cardDoctorName} numberOfLines={1}>
                            {apt.doctorName}
                          </Text>

                          {/* Xizmat nomi */}
                          <Text style={styles.cardServiceName} numberOfLines={1}>
                            {apt.serviceName}
                          </Text>

                          {/* Qabul holati "Yakunlandi" bo'lsa yangi To'lov ma'lumotlari ko'rinishi */}
                          {apt.status === 'Yakunlandi' ? (
                            (() => {
                              const linkedPay =
                                payments.find((p) => p && p.appointmentId === apt.id) ||
                                payments.find(
                                  (p) =>
                                    p &&
                                    p.patientId === apt.patientId &&
                                    (p.date === apt.date || p.serviceName === apt.serviceName)
                                ) ||
                                payments.find((p) => p && p.patientId === apt.patientId);

                              // To'lov holati
                              const hasLinkedPay = !!linkedPay;
                              const isPaid =
                                (linkedPay &&
                                  (linkedPay.status === 'To‘langan' ||
                                    linkedPay.status === 'To‘landi' ||
                                    (linkedPay.debtAmount === 0 && linkedPay.paidAmount > 0))) ||
                                (!linkedPay &&
                                  apt.servicePrice > 0 &&
                                  (apt.paidAmount || 0) >= apt.servicePrice);

                              const hasDebt =
                                (linkedPay &&
                                  (linkedPay.debtAmount > 0 || linkedPay.status === 'To‘lash kerak')) ||
                                (!linkedPay &&
                                  apt.servicePrice > 0 &&
                                  (apt.paidAmount || 0) < apt.servicePrice);

                              let tagText = 'To‘lov: To‘lash kerak';
                              let isTagPaid = false;
                              if (isPaid) {
                                tagText = 'To‘lov: To‘landi ✓';
                                isTagPaid = true;
                              } else if (!hasLinkedPay && !apt.servicePrice) {
                                tagText = 'To‘lov: Ma’lumot yo‘q';
                              }

                              // Ko'rsatiladigan summa va sarlavha
                              let amountLabel = 'To‘lanmagan summa';
                              let amountValue = 0;
                              let hasAmountData = true;

                              if (hasLinkedPay) {
                                if (hasDebt) {
                                  amountLabel = 'To‘lanmagan summa';
                                  amountValue =
                                    linkedPay.debtAmount > 0
                                      ? linkedPay.debtAmount
                                      : linkedPay.totalAmount || apt.servicePrice || 0;
                                } else {
                                  amountLabel = 'To‘langan summa';
                                  amountValue =
                                    linkedPay.paidAmount > 0
                                      ? linkedPay.paidAmount
                                      : linkedPay.totalAmount || apt.servicePrice || 0;
                                }
                              } else if (apt.servicePrice && apt.servicePrice > 0) {
                                if (hasDebt) {
                                  amountLabel = 'To‘lanmagan summa';
                                  amountValue = Math.max(0, apt.servicePrice - (apt.paidAmount || 0));
                                } else {
                                  amountLabel = 'To‘langan summa';
                                  amountValue = apt.paidAmount || apt.servicePrice;
                                }
                              } else {
                                amountLabel = 'To‘lov holati';
                                hasAmountData = false;
                              }

                              // To'lov turi
                              const methodText =
                                linkedPay?.paymentMethod ||
                                (hasDebt ? 'hali tanlanmagan' : 'mavjud emas');

                              return (
                                <div
                                  style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                  }}
                                  onClick={(e: any) => e.stopPropagation()}
                                  onMouseDown={(e: any) => e.stopPropagation()}
                                >
                                  {/* Kichik status pilli */}
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      backgroundColor: isTagPaid ? '#DCFCE7' : '#FEF3C7',
                                      border: `1px solid ${isTagPaid ? '#BBF7D0' : '#FDE68A'}`,
                                      color: isTagPaid ? '#15803D' : '#B45309',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      marginBottom: '12px',
                                    }}
                                  >
                                    {tagText}
                                  </div>

                                  {/* Ajratuvchi chiziq */}
                                  <div
                                    style={{
                                      height: '1px',
                                      backgroundColor: '#F1F5F9',
                                      marginBottom: '12px',
                                      width: '100%',
                                    }}
                                  />

                                  {/* TO'LOV MA'LUMOTLARI bloki */}
                                  <div style={{ marginBottom: '12px' }}>
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#64748B',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        marginBottom: '4px',
                                      }}
                                    >
                                      TO‘LOV MA’LUMOTLARI
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: '#64748B',
                                        marginBottom: '2px',
                                      }}
                                    >
                                      {amountLabel}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '22px',
                                        fontWeight: 800,
                                        color: '#0F172A',
                                        letterSpacing: '-0.3px',
                                        marginBottom: '2px',
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {hasAmountData
                                        ? formatCurrency(amountValue)
                                        : 'Ma’lumot mavjud emas'}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: '#64748B',
                                      }}
                                    >
                                      To‘lov turi: {methodText}
                                    </div>
                                  </div>

                                  {/* To'lovlarga o'tish tugmasi */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const query =
                                        linkedPay?.receiptNumber ||
                                        apt.patientName ||
                                        '';
                                      if (query) {
                                        setSearchQuery(query);
                                      }
                                      setCurrentTab('payments');
                                      showToast(
                                        `${apt.patientName} to‘lov ma’lumotlariga o‘tildi`
                                      );
                                    }}
                                    style={{
                                      width: '100%',
                                      height: '38px',
                                      backgroundColor: '#0D9488',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.15s ease',
                                      marginBottom: '8px',
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor = '#0F766E')
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor = '#0D9488')
                                    }
                                    title="Mavjud To‘lovlar sahifasiga o‘tish va bemor to‘lovini ko‘rish"
                                  >
                                    To‘lovlarga o‘tish →
                                  </button>

                                  {/* 2 ta Tugma: Tahrirlash va Status almashtirish */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      width: '100%',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditAppointment(apt);
                                      }}
                                      style={{
                                        flex: 1,
                                        height: '34px',
                                        backgroundColor: '#FFFFFF',
                                        color: '#334155',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s ease',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.backgroundColor = '#F8FAFC')
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.backgroundColor = '#FFFFFF')
                                      }
                                      title="Qabul ma’lumotlarini tahrirlash"
                                    >
                                      Tahrirlash
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusModalApt(apt);
                                      }}
                                      style={{
                                        flex: 1,
                                        height: '34px',
                                        backgroundColor: '#FFFFFF',
                                        color: '#334155',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s ease',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.backgroundColor = '#F8FAFC')
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.backgroundColor = '#FFFFFF')
                                      }
                                      title="Alohida status oynasini ochish"
                                    >
                                      Status almashtirish
                                    </button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            /* Boshqa barcha statuslar uchun avvalgi 3 ta tugma */
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '12px',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                              onClick={(e: any) => e.stopPropagation()}
                              onMouseDown={(e: any) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateAppointment(apt.id, { status: 'Yakunlandi' });
                                  showToast('Qabul statusi "Yakunlandi"ga o‘zgartirildi!');
                                }}
                                style={{
                                  flex: 1,
                                  height: '32px',
                                  padding: '0 6px',
                                  borderRadius: '8px',
                                  backgroundColor: '#E6F4EA',
                                  color: '#065F46',
                                  border: '1px solid #A7F3D0',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#D1FAE5')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#E6F4EA')
                                }
                                title="Qabul statusini Yakunlandiga o‘zgartirish"
                              >
                                Yakunlandi
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditAppointment(apt);
                                }}
                                style={{
                                  flex: 1,
                                  height: '32px',
                                  padding: '0 6px',
                                  borderRadius: '8px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#334155',
                                  border: '1px solid #E2E8F0',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#E2E8F0')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#F1F5F9')
                                }
                                title="Qabul ma’lumotlarini tahrirlash"
                              >
                                Tahrirlash
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatusModalApt(apt);
                                }}
                                style={{
                                  flex: 1.3,
                                  height: '32px',
                                  padding: '0 6px',
                                  borderRadius: '8px',
                                  backgroundColor: '#FFFFFF',
                                  color: '#334155',
                                  border: '1px solid #CBD5E1',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#F8FAFC')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#FFFFFF')
                                }
                                title="Alohida status oynasini ochish"
                              >
                                Status almashtirish
                              </button>
                            </div>
                          )}

                          {/* Mobil ekranlar uchun tezkor ko'chirish tugmachasi */}
                          {isMobile && (
                            <TouchableOpacity
                              style={styles.mobileMoveBtn}
                              onPress={(e) => {
                                // @ts-ignore
                                e.stopPropagation?.();
                                setMobileMoveTargetApt(apt);
                              }}
                            >
                              <Text style={styles.mobileMoveBtnText}>
                                Kunni ko‘chirish ➔
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}
        </View>


      </ScrollView>

      {/* ============================================================ */}
      {/* 6. SUDRALAYOTGAN KARTA KO'RINISHI (KURSOR BILAN ANIQLIKDA)   */}
      {/* ============================================================ */}
      {draggingApt && (
        <View
          style={[
            styles.floatingGhostCard,
            {
              position: 'fixed' as any,
              top: cursorPos.y - 25,
              left: cursorPos.x - 35,
            },
          ]}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTimeText}>{draggingApt.time}</Text>
            <View style={styles.floatingTargetBadge}>
              <Text style={styles.floatingTargetText}>
                {dragOverColumnDate
                  ? `➔ ${getDayHeaderInfo(dragOverColumnDate).weekdayUpper} (${getDayHeaderInfo(dragOverColumnDate).dayDate})`
                  : 'Boshqa kunga sudrang'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardPatientName}>{draggingApt.patientName}</Text>
          <Text style={styles.cardDoctorName}>
            {draggingApt.doctorName} • {draggingApt.serviceName}
          </Text>
        </View>
      )}

      {/* ============================================================ */}
      {/* 7. TELEFON VA TEZKOR BOSISH UCHUN KO'CHIRISH MODALI          */}
      {/* ============================================================ */}
      <Modal
        visible={!!mobileMoveTargetApt}
        onClose={() => setMobileMoveTargetApt(null)}
        title="Qabul kunini ko‘chirish"
      >
        {mobileMoveTargetApt && (
          <View style={styles.moveModalContent}>
            <Text style={styles.moveModalPatient}>
              Bemor:{' '}
              <Text style={{ fontWeight: '800', color: '#0F172A' }}>
                {mobileMoveTargetApt.patientName}
              </Text>
            </Text>
            <Text style={styles.moveModalTime}>
              Qabul vaqti: {mobileMoveTargetApt.time} ({formatDate(mobileMoveTargetApt.date)})
            </Text>
            <Text style={styles.moveModalPrompt}>
              Qaysi kunga ko‘chirmoqchisiz?
            </Text>

            <View style={styles.moveModalButtons}>
              {currentThreeDays.map((targetDay) => {
                const info = getDayHeaderInfo(targetDay);
                const isCurrent = mobileMoveTargetApt.date === targetDay;

                return (
                  <TouchableOpacity
                    key={targetDay}
                    style={[
                      styles.moveOptionBtn,
                      isCurrent && styles.moveOptionBtnCurrent,
                    ]}
                    onPress={() => {
                      handleMoveAppointment(mobileMoveTargetApt.id, targetDay);
                      setMobileMoveTargetApt(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.moveOptionBtnText,
                        isCurrent && styles.moveOptionBtnTextCurrent,
                      ]}
                    >
                      {info.weekdayUpper} • {info.dayDate}
                    </Text>
                    {isCurrent && (
                      <Text style={styles.currentTag}>(Joriy kun)</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </Modal>

      {/* 8. STATUSNI ALMASHTIRISH MODALI (3 TA STATUS: Yakunlandi, Jarayonda, Bekor qilish) */}
      <AppointmentStatusModal
        visible={!!statusModalApt}
        onClose={() => setStatusModalApt(null)}
        appointment={statusModalApt}
        onUpdateStatus={(aptId, newStatus) => {
          updateAppointment(aptId, { status: newStatus });
          showToast(`Qabul statusi "${newStatus}"ga o‘zgartirildi!`);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
    width: '100%',
  },

  // Yagona ixcham boshqaruv qatori
  unifiedTopBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    zIndex: 30,
  },
  unifiedLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 35,
  },
  qabullarPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qabullarPillText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 13,
  },
  viewModePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModePillText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  compactFilterItem: {
    height: 34,
    justifyContent: 'center',
  },
  totalCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 4,
    marginRight: 6,
  },
  navArrowBtnPrev: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  dateRangeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 6,
    marginRight: 10,
  },
  unifiedRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  newAptCompactBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  newAptCompactBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  nextThreeDaysText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    // @ts-ignore
    cursor: 'pointer',
  },
  navArrowBtnNext: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },

  // 4. Asosiy 3 kunlik ustunlar
  columnsContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  columnsContainerMobile: {
    flexDirection: 'column',
  },
  dayColumn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    minHeight: 480,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    width: '100%',
  },
  dayColumnHovered: {
    borderColor: '#0D9488',
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: '#F0FDFA',
  },
  colHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  colDayName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  colDayDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  colCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropIndicatorBox: {
    padding: 10,
    backgroundColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0D9488',
    alignItems: 'center',
    marginBottom: 12,
  },
  dropIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
    textAlign: 'center',
  },

  // Kartochkalar ro'yxati
  colCardsList: {
    gap: 12,
  },
  emptyColBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyColText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  emptyColSub: {
    fontSize: 11,
    color: '#CBD5E1',
    textAlign: 'center',
  },

  // Bitta qabul kartochkasi
  aptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    // @ts-ignore
    cursor: 'grab',
    // @ts-ignore
    userSelect: 'none',
  },
  aptCardGhost: {
    opacity: 0.28,
    borderStyle: 'dashed',
    borderColor: '#0D9488',
    backgroundColor: '#F8FAFC',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTimeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardPatientName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardDoctorName: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardServiceName: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '400',
    marginTop: 2,
  },
  cardPaymentTagRow: {
    marginTop: 4,
    flexDirection: 'row',
  },
  cardPaymentPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardPaymentPillPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  cardPaymentPillPaid: {
    backgroundColor: '#DCFCE7',
    borderColor: '#A7F3D0',
  },
  cardPaymentText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardPaymentTextPending: {
    color: '#B45309',
  },
  cardPaymentTextPaid: {
    color: '#065F46',
  },
  mobileMoveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  mobileMoveBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
  },

  // Floating Ghost Card (Kursor ostida qat'iy ergashadi)
  floatingGhostCard: {
    zIndex: 999999,
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0D9488',
    padding: 14,
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    // @ts-ignore
    pointerEvents: 'none',
    // @ts-ignore
    userSelect: 'none',
  },
  floatingTargetBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  floatingTargetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },

  // 5. Pastki legend
  legendRow: {
    paddingVertical: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // 6. Modal oynasi
  moveModalContent: {
    gap: 12,
    paddingVertical: 8,
  },
  moveModalPatient: {
    fontSize: 14,
    color: '#475569',
  },
  moveModalTime: {
    fontSize: 12,
    color: '#64748B',
  },
  moveModalPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
  },
  moveModalButtons: {
    gap: 8,
    marginTop: 4,
  },
  moveOptionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    // @ts-ignore
    cursor: 'pointer',
  },
  moveOptionBtnCurrent: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  moveOptionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  moveOptionBtnTextCurrent: {
    color: '#64748B',
  },
  currentTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
