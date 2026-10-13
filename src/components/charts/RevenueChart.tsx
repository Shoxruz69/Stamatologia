import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { AnalyticsIcon } from '../common/Icons';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface RevenueDataPoint {
  label: string;
  revenue: number;
  payments: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  title?: string;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  title = 'Savdo va Tushum Dinamikasi',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartHeight = 220;
  const chartWidth = 560; // Web konteyneriga mos
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingLeft = 50;
  const paddingRight = 20;

  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const innerWidth = chartWidth - paddingLeft - paddingRight;

  if (!data || data.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Savdo buyurtmalari va amaldagi naqd/karta tushumlari</Text>
          </View>
        </View>
        <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ marginBottom: 8 }}>
            <AnalyticsIcon size={32} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
            Tanlangan muddatda tushumlar mavjud emas (0 so‘m)
          </Text>
        </View>
      </View>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.revenue, d.payments)),
    500000
  );

  const barGroupWidth = innerWidth / data.length;
  const singleBarWidth = Math.max(12, Math.min(22, (barGroupWidth - 14) / 2));

  // Y-axis grid bo'linmalari
  const ySteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Savdo buyurtmalari va amaldagi naqd/karta tushumlari</Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Savdo hajmi</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#0284C7' }]} />
            <Text style={styles.legendText}>Haqiqiy tushum</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartWrapper}>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Defs>
            <LinearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor="#0F766E" stopOpacity="0.85" />
            </LinearGradient>
            <LinearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0284C7" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0369A1" stopOpacity="0.85" />
            </LinearGradient>
          </Defs>

          {/* Grid lines and Y labels */}
          {ySteps.map((step, idx) => {
            const y = paddingTop + innerHeight * (1 - step);
            const val = maxVal * step;
            const labelStr = val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`;

            return (
              <React.Fragment key={idx}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={step === 0 ? '0' : '4,4'}
                  strokeWidth="1"
                />
                <SvgText
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="#94A3B8"
                  fontSize="10"
                  textAnchor="end"
                >
                  {labelStr}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Bars */}
          {data.map((item, idx) => {
            const groupCenterX = paddingLeft + idx * barGroupWidth + barGroupWidth / 2;
            const revBarHeight = (item.revenue / maxVal) * innerHeight;
            const payBarHeight = (item.payments / maxVal) * innerHeight;

            const revY = paddingTop + innerHeight - revBarHeight;
            const payY = paddingTop + innerHeight - payBarHeight;

            const revX = groupCenterX - singleBarWidth - 2;
            const payX = groupCenterX + 2;

            const isHovered = hoveredIndex === idx;

            return (
              <React.Fragment key={idx}>
                {/* Background hover highlight */}
                {isHovered && (
                  <Rect
                    x={paddingLeft + idx * barGroupWidth + 4}
                    y={paddingTop}
                    width={barGroupWidth - 8}
                    height={innerHeight}
                    fill="rgba(13, 148, 136, 0.06)"
                    rx="6"
                  />
                )}

                {/* Revenue Bar */}
                <Rect
                  x={revX}
                  y={revY}
                  width={singleBarWidth}
                  height={Math.max(4, revBarHeight)}
                  fill="url(#tealGrad)"
                  rx="3"
                />

                {/* Payments Bar */}
                <Rect
                  x={payX}
                  y={payY}
                  width={singleBarWidth}
                  height={Math.max(4, payBarHeight)}
                  fill="url(#blueGrad)"
                  rx="3"
                />

                {/* X Axis Label */}
                <SvgText
                  x={groupCenterX}
                  y={chartHeight - 8}
                  fill={isHovered ? colors.primaryDark : '#64748B'}
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  textAnchor="middle"
                >
                  {item.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      {/* Info bar pastida */}
      <View style={styles.chartFooter}>
        {data.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => setHoveredIndex(idx === hoveredIndex ? null : idx)}
            style={[
              styles.footerItem,
              hoveredIndex === idx && styles.footerItemActive,
            ]}
          >
            <Text style={styles.footerLabel}>{item.label}</Text>
            <Text style={styles.footerRev}>{formatNumber(item.revenue)}</Text>
          </TouchableOpacity>
        ))}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
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
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chartWrapper: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  footerItem: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    // @ts-ignore
    cursor: 'pointer',
  },
  footerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footerRev: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
