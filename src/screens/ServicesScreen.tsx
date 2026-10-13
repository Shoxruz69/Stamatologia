import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Service, ServiceCategory } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatCurrency } from '../utils/formatters';
import {
  PlusIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  ToothIcon,
} from '../components/common/Icons';

interface ServicesScreenProps {
  onOpenNewModal: () => void;
  onEditService: (service: Service) => void;
}

export const ServicesScreen: React.FC<ServicesScreenProps> = ({
  onOpenNewModal,
  onEditService,
}) => {
  const { services, updateService, deleteService, searchQuery, currentUser } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('Barchasi');
  const [localSearch, setLocalSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => set.add(s.category));
    return ['Barchasi', ...Array.from(set)];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategory !== 'Barchasi' && s.category !== selectedCategory) return false;
      const q = (searchQuery || localSearch).trim().toLowerCase();
      if (q) {
        const matchName = s.name.toLowerCase().includes(q);
        const matchCat = s.category.toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [services, selectedCategory, searchQuery, localSearch]);

  const toggleServiceActive = (service: Service) => {
    updateService(service.id, { isActive: !service.isActive });
  };

  return (
    <View style={styles.container}>
      {/* Yuqori panel */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Klinika Xizmatlari va Preyskurant ({services.length})</Text>
          <Text style={styles.subtitle}>
            Muolajalar narxlarini o‘zgartirish, yangilarini kiritish va faollashtirish
          </Text>
        </View>

        <Button
          title="Yangi xizmat qo‘shish"
          icon={<PlusIcon size={16} color="#FFF" />}
          onPress={onOpenNewModal}
        />
      </View>

      {/* Kategoriyalar va qidiruv filtri */}
      <View style={styles.filterSection}>
        {/* Qidiruv */}
        <View style={styles.searchBox}>
          <SearchIcon size={18} color={colors.textMuted} />
          <TextInput
            value={localSearch}
            onChangeText={setLocalSearch}
            placeholder="Xizmat nomi bo‘yicha qidirish..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        {/* Kategoriya teglar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.catChip,
                selectedCategory === cat && styles.catChipActive,
              ]}
            >
              <Text
                style={[
                  styles.catChipText,
                  selectedCategory === cat && styles.catChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Xizmatlar jadvali */}
      <ScrollView style={styles.tableScrollView} showsVerticalScrollIndicator={true}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <View style={styles.tableContainer}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2, minWidth: 170 }]}>Xizmat Nomi</Text>
              <Text style={[styles.th, { flex: 1.2, minWidth: 130 }]}>Kategoriya</Text>
              <Text style={[styles.th, { width: 140 }]}>Narxi (UZS)</Text>
              <Text style={[styles.th, { width: 110 }]}>Davomiyligi</Text>
              <Text style={[styles.th, { width: 110 }]}>Holat</Text>
              <Text style={[styles.th, { width: 140, textAlign: 'center' }]}>Amallar</Text>
            </View>

          {/* Body */}
          {filteredServices.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={{ marginBottom: 12 }}>
                <ToothIcon size={44} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {services.length === 0 ? 'Xizmatlar katalogi bo‘sh' : 'Xizmat topilmadi'}
              </Text>
              <Text style={styles.emptySub}>
                {services.length === 0
                  ? 'Klinikangiz ko‘rsatadigan stomatologik xizmatlar va narxlarni kiriting'
                  : 'Boshqa kategoriya tanlang yoki qidiruv so‘zini tozalang'}
              </Text>
              {services.length === 0 && (
                <View style={{ marginTop: 16 }}>
                  <Button
                    title="Birinchi xizmatni qo‘shish"
                    icon={<PlusIcon size={16} color="#FFF" />}
                    onPress={onOpenNewModal}
                  />
                </View>
              )}
            </View>
          ) : (
            filteredServices.map((service, idx) => (
              <View
                key={service.id}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 && styles.tableRowAlt,
                  !service.isActive && styles.tableRowInactive,
                ]}
              >
                {/* Nomi & tavsifi */}
                <View style={{ flex: 2 }}>
                  <Text style={styles.cellServiceName}>{service.name}</Text>
                  {service.description ? (
                    <Text style={styles.cellServiceDesc} numberOfLines={2}>
                      {service.description}
                    </Text>
                  ) : null}
                </View>

                {/* Kategoriya */}
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.cellCategory}>{service.category}</Text>
                </View>

                {/* Narxi */}
                <View style={{ width: 140 }}>
                  <Text style={styles.cellPrice}>{formatCurrency(service.price)}</Text>
                </View>

                {/* Davomiyligi */}
                <View style={{ width: 110 }}>
                  <Text style={styles.cellDuration}>{service.durationMinutes} daqiqa</Text>
                </View>

                {/* Faol / Faol emas switch */}
                <View style={{ width: 110 }}>
                  <TouchableOpacity
                    onPress={() => toggleServiceActive(service)}
                    style={styles.statusToggleBtn}
                  >
                    <Badge
                      status={service.isActive ? 'Faol' : 'Faol emas'}
                      size="sm"
                    />
                  </TouchableOpacity>
                </View>

                {/* Amallar */}
                <View style={[styles.actionsCell, { width: 140 }]}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onEditService(service)}
                    // @ts-ignore
                    title="Tahrirlash"
                  >
                    <EditIcon size={15} color={colors.accent} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => setDeleteTarget(service)}
                    // @ts-ignore
                    title="O‘chirish"
                  >
                    <TrashIcon size={15} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScrollView>

      {/* O'chirish dialogi */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Xizmatni o‘chirish"
        message={`Haqiqatdan ham "${deleteTarget?.name}" xizmatini o‘chirmoqchimisiz?`}
        confirmText="O‘chirish"
        isDestructive={true}
        onConfirm={() => {
          if (deleteTarget) {
            deleteService(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: colors.text,
    // @ts-ignore
    outline: 'none',
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    // @ts-ignore
    cursor: 'pointer',
  },
  catChipActive: {
    backgroundColor: colors.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  tableScrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  horizontalScrollContent: {
    minWidth: '100%',
    flexGrow: 1,
  },
  tableContainer: {
    width: '100%',
    minWidth: 780,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableRowInactive: {
    opacity: 0.5,
  },
  cellServiceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cellServiceDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cellCategory: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cellPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  cellDuration: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusToggleBtn: {
    // @ts-ignore
    cursor: 'pointer',
  },
  actionsCell: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
});
