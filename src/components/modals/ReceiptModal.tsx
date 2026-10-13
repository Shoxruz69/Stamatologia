import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Payment } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { colors } from '../../theme/colors';
import { PrinterIcon, CheckIcon } from '../common/Icons';

interface ReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  payment: Payment | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  onClose,
  payment,
}) => {
  const { settings } = useApp();

  if (!payment) return null;

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="To‘lov Kvitansiyasi"
      subtitle={`Chek raqami: ${payment.receiptNumber}`}
      maxWidth={480}
      footer={
        <View style={styles.footerRow}>
          <Button title="Yopish" variant="outline" onPress={onClose} />
          <Button
            title="Chop etish"
            variant="primary"
            icon={<PrinterIcon size={16} color="#FFF" />}
            onPress={handlePrint}
          />
        </View>
      }
    >
      <View style={styles.receiptPaper}>
        {/* Klinika sarlavhasi */}
        <View style={styles.receiptHeader}>
          <Text style={styles.clinicTitle}>{settings.name || 'DentaCare Stomatologiya'}</Text>
          <Text style={styles.clinicTagline}>{settings.tagline || 'Sizning tabassumingiz — bizning faxrimiz'}</Text>
          <Text style={styles.clinicContact}>{settings.address}</Text>
          <Text style={styles.clinicContact}>Tel: {settings.phone}</Text>
        </View>

        <View style={styles.divider} />

        {/* To'lov ma'lumotlari */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Chek raqami:</Text>
          <Text style={styles.metaValue}>{payment.receiptNumber}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Sana va vaqt:</Text>
          <Text style={styles.metaValue}>{formatDate(payment.date)} • {payment.time}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Bemor:</Text>
          <Text style={styles.metaValueBold}>{payment.patientName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Shifokor:</Text>
          <Text style={styles.metaValue}>{payment.doctorName}</Text>
        </View>

        <View style={styles.divider} />

        {/* Xizmat va narxlar */}
        <View style={styles.serviceRow}>
          <Text style={styles.serviceName}>{payment.serviceName}</Text>
          <Text style={styles.servicePrice}>{formatCurrency(payment.totalAmount)}</Text>
        </View>

        <View style={styles.dividerDashed} />

        {/* Jami to'lov */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TO‘LANGAN SUMMA:</Text>
          <Text style={styles.totalValue}>{formatCurrency(payment.paidAmount)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>To‘lov usuli:</Text>
          <Text style={styles.metaValue}>{payment.paymentMethod}</Text>
        </View>

        {payment.debtAmount > 0 && (
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            <Text style={[styles.metaLabel, { color: colors.danger, fontWeight: '700' }]}>
              Qolgan qarz:
            </Text>
            <Text style={[styles.metaValue, { color: colors.danger, fontWeight: '800' }]}>
              {formatCurrency(payment.debtAmount)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Xulosa */}
        <View style={styles.footerNote}>
          <Text style={styles.thankYouText}>Salomat bo‘ling! Ishonchingiz uchun rahmat!</Text>
          <Text style={styles.qrDemoText}>* Ushbu chek elektron tizim orqali tasdiqlangan *</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 18,
    // @ts-ignore
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  clinicTagline: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'center',
  },
  clinicContact: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  dividerDashed: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    color: colors.text,
  },
  metaValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 10,
  },
  thankYouText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  qrDemoText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
});
