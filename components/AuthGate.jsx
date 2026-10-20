import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch } from 'react-redux';
import { openModal } from '@/state/slices/modal.slice';
import ClerkSignIn from '@/components/ClerkSignIn';

/**
 * AuthGate — renders children only when signed in.
 * When logged out, shows a login prompt instead of the protected UI.
 * This prevents null-ref crashes in Party/Chat which assume a Clerk user + token.
 */
export default function AuthGate({
  isSignedIn,
  title = 'Sign in to continue 🔐',
  subtitle = 'This section needs your Beatify account to load your rooms, friends and vibes.',
  icon = 'account-lock',
  children,
}) {
  const theme = useTheme();
  const dispatch = useDispatch();

  if (isSignedIn) return <>{children}</>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.elevation.level2 }]}>
          <Icon name={icon} size={44} color={theme.colors.primary} />
        </View>
        <Text variant="headlineSmall" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Button
          mode="contained"
          icon="login"
          style={styles.loginBtn}
          contentStyle={{ height: 48 }}
          onPress={() => dispatch(openModal(<ClerkSignIn />))}
        >
          Sign In
        </Button>
        <TouchableOpacity
          style={styles.guestHint}
          activeOpacity={0.7}
          onPress={() => dispatch(openModal(<ClerkSignIn />))}
        >
          <Text style={[styles.guestHintText, { color: theme.colors.primary }]}>
            New here? Create a free account ✨
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  loginBtn: { width: '100%', borderRadius: 12 },
  guestHint: { marginTop: 14 },
  guestHintText: { fontSize: 13, fontWeight: '700' },
});
