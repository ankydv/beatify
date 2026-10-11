import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { socket } from "@/configs/socket";
import { useUser } from "@clerk/clerk-expo";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE = Math.min(340, SCREEN_WIDTH * 0.8);

const ChatComponent = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef(null);
  const { user } = useUser();
  const myUserId = user?.id;

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      try {
        flatListRef.current?.scrollToEnd({ animated });
      } catch (e) {}
    });
  }, []);

  useEffect(() => {
    const onMessage = (message) => {
      if (!message) return;
      const now = Date.now();
      setMessages((prevMessages) => {
        if (prevMessages.length > 0) {
          const last = prevMessages[prevMessages.length - 1];
          const incomingId = message?._id ?? message?.id;
          const lastId = last?._id ?? last?.id;
          // 1) Same server id arriving twice (reconnect / re-subscribe).
          if (
            incomingId != null && lastId != null &&
            String(incomingId) === String(lastId)
          ) {
            return prevMessages;
          }
          // 2) Same sender + same text within 3s — covers server echo
          // arriving without a stable id, or double-fired events.
          // (Only checks the tail so legit repeats minutes apart still show.)
          const lastUser = last?.userId ?? last?.senderId ?? last?.sender?.id ?? last?.userName;
          const inUser = message?.userId ?? message?.senderId ?? message?.sender?.id ?? message?.userName;
          const sameUser = lastUser != null && inUser != null && String(lastUser) === String(inUser);
          const sameText = last?.message === message?.message && message?.message;
          const recent = last?._ts != null && now - last._ts < 3000;
          if (sameUser && sameText && recent) {
            return prevMessages;
          }
        }
        return [...prevMessages, { ...message, _ts: now }];
      });
    };
    socket.on("receive-message", onMessage);
    return () => {
      socket.off("receive-message", onMessage);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;
    // Clear FIRST so a double-tap / double-submit can't emit twice
    // (TextInput onSubmitEditing + button onPress can both fire).
    setNewMessage("");
    if (!socket.connected) {
      setMessages((prev) => [...prev, { userName: 'System', message: 'Reconnecting… your message was kept as draft.', _sys: true, _ts: Date.now() }]);
      return;
    }
    // No optimistic append: the server echoes 'receive-message' back to
    // the sender too, so appending here + appending on echo = duplicate
    // on our own screen (others only get the single echo, so they look fine).
    // Single source of truth = server echo.
    try {
      socket.emit("send-message", { roomId, message: text });
    } catch (e) {}
  };

  const renderItem = useCallback(({ item }) => {
    if (item?._sys) {
      return (
        <View style={styles.sysRow}>
          <Text style={styles.sysText}>{item.message}</Text>
        </View>
      );
    }
    // Robust own-message detection: server field name may vary
    // (userId / senderId / id) — also handles legacy optimistic
    // messages and falls back to userName match.
    const itemUserId = item?.userId ?? item?.senderId ?? item?.sender?.id ?? item?.id;
    const myName = user?.username ?? user?.fullName ?? user?.firstName;
    const mine =
      (!!myUserId && !!itemUserId && String(itemUserId) === String(myUserId)) ||
      (!!item?._mine) ||
      (!!myName && !!item?.userName && String(item.userName) === String(myName));
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        {!mine ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(item?.userName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={mine ? styles.senderMine : styles.senderText} numberOfLines={1}>
            {mine ? 'You' : item?.userName ?? 'Unknown'}
          </Text>
          <Text style={[styles.messageText, mine ? styles.messageMine : styles.messageTheirs]}>{item.message}</Text>
        </View>
      </View>
    );
  }, [myUserId, user]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => (item?._id ?? item?.id ?? index).toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.messageList, messages.length === 0 && styles.messageListEmpty]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollToBottom(false)}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages yet — say hi!</Text>
        }
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#777"
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          maxLength={500}
          multiline
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={[styles.sendButton, !newMessage.trim() && styles.sendDisabled]}
          disabled={!newMessage.trim()}
          hitSlop={8}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // FIX: fixed height (not min/max) so the box never grows/shifts
  // when messages arrive — new messages scroll *inside* instead.
  container: {
    height: 400,
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  list: { flex: 1 },
  messageList: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  messageListEmpty: { flexGrow: 1, justifyContent: "center" },
  emptyText: { textAlign: "center", color: "#666", fontSize: 12, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "flex-end", marginVertical: 1 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#3d2b63", justifyContent: "center", alignItems: "center",
    marginRight: 6,
  },
  avatarText: { color: "#d1b3ff", fontSize: 11, fontWeight: "700" },
  bubble: { maxWidth: MAX_BUBBLE, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  // OWN: vivid purple, right, sharp bottom-right corner, white text
  bubbleMine: { backgroundColor: "#6200ee", borderBottomRightRadius: 4, marginLeft: 48, borderWidth: 0 },
  // OTHER: dark grey w/ border, left, sharp bottom-left corner, light text
  bubbleTheirs: {
    backgroundColor: "#2c2c2c", borderBottomLeftRadius: 4, marginRight: 48,
    borderWidth: 1, borderColor: "#3a3a3a",
  },
  senderText: { fontSize: 11, fontWeight: "700", color: "#bb86fc", marginBottom: 2 },
  senderMine: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.7)", marginBottom: 2, textAlign: "right" },
  messageText: { fontSize: 13, lineHeight: 17 },
  messageMine: { color: "#fff" },
  messageTheirs: { color: "#eee" },
  sysRow: { alignItems: "center", paddingVertical: 2 },
  sysText: { fontSize: 11, color: "#888", fontStyle: "italic" },
  inputContainer: {
    flexDirection: "row", alignItems: "flex-end", padding: 8, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#333",
    backgroundColor: "#1a1a1a",
  },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#2c2c2c", borderRadius: 18,
    fontSize: 13, color: "#fff", maxHeight: 90,
  },
  sendButton: {
    backgroundColor: "#6200ee", width: 36, height: 36,
    borderRadius: 18, justifyContent: "center", alignItems: "center",
  },
  sendDisabled: { opacity: 0.4 },
});
export default ChatComponent;
