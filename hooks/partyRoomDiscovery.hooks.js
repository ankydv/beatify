import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  getActiveRooms,
  getDiscoverRooms,
  getVibeMatches,
  createPartyRoom as apiCreateRoom,
} from '@/services/room.service';
import { socket, ensureSocketConnected } from '@/configs/socket';

export const usePartyRoomDiscovery = () => {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  const [activeRooms, setActiveRooms] = useState([]);
  const [discoverCategories, setDiscoverCategories] = useState([]);
  const [featuredRoom, setFeaturedRoom] = useState(null);
  const [vibeProfile, setVibeProfile] = useState(null);
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [selectedVibe, setSelectedVibe] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await getActiveRooms({
        vibe: selectedVibe === 'All' ? '' : selectedVibe,
        search: searchQuery,
      });
      if (res?.success && Array.isArray(res.rooms)) {
        setActiveRooms(res.rooms);
      }
    } catch (e) {
      console.warn('Failed to load active rooms:', e);
    }
  }, [selectedVibe, searchQuery]);

  const fetchDiscover = useCallback(async () => {
    try {
      const res = await getDiscoverRooms();
      if (res?.success) {
        setDiscoverCategories(res.categories || []);
        if (res.featured) setFeaturedRoom(res.featured);
      }
    } catch (e) {
      console.warn('Failed to load discover categories:', e);
    }
  }, []);

  const fetchVibeData = useCallback(async () => {
    try {
      let token = null;
      if (isSignedIn) {
        token = await getToken();
      }
      const res = await getVibeMatches(token);
      if (res?.success) {
        setVibeProfile(res.userVibe || null);
        setMatchedUsers(res.matchedUsers || []);
      }
    } catch (e) {
      console.warn('Failed to load vibe matches:', e);
    }
  }, [isSignedIn, getToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRooms(), fetchDiscover(), fetchVibeData()]);
    setLoading(false);
  }, [fetchRooms, fetchDiscover, fetchVibeData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRooms(), fetchDiscover(), fetchVibeData()]);
    setRefreshing(false);
  }, [fetchRooms, fetchDiscover, fetchVibeData]);

  useEffect(() => {
    loadAll();
  }, [selectedVibe, searchQuery]);

  // Hook socket for live updates
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureSocketConnected();
        if (!alive) return;

        socket.on('dj:state', () => {
          fetchRooms();
        });
        socket.on('user-joined', () => {
          fetchRooms();
        });
        socket.on('user-left', () => {
          fetchRooms();
        });
      } catch (e) {}
    })();

    return () => {
      alive = false;
      socket.off('dj:state');
      socket.off('user-joined');
      socket.off('user-left');
    };
  }, [fetchRooms]);

  const createRoom = async ({ title, vibe, tags, isPrivate, roomId }) => {
    let token = null;
    if (isSignedIn) {
      token = await getToken();
    }
    const res = await apiCreateRoom({
      title,
      vibe: vibe || selectedVibe !== 'All' ? selectedVibe : 'Chill',
      tags,
      isPrivate,
      roomId,
      token,
    });
    // Refresh rooms list
    fetchRooms();
    return res;
  };

  return {
    activeRooms,
    discoverCategories,
    featuredRoom,
    vibeProfile,
    matchedUsers,
    selectedVibe,
    setSelectedVibe,
    searchQuery,
    setSearchQuery,
    loading,
    refreshing,
    onRefresh,
    createRoom,
    currentUser: user,
  };
};
