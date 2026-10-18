import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToGlobalChatNotifications } from '@/services/chatStorage.service';

export default function GlobalChatNotification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notification, setNotification] = useState(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef(null);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  useEffect(() => {
    const unsub = subscribeToGlobalChatNotifications((notif) => {
      if (!notif) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotification(notif);

      // Slide in from top
      translateY.setValue(-120);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 15,
        stiffness: 120,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after 5 seconds
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 5000);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [translateY]);

  if (!notification) return null;

  const handlePress = () => {
    const notif = notification;
    dismiss();

    if (notif.roomId) {
      router.push({
        pathname: 'voiceRoom',
        params: { roomId: String(notif.roomId) },
      });
    } else {
      router.push({
        pathname: '/(tabs)/chat',
        params: notif.senderId ? { friendId: notif.senderId } : undefined,
      });
    }
  };

  const isInvite = notification.type === 'jam_invite' || Boolean(notification.roomId);
  const isFriendReq = notification.type === 'friend_request';

  const iconName = isInvite ? 'music-circle' : isFriendReq ? 'account-plus' : 'message-text';
  const iconBg = isInvite ? '#E94057' : isFriendReq ? '#FF9800' : '#8A2387';

  const topOffset = Math.max(insets.top + (Platform.OS === 'android' ? 8 : 4), 36);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.toastCard}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Icon name={iconName} size={22} color="#FFFFFF" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title || (isInvite ? 'Party Room Invite 🎧' : 'New Message 💬')}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>

        <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={18} color="#CCCCCC" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999999,
    elevation: 999,
  },
  toastCard: {
    backgroundColor: 'rgba(26, 26, 36, 0.96)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  body: {
    color: '#B0B0C0',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
