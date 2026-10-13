import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatters';

interface PaymentDistributionItem {
  method: string;
  amount: number;
  color: string;
}

interface PaymentPieChartProps {
  items: PaymentDistributionItem[];
  totalAmount: number;
}

export const PaymentPieChart: React.FC<PaymentPieChartProps> = ({
  items,
  totalAmount,
}) => {
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>To‘lov Usullari Taqsimoti</Text>
      <Text style={styles.subtitle}>Kassaga kelib tushgan jami mablag‘lar nisbati</Text>

      <View style={styles.contentRow}>
        {/* SVG Donut */}
        <View style={styles.chartWrapper}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {totalAmount > 0 &&
              items.map((item, idx) => {
                const fraction = item.amount / totalAmount;
                const strokeDasharray = `${circumference * fraction} ${circumference * (1 - fraction)}`;
                const strokeDashoffset = -currentOffset;
                currentOffset += circumference * fraction;

                return (
                  <Circle
                    key={idx}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    fill="none"
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  />
                );
              })}
          </Svg>
          <View style={styles.centerTextContainer}>
            <Text style={styles.centerLabel}>Jami tushum</Text>
            <Text style={styles.centerValue} numberOfLines={1}>
              {formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          {items.map((item, idx) => {
            const percent = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0;
            return (
              <View key={idx} style={styles.legendItem}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <View style={styles.legendTextWrap}>
                  <View style={styles.legendHeader}>
                    <Text style={styles.methodName}>{item.method}</Text>
                    <Text style={styles.methodPercent}>{percent}%</Text>
                  </View>
                  <Text style={styles.methodAmount}>{formatCurrency(item.amount)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 20,
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  centerLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  centerValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 2,
  },
  legendContainer: {
    flex: 1,
    minWidth: 180,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendTextWrap: {
    flex: 1,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  methodPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  methodAmount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
});
