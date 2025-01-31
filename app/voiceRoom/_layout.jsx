import React, { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { socket } from '@/configs/socket';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import ChatComponent from './chat';
import WebRTCClient from './webRTC';
const demoParticipants = [
    { id: 1, name: 'Alice', avatar: 'https://i.pravatar.cc/100?u=alice', isSpeaking: true },
    { id: 2, name: 'Bob', avatar: 'https://i.pravatar.cc/100?u=bob', isSpeaking: false },
    { id: 3, name: 'Charlie', avatar: 'https://i.pravatar.cc/100?u=charlie', isSpeaking: false },
    { id: 4, name: 'Daisy', avatar: 'https://i.pravatar.cc/100?u=daisy', isSpeaking: true },
    { id: 5, name: 'Eve', avatar: 'https://i.pravatar.cc/100?u=eve', isSpeaking: false },
    { id: 6, name: 'Frank', avatar: 'https://i.pravatar.cc/100?u=frank', isSpeaking: true },
    { id: 3, name: 'Charlie', avatar: 'https://i.pravatar.cc/100?u=charlie', isSpeaking: false },
    { id: 4, name: 'Daisy', avatar: 'https://i.pravatar.cc/100?u=daisy', isSpeaking: true },
    { id: 5, name: 'Eve', avatar: 'https://i.pravatar.cc/100?u=eve', isSpeaking: false },
    { id: 6, name: 'Frank', avatar: 'https://i.pravatar.cc/100?u=frank', isSpeaking: true },
  ];
  
const PartyRoom = ({ roomName="ankit", participants=demoParticipants, onToggleMic= () =>{} }) => {
  const [isMuted, setIsMuted] = useState(false);
  const router = useRouter();
  const [participantsList, setParticipantsList] = useState();
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const { roomId } = useLocalSearchParams();
  const peerConnectionRef = useRef(null);

  // Toggle mute/unmute
  const handleMicToggle = () => {
    setIsMuted(!isMuted);
    onToggleMic(!isMuted);
  };

  const onBackPress = () => {
    handleLeaveRoom();
    console.log('back pressed')
    return true;
  };

  const handleLeaveRoom = () =>{
    socket.emit('leave-room', {roomId: roomId});
    router.back();

  }
  
    useFocusEffect(
      useCallback(() => {
        const backHandler = BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );
  
        return () => backHandler.remove();
      }, [])
    );


  useEffect(() => {
    if (socket.connected) {
      onConnect();
    }
    
    function onConnect() {
      setIsConnected(true);
      console.log('connected');
      socket.emit('join-room', { roomId }, (response) => {
        console.log(response);
        if (response.success) {
          console.log('Successfully joined room:', roomId);
          setIsJoining(false); // Stop loading once joined
          setParticipantsList(response.roomParticipants); // Update participants list
        } else {
          console.error('Failed to join room:', response.message);
          setIsJoining(false); // Stop loading even if failed
        }
      });
    }

    function onDisconnect() {
      console.log('disconnected')
    }

    function onJoined(data){
      console.log(data.userId+" joined");
      setParticipantsList(data.roomParticipants);
      console.log(data.roomParticipants)
    }

    function onLeft(data){
      console.log(data.userId+" left");
      setParticipantsList(data.roomParticipants);
      console.log(data.roomParticipants)
    }

    function onError(error) {
      console.log(error.message);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('user-joined', onJoined);
    socket.on('user-left', onLeft);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  
  if(isJoining){
    return (
      <Text style={{color:'white'}}>Joining</Text>
    );
  }
  return (
    <View style={styles.container}>
      {/* Room Header */}
      <View style={styles.header}>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.participantCount}>
          {participantsList?.length} Participants
        </Text>
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
          <Icon name="exit-to-app" size={20} color="#fff" />
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* User Grid */}
      <FlatList
        data={participantsList}
        numColumns={3}
        keyExtractor={(item) => item.userId.toString()}
        contentContainerStyle={styles.gridContainer}
        renderItem={({ item }) => (
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: item.picture || 'https://plus.unsplash.com/premium_vector-1731922571927-ac1d331d87e3?q=80&w=2360&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
              style={[
                styles.avatar,
                item.isSpeaking && styles.speakingBorder,
              ]}
            />
            <Text style={styles.username}>{item.userName}</Text>
          </View>
        )}
      />
      {/* Chat */}
      <ChatComponent roomId={roomId}/>
      {/* Voice Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={handleMicToggle} style={styles.controlButton}>
          <Icon
            name={isMuted ? 'microphone-off' : 'microphone'}
            size={30}
            color={isMuted ? '#f44' : '#4caf50'}
          />
          <Text style={styles.controlText}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="hand-front-right" size={30} color="#ff9800" />
          <Text style={styles.controlText}>Raise Hand</Text>
        </TouchableOpacity>
      </View>
      <WebRTCClient roomId={roomId}/>
    </View>
  );
};

export default PartyRoom;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  participantCount: {
    fontSize: 14,
    color: '#aaa',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e53935',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  leaveText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#fff',
  },
  gridContainer: {
    paddingVertical: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#444',
  },
  speakingBorder: {
    borderColor: '#4caf50',
  },
  username: {
    marginTop: 8,
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlText: {
    marginTop: 8,
    fontSize: 14,
    color: '#fff',
  },
});
