import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'Keldi':
      case 'Yakunlandi':
      case 'To‘langan':
      case 'To‘landi':
      case 'Faol':
        return {
          bg: colors.successLight,
          text: colors.successText,
          border: '#A7F3D0',
        };
      case 'To‘lash kerak':
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          border: '#FDE68A',
        };
      case 'Tasdiqlangan':
        return {
          bg: colors.infoLight,
          text: colors.infoText,
          border: '#BFDBFE',
        };
      case 'Qabulda':
        return {
          bg: colors.purpleLight,
          text: colors.purpleText,
          border: '#DDD6FE',
        };
      case 'Jarayonda':
        return {
          bg: '#DCFCE7',
          text: '#059669',
          border: '#A7F3D0',
        };
      case 'Kutilmoqda':
      case 'Qisman to‘langan':
        return {
          bg: colors.warningLight,
          text: colors.warningText,
          border: '#FDE68A',
        };
      case 'Bekor qilindi':
      case 'Bekor qilish':
      case 'Qaytarilgan':
      case 'Faol emas':
        return {
          bg: colors.dangerLight,
          text: colors.dangerText,
          border: '#FECACA',
        };
      default:
        return {
          bg: '#F1F5F9',
          text: '#475569',
          border: '#CBD5E1',
        };
    }
  };

  const current = getBadgeStyle();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 8 : 10,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: current.text }]} />
      <Text
        style={[
          styles.text,
          {
            color: current.text,
            fontSize: isSm ? 11 : 12,
          },
        ]}
      >
        {status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
