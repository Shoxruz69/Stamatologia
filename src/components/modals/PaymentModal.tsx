import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select, DateInput } from '../common/Input';
import { useApp } from '../../context/AppContext';
import { Payment, PaymentMethod, PaymentStatus, Patient } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { colors } from '../../theme/colors';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  preselectedPatient?: Patient | null;
  paymentToEdit?: Payment | null;
  onPaymentSuccess?: (payment: Payment) => void;
}

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Naqd pul', value: 'Naqd' },
  { label: 'Plastik karta (Uzcard / Humo)', value: 'Karta' },
  { label: 'Payme / Click', value: 'Payme / Click' },
  { label: 'Bank o‘tkazmasi (Hisob raqam)', value: 'O‘tkazma' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  preselectedPatient,
  paymentToEdit,
  onPaymentSuccess,
}) => {
  const { patients, doctors, services, appointments, addPayment, updatePayment } = useApp();

  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Naqd');
  const [date, setDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (paymentToEdit) {
      setPatientId(paymentToEdit.patientId);
      setDoctorId(paymentToEdit.doctorId);
      setServiceName(paymentToEdit.serviceName);
      setTotalAmountStr(paymentToEdit.totalAmount.toString());
      setPaidAmountStr(paymentToEdit.paidAmount.toString());
      setPaymentMethod(paymentToEdit.paymentMethod);
      setDate(paymentToEdit.date);
      setNotes(paymentToEdit.notes || '');
    } else if (preselectedPatient) {
      setPatientId(preselectedPatient.id);
      setDoctorId(doctors[0]?.id || '');
      // Agar qarzi bo'lsa, qarz summasini to'ldiramiz
      if (preselectedPatient.debt > 0) {
        setServiceName('Qarzdorlikni to‘lash');
        setTotalAmountStr(preselectedPatient.debt.toString());
        setPaidAmountStr(preselectedPatient.debt.toString());
      } else {
        const srv = services[0];
        setServiceName(srv?.name || 'Stomatologik xizmat');
        setTotalAmountStr(srv ? srv.price.toString() : '200000');
        setPaidAmountStr(srv ? srv.price.toString() : '200000');
      }
      setDate(getTodayDateString());
      setNotes('');
    } else {
      setPatientId(patients[0]?.id || '');
      setDoctorId(doctors[0]?.id || '');
      const srv = services[0];
      setServiceName(srv?.name || 'Stomatologik xizmat');
      setTotalAmountStr(srv ? srv.price.toString() : '250000');
      setPaidAmountStr(srv ? srv.price.toString() : '250000');
      setDate(getTodayDateString());
      setNotes('');
    }
    setErrors({});
  }, [paymentToEdit, preselectedPatient, visible, patients, doctors, services]);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  const totalNum = parseInt(totalAmountStr.replace(/\s+/g, ''), 10) || 0;
  const paidNum = parseInt(paidAmountStr.replace(/\s+/g, ''), 10) || 0;
  const debtNum = Math.max(0, totalNum - paidNum);

  const handleSelectService = (srvId: string) => {
    const srv = services.find((s) => s.id === srvId);
    if (srv) {
      setServiceName(srv.name);
      setTotalAmountStr(srv.price.toString());
      setPaidAmountStr(srv.price.toString());
    }
  };

  const handlePayFull = () => {
    setPaidAmountStr(totalAmountStr);
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!patientId) newErrors.patientId = 'Bemorni tanlang';
    if (!doctorId) newErrors.doctorId = 'Shifokorni tanlang';
    if (!serviceName.trim()) newErrors.serviceName = 'Xizmat nomini kiriting';
    if (totalNum <= 0) newErrors.totalAmount = 'Jami summa 0 dan katta bo‘lishi kerak';
    if (paidNum < 0) newErrors.paidAmount = 'To‘lov summasi manfiy bo‘lishi mumkin emas';
    if (paidNum > totalNum) newErrors.paidAmount = 'To‘langan summa jami summadan ko‘p bo‘lishi mumkin emas';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!selectedPatient || !selectedDoctor) return;

    const status: PaymentStatus = debtNum === 0 ? 'To‘landi' : 'Qisman to‘langan';
    const currentTime = new Date().toTimeString().slice(0, 5);

    if (paymentToEdit) {
      updatePayment(paymentToEdit.id, {
        appointmentId: paymentToEdit.appointmentId,
        patientId,
        patientName: selectedPatient.fullName,
        doctorId,
        doctorName: selectedDoctor.fullName,
        serviceName: serviceName.trim(),
        totalAmount: totalNum,
        paidAmount: paidNum,
        debtAmount: debtNum,
        paymentMethod,
        status,
        date,
        notes: notes.trim(),
      });
      onClose();
    } else {
      const created = addPayment({
        patientId,
        patientName: selectedPatient.fullName,
        doctorId,
        doctorName: selectedDoctor.fullName,
        serviceName: serviceName.trim(),
        totalAmount: totalNum,
        paidAmount: paidNum,
        debtAmount: debtNum,
        paymentMethod,
        status,
        date,
        time: currentTime,
        notes: notes.trim(),
      });
      if (onPaymentSuccess) {
        onPaymentSuccess(created);
      }
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={paymentToEdit ? 'To‘lovni Tahrirlash' : 'Yangi To‘lov Kiritish (Kassa)'}
      subtitle="Bemor to‘lovini qabul qilish va avtomatik qarz hisobi"
      maxWidth={620}
      footer={
        <View style={styles.footerRow}>
          <Button title="Bekor qilish" variant="outline" onPress={onClose} />
          <Button
            title={paymentToEdit ? 'Saqlash' : 'To‘lovni Qabul Qilish'}
            variant="primary"
            onPress={handleSubmit}
          />
        </View>
      }
    >
      <Select
        label="Bemor"
        required
        value={patientId}
        onValueChange={(val) => {
          setPatientId(val);
          setErrors({ ...errors, patientId: '' });
        }}
        options={patients.map((p) => ({
          label: `${p.fullName} (${p.phone})${p.debt > 0 ? ` • Mavjud qarz: ${formatCurrency(p.debt)}` : ''}`,
          value: p.id,
        }))}
        placeholder="Bemorni tanlang..."
        error={errors.patientId}
      />

      <View style={styles.grid2}>
        <Select
          label="Xizmat andozasidan tanlash"
          value=""
          onValueChange={handleSelectService}
          options={services.map((s) => ({
            label: `${s.name} (${formatCurrency(s.price)})`,
            value: s.id,
          }))}
          placeholder="Xizmat narxini avtomatik to‘ldirish..."
          containerStyle={styles.col2}
        />

        <Select
          label="Mas’ul shifokor"
          required
          value={doctorId}
          onValueChange={(val) => {
            setDoctorId(val);
            setErrors({ ...errors, doctorId: '' });
          }}
          options={doctors.map((d) => ({
            label: `${d.fullName} (${d.specialty})`,
            value: d.id,
          }))}
          placeholder="Shifokorni tanlang..."
          error={errors.doctorId}
          containerStyle={styles.col2}
        />
      </View>

      <Input
        label="Xizmat yoki to‘lov maqsadi"
        required
        value={serviceName}
        onChangeText={setServiceName}
        placeholder="Xizmat nomi yoki Qarz to‘lovi"
        error={errors.serviceName}
      />

      <View style={styles.grid2}>
        <Input
          label="Jami xizmat summasi"
          required
          value={totalAmountStr}
          onChangeText={(val) => setTotalAmountStr(val)}
          placeholder="250 000"
          keyboardType="numeric"
          suffix="so‘m"
          error={errors.totalAmount}
          containerStyle={styles.col2}
        />

        <View style={styles.col2}>
          <Input
            label="Hozir to‘lanayotgan summa"
            required
            value={paidAmountStr}
            onChangeText={(val) => setPaidAmountStr(val)}
            placeholder="250 000"
            keyboardType="numeric"
            suffix="so‘m"
            error={errors.paidAmount}
          />
          <Text style={styles.quickPayFullLink} onPress={handlePayFull}>
            To‘liq to‘lash (100%)
          </Text>
        </View>
      </View>

      {/* Qarz va to'lov xulosasi kartasi */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Jami hisob:</Text>
          <Text style={styles.summaryVal}>{formatCurrency(totalNum)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tushayotgan mablag‘:</Text>
          <Text style={[styles.summaryVal, { color: colors.success }]}>
            {formatCurrency(paidNum)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Qarz qoldig‘i:</Text>
          <Text
            style={[
              styles.summaryVal,
              { color: debtNum > 0 ? colors.danger : colors.textMuted },
            ]}
          >
            {formatCurrency(debtNum)}
          </Text>
        </View>
      </View>

      <View style={styles.grid2}>
        <Select
          label="To‘lov turi (Usuli)"
          required
          value={paymentMethod}
          onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
          options={PAYMENT_METHODS}
          containerStyle={styles.col2}
        />

        <DateInput
          label="To‘lov sanasi"
          required
          value={date}
          onChangeDate={setDate}
          containerStyle={styles.col2}
        />
      </View>

      <Input
        label="To‘lov bo‘yicha qo‘shimcha izoh"
        value={notes}
        onChangeText={setNotes}
        placeholder="Chek raqami, tranzaksiya ID yoki maxsus qayd..."
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
  quickPayFullLink: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
    marginTop: -10,
    marginBottom: 10,
    textAlign: 'right',
    // @ts-ignore
    cursor: 'pointer',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
});
