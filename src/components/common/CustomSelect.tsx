import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
// @ts-ignore
import { createPortal } from 'react-dom';
import { colors } from '../../theme/colors';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  label?: string;
  value: string;
  onValueChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  containerStyle?: ViewStyle | any;
  size?: 'sm' | 'md';
  disabled?: boolean;
  id?: string;
  style?: any;
  fullWidth?: boolean;
  minWidth?: number | string;
}

export const CustomSelect: React.FC<SelectProps> = ({
  label,
  value,
  onValueChange,
  options = [],
  placeholder = 'Tanlang...',
  error,
  required,
  hint,
  containerStyle,
  size = 'md',
  disabled = false,
  id,
  style,
  fullWidth = true,
  minWidth,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Tanlangan variantni topish
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const selectedIndex = options.findIndex((opt) => String(opt.value) === String(value));

  // Menyu koordinatalarini o'lchash va yangilash
  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUpward = spaceBelow < 240 && spaceAbove > spaceBelow;

    setOpenUpward(shouldOpenUpward);
    setMenuRect({
      top: shouldOpenUpward ? undefined : rect.bottom + 4,
      bottom: shouldOpenUpward ? window.innerHeight - rect.top + 4 : undefined,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Tashqariga bosilganda menyuni yopish (Portal elementini ham hisobga oladi)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = containerRef.current && containerRef.current.contains(target);
      const inMenu = listRef.current && listRef.current.contains(target);

      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Menyu ochilganda koordinatalarni hisoblash va o'lcham/scroll o'zgarganda yangilab turish
  useEffect(() => {
    if (!isOpen) {
      setMenuRect(null);
      return;
    }

    updateMenuPosition();

    // Hozirgi tanlangan elementni highlight qilish
    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex);
    } else {
      setHighlightedIndex(0);
    }

    const handleScrollOrResize = () => {
      updateMenuPosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, selectedIndex, updateMenuPosition]);

  // Klaviaturada yuqoriga/pastga harakatlanganda ko'rinishga keltirish (scrollIntoView)
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const itemEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === 'function') {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Klaviaturadan boshqarish (Enter, Space, ArrowUp, ArrowDown, Escape, Tab)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      setIsOpen(false);
      e.preventDefault();
      return;
    }

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        const chosen = options[highlightedIndex];
        onValueChange(chosen.value);
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const handleSelect = (val: string) => {
    onValueChange(val);
    setIsOpen(false);
  };

  const isSmall = size === 'sm';
  const height = isSmall ? 34 : 42;
  const fontSize = isSmall ? 13 : 14;
  const borderRadius = isSmall ? 8 : 10;
  const paddingHorizontal = isSmall ? 10 : 12;

  // Webda to'liq custom premium dropdown
  if (Platform.OS === 'web') {
    return (
      <div
        ref={containerRef}
        id={id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: fullWidth ? '100%' : 'auto',
          minWidth: minWidth || (isSmall ? '130px' : 'auto'),
          position: 'relative',
          zIndex: isOpen ? 1050 : 'auto',
          marginBottom: label ? 14 : 0,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          ...style,
          ...(containerStyle as any),
        }}
      >
        {/* Scrollbar uslubi */}
        <style>{`
          .denta-select-dropdown-list::-webkit-scrollbar {
            width: 5px;
          }
          .denta-select-dropdown-list::-webkit-scrollbar-track {
            background: transparent;
          }
          .denta-select-dropdown-list::-webkit-scrollbar-thumb {
            background: #CBD5E1;
            border-radius: 10px;
          }
          .denta-select-dropdown-list::-webkit-scrollbar-thumb:hover {
            background: #94A3B8;
          }
        `}</style>

        {/* Sarlavha (Label) */}
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0F172A',
              marginBottom: '6px',
              userSelect: 'none',
            }}
          >
            {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
          </label>
        )}

        {/* Dropdown Tugmasi (Trigger Box) */}
        <div
          ref={triggerRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          style={{
            height: `${height}px`,
            width: '100%',
            backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
            border: `1px solid ${
              error
                ? '#EF4444'
                : isOpen || isFocused
                ? '#0D9488'
                : '#E2E8F0'
            }`,
            boxShadow:
              isOpen || isFocused
                ? error
                  ? '0 0 0 3px rgba(239, 68, 68, 0.15)'
                  : '0 0 0 3px rgba(13, 148, 136, 0.15)'
                : '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
            borderRadius: `${borderRadius}px`,
            paddingLeft: `${paddingHorizontal}px`,
            paddingRight: `${paddingHorizontal}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {/* Tanlangan matn yoki placeholder */}
          <span
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: selectedOption ? 500 : 400,
              color: selectedOption ? '#0F172A' : '#64748B',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          {/* O'ng tomondagi yumshoq buriluvchi Chevron icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isOpen || isFocused ? '#0D9488' : '#64748B',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s ease, color 0.15s ease',
              flexShrink: 0,
            }}
          >
            <svg
              width={isSmall ? 13 : 15}
              height={isSmall ? 13 : 15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Ochiluvchi Tanlov Ro'yxati (Dropdown Menu - createPortal orqali butun sahifa ustida ochiladi) */}
        {isOpen && (() => {
          const isPortal = Boolean(menuRect && typeof document !== 'undefined' && document.body);

          const dropdownElement = (
            <div
              ref={listRef}
              role="listbox"
              className="denta-select-dropdown-list"
              style={{
                position: isPortal ? 'fixed' : 'absolute',
                ...(isPortal
                  ? {
                      top: menuRect?.top !== undefined ? `${menuRect.top}px` : 'auto',
                      bottom: menuRect?.bottom !== undefined ? `${menuRect.bottom}px` : 'auto',
                      left: `${menuRect?.left ?? 0}px`,
                      width: `${menuRect?.width ?? 200}px`,
                    }
                  : {
                      top: openUpward ? 'auto' : `calc(100% + 4px)`,
                      bottom: openUpward ? `calc(100% + 4px)` : 'auto',
                      left: alignRight ? 'auto' : 0,
                      right: alignRight ? 0 : 'auto',
                      width: fullWidth ? '100%' : 'max-content',
                    }),
                minWidth: isPortal ? `${menuRect?.width ?? 180}px` : '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: isSmall ? '10px' : '12px',
                boxShadow:
                  '0 12px 30px -4px rgba(0, 0, 0, 0.18), 0 8px 14px -6px rgba(0, 0, 0, 0.08)',
                maxHeight: '240px',
                overflowY: 'auto',
                zIndex: 999999,
                padding: '4px',
                boxSizing: 'border-box',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                animation: 'fadeInScale 0.12s ease-out',
              }}
            >
              {options.length === 0 ? (
                <div
                  style={{
                    padding: '10px 12px',
                    fontSize: `${fontSize}px`,
                    color: '#94A3B8',
                    textAlign: 'center',
                  }}
                >
                  Variantlar mavjud emas
                </div>
              ) : (
                options.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={`${opt.value}-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(opt.value);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      style={{
                        padding: isSmall ? '7px 10px' : '9px 12px',
                        borderRadius: '8px',
                        fontSize: `${fontSize}px`,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? '#0D9488' : '#1E293B',
                        backgroundColor: isSelected
                          ? '#F0FDFA'
                          : isHighlighted
                          ? '#F8FAFC'
                          : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        userSelect: 'none',
                        transition: 'background-color 0.1s ease, color 0.1s ease',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {opt.label}
                      </span>

                      {/* Tanlangan nishon (Checkmark) */}
                      {isSelected && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0D9488',
                            flexShrink: 0,
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );

          if (isPortal) {
            return createPortal(dropdownElement, document.body);
          }
          return dropdownElement;
        })()}

        {/* Xatolik yoki eslatma matni */}
        {error ? (
          <span
            style={{
              color: '#DC2626',
              fontSize: '12px',
              marginTop: '4px',
              display: 'block',
            }}
          >
            {error}
          </span>
        ) : hint ? (
          <span
            style={{
              color: '#64748B',
              fontSize: '12px',
              marginTop: '4px',
              display: 'block',
            }}
          >
            {hint}
          </span>
        ) : null}
      </div>
    );
  }

  // Fallback (native)
  return null;
};
