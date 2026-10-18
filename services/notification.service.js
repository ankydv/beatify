import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { socket } from '@/configs/socket';
import { registerFcmTokenApi } from '@/services/friend.service';
import {
  saveMessageLocally,
  getActiveChatId,
  emitGlobalChatNotification,
} from '@/services/chatStorage.service';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-CHAT-NOTIFICATION-TASK';

// Configure foreground notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Define background notification task to wake the service upon background FCM push
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    console.warn('[TaskManager] Background notification task error:', error);
    return;
  }

  try {
    const rawData = data?.notification?.data || data?.data;
    if (!rawData) return;

    let payload = rawData;
    if (typeof rawData.payload === 'string') {
      try {
        payload = JSON.parse(rawData.payload);
      } catch (e) {}
    }

    const senderId = payload.senderId || rawData.senderId;
    if (!senderId) return;

    const activeId = getActiveChatId();
    const isChatOpen = activeId === String(senderId);

    // Save message locally to device storage
    const msgUuid = payload.uuid || payload.messageUuid || payload._id || rawData.messageUuid;
    await saveMessageLocally(
      senderId,
      {
        uuid: msgUuid,
        _id: msgUuid,
        senderId,
        senderName: payload.senderName || rawData.senderName,
        recipientId: payload.recipientId || rawData.recipientId,
        message: payload.message || rawData.message,
        type: payload.type || payload.msgType || rawData.msgType || 'text',
        roomId: payload.roomId || rawData.roomId || null,
        roomTitle: payload.roomTitle || rawData.roomTitle || null,
        createdAt: payload.createdAt || rawData.createdAt || new Date().toISOString(),
        read: isChatOpen,
      },
      false
    );

    console.log('[TaskManager] Background message processed & stored locally:', msgUuid);
  } catch (err) {
    console.warn('[TaskManager] Error processing background notification payload:', err);
  }
});

/**
 * Register device for push notifications (FCM & background task)
 */
export async function registerPushNotifications(token = null) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat_messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E94057',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Push notification permission not granted');
      return null;
    }

    // Register background task with expo-notifications
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
      if (!isRegistered) {
        await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
        console.log('[Notifications] Registered background task:', BACKGROUND_NOTIFICATION_TASK);
      }
    } catch (taskErr) {
      console.warn('[Notifications] Background task registration warning:', taskErr?.message || taskErr);
    }

    // Retrieve FCM native device push token on Android
    let pushToken = null;
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      pushToken = deviceToken?.data;
    } catch (e) {
      try {
        const expoToken = await Notifications.getExpoPushTokenAsync();
        pushToken = expoToken?.data;
      } catch (err) {}
    }

    if (pushToken) {
      console.log('[Notifications] Push token retrieved:', pushToken);
      // Register with backend via socket
      socket.emit('fcm:register', { fcmToken: pushToken });

      // Register with backend via REST
      if (token) {
        try {
          await registerFcmTokenApi({ fcmToken: pushToken, token });
        } catch (apiErr) {}
      }
    }

    return pushToken;
  } catch (err) {
    console.warn('[Notifications] registerPushNotifications error:', err?.message || err);
    return null;
  }
}
