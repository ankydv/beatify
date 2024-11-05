import { useState, useEffect } from 'react';
import { getUser } from '@/utils/user.utils';
import { useSelector } from 'react-redux';

const useUser = () => {
  const [user, setUser] = useState(null);         // State to store user profile
  const [loading, setLoading] = useState(true);    // Loading state for UI feedback
  const [error, setError] = useState(null);        // Error state if fetching fails

  const { isLoggedIn } = useSelector((state) => state.auth);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true); // Start loading before fetching user data
        const userData = await getUser();   // Fetch user profile from API
        setUser(userData);                         // Set the user data
      } catch (err) {
        setError(err);                             // Capture any errors
      } finally {
        setLoading(false);                         // Stop loading after fetching
      }
    };
    if(!isLoggedIn){
      setUser(null);
      return;
    }
    fetchUserProfile(); // Call the fetch function on mount
  }, [isLoggedIn]);

  return { user, loading, error };
};

export default useUser;
