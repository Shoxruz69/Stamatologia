import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select, DateInput } from '../common/Input';
import { useApp } from '../../context/AppContext';
import { Patient } from '../../types';
import { formatUzbekPhoneNumber } from '../../utils/formatters';

interface PatientModalProps {
  visible: boolean;
  onClose: () => void;
  patientToEdit?: Patient | null;
  onPatientCreated?: (patient: Patient) => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  visible,
  onClose,
  patientToEdit,
  onPatientCreated,
}) => {
  const { addPatient, updatePatient, currentUser } = useApp();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'Erkak' | 'Ayol'>('Erkak');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (patientToEdit) {
      setFullName(patientToEdit.fullName);
      setPhone(patientToEdit.phone ? formatUzbekPhoneNumber(patientToEdit.phone) : '');
      setGender(patientToEdit.gender);
      setBirthDate(patientToEdit.birthDate || '');
      setAddress(patientToEdit.address || '');
      setNotes(patientToEdit.notes || '');
    } else {
      setFullName('');
      setPhone('');
      setGender('Erkak');
      setBirthDate('1995-01-01');
      setAddress('');
      setNotes('');
    }
    setErrors({});
  }, [patientToEdit, visible]);

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = 'Bemorning to‘liq ismini kiriting';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) newErrors.phone = 'Telefon raqamini to‘liq kiriting';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }


    if (patientToEdit) {
      updatePatient(patientToEdit.id, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender,
        birthDate,
        address: address.trim(),
        notes: notes.trim(),
      });
      onClose();
    } else {
      const created = addPatient({
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender,
        birthDate,
        address: address.trim(),
        notes: notes.trim(),
        debt: 0,
      });
      if (onPatientCreated) {
        onPatientCreated(created);
      }
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={
        patientToEdit
          ? 'Bemor Ma’lumotlarini Tahrirlash'
          : 'Yangi Bemor Qo‘shish'
      }
      subtitle="Bemorning shaxsiy ma’lumotlari va aloqa vositalari"
      maxWidth={580}
      footer={
        <View style={styles.footerRow}>
          <Button
            title="Bekor qilish"
            variant="outline"
            onPress={onClose}
          />
          <Button
            title={patientToEdit ? 'Saqlash' : 'Bemorni Qo‘shish'}
            variant="primary"
            onPress={handleSubmit}
          />
        </View>
      }
    >
      <Input
        label="F.I.Sh (Ism, familiya)"
        required
        value={fullName}
        onChangeText={(val) => {
          setFullName(val);
          setErrors({ ...errors, fullName: '' });
        }}
        placeholder="Masalan: Sardorbek Rustamov"
        error={errors.fullName}
      />

      <View style={styles.grid2}>
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

        <Select
          label="Jinsi"
          value={gender}
          onValueChange={(val) => setGender(val as 'Erkak' | 'Ayol')}
          options={[
            { label: 'Erkak', value: 'Erkak' },
            { label: 'Ayol', value: 'Ayol' },
          ]}
          containerStyle={styles.col2}
        />
      </View>

      <View style={styles.grid2}>
        <DateInput
          label="Tug‘ilgan sanasi"
          value={birthDate}
          onChangeDate={setBirthDate}
          containerStyle={styles.col2}
        />

        <Input
          label="Yashash manzili"
          value={address}
          onChangeText={setAddress}
          placeholder="Toshkent sh., Yunusobod tumani"
          containerStyle={styles.col2}
        />
      </View>

      <Input
        label="Tibbiy qaydlar yoki allergiya ma’lumotlari"
        value={notes}
        onChangeText={setNotes}
        placeholder="Masalan: Anesteziyaga sezuvchanlik, yurak qon-tomir xastaligi yo‘q..."
        multiline
        numberOfLines={3}
      />
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
});
