import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { socket } from '@/configs/socket';
import { useSelector } from 'react-redux';
import { usePartyPresence, REACTIONS } from '@/hooks/partyPresence.hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE = Math.min(280, SCREEN_WIDTH * 0.66);

const formatTime = (ts) => {
  const d = new Date(ts || Date.now());
  const h = d.getHours();
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${((h % 12) || 12)}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

// Deliberately ASCII-only so we never depend on \p{...} property escapes
// (Hermes support varies) — a short token with no letters/digits is an emoji.
const isEmojiOnly = (s) => {
  const t = String(s || '').trim();
  if (!t || t.length > 12) return false;
  return !/[A-Za-z0-9]/.test(t);
};

// memo: every new party message re-rendered the whole history; rows are static.
const PartyRow = memo(function PartyRow({ item }) {
  const mine = !!item.userId && item.userId === socket.id;
  const name = item.userName || 'Guest';
  const initial = String(name).trim().charAt(0).toUpperCase() || '?';
  const isEmoji = isEmojiOnly(item.message);

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      ) : null}
      <View style={{ maxWidth: MAX_BUBBLE }}>
        {!mine ? <Text style={styles.senderText}>{name}</Text> : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text
            style={[
              styles.messageText,
              mine ? styles.messageMine : styles.messageTheirs,
              isEmoji && styles.emojiText,
            ]}
          >
            {item.message}
          </Text>
        </View>
        <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(item._ts)}</Text>
      </View>
    </View>
  );
});

/**
 * Party chat — reads the message buffer from redux (owned by PartyHost) so
 * history survives minimising the room, and is the default tab of the stage.
 *
 * The quick-reaction strip sends the emoji as a normal message (so it lands in
 * everyone's log) AND as a `party:reaction` (so it also bursts across the
 * screen for everyone).
 */
const ChatComponent = ({ roomId }) => {
  const messages = useSelector((s) => s.party.chat);
  const { react } = usePartyPresence();
  const [newMessage, setNewMessage] = useState('');
  const [warn, setWarn] = useState(null);
  const listRef = useRef(null);

  // Newest-first data + inverted list => always pinned to the latest message.
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const flash = (msg) => {
    setWarn(msg);
    setTimeout(() => setWarn((w) => (w === msg ? null : w)), 2600);
  };

  const send = (override) => {
    const text = (override !== undefined ? override : newMessage).trim();
    if (!text) return;
    setNewMessage('');
    if (!socket.connected) {
      flash('Reconnecting… your message was not sent.');
      return;
    }
    try {
      socket.emit('send-message', { roomId, message: text });
    } catch (e) {}
  };

  const sendReaction = (emoji) => {
    send(emoji);
    react(emoji);
  };

  useEffect(() => {
    if (messages.length <= 1) return;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch (e) {}
    });
  }, [messages.length]);

  const renderItem = useCallback(({ item }) => <PartyRow item={item} />, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          inverted
          data={reversed}
          style={styles.list}
          keyExtractor={(item, i) =>
            String(item?._id ?? item?.id ?? `${item?.userId}-${item?._ts}-${i}`)
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          windowSize={9}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          removeClippedSubviews
        />
        {reversed.length === 0 ? (
          <View style={styles.emptyWrap} pointerEvents="none">
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyText}>No messages yet — say hi and break the ice!</Text>
          </View>
        ) : null}
      </View>

      {/* footer: reactions fused flush onto the input */}
      <View style={styles.footer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.reactionScroll}
          contentContainerStyle={styles.reactionBar}
          keyboardShouldPersistTaps="handled"
        >
          {REACTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              style={styles.reactionBtn}
              onPress={() => sendReaction(e)}
              hitSlop={6}
            >
              <Text style={styles.reactionEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {warn ? <Text style={styles.warn}>{warn}</Text> : null}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Message the party…"
            placeholderTextColor="#6f6792"
            returnKeyType="send"
            onSubmitEditing={() => send()}
            maxLength={500}
            multiline
          />
          <TouchableOpacity
            onPress={() => send()}
            style={[styles.sendButton, !newMessage.trim() && styles.sendDisabled]}
            disabled={!newMessage.trim()}
            hitSlop={8}
          >
            <Ionicons name="send" size={17} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ChatComponent;

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  listWrap: { flex: 1, minHeight: 0 },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 0 },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 30,
  },
  emptyEmoji: { fontSize: 30, opacity: 0.85 },
  emptyText: { color: '#6f6792', fontSize: 12, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3d2b63',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    marginBottom: 14,
  },
  avatarText: { color: '#d1b3ff', fontSize: 11, fontWeight: '700' },
  senderText: { color: '#a99ce0', fontSize: 10, fontWeight: '700', marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: {
    backgroundColor: '#6200ee',
    borderBottomRightRadius: 4,
    shadowColor: '#6200ee',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bubbleTheirs: {
    backgroundColor: '#231b3a',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#302650',
  },
  messageText: { fontSize: 13.5, lineHeight: 18 },
  messageMine: { color: '#fff' },
  messageTheirs: { color: '#e8e3ff' },
  emojiText: { fontSize: 30, lineHeight: 36 },
  time: { fontSize: 9, color: '#6f6792', marginTop: 3, marginLeft: 4 },
  timeMine: { textAlign: 'right', marginRight: 4, marginLeft: 0 },

  footer: {
    backgroundColor: '#151022',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#271f3d',
    paddingBottom: 8,
  },
  reactionScroll: { flexGrow: 0, flexShrink: 0 },
  reactionBar: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 0, gap: 6, alignItems: 'center' },
  reactionBtn: {
    width: 36,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 18 },

  warn: {
    color: '#ffca28',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 2,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#231b3a',
    borderRadius: 20,
    fontSize: 13.5,
    color: '#fff',
    maxHeight: 96,
  },
  sendButton: {
    backgroundColor: '#6200ee',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.35 },
});
