import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import useAutoRefresh from '../hooks/useAutoRefresh';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, socket }) => {
  const [agents, setAgents] = useState({});
  const [metrics, setMetrics] = useState({});
  const [tasks, setTasks] = useState({
    pending: [],
    in_progress: [],
    completed: [],
    failed: [],
  });
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);

  // Load settings for auto-refresh
  const getSettings = () => {
    try {
      const savedSettings = localStorage.getItem('mcp-swarm-settings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return {
      performance: {
        autoRefresh: true,
        refreshInterval: 30,
      },
    };
  };

  const [settings] = useState(getSettings);

  const addLog = useCallback(message => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      id: Date.now() + Math.random(),
    };
    setLogs(prev => [...prev.slice(-99), logEntry]); // Keep last 100 logs
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/status');
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      } else {
        console.error(
          'Failed to fetch agents:',
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const [
        pendingResponse,
        inProgressResponse,
        completedResponse,
        failedResponse,
        blockedResponse,
      ] = await Promise.all([
        fetch('/api/tasks/pending'),
        fetch('/api/tasks/in_progress'),
        fetch('/api/tasks/completed'),
        fetch('/api/tasks/failed'),
        fetch('/api/tasks/blocked'),
      ]);

      if (
        pendingResponse.ok &&
        inProgressResponse.ok &&
        completedResponse.ok &&
        failedResponse.ok &&
        blockedResponse.ok
      ) {
        const pending = await pendingResponse.json();
        const in_progress = await inProgressResponse.json();
        const completed = await completedResponse.json();
        const failed = await failedResponse.json();
        const blocked = await blockedResponse.json();

        setTasks({
          pending,
          in_progress,
          completed,
          failed,
          blocked,
        });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, []);

  const assignTask = async (agent, task) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, task }),
      });

      if (response.ok) {
        const result = await response.json();
        addLog(
          `Task assigned to ${agent}: ${task.title} (ID: ${result.taskId})`
        );
        setTimeout(fetchTasks, 1000); // Refresh tasks after delay
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign task');
      }
    } catch (error) {
      addLog(`Error assigning task: ${error.message}`);
      throw error;
    }
  };

  const restartAgent = async agent => {
    try {
      const response = await fetch(`/api/agents/${agent}/restart`, {
        method: 'POST',
      });

      if (response.ok) {
        addLog(`Restart signal sent to ${agent}`);
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restart agent');
      }
    } catch (error) {
      addLog(`Error restarting ${agent}: ${error.message}`);
      throw error;
    }
  };

  const getAgentLogs = async agent => {
    try {
      const response = await fetch(`/api/logs/${agent}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error(`Error fetching logs for ${agent}:`, error);
      return [];
    }
  };

  // Use callback to avoid recreation on each render
  const fetchAllData = useCallback(async () => {
    try {
      await Promise.all([
        fetchAgents(),
        fetchTasks(),
        fetchProjects(),
        fetchMetrics(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      addLog('Error loading data: ' + error.message);
    }
  }, [fetchAgents, fetchTasks, fetchProjects, fetchMetrics, addLog]);

  // Set up auto-refresh based on user settings
  useAutoRefresh(
    fetchAllData,
    settings.performance?.refreshInterval || 30,
    settings.performance?.autoRefresh !== false
  );

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time updates
    socket.on('agent_status_update', data => {
      setAgents(prev => ({
        ...prev,
        [data.agent]: data.status,
      }));
    });

    socket.on('task_update', data => {
      addLog(`Task ${data.taskId} updated: ${data.status}`);
      // Refresh tasks when updated
      setTimeout(fetchTasks, 500); // Shorter delay for better UX
    });

    socket.on('metrics_update', data => {
      setMetrics(data);
    });

    socket.on('agent_output', data => {
      addLog(
        `[${data.agent.toUpperCase()}] ${
          data.output.output || data.output.message || 'Output received'
        }`
      );
    });

    // Real-time task updates (faster than the basic task_update)
    socket.on('realtime_task_update', data => {
      addLog(`🔄 ${data.agent}: Task ${data.taskId} → ${data.status}`);
      if (data.debugMode) {
        addLog(`🐛 DEBUG MODE: ${data.agent} simulated processing`);
      }
    });

    // Queue updates
    socket.on('queue_update', data => {
      addLog(`📋 Queue: ${data.queueLength} tasks waiting`);
    });

    // Tasks refresh (immediate data update)
    socket.on('tasks_refresh', data => {
      setTasks(data);
    });

    // Initial data load
    fetchAllData();

    return () => {
      socket.off('agent_status_update');
      socket.off('task_update');
      socket.off('metrics_update');
      socket.off('agent_output');
      socket.off('realtime_task_update');
      socket.off('queue_update');
      socket.off('tasks_refresh');
    };
  }, [socket, fetchTasks, addLog, fetchAllData]);

  const value = {
    socket,
    agents,
    metrics,
    tasks,
    projects,
    logs,
    assignTask,
    restartAgent,
    getAgentLogs,
    fetchAllData,
    fetchAgents,
    fetchTasks,
    fetchProjects,
    fetchMetrics,
    addLog,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
