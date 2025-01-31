import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Using Ionicons from Expo
import { socket } from "@/configs/socket"; // Import the pre-configured socket

const ChatComponent = ({ roomId }) => {
  const [messages, setMessages] = useState([]); // Stores chat messages
  const [newMessage, setNewMessage] = useState(""); // Stores the current message input
  const flatListRef = useRef(null); // Reference to the FlatList

  useEffect(() => {
    // Listen for incoming messages
    socket.on("receive-message", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);

      // Scroll to the bottom when a new message is received
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    });

    // Cleanup on unmount
    return () => {
      socket.off("receive-message"); // Remove the event listener
    };
  }, []);

  const sendMessage = () => {
    if (newMessage.trim()) {
      // Emit the message to the server
      socket.emit("send-message", { roomId, message: newMessage });

      // Clear the input field
      setNewMessage("");

      // Scroll to the bottom after sending a message
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Chat Header */}
      {/* <View style={styles.header}>
        <Text style={styles.headerText}>Chat Room: {roomId}</Text>
      </View> */}

      {/* Message List */}
      <FlatList
        ref={flatListRef} // Attach the ref to the FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageContainer}>
            <Text style={styles.senderText}>{item.user.userName}:</Text>
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        )}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} // Auto-scroll when content size changes
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })} // Auto-scroll when layout changes
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatComponent;

// Styles
const styles = StyleSheet.create({
  container: {
    // flex: 1,
    // backgroundColor: "#f5f5f5",
    maxHeight: 500
  },
  header: {
    padding: 16,
    backgroundColor: "#6200ee",
    alignItems: "center",
  },
  headerText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
  messageList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  senderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6200ee",
  },
  messageText: {
    fontSize: 16,
    color: "#333",
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    // backgroundColor: "#fff",
    // borderTopWidth: 1,
    // borderTopColor: "#ddd",
  },
  input: {
    flex: 1,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 24,
    marginRight: 8,
    fontSize: 16,
    color: "#333",
  },
  sendButton: {
    backgroundColor: "#6200ee",
    borderRadius: 24,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});