import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: isHovered ? colors.primaryDark : colors.primary,
          text: colors.textInverted,
          border: 'transparent',
        };
      case 'secondary':
        return {
          bg: isHovered ? '#CCFBF1' : colors.primarySoft,
          text: colors.primaryDark,
          border: '#99F6E4',
        };
      case 'outline':
        return {
          bg: isHovered ? '#F8FAFC' : 'transparent',
          text: colors.text,
          border: colors.border,
        };
      case 'danger':
        return {
          bg: isHovered ? '#DC2626' : colors.danger,
          text: colors.textInverted,
          border: 'transparent',
        };
      case 'ghost':
        return {
          bg: isHovered ? '#F1F5F9' : 'transparent',
          text: colors.textSecondary,
          border: 'transparent',
        };
    }
  };

  const current = getVariantStyles();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { py: 6, px: 12, fontSize: 13, minHeight: 34 };
      case 'lg':
        return { py: 14, px: 24, fontSize: 16, minHeight: 48 };
      default:
        return { py: 10, px: 18, fontSize: 14, minHeight: 42 };
    }
  };

  const sz = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      // @ts-ignore Web hover event
      onMouseEnter={() => setIsHovered(true)}
      // @ts-ignore Web hover event
      onMouseLeave={() => setIsHovered(false)}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? '#E2E8F0' : current.bg,
          borderColor: disabled ? 'transparent' : current.border,
          paddingVertical: sz.py,
          paddingHorizontal: sz.px,
          minHeight: sz.minHeight,
          height: (style as any)?.height || (size === 'md' ? 42 : undefined),
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFF' : colors.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: disabled ? '#94A3B8' : current.text,
                fontSize: sz.fontSize,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Web uchun cursor pointer
    // @ts-ignore
    cursor: 'pointer',
    userSelect: 'none',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
  },
});
