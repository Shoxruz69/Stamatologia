import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { Button } from './Button';
import { colors } from '../../theme/colors';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Tasdiqlash',
  cancelText = 'Bekor qilish',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={title}
      maxWidth={460}
      footer={
        <View style={styles.footerRow}>
          <Button
            title={cancelText}
            variant="outline"
            onPress={onCancel}
          />
          <Button
            title={confirmText}
            variant={isDestructive ? 'danger' : 'primary'}
            onPress={onConfirm}
          />
        </View>
      }
    >
      <Text style={styles.message}>{message}</Text>
    </Modal>
  );
};

const styles = StyleSheet.create({
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
