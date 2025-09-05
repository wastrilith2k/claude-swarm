import { useEffect } from 'react';

const useAutoRefresh = (callback, interval, enabled = true) => {
  useEffect(() => {
    if (!enabled || !callback || interval <= 0) {
      return;
    }

    const intervalId = setInterval(callback, interval * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [callback, interval, enabled]);
};

export default useAutoRefresh;
