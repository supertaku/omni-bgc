import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, palette } from './components';

export type AppDialogAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function AppDialog({
  visible,
  title,
  description,
  children,
  actions,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  actions: AppDialogAction[];
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          onPress={onDismiss}
        />
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.avoider}
          >
            <View accessibilityViewIsModal style={styles.dialog} accessibilityLabel={title}>
              <View style={styles.heading}>
                <Icon
                  name={actions.some((action) => action.destructive) ? 'warning' : 'info'}
                  size={24}
                />
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
              </View>
              {description ? <Text style={styles.description}>{description}</Text> : null}
              {children ? (
                <ScrollView
                  style={styles.body}
                  contentContainerStyle={styles.bodyContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
              ) : null}
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: action.disabled }}
                    disabled={action.disabled}
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.action,
                      action.destructive && styles.destructiveAction,
                      action.disabled && styles.disabled,
                      pressed && !action.disabled && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.actionText, action.destructive && styles.destructiveText]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(16, 36, 58, 0.48)',
  },
  safeArea: { flex: 1, justifyContent: 'center' },
  avoider: { maxHeight: '100%' },
  dialog: {
    maxHeight: '100%',
    padding: 20,
    gap: 12,
    borderRadius: 22,
    backgroundColor: palette.surface,
    elevation: 12,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: 'OmniHeading', fontSize: 20, lineHeight: 28, color: palette.ink },
  description: { fontFamily: 'OmniBody', fontSize: 15, lineHeight: 22, color: palette.muted },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  action: {
    minHeight: 48,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: palette.selected,
  },
  destructiveAction: { backgroundColor: palette.dangerBg },
  actionText: { fontFamily: 'OmniBodySemiBold', fontSize: 15, color: palette.blue },
  destructiveText: { color: palette.danger },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});
