import { useState, useEffect, useCallback } from 'react';
import { fetchAllUsers } from '@/lib/api';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllUsers();
      setUsers(data || []);
    } catch (err) {
      setError(getUserMessage(err, { context: 'useUsers', fallback: MESSAGES.LOAD_FAILED }));
      notify.error(err, { context: 'useUsers', fallback: MESSAGES.LOAD_FAILED });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return { users, loading, error, refresh: loadUsers };
};
