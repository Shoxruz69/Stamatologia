import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { Patient } from '../../types';
import { useApp } from '../../context/AppContext';
import { colors } from '../../theme/colors';
import { TelegramIcon, SendIcon, CheckIcon, FlaskIcon, AlertTriangleIcon } from '../common/Icons';
import {
  checkTelegramStatus,
  checkPatientTelegramConnection,
  sendTelegramToPatient,
  sendTestTelegramMessage,
  TelegramStatusResponse,
} from '../../services/smsService';

interface SmsTelegramModalProps {
  visible: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export const SmsTelegramModal: React.FC<SmsTelegramModalProps> = ({
  visible,
  onClose,
  patient,
}) => {
  const { showToast, settings, updatePatient } = useApp();

  // Tab: 'send' (Bemorga xabar yuborish) yoki 'test' (O'z akkauntimga test)
  const [activeTab, setActiveTab] = useState<'send' | 'test'>('send');

  const [template, setTemplate] = useState('appointment');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Telegram bot holati
  const [botStatus, setBotStatus] = useState<TelegramStatusResponse | null>(null);

  // Test yuborish state
  const [testChatId, setTestChatId] = useState('');
  const [testMessageText, setTestMessageText] = useState(
    'Assalomu alaykum! Bu DentaCare klinika tizimidan yuborilgan test xabarnomasi. Telegram bot integratsiyasi muvaffaqiyatli ishlamoqda!'
  );
  const [isSendingTest, setIsSendingTest] = useState(false);

  const botUsername = botStatus?.botUsername || 'DentaCare0_bot';
  const telegramDeepLink = patient
    ? `https://t.me/${botUsername}?start=patient_${patient.id}`
    : `https://t.me/${botUsername}`;

  // 1. Modal ochilganda bot holatini tekshirish
  useEffect(() => {
    if (visible) {
      checkTelegramStatus().then((st) => setBotStatus(st));
    }
  }, [visible]);

  // 2. AVTOMATIK ANIQLASH (Polling): Bemor botda Start bosishi bilan darhol bog'lash
  useEffect(() => {
    if (!visible || !patient || patient.telegramChatId) return;

    let isMounted = true;

    // Dastlabki bir marta tekshirish
    checkPatientTelegramConnection(patient.id).then((res) => {
      if (isMounted && res.connected && res.chatId) {
        updatePatient(patient.id, {
          telegramChatId: res.chatId,
          telegramUsername: res.username || undefined,
          telegramConnectedAt: new Date().toISOString(),
        });
        showToast('Telegram muvaffaqiyatli bog‘landi!', 'success');
      }
    });

    // Har 2 soniyada avtomatik tekshirish
    const intervalId = setInterval(async () => {
      try {
        const res = await checkPatientTelegramConnection(patient.id);
        if (isMounted && res.connected && res.chatId) {
          updatePatient(patient.id, {
            telegramChatId: res.chatId,
            telegramUsername: res.username || undefined,
            telegramConnectedAt: new Date().toISOString(),
          });
          showToast(
            `Telegram muvaffaqiyatli bog‘landi! (${res.username || res.chatId})`,
            'success',
            'Telegram ulangan'
          );
          clearInterval(intervalId);
        }
      } catch {
        // Fondagi tekshiruv xatosini yashiramiz
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [visible, patient?.id, patient?.telegramChatId, updatePatient, showToast]);

  // 3. Tayyor xabar andozalari
  useEffect(() => {
    if (patient) {
      if (template === 'appointment') {
        setMessageText(
          `Hurmatli ${patient.fullName}! Sizning ertaga soat 10:00 da DentaCare klinikasida shifokor qabulingiz bor. Manzil: ${settings.address || 'Amir Temur ko‘chasi, 45'}. Aloqa markazi: +998 88 732 55 15.`
        );
      } else if (template === 'debt') {
        setMessageText(
          `Hurmatli ${patient.fullName}! DentaCare klinikasidagi xizmatlar bo‘yicha qarzdorligingiz ${patient.debt} so‘mni tashkil etadi. Iltimos, o‘zingizga qulay vaqtda to‘lovni amalga oshirishingizni so‘raymiz. Aloqa markazi: +998 88 732 55 15.`
        );
      } else {
        setMessageText(
          `Hurmatli ${patient.fullName}! Oxirgi tish ko‘rigidan so‘ng 6 oy o‘tdi. Sog‘lom tabassum uchun rejaviy bepul diagnostika va tish tozalashga taklif etamiz. Aloqa markazi: +998 88 732 55 15.`
        );
      }
    }
  }, [patient, template, settings]);

  if (!patient) return null;

  // Havolani nusxalash
  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(telegramDeepLink);
      showToast('Telegram havolasi nusxalandi!', 'success');
    } else {
      showToast(telegramDeepLink, 'info');
    }
  };

  // Telegramda botni ochish
  const handleOpenTelegram = () => {
    Linking.openURL(telegramDeepLink).catch(() => {
      showToast('Telegram ilovasini ochib bo‘lmadi', 'error');
    });
  };

  // Test xabar yuborish
  const handleSendTest = async () => {
    if (!testChatId.trim()) {
      showToast('Iltimos, o‘z Telegram Chat ID raqamingizni kiriting!', 'error');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await sendTestTelegramMessage(testChatId.trim(), testMessageText.trim());
      if (res.success) {
        showToast(
          'Test xabari Telegramingizga muvaffaqiyatli yuborildi!',
          'success',
          'Test muvaffaqiyatli'
        );
      } else {
        showToast(res.message || 'Test xabari yuborilmadi', 'error', 'Xatolik');
      }
    } catch (err: any) {
      showToast(`Xatolik: ${err.message}`, 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Test Chat ID ni bemorga biriktirish
  const handleLinkTestIdToPatient = async () => {
    if (!testChatId.trim()) {
      showToast('Avval Chat ID raqamini kiriting!', 'error');
      return;
    }
    const cleanId = testChatId.trim();
    updatePatient(patient.id, {
      telegramChatId: cleanId,
      telegramUsername: '@TestAdmin',
      telegramConnectedAt: new Date().toISOString(),
    });
    showToast(
      `Ushbu Chat ID (${cleanId}) "${patient.fullName}" profiliga bog‘landi!`,
      'success'
    );
    setActiveTab('send');
  };

  // Bemorga qabul xabarini yuborish
  const handleSend = async () => {
    if (!patient.telegramChatId) {
      showToast(
        'Telegram ulanmagan! Iltimos, bemor botda Start tugmasini bossin.',
        'info',
        'Telegram ulanmagan'
      );
      return;
    }

    if (!messageText.trim()) {
      showToast('Iltimos, xabar matnini kiriting!', 'error');
      return;
    }

    setIsSending(true);
    try {
      const result = await sendTelegramToPatient(patient.telegramChatId, messageText.trim());
      if (result.success) {
        showToast(
          `Xabar ${patient.fullName} ning Telegramiga muvaffaqiyatli yuborildi!`,
          'success',
          'Xabar yuborildi'
        );
        onClose();
      } else {
        showToast(
          result.message || 'Telegram orqali xabar yetkazilmadi.',
          'error',
          'Yuborilmadi'
        );
      }
    } catch (err: any) {
      showToast(`Xatolik: ${err.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Telegram Xabarnoma Yuborish"
      subtitle="Bemorga qabul vaqti va klinika eslatmalari"
      maxWidth={560}
      footer={
        <View style={styles.footerRow}>
          <Button title="Yopish" variant="outline" onPress={onClose} />
          {activeTab === 'send' && (
            <Button
              title={
                patient.telegramChatId
                  ? 'Telegram orqali yuborish'
                  : 'Telegram ulanmagan'
              }
              variant={patient.telegramChatId ? 'primary' : 'outline'}
              disabled={!patient.telegramChatId}
              loading={isSending}
              icon={<SendIcon size={16} color={patient.telegramChatId ? '#FFF' : '#94A3B8'} />}
              onPress={handleSend}
            />
          )}
        </View>
      }
    >
      {/* Tab almashtirish: Bemorga xabar yoki Test */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'send' && styles.tabBtnActive]}
          onPress={() => setActiveTab('send')}
          activeOpacity={0.7}
        >
          <TelegramIcon size={16} color={activeTab === 'send' ? '#0D9488' : '#64748B'} />
          <Text style={[styles.tabBtnText, activeTab === 'send' && styles.tabBtnTextActive]}>
            Bemorga xabar yuborish
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'test' && styles.tabBtnActive]}
          onPress={() => setActiveTab('test')}
          activeOpacity={0.7}
        >
          <FlaskIcon size={16} color={activeTab === 'test' ? colors.primary : '#64748B'} />
          <Text style={[styles.tabBtnText, activeTab === 'test' && styles.tabBtnTextActive]}>
            O‘z akkauntingizga test yuborish
          </Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* 1-TAB: BEMORGA XABAR YUBORISH                            */}
      {/* ======================================================== */}
      {activeTab === 'send' && (
        <>
          {/* TELEGRAM HOLATI: ULANGAN YOKI ULANMAGAN */}
          {patient.telegramChatId ? (
            <View style={styles.connectedCard}>
              <View style={styles.connectedBadge}>
                <CheckIcon size={14} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectedTitle}>
                  Telegram ulangan:{' '}
                  <Text style={{ fontWeight: '800' }}>
                    {patient.telegramUsername || `ID: ${patient.telegramChatId}`}
                  </Text>
                </Text>
                <Text style={styles.connectedSub}>
                  Xabarlar to‘g‘ridan-to‘g‘ri bemorning Telegramiga yetkaziladi.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.unconnectedContainer}>
              <View style={styles.unconnectedHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangleIcon size={18} color="#D97706" />
                  <Text style={styles.unconnectedTitle}>Telegram ulanmagan</Text>
                </View>
                <Text style={styles.unconnectedSub}>
                  Qabul eslatmalarini yuborish uchun bemor botda <Text style={{ fontWeight: '700' }}>Start</Text> tugmasini bosishi kerak.
                </Text>
              </View>

              {/* SODDALASHTIRILGAN ULASH: Faqat Botni ochish tugmasi va Havola nusxalash */}
              <View style={styles.quickConnectBox}>
                <TouchableOpacity
                  style={styles.openBotPrimaryBtn}
                  onPress={handleOpenTelegram}
                  activeOpacity={0.8}
                >
                  <TelegramIcon size={20} color="#FFFFFF" />
                  <Text style={styles.openBotPrimaryText}>Botni Telegramda ochish</Text>
                </TouchableOpacity>

                <View style={styles.linkRow}>
                  <Text style={styles.linkText} numberOfLines={1}>
                    {telegramDeepLink}
                  </Text>
                  <TouchableOpacity style={styles.miniCopyBtn} onPress={handleCopyLink}>
                    <Text style={styles.miniCopyBtnText}>Havolani nusxalash</Text>
                  </TouchableOpacity>
                </View>

                {/* Avtomatik aniqlash bildirishnomasi */}
                <View style={styles.autoDetectNotice}>
                  <Text style={styles.autoDetectDot}>●</Text>
                  <Text style={styles.autoDetectText}>
                    Bemor Start bosishi bilan tizim avtomatik aniqlaydi va ulaydi...
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Bemor ma'lumotlari */}
          <View style={styles.grid2}>
            <Input
              label="Bemor"
              value={patient.fullName}
              onChangeText={() => {}}
              editable={false}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Telefon"
              value={patient.phone}
              onChangeText={() => {}}
              editable={false}
              containerStyle={{ flex: 1 }}
            />
          </View>

          <Select
            label="Xabar andozasi"
            value={template}
            onValueChange={setTemplate}
            options={[
              { label: 'Qabul vaqti eslatmasi', value: 'appointment' },
              { label: 'Qarzdorlik eslatmasi', value: 'debt' },
              { label: 'Rejaviy ko‘rikka taklif (Profilaktika)', value: 'checkup' },
            ]}
          />

          <Input
            label="Xabar matni"
            required
            value={messageText}
            onChangeText={setMessageText}
            multiline
            numberOfLines={4}
          />
        </>
      )}

      {/* ======================================================== */}
      {/* 2-TAB: O'Z AKKAUNTINGIZGA TEST YUBORISH                   */}
      {/* ======================================================== */}
      {activeTab === 'test' && (
        <View style={styles.testSection}>
          <View style={styles.testHeaderBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FlaskIcon size={18} color="#0284C7" />
              <Text style={styles.testHeaderTitle}>O‘z Telegramingizga Test Xabar Yuborish</Text>
            </View>
            <Text style={styles.testHeaderSub}>
              Telegram bot ishlayotganini tekshirish uchun o‘z Telegram Chat ID raqamingizga test xabar yuborishingiz mumkin.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.openBotSecondaryBtn}
            onPress={() => Linking.openURL(`https://t.me/${botUsername}`)}
            activeOpacity={0.8}
          >
            <TelegramIcon size={18} color="#0284C7" />
            <Text style={styles.openBotSecondaryText}>Telegramda @{botUsername} ni ochish →</Text>
          </TouchableOpacity>

          <Input
            label="Sizning Telegram Chat ID raqamingiz"
            required
            placeholder="Masalan: 123456789"
            value={testChatId}
            onChangeText={setTestChatId}
            hint="Botda Start bosganingizdan keyin Chat ID ni bu yerga kiriting"
          />

          <Input
            label="Test xabar matni"
            value={testMessageText}
            onChangeText={setTestMessageText}
            multiline
            numberOfLines={3}
          />

          <View style={styles.testActionsRow}>
            <Button
              title="Test Xabar Yuborish"
              icon={<SendIcon size={16} color="#FFFFFF" />}
              variant="primary"
              loading={isSendingTest}
              onPress={handleSendTest}
            />

            <Button
              title={`Ushbu ID ni "${patient.fullName}" ga biriktirish`}
              variant="outline"
              onPress={handleLinkTestIdToPatient}
            />
          </View>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  tabBtnActive: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  tabIcon: {
    fontSize: 14,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0D9488',
    fontWeight: '700',
  },

  // Telegram Ulangan Card
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    marginBottom: 16,
  },
  connectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  connectedSub: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
  },

  // Telegram Ulanmagan Container
  unconnectedContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 16,
  },
  unconnectedHeader: {
    marginBottom: 12,
  },
  unconnectedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B45309',
  },
  unconnectedSub: {
    fontSize: 13,
    color: '#92400E',
    marginTop: 4,
    lineHeight: 18,
  },

  // Soddalashtirilgan Ulash Box
  quickConnectBox: {
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  openBotPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  openBotPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: '#0284C7',
    fontFamily: 'monospace',
  },
  miniCopyBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  miniCopyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  autoDetectNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  autoDetectDot: {
    fontSize: 10,
    color: '#16A34A',
  },
  autoDetectText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500',
  },

  grid2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },

  // Test Bo'limi
  testSection: {
    gap: 14,
  },
  testHeaderBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  testHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  testHeaderSub: {
    fontSize: 12,
    color: '#0284C7',
    marginTop: 4,
    lineHeight: 18,
  },
  openBotSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  openBotSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  testActionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 8,
  },
});
