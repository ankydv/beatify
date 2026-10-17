import { useState, useEffect, useCallback, useRef } from 'react';
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
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

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
      const token = isSignedIn && getTokenRef.current ? await getTokenRef.current() : null;
      const res = await getActiveRooms({
        vibe: selectedVibe === 'All' ? '' : selectedVibe,
        search: searchQuery,
        token,
      });
      if (res?.success && Array.isArray(res.rooms)) {
        setActiveRooms(res.rooms);
      }
    } catch (e) {
      console.warn('Failed to load active rooms:', e);
    }
  }, [selectedVibe, searchQuery, isSignedIn]);

  const fetchDiscover = useCallback(async () => {
    try {
      const token = isSignedIn && getTokenRef.current ? await getTokenRef.current() : null;
      const res = await getDiscoverRooms(token);
      if (res?.success) {
        setDiscoverCategories(res.categories || []);
        if (res.featured) setFeaturedRoom(res.featured);
      }
    } catch (e) {
      console.warn('Failed to load discover categories:', e);
    }
  }, [isSignedIn]);

  const fetchVibeData = useCallback(async () => {
    try {
      const token = isSignedIn && getTokenRef.current ? await getTokenRef.current() : null;
      const res = await getVibeMatches(token);
      if (res?.success) {
        setVibeProfile(res.userVibe || null);
        setMatchedUsers(res.matchedUsers || []);
      }
    } catch (e) {
      console.warn('Failed to load vibe matches:', e);
    }
  }, [isSignedIn]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([fetchRooms(), fetchDiscover(), fetchVibeData()]);
    setLoading(false);
  }, [fetchRooms, fetchDiscover, fetchVibeData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchRooms(), fetchDiscover(), fetchVibeData()]);
    setRefreshing(false);
  }, [fetchRooms, fetchDiscover, fetchVibeData]);

  // Initial and filter changes
  useEffect(() => {
    loadAll();
  }, [selectedVibe, searchQuery]);

  // Hook socket for debounced room discovery updates (never listen to rapid dj:state on discovery)
  useEffect(() => {
    let alive = true;
    let debounceTimer = null;

    const handleRoomChange = () => {
      if (!alive) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (alive) fetchRooms();
      }, 2000);
    };

    (async () => {
      try {
        await ensureSocketConnected();
        if (!alive) return;

        socket.on('party:rooms-updated', handleRoomChange);
        socket.on('user-joined', handleRoomChange);
        socket.on('user-left', handleRoomChange);
      } catch (e) {}
    })();

    return () => {
      alive = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off('party:rooms-updated', handleRoomChange);
      socket.off('user-joined', handleRoomChange);
      socket.off('user-left', handleRoomChange);
    };
  }, [fetchRooms]);

  const createRoom = async ({ title, vibe, tags, isPrivate, roomId }) => {
    const token = isSignedIn && getTokenRef.current ? await getTokenRef.current() : null;
    const res = await apiCreateRoom({
      title,
      vibe,
      tags,
      isPrivate,
      roomId,
      token,
    });
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
