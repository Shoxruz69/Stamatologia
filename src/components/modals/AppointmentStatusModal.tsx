import React, { useEffect } from 'react';
// @ts-ignore
import { createPortal } from 'react-dom';
import { Appointment, AppointmentStatus } from '../../types';

interface AppointmentStatusModalProps {
  visible: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onUpdateStatus: (appointmentId: string, newStatus: AppointmentStatus) => void;
}

export const AppointmentStatusModal: React.FC<AppointmentStatusModalProps> = ({
  visible,
  onClose,
  appointment,
  onUpdateStatus,
}) => {
  // Modal ochiq paytda fon sahifasi scroll bo'lmasligi va yopilganda avvalgi holatga qaytishi
  useEffect(() => {
    if (!visible || !appointment) return;

    if (typeof document !== 'undefined' && document.body) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [visible, appointment]);

  if (!visible || !appointment) return null;

  const currentStatus = appointment.status;

  const getStatusBadgeColors = (st: AppointmentStatus) => {
    switch (st) {
      case 'Keldi':
      case 'Jarayonda':
        return { bg: '#DCFCE7', text: '#059669', border: '#A7F3D0' };
      case 'Tasdiqlangan':
        return { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' };
      case 'Yakunlandi':
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      case 'Bekor qilindi':
      case 'Bekor qilish':
        return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const currentBadge = getStatusBadgeColors(currentStatus);

  const handleSelectStatus = (newStatus: AppointmentStatus) => {
    onUpdateStatus(appointment.id, newStatus);
    onClose();
  };

  const isYakunlandi = currentStatus === 'Yakunlandi';
  const isJarayonda = currentStatus === 'Jarayonda';
  const isBekorQilish = currentStatus === 'Bekor qilish' || currentStatus === 'Bekor qilindi';

  const modalElement = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '460px',
          padding: '28px 24px 22px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          animation: 'fadeInScale 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sarlavha */}
        <h3
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
          }}
        >
          Statusni almashtirish
        </h3>
        <p
          style={{
            margin: '4px 0 16px 0',
            fontSize: '13px',
            color: '#64748B',
          }}
        >
          Qabul holatini tanlang
        </p>

        {/* Hozirgi status bloki */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            Hozirgi status:
          </span>
          <span
            style={{
              backgroundColor: currentBadge.bg,
              color: currentBadge.text,
              border: `1px solid ${currentBadge.border}`,
              fontSize: '12px',
              fontWeight: 700,
              padding: '3px 12px',
              borderRadius: '9999px',
            }}
          >
            {currentStatus}
          </span>
        </div>

        {/* 3 ta Status tanlovi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 1. Yakunlandi */}
          <button
            type="button"
            onClick={() => handleSelectStatus('Yakunlandi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: isYakunlandi ? '#F0FDF4' : '#FFFFFF',
              border: isYakunlandi ? '2px solid #0D9488' : '1px solid #E2E8F0',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            {/* Radio icon */}
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: isYakunlandi ? '2px solid #0D9488' : '2px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '14px',
                flexShrink: 0,
                backgroundColor: '#FFFFFF',
              }}
            >
              {isYakunlandi && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#0D9488',
                  }}
                />
              )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Yakunlandi
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                Bemor qabuli tugadi
              </div>
            </div>
          </button>

          {/* 2. Jarayonda */}
          <button
            type="button"
            onClick={() => handleSelectStatus('Jarayonda')}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: isJarayonda ? '#F0FDFA' : '#FFFFFF',
              border: isJarayonda ? '2px solid #0D9488' : '1px solid #E2E8F0',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            {/* Radio icon */}
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: isJarayonda ? '2px solid #0D9488' : '2px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '14px',
                flexShrink: 0,
                backgroundColor: '#FFFFFF',
              }}
            >
              {isJarayonda && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#0D9488',
                  }}
                />
              )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Jarayonda
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                Bemor hozir qabulda
              </div>
            </div>
          </button>

          {/* 3. Bekor qilish */}
          <button
            type="button"
            onClick={() => handleSelectStatus('Bekor qilish')}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: '#FEF2F2',
              border: isBekorQilish ? '2px solid #DC2626' : '1px solid #FECACA',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            {/* Radio icon */}
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: isBekorQilish ? '2px solid #DC2626' : '2px solid #F87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '14px',
                flexShrink: 0,
                backgroundColor: '#FFFFFF',
              }}
            >
              {isBekorQilish && (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#DC2626',
                  }}
                />
              )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626' }}>
                Bekor qilish
              </div>
              <div style={{ fontSize: '12px', color: '#991B1B', marginTop: '2px' }}>
                Qabul bekor qilinadi
              </div>
            </div>
          </button>
        </div>

        {/* Izoh matni va Yopish tugmasi */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '20px',
            paddingTop: '8px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
            Uchta status tanlovidan birini bosing.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
};
