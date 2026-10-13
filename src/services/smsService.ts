export interface SmsStatusResponse {
  configured: boolean;
  provider: string;
  from?: string;
  email?: string | null;
  serverOnline: boolean;
  message: string;
}

export interface SmsSendResult {
  success: boolean;
  code?: string;
  message: string;
  id?: string;
  phone?: string;
}

export interface TelegramStatusResponse {
  configured: boolean;
  botUsername: string;
  botName: string;
  serverOnline: boolean;
  message: string;
}

export interface TelegramConnectionCheck {
  connected: boolean;
  chatId?: string;
  username?: string | null;
  firstName?: string;
  message?: string;
}

import { getApiBaseUrl } from './apiClient';

/**
 * SMS Provayder ulanish holatini tekshirish
 */
export const checkSmsStatus = async (): Promise<SmsStatusResponse> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${getApiBaseUrl()}/api/sms/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        configured: Boolean(data.configured),
        provider: data.provider || 'Eskiz.uz',
        from: data.from,
        email: data.email,
        serverOnline: true,
        message: data.message || (data.configured ? 'Sozlangan' : 'SMS xizmati ulanmagan'),
      };
    }
  } catch (err: any) {
    // Server offline
  }

  return {
    configured: false,
    provider: 'Eskiz.uz',
    serverOnline: false,
    message: 'SMS xizmati ulanmagan (API serverga ulanib bo‘lmadi)',
  };
};

/**
 * Haqiqiy SMS yuborish
 */
export const sendRealSms = async (
  phone: string,
  message: string
): Promise<SmsSendResult> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${getApiBaseUrl()}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ phone, message }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      return {
        success: true,
        id: data.id,
        phone: data.phone,
        message: data.message || 'SMS provayder orqali muvaffaqiyatli yuborildi',
      };
    }

    return {
      success: false,
      code: data.code || 'PROVIDER_ERROR',
      message: data.message || 'SMS yuborishda xatolik yuz berdi',
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'SERVER_OFFLINE',
      message:
        'SMS xizmati ulanmagan: Backend serverga ulanib bo‘lmadi. Iltimos, "run-server.cmd" ni ishga tushiring yoki server sozlamalarini tekshiring.',
    };
  }
};

/**
 * Telegram Bot holatini tekshirish
 */
export const checkTelegramStatus = async (): Promise<TelegramStatusResponse> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${getApiBaseUrl()}/api/telegram/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        configured: Boolean(data.ok),
        botUsername: data.username || 'DentaCare0_bot',
        botName: data.firstName || 'DentaCare',
        serverOnline: true,
        message: data.ok ? 'Telegram bot ulangan va faol' : 'Telegram bot ulanmagan',
      };
    }
  } catch (err) {
    // server offline
  }

  return {
    configured: false,
    botUsername: 'DentaCare0_bot',
    botName: 'DentaCare',
    serverOnline: false,
    message: `Telegram API serverga ulanib bo‘lmadi (${getApiBaseUrl() || 'server'})`,
  };
};

/**
 * Bemorning Telegram bog'langanligini tekshirish (Start bosilganini tekshirish)
 */
export const checkPatientTelegramConnection = async (
  patientId: string
): Promise<TelegramConnectionCheck> => {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/telegram/check-connection?patientId=${encodeURIComponent(patientId)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );

    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    //
  }

  return { connected: false, message: 'Serverga ulanib bo‘lmadi' };
};

/**
 * Chat ID ni bemorga qo'lda biriktirish
 */
export const bindPatientTelegram = async (
  patientId: string,
  chatId: string,
  username?: string
): Promise<{ success: boolean }> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/telegram/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, chatId, username }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    //
  }
  return { success: false };
};

/**
 * Bemorning Telegram akkauntiga xabar yuborish
 */
export const sendTelegramToPatient = async (
  chatId: string,
  message: string
): Promise<SmsSendResult> => {
  if (!chatId) {
    return {
      success: false,
      code: 'NO_CHAT_ID',
      message: 'Telegram ulanmagan: Bemorning Telegram Chat ID raqami mavjud emas.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${getApiBaseUrl()}/api/telegram/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ chatId, message }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      return {
        success: true,
        id: String(data.messageId || ''),
        message: data.message || 'Xabar Telegram orqali muvaffaqiyatli yuborildi',
      };
    }

    return {
      success: false,
      code: data.code || 'TELEGRAM_ERROR',
      message: data.message || 'Telegram orqali xabar yuborilmadi',
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'SERVER_OFFLINE',
      message: `Telegram serveriga ulanib bo‘lmadi (${getApiBaseUrl() || 'server'})`,
    };
  }
};

/**
 * O'z Telegramingizga test xabar yuborish
 */
export const sendTestTelegramMessage = async (
  chatId: string,
  customText?: string
): Promise<SmsSendResult> => {
  if (!chatId || !chatId.trim()) {
    return {
      success: false,
      code: 'EMPTY_CHAT_ID',
      message: 'Iltimos, o‘z Telegram Chat ID raqamingizni kiriting!',
    };
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/telegram/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: chatId.trim(), message: customText }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      return {
        success: true,
        message: 'Test xabari Telegramingizga muvaffaqiyatli yetib bordi!',
      };
    }

    return {
      success: false,
      code: data.code || 'TELEGRAM_ERROR',
      message: data.message || 'Test xabari yuborilmadi',
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'SERVER_OFFLINE',
      message: 'Telegram API serveriga ulanib bo‘lmadi',
    };
  }
};
