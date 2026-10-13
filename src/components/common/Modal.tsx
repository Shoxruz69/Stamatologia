import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { CloseIcon } from './Icons';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: number;
  hideDivider?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  maxWidth = 580,
  hideDivider = false,
  children,
  footer,
}) => {
  if (!visible) return null;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.container, { maxWidth }]}>
          {/* Header */}
          <View
            style={[
              styles.header,
              hideDivider && styles.headerNoDivider,
            ]}
          >
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, hideDivider && styles.closeBtnClean]}
              // @ts-ignore
              accessibilityLabel="Yopish"
            >
              <CloseIcon size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={[
              styles.bodyContent,
              hideDivider && styles.bodyContentClean,
            ]}
            showsVerticalScrollIndicator={true}
          >
            {children}
          </ScrollView>

          {/* Footer */}
          {footer && (
            <View
              style={[
                styles.footer,
                hideDivider && styles.footerClean,
              ]}
            >
              {footer}
            </View>
          )}
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    maxHeight: '92%',
    overflow: 'hidden',
    zIndex: 1001,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerNoDivider: {
    borderBottomWidth: 0,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    // @ts-ignore
    cursor: 'pointer',
  },
  closeBtnClean: {
    backgroundColor: 'transparent',
    padding: 6,
  },
  body: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: 24,
  },
  bodyContentClean: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  footerClean: {
    borderTopWidth: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 8,
  },
});
