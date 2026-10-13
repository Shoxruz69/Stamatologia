import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Appointment, AppointmentStatus, Patient } from '../../types';
import { formatUzbekPhoneNumber, getTodayDateString } from '../../utils/formatters';
import { Select } from '../common/Input';
import { UserIcon, PlusIcon, CheckIcon, SparklesIcon } from '../common/Icons';

interface AppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  appointmentToEdit?: Appointment | null;
}

const TIME_SLOTS = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
];

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  visible,
  onClose,
  appointmentToEdit,
}) => {
  const {
    doctors,
    services,
    patients,
    addAppointment,
    updateAppointment,
    addPatient,
    showToast,
  } = useApp();

  const isEditMode = !!appointmentToEdit;

  // Bemor tanlash rejimi (faqat yangi qabul yozishda): 'existing' | 'new'
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');

  // Mavjud bemor tanlovi holatlari
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Yangi bemor qo'shish holatlari
  const [newPatientFullName, setNewPatientFullName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'Erkak' | 'Ayol'>('Erkak');

  // Umumiy qabul maydonlari
  const [phone, setPhone] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('2026-10-07');
  const [time, setTime] = useState('17:30');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (appointmentToEdit) {
      setSelectedPatientId(appointmentToEdit.patientId || '');
      setSelectedPatientName(appointmentToEdit.patientName || '');
      setPatientSearchTerm(appointmentToEdit.patientName || '');
      setPhone(appointmentToEdit.patientPhone ? formatUzbekPhoneNumber(appointmentToEdit.patientPhone) : '');
      setDoctorId(appointmentToEdit.doctorId || (doctors[0]?.id || ''));
      setServiceId(appointmentToEdit.serviceId || (services[0]?.id || ''));
      setDate(appointmentToEdit.date || '2026-10-07');
      setTime(appointmentToEdit.time || '17:30');
      setNotes(appointmentToEdit.notes || '');
      setPatientMode('existing');
    } else {
      setSelectedPatientId('');
      setSelectedPatientName('');
      setPatientSearchTerm('');
      setPhone('');
      setNewPatientFullName('');
      setNewPatientPhone('');
      setNewPatientGender('Erkak');
      setDoctorId(doctors[0]?.id || '');
      setServiceId(services[0]?.id || '');
      setDate(getTodayDateString());
      setTime('09:30');
      setNotes('');
      setPatientMode('existing');
    }
    setPatientDropdownOpen(false);
    setErrors({});
  }, [appointmentToEdit, visible, doctors, services]);

  // Tashqariga bosilganda bemor qidiruv ro'yxatini yopish
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPatientDropdownOpen(false);
      }
    };
    if (patientDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [patientDropdownOpen]);

  if (!visible) return null;

  // Mavjud bemorlar ro'yxatini qidirish bo'yicha filtrlash
  const filteredPatients = patients.filter((p) => {
    if (!patientSearchTerm.trim()) return true;
    const q = patientSearchTerm.toLowerCase().trim();
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q))
    );
  });

  // Mavjud bemor tanlanganda: F.I.Sh va telefon avtomatik to'ladi
  const handleSelectExistingPatient = (p: Patient) => {
    setSelectedPatientId(p.id);
    setSelectedPatientName(p.fullName);
    setPatientSearchTerm(p.fullName);
    const formattedPhone = p.phone ? formatUzbekPhoneNumber(p.phone) : '';
    setPhone(formattedPhone);
    setPatientDropdownOpen(false);
    setErrors((prev) => ({ ...prev, patient: '', phone: '' }));
  };

  const handlePhoneChange = (val: string) => {
    setPhone(formatUzbekPhoneNumber(val));
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
  };

  const handleNewPatientPhoneChange = (val: string) => {
    setNewPatientPhone(formatUzbekPhoneNumber(val));
    if (errors.newPatientPhone) setErrors((prev) => ({ ...prev, newPatientPhone: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // 1. Bemor validatsiyasi
    if (!isEditMode) {
      if (patientMode === 'new') {
        if (!newPatientFullName.trim()) {
          newErrors.newPatientFullName = 'Yangi bemor ism-familiyasini kiriting';
        }
        if (!newPatientPhone.trim()) {
          newErrors.newPatientPhone = 'Yangi bemor telefon raqamini kiriting';
        }
      } else {
        if (!selectedPatientId) {
          newErrors.patient = 'Iltimos, mavjud bemorlar ro‘yxatidan tanlang';
        }
        if (!phone.trim()) {
          newErrors.phone = 'Telefon raqamini kiriting';
        }
      }
    } else {
      if (!phone.trim()) {
        newErrors.phone = 'Telefon raqamini kiriting';
      }
    }

    // 2. Qabul parametrlari validatsiyasi
    if (!doctorId) {
      newErrors.doctor = 'Shifokorni tanlang';
    }
    if (!serviceId) {
      newErrors.service = 'Xizmatni tanlang';
    }
    if (!date) {
      newErrors.date = 'Sanani tanlang';
    }
    if (!time) {
      newErrors.time = 'Vaqtni tanlang';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const currentDoc = doctors.find((d) => d.id === doctorId);
    const currentSrv = services.find((s) => s.id === serviceId);

    // Xizmat "Birlamchi konsultatsiya va ko‘rik" ekanligini tekshirish
    const srvName = (currentSrv?.name || '').toLowerCase();
    const isPrimaryConsultation =
      srvName.includes('birlamchi konsultatsiya') ||
      srvName.includes('konsultatsiya va ko‘rik') ||
      srvName.includes("konsultatsiya va ko'rik");

    // ============================================================
    // A) TAHRIRLASH REJIMI (Edit Mode)
    // ============================================================
    if (isEditMode && appointmentToEdit) {
      const res = updateAppointment(appointmentToEdit.id, {
        patientPhone: phone.trim(),
        doctorId,
        doctorName: currentDoc ? currentDoc.fullName : appointmentToEdit.doctorName,
        serviceId,
        serviceName: currentSrv ? currentSrv.name : appointmentToEdit.serviceName,
        servicePrice: currentSrv ? currentSrv.price : appointmentToEdit.servicePrice,
        date,
        time,
        notes: notes.trim(),
      });

      if (res.success) {
        showToast('Qabul ma’lumotlari muvaffaqiyatli yangilandi!');
        onClose();
      } else if (res.error) {
        setErrors({ form: res.error });
      }
      return;
    }

    // ============================================================
    // B) YANGI QABUL YOZISH REJIMI (New Mode)
    // ============================================================
    if (patientMode === 'new') {
      // 1. Yangi bemorni bazaga ro'yxatdan o'tkazish
      const createdPatient = addPatient({
        fullName: newPatientFullName.trim(),
        phone: newPatientPhone.trim(),
        gender: newPatientGender,
        debt: 0,
      });

      // 2. Yangi bemor uchun "Birlamchi konsultatsiya va ko‘rik" bo'lsa status avtomatik "Jarayonda"
      const initialStatus: AppointmentStatus = isPrimaryConsultation ? 'Jarayonda' : 'Kutilmoqda';

      // 3. Qabulni yangi bemor profiliga bog'lab yaratish
      const res = addAppointment({
        patientId: createdPatient.id,
        patientName: createdPatient.fullName,
        patientPhone: createdPatient.phone,
        doctorId,
        doctorName: currentDoc?.fullName || 'Shifokor',
        serviceId,
        serviceName: currentSrv?.name || 'Xizmat',
        servicePrice: currentSrv?.price || 0,
        date,
        time,
        durationMinutes: currentSrv?.durationMinutes || 30,
        status: initialStatus,
        notes: notes.trim(),
      });

      if (res.success) {
        if (initialStatus === 'Jarayonda') {
          showToast(
            `Yangi bemor "${createdPatient.fullName}" ro‘yxatga olindi va qabul "Jarayonda" statusida yaratildi!`,
            'success'
          );
        } else {
          showToast(
            `Yangi bemor "${createdPatient.fullName}" ro‘yxatga olindi va qabul rejalashtirildi!`,
            'success'
          );
        }
        onClose();
      } else if (res.error) {
        setErrors({ form: res.error });
      }
    } else {
      // Mavjud bemor uchun qabul rejalashtirish
      const matchedPatient = patients.find((p) => p.id === selectedPatientId);
      const res = addAppointment({
        patientId: selectedPatientId,
        patientName: matchedPatient ? matchedPatient.fullName : selectedPatientName,
        patientPhone: phone.trim() || (matchedPatient?.phone || ''),
        doctorId,
        doctorName: currentDoc?.fullName || 'Shifokor',
        serviceId,
        serviceName: currentSrv?.name || 'Xizmat',
        servicePrice: currentSrv?.price || 0,
        date,
        time,
        durationMinutes: currentSrv?.durationMinutes || 30,
        status: 'Kutilmoqda',
        notes: notes.trim(),
      });

      if (res.success) {
        showToast('Qabul muvaffaqiyatli saqlandi!', 'success');
        onClose();
      } else if (res.error) {
        setErrors({ form: res.error });
      }
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#0F172A',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '42px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    color: '#0F172A',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '28px 28px 24px 28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          animation: 'fadeInScale 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Sarlavhasi */}
        <h3
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
          }}
        >
          {isEditMode ? 'Qabulni tahrirlash' : 'Yangi qabul yozish'}
        </h3>
        <p
          style={{
            margin: '4px 0 18px 0',
            fontSize: '13px',
            color: '#64748B',
          }}
        >
          {isEditMode
            ? 'Bemor ma’lumotlari va qabul tafsilotlarini yangilang'
            : 'Bemor, shifokor va qabul vaqtini to‘liq rejalashtirish'}
        </p>

        {errors.form && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#DC2626',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ============================================================ */}
          {/* 1. YANGI QABUL UCHUN: BEMOR TANLASH SEGMENTED SWITCHER       */}
          {/* ============================================================ */}
          {!isEditMode && (
            <div>
              <label style={labelStyle}>Bemor tanlash</label>
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  backgroundColor: '#F1F5F9',
                  padding: '4px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPatientMode('existing');
                    setErrors((prev) => ({ ...prev, patient: '', newPatientFullName: '', newPatientPhone: '' }));
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: patientMode === 'existing' ? '#0D9488' : 'transparent',
                    color: patientMode === 'existing' ? '#FFFFFF' : '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <UserIcon size={14} color={patientMode === 'existing' ? '#FFFFFF' : '#475569'} />
                  <span>Mavjud bemorni tanlash</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPatientMode('new');
                    setErrors((prev) => ({ ...prev, patient: '', newPatientFullName: '', newPatientPhone: '' }));
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: patientMode === 'new' ? '#0D9488' : 'transparent',
                    color: patientMode === 'new' ? '#FFFFFF' : '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <PlusIcon size={14} color={patientMode === 'new' ? '#FFFFFF' : '#475569'} />
                  <span>Yangi bemor qo‘shish</span>
                </button>
              </div>

              {/* 1A. MAVJUD BEMORNI TANLASH */}
              {patientMode === 'existing' ? (
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={patientSearchTerm}
                      onChange={(e) => {
                        setPatientSearchTerm(e.target.value);
                        setSelectedPatientId('');
                        setSelectedPatientName('');
                        setPatientDropdownOpen(true);
                        if (errors.patient) setErrors((prev) => ({ ...prev, patient: '' }));
                      }}
                      onFocus={() => setPatientDropdownOpen(true)}
                      placeholder="Bemor ismini yozing yoki ro‘yxatdan tanlang..."
                      style={{
                        ...inputStyle,
                        paddingRight: '36px',
                        borderColor: errors.patient ? '#EF4444' : '#E2E8F0',
                      }}
                    />
                    {/* Clear / Chevron Icon */}
                    <div
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        color: '#64748B',
                      }}
                      onClick={() => setPatientDropdownOpen((prev) => !prev)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {/* Dropdown natijalar ro'yxati */}
                  {patientDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '46px',
                        left: 0,
                        right: 0,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '10px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 100,
                      }}
                    >
                      {filteredPatients.length > 0 ? (
                        filteredPatients.map((p) => {
                          const isSelected = p.id === selectedPatientId;
                          return (
                            <div
                              key={p.id}
                              onClick={() => handleSelectExistingPatient(p)}
                              style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid #F1F5F9',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#F0FDFA' : '#FFFFFF',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background-color 0.1s',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                                  {p.fullName}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B' }}>
                                  {p.phone || 'Telefon kiritilmagan'}
                                </div>
                              </div>
                              {isSelected && (
                                <span style={{ color: '#0D9488', fontWeight: 700, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckIcon size={14} color="#0D9488" /> Tanlandi
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '12px 14px', color: '#64748B', fontSize: '13px', textAlign: 'center' }}>
                          Bunday bemor topilmadi. &quot;Yangi bemor qo‘shish&quot; bo‘limidan foydalaning.
                        </div>
                      )}
                    </div>
                  )}

                  {errors.patient && (
                    <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>
                      {errors.patient}
                    </div>
                  )}
                  {selectedPatientId && (
                    <div style={{ color: '#0D9488', fontSize: '12px', marginTop: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckIcon size={14} color="#0D9488" /> Bemor biriktirildi. Telefon raqami avtomatik kiritildi.
                    </div>
                  )}
                </div>
              ) : (
                /* 1B. YANGI BEMOR QO'SHISH MAYDONLARI */
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#0D9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SparklesIcon size={14} color="#0D9488" /> Yangi bemor ma’lumotlari (saqlanganda avtomatik ro‘yxatga qo‘shiladi):
                  </div>

                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px', marginBottom: '4px' }}>
                      Bemor F.I.Sh (Ism, familiya) *
                    </label>
                    <input
                      type="text"
                      value={newPatientFullName}
                      onChange={(e) => {
                        setNewPatientFullName(e.target.value);
                        if (errors.newPatientFullName) setErrors((prev) => ({ ...prev, newPatientFullName: '' }));
                      }}
                      placeholder="Masalan: Sardorbek Rustamov"
                      style={{
                        ...inputStyle,
                        height: '38px',
                        borderColor: errors.newPatientFullName ? '#EF4444' : '#E2E8F0',
                      }}
                    />
                    {errors.newPatientFullName && (
                      <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '2px' }}>
                        {errors.newPatientFullName}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '12px', marginBottom: '4px' }}>
                        Telefon raqami *
                      </label>
                      <input
                        type="text"
                        value={newPatientPhone}
                        onChange={(e) => handleNewPatientPhoneChange(e.target.value)}
                        placeholder="+998 90 123 45 67"
                        style={{
                          ...inputStyle,
                          height: '38px',
                          borderColor: errors.newPatientPhone ? '#EF4444' : '#E2E8F0',
                        }}
                      />
                      {errors.newPatientPhone && (
                        <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '2px' }}>
                          {errors.newPatientPhone}
                        </div>
                      )}
                    </div>

                    <div>
                      <Select
                        label="Jinsi"
                        size="sm"
                        value={newPatientGender}
                        onValueChange={(val) => setNewPatientGender(val as 'Erkak' | 'Ayol')}
                        options={[
                          { label: 'Erkak', value: 'Erkak' },
                          { label: 'Ayol', value: 'Ayol' },
                        ]}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. TELEFON (Mavjud bemor yoki Tahrirlash rejimida)            */}
          {/* ============================================================ */}
          {(isEditMode || patientMode === 'existing') && (
            <div>
              <label style={labelStyle}>Telefon</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+998 88 732 55 15"
                style={{
                  ...inputStyle,
                  borderColor: errors.phone ? '#EF4444' : '#E2E8F0',
                }}
              />
              {errors.phone && (
                <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>
                  {errors.phone}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. SHIFOKOR                                                  */}
          {/* ============================================================ */}
          <div>
            <Select
              label="Shifokor"
              required
              value={doctorId}
              onValueChange={(val) => {
                setDoctorId(val);
                if (errors.doctor) setErrors((prev) => ({ ...prev, doctor: '' }));
              }}
              options={doctors.map((d) => ({
                label: d.fullName,
                value: d.id,
              }))}
              placeholder="Shifokorni tanlang..."
              error={errors.doctor}
              containerStyle={{ marginBottom: 0 }}
            />
          </div>

          {/* ============================================================ */}
          {/* 4. XIZMAT                                                    */}
          {/* ============================================================ */}
          <div>
            <Select
              label="Xizmat"
              required
              value={serviceId}
              onValueChange={(val) => {
                setServiceId(val);
                if (errors.service) setErrors((prev) => ({ ...prev, service: '' }));
              }}
              options={services.map((s) => ({
                label: s.name,
                value: s.id,
              }))}
              placeholder="Xizmatni tanlang..."
              error={errors.service}
              containerStyle={{ marginBottom: 0 }}
            />
          </div>

          {/* ============================================================ */}
          {/* 5. SANA VA VAQT (Yonma-yon 2 ustunda)                         */}
          {/* ============================================================ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Sana</label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                }}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  borderColor: errors.date ? '#EF4444' : '#E2E8F0',
                }}
              />
              {errors.date && (
                <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>
                  {errors.date}
                </div>
              )}
            </div>

            <div>
              <Select
                label="Vaqt"
                required
                value={time}
                onValueChange={(val) => {
                  setTime(val);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: '' }));
                }}
                options={TIME_SLOTS.map((t) => ({
                  label: t,
                  value: t,
                }))}
                placeholder="Vaqtni tanlang..."
                error={errors.time}
                containerStyle={{ marginBottom: 0 }}
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 6. IZOH                                                      */}
          {/* ============================================================ */}
          <div>
            <label style={labelStyle}>Izoh</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bemorning qabul bo‘yicha qo‘shimcha izohi"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                color: '#0F172A',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                minHeight: '70px',
              }}
            />
          </div>

          {/* ============================================================ */}
          {/* 7. MAXSUS BILDIRISHNOMA                                      */}
          {/* ============================================================ */}
          {isEditMode ? (
            <div
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#065F46',
                fontWeight: 500,
                marginTop: '2px',
              }}
            >
              Qabul holati alohida &quot;Status almashtirish&quot; orqali boshqariladi.
            </div>
          ) : (
            patientMode === 'new' &&
            services.find((s) => s.id === serviceId)?.name?.toLowerCase().includes('konsultatsiya') && (
              <div
                style={{
                  backgroundColor: '#F0FDFA',
                  border: '1px solid #99F6E4',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#0F766E',
                  fontWeight: 500,
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <SparklesIcon size={16} color="#0F766E" />
                <span>Yangi bemor uchun <b>&quot;Birlamchi konsultatsiya va ko‘rik&quot;</b> tanlandi. Qabul avtomatik ravishda <b>&quot;Jarayonda&quot;</b> statusida saqlanadi.</span>
              </div>
            )
          )}

          {/* ============================================================ */}
          {/* 8. FOOTER: Yopish va Saqlash                                 */}
          {/* ============================================================ */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '12px',
              paddingTop: '6px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              Yopish
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 26px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0D9488',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0F766E')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0D9488')}
            >
              {isEditMode ? 'Saqlash' : 'Qabulni saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
