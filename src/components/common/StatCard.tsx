import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  iconBg?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  iconBg = colors.primaryLight,
  icon,
  trend,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <View
      // @ts-ignore Web hover
      onMouseEnter={() => setIsHovered(true)}
      // @ts-ignore Web hover
      onMouseLeave={() => setIsHovered(false)}
      style={[
        styles.card,
        isHovered && styles.cardHovered,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {icon && (
          <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
            {icon}
          </View>
        )}
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      <View style={styles.footer}>
        {trend && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trend.isPositive ? colors.successLight : colors.dangerLight,
              },
            ]}
          >
            <Text
              style={[
                styles.trendText,
                {
                  color: trend.isPositive ? colors.successText : colors.dangerText,
                },
              ]}
            >
              {trend.value}
            </Text>
          </View>
        )}
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    flex: 1,
    minWidth: 220,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardHovered: {
    borderColor: '#99F6E4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    transform: [{ translateY: -2 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
});
