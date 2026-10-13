import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { formatUzbekPhoneNumber, extractDateOnly } from '../../utils/formatters';

interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  containerStyle?: ViewStyle;
}

interface InputProps extends FormFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
  secureTextEntry?: boolean;
  maxLength?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required = false,
  hint,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  containerStyle,
  prefix,
  suffix,
  secureTextEntry = false,
  maxLength,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.requiredMark}>*</Text>}
        </Text>
      </View>

      <View
        // @ts-ignore
        dataSet={{ inputContainer: 'true' }}
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
          !editable && styles.inputDisabled,
          multiline && { height: 24 * (numberOfLines || 3) + 16, alignItems: 'flex-start' },
        ]}
      >
        {prefix && <Text style={styles.affix}>{prefix}</Text>}

        <TextInput
          value={value}
          onChangeText={(text) => {
            if (keyboardType === 'phone-pad') {
              onChangeText(formatUzbekPhoneNumber(text));
            } else {
              onChangeText(text);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={Platform.OS === 'web' && keyboardType === 'numeric' ? 'default' : keyboardType}
          // @ts-ignore
          inputMode={keyboardType === 'numeric' ? 'numeric' : keyboardType === 'phone-pad' ? 'tel' : undefined}
          // @ts-ignore
          autoComplete={secureTextEntry ? 'new-password' : 'off'}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          // @ts-ignore
          dataSet={{ innerInput: 'true' }}
          underlineColorAndroid="transparent"
          style={[
            styles.input,
            multiline && styles.multilineInput,
            !editable && { color: colors.textSecondary },
            Platform.OS === 'web' && ({
              outlineStyle: 'none',
              outlineWidth: 0,
              outlineColor: 'transparent',
              borderWidth: 0,
              backgroundColor: 'transparent',
            } as any),
          ]}
        />

        {suffix && <Text style={styles.affix}>{suffix}</Text>}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
};

import { CustomSelect, SelectOption, SelectProps } from './CustomSelect';

export type { SelectOption, SelectProps };
export const Select = CustomSelect;

interface DateInputProps extends FormFieldProps {
  value: string;
  onChangeDate: (date: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChangeDate,
  error,
  required,
  hint,
  containerStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrapper, containerStyle]}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label} {required && <Text style={styles.requiredMark}>*</Text>}
          </Text>
        </View>

        {/* @ts-ignore */}
        <input
          type="date"
          value={extractDateOnly(value)}
          onChange={(e: any) => onChangeDate(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            height: 42,
            width: '100%',
            backgroundColor: '#FFFFFF',
            border: `1px solid ${error ? colors.danger : isFocused ? '#0D9488' : colors.border}`,
            boxShadow: isFocused
              ? error
                ? '0 0 0 3px rgba(239, 68, 68, 0.18)'
                : '0 0 0 3px rgba(13, 148, 136, 0.18)'
              : 'none',
            borderRadius: 8,
            paddingLeft: 12,
            paddingRight: 12,
            fontSize: 14,
            color: colors.text,
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
          }}
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeDate}
      placeholder="YYYY-MM-DD"
      error={error}
      required={required}
      hint={hint}
      containerStyle={containerStyle}
    />
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: 6,
    minHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  requiredMark: {
    color: colors.danger,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    minHeight: 42,
  },
  inputFocused: {
    borderColor: '#0D9488',
    // @ts-ignore
    boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.18)',
  },
  inputError: {
    borderColor: colors.danger,
    // @ts-ignore
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.18)',
  },
  inputDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
    // @ts-ignore
    outlineStyle: 'none',
    // @ts-ignore
    outlineWidth: 0,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  affix: {
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: 4,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
