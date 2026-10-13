import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { CheckIcon, CloseIcon } from './Icons';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: '#ECFDF5',
          border: '#6EE7B7',
          iconColor: colors.success,
          titleColor: '#065F46',
        };
      case 'error':
        return {
          bg: '#FEF2F2',
          border: '#FCA5A5',
          iconColor: colors.danger,
          titleColor: '#991B1B',
        };
      default:
        return {
          bg: '#EFF6FF',
          border: '#93C5FD',
          iconColor: colors.info,
          titleColor: '#1E40AF',
        };
    }
  };

  const st = getStyle();

  return (
    <View
      style={[
        styles.toastCard,
        {
          backgroundColor: st.bg,
          borderColor: st.border,
        },
      ]}
    >
      <View style={styles.iconCol}>
        <CheckIcon size={18} color={st.iconColor} />
      </View>
      <View style={styles.contentCol}>
        {toast.title && <Text style={[styles.title, { color: st.titleColor }]}>{toast.title}</Text>}
        <Text style={styles.message}>{toast.message}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
        <CloseIcon size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 99999,
    width: 360,
    maxWidth: '90%',
    gap: 10,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iconCol: {
    marginRight: 10,
  },
  contentCol: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
