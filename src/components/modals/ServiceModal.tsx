import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { useApp } from '../../context/AppContext';
import { Service, ServiceCategory } from '../../types';

interface ServiceModalProps {
  visible: boolean;
  onClose: () => void;
  serviceToEdit?: Service | null;
}

const CATEGORIES: { label: string; value: ServiceCategory }[] = [
  { label: 'Konsultatsiya', value: 'Konsultatsiya' },
  { label: 'Terapiya', value: 'Terapiya' },
  { label: 'Jarrohlik', value: 'Jarrohlik' },
  { label: 'Ortodontiya', value: 'Ortodontiya' },
  { label: 'Gigiyena va profilaktika', value: 'Gigiyena va profilaktika' },
  { label: 'Rentgen va diagnostika', value: 'Rentgen va diagnostika' },
  { label: 'Protezlash', value: 'Protezlash' },
];

export const ServiceModal: React.FC<ServiceModalProps> = ({
  visible,
  onClose,
  serviceToEdit,
}) => {
  const { addService, updateService } = useApp();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('Terapiya');
  const [priceStr, setPriceStr] = useState('');
  const [durationStr, setDurationStr] = useState('30');
  const [description, setDescription] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (serviceToEdit) {
      setName(serviceToEdit.name);
      setCategory(serviceToEdit.category);
      setPriceStr(serviceToEdit.price.toString());
      setDurationStr(serviceToEdit.durationMinutes.toString());
      setDescription(serviceToEdit.description || '');
    } else {
      setName('');
      setCategory('Terapiya');
      setPriceStr('');
      setDurationStr('30');
      setDescription('');
    }
    setErrors({});
  }, [serviceToEdit, visible]);

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Xizmat nomini kiriting';
    const priceNum = parseInt(priceStr.replace(/\s+/g, ''), 10);
    if (isNaN(priceNum) || priceNum <= 0) newErrors.price = 'To‘g‘ri narx kiriting';
    const durationNum = parseInt(durationStr, 10);
    if (isNaN(durationNum) || durationNum <= 0) newErrors.duration = 'Davomiylikni minutlarda kiriting';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (serviceToEdit) {
      updateService(serviceToEdit.id, {
        name: name.trim(),
        category,
        price: priceNum,
        durationMinutes: durationNum,
        description: description.trim(),
      });
    } else {
      addService({
        name: name.trim(),
        category,
        price: priceNum,
        durationMinutes: durationNum,
        description: description.trim(),
        isActive: true,
      });
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={serviceToEdit ? 'Xizmatni Tahrirlash' : 'Yangi Xizmat Qo‘shish'}
      subtitle="Stomatologik muolaja nomi, toifasi va narxi"
      maxWidth={560}
      footer={
        <View style={styles.footerRow}>
          <Button title="Bekor qilish" variant="outline" onPress={onClose} />
          <Button
            title={serviceToEdit ? 'Saqlash' : 'Xizmatni Qo‘shish'}
            variant="primary"
            onPress={handleSubmit}
          />
        </View>
      }
    >
      <Input
        label="Xizmat nomi"
        required
        value={name}
        onChangeText={(val) => {
          setName(val);
          setErrors({ ...errors, name: '' });
        }}
        placeholder="Masalan: Tish oqartirish (Zoom 4)"
        error={errors.name}
      />

      <Select
        label="Xizmat toifasi (Kategoriya)"
        required
        value={category}
        onValueChange={(val) => setCategory(val as ServiceCategory)}
        options={CATEGORIES}
      />

      <View style={styles.grid2}>
        <Input
          label="Narxi (UZS, butun so‘m)"
          required
          value={priceStr}
          onChangeText={(val) => {
            setPriceStr(val);
            setErrors({ ...errors, price: '' });
          }}
          placeholder="250 000"
          keyboardType="numeric"
          suffix="so‘m"
          error={errors.price}
        />

        <Input
          label="Davomiyligi"
          required
          value={durationStr}
          onChangeText={(val) => {
            setDurationStr(val);
            setErrors({ ...errors, duration: '' });
          }}
          placeholder="30"
          keyboardType="numeric"
          suffix="daqiqa"
          error={errors.duration}
        />
      </View>

      <Input
        label="Xizmat haqida qo‘shimcha ma’lumot"
        value={description}
        onChangeText={setDescription}
        placeholder="Muolaja jarayoni, ishlatiladigan materiallar..."
        multiline
        numberOfLines={3}
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
    gap: 16,
    flexWrap: 'wrap',
  },
});
