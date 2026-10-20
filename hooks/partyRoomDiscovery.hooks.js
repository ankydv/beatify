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
    // Never hit the API when logged out — backend would 401 and spams logs.
    if (!isSignedIn) {
      setActiveRooms([]);
      return;
    }
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      if (!token) {
        setActiveRooms([]);
        return;
      }
      const res = await getActiveRooms({
        vibe: selectedVibe === 'All' ? '' : selectedVibe,
        search: searchQuery,
        token,
      });
      if (res?.success && Array.isArray(res.rooms)) {
        setActiveRooms(res.rooms);
      } else {
        setActiveRooms([]);
      }
    } catch (e) {
      console.warn('Failed to load active rooms:', e);
      setActiveRooms([]);
    }
  }, [selectedVibe, searchQuery, isSignedIn]);

  const fetchDiscover = useCallback(async () => {
    if (!isSignedIn) {
      setDiscoverCategories([]);
      setFeaturedRoom(null);
      return;
    }
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      if (!token) {
        setDiscoverCategories([]);
        setFeaturedRoom(null);
        return;
      }
      const res = await getDiscoverRooms(token);
      if (res?.success) {
        setDiscoverCategories(res.categories || []);
        if (res.featured) setFeaturedRoom(res.featured);
      } else {
        setDiscoverCategories([]);
        setFeaturedRoom(null);
      }
      
    } catch (e) {
      console.warn('Failed to load discover categories:', e);
    }
  }, [isSignedIn]);

  const fetchVibeData = useCallback(async () => {
    if (!isSignedIn) {
      setVibeProfile(null);
      setMatchedUsers([]);
      return;
    }
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      if (!token) {
        setVibeProfile(null);
        setMatchedUsers([]);
        return;
      }
      const res = await getVibeMatches(token);
      if (res?.success) {
        setVibeProfile(res.userVibe || null);
        setMatchedUsers(res.matchedUsers || []);
      } else {
        setVibeProfile(null);
        setMatchedUsers([]);
      }
      
    } catch (e) {
      console.warn('Failed to load vibe matches:', e);
    }
  }, [isSignedIn]);

  const loadAll = useCallback(async () => {
    if (!isSignedIn) {
      setActiveRooms([]);
      setDiscoverCategories([]);
      setFeaturedRoom(null);
      setVibeProfile(null);
      setMatchedUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.allSettled([fetchRooms(), fetchDiscover(), fetchVibeData()]);
    setLoading(false);
  }, [isSignedIn, fetchRooms, fetchDiscover, fetchVibeData]);

  const onRefresh = useCallback(async () => {
    if (!isSignedIn) return;
    setRefreshing(true);
    await Promise.allSettled([fetchRooms(), fetchDiscover(), fetchVibeData()]);
    setRefreshing(false);
  }, [isSignedIn, fetchRooms, fetchDiscover, fetchVibeData]);

  // Initial and filter changes — no-op when logged out (also clears stale data).
  useEffect(() => {
    if (!isSignedIn) {
      setActiveRooms([]);
      setDiscoverCategories([]);
      setFeaturedRoom(null);
      setVibeProfile(null);
      setMatchedUsers([]);
      setLoading(false);
      return;
    }
    loadAll();
  }, [isSignedIn, selectedVibe, searchQuery]);

  // Hook socket for debounced room discovery updates (never listen to rapid dj:state on discovery)
  // IMPORTANT: never connect the socket when logged out — Party tab previously
  // forced ensureSocketConnected() with no token, fighting EventListeners'
  // disconnect-on-signout and causing 401 loops / null-ref crashes.
  useEffect(() => {
    if (!isSignedIn) return;
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
        const token = getTokenRef.current ? await getTokenRef.current() : null;
        if (!alive || !token) return;
        await ensureSocketConnected(() => Promise.resolve(token));
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
  }, [isSignedIn, fetchRooms]);

  const createRoom = async ({ title, vibe, tags, isPrivate, roomId }) => {
    if (!isSignedIn) {
      throw { message: 'Please sign in to create a party room' };
    }
    const token = getTokenRef.current ? await getTokenRef.current() : null;
    if (!token) {
      throw { message: 'Please sign in to create a party room' };
    }
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
    activeRooms: activeRooms || [],
    discoverCategories: discoverCategories || [],
    featuredRoom,
    vibeProfile,
    matchedUsers: matchedUsers || [],
    selectedVibe,
    setSelectedVibe,
    searchQuery,
    setSearchQuery,
    loading,
    refreshing,
    onRefresh,
    createRoom,
    currentUser: user || null,
    isSignedIn: !!isSignedIn,
  };
};
