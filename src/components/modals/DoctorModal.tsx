import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useApp } from '../../context/AppContext';
import { Doctor } from '../../types';
import { colors } from '../../theme/colors';
import { formatUzbekPhoneNumber } from '../../utils/formatters';
import { registerOrUpdateStaffMember } from '../../utils/staffData';

interface DoctorModalProps {
  visible: boolean;
  onClose: () => void;
  doctorToEdit?: Doctor | null;
}

const ALL_DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

export const DoctorModal: React.FC<DoctorModalProps> = ({
  visible,
  onClose,
  doctorToEdit,
}) => {
  const { addDoctor, updateDoctor } = useApp();

  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [workDays, setWorkDays] = useState<string[]>(['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (doctorToEdit) {
      setFullName(doctorToEdit.fullName);
      setSpecialty(doctorToEdit.specialty);
      setPhone(doctorToEdit.phone ? formatUzbekPhoneNumber(doctorToEdit.phone) : '');
      setWorkDays(doctorToEdit.workDays || []);
      setStartTime(doctorToEdit.workHours?.start || '09:00');
      setEndTime(doctorToEdit.workHours?.end || '18:00');
    } else {
      setFullName('');
      setSpecialty('Terapevt-Stomatolog');
      setPhone('');
      setWorkDays(['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma']);
      setStartTime('09:00');
      setEndTime('18:00');
    }
    setErrors({});
  }, [doctorToEdit, visible]);

  const toggleDay = (day: string) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter((d) => d !== day));
    } else {
      setWorkDays([...workDays, day]);
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = 'Shifokorning to‘liq ismini kiriting';
    if (!specialty.trim()) newErrors.specialty = 'Mutaxassisligini kiriting';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) newErrors.phone = 'Telefon raqamini kiriting';
    if (workDays.length === 0) newErrors.workDays = 'Kamida 1 ta ish kunini tanlang';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (doctorToEdit) {
      updateDoctor(doctorToEdit.id, {
        fullName: fullName.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
        workDays,
        workHours: { start: startTime, end: endTime },
      });
      registerOrUpdateStaffMember(fullName.trim(), 'Shifokor', '1234');
    } else {
      addDoctor({
        fullName: fullName.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
        workDays,
        workHours: { start: startTime, end: endTime },
        isActive: true,
      });
      registerOrUpdateStaffMember(fullName.trim(), 'Shifokor', '1234');
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={doctorToEdit ? 'Shifokor Ma’lumotlarini Tahrirlash' : 'Yangi Shifokor Qo‘shish'}
      subtitle="Klinika mutaxassisi, mutaxassisligi va qabul grafigi"
      maxWidth={580}
      footer={
        <View style={styles.footerRow}>
          <Button title="Bekor qilish" variant="outline" onPress={onClose} />
          <Button
            title={doctorToEdit ? 'Saqlash' : 'Shifokorni Qo‘shish'}
            variant="primary"
            onPress={handleSubmit}
          />
        </View>
      }
    >
      <Input
        label="Shifokor F.I.Sh"
        required
        value={fullName}
        onChangeText={(val) => {
          setFullName(val);
          setErrors({ ...errors, fullName: '' });
        }}
        placeholder="Masalan: Dr. Sardor Alimov"
        error={errors.fullName}
      />

      <View style={styles.grid2}>
        <Input
          label="Mutaxassisligi"
          required
          value={specialty}
          onChangeText={(val) => {
            setSpecialty(val);
            setErrors({ ...errors, specialty: '' });
          }}
          placeholder="Jarroh, Ortodont, Terapevt..."
          error={errors.specialty}
          containerStyle={styles.col2}
        />

        <Input
          label="Telefon raqami"
          required
          value={phone}
          onChangeText={(val) => {
            setPhone(val);
            setErrors({ ...errors, phone: '' });
          }}
          placeholder="+998 90 123 45 67"
          keyboardType="phone-pad"
          error={errors.phone}
          containerStyle={styles.col2}
        />
      </View>

      {/* Ish kunlari tanlovi */}
      <View style={styles.workDaysSection}>
        <Text style={styles.sectionLabel}>Ish kunlari *</Text>
        <View style={styles.daysRow}>
          {ALL_DAYS.map((day) => {
            const isSelected = workDays.includes(day);
            return (
              <TouchableOpacity
                key={day}
                onPress={() => toggleDay(day)}
                style={[styles.dayChip, isSelected && styles.dayChipActive]}
              >
                <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                  {day.slice(0, 4)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errors.workDays ? <Text style={styles.errorText}>{errors.workDays}</Text> : null}
      </View>

      <View style={styles.grid2}>
        <Input
          label="Ish boshlanish vaqti"
          value={startTime}
          onChangeText={setStartTime}
          placeholder="09:00"
          containerStyle={styles.col2}
        />

        <Input
          label="Ish yakunlanish vaqti"
          value={endTime}
          onChangeText={setEndTime}
          placeholder="18:00"
          containerStyle={styles.col2}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  grid2: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  col2: {
    flex: 1,
    minWidth: 200,
  },
  workDaysSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    // @ts-ignore
    cursor: 'pointer',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
});
