import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  TrendingUp as MetricsIcon,
} from '@mui/icons-material';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

import { SocketProvider } from './contexts/SocketContext';
import Dashboard from './components/Dashboard';
import AgentsView from './components/AgentsView';
import TasksView from './components/TasksView';
import ProjectsView from './components/ProjectsView';
import MetricsView from './components/MetricsView';
import SettingsView from './components/SettingsView';

function App() {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Get current page from URL path
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    return path.substring(1); // Remove leading slash
  };

  const currentPage = getCurrentPage();

  useEffect(() => {
    // Connect to API server for socket connection
    // Use the current window location to construct the API URL for network access
    const socketUrl = 
      process.env.REACT_APP_API_URL ||
      `${window.location.protocol}//${window.location.hostname}:${window.location.port || '8080'}`;

    const newSocket = io(socketUrl, {
      withCredentials: false,
      transports: ['websocket', 'polling'],
      forceNew: true, // Ensure fresh connection for network access
    });

    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      toast.success('Connected to MCP Swarm');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      toast.error('Disconnected from MCP Swarm');
    });

    newSocket.on('connect_error', error => {
      setConnectionStatus('error');
      console.error('Socket connection error:', error);
      toast.error('Connection error');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'disconnected':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'agents', label: 'Agents', icon: <PeopleIcon /> },
    { id: 'tasks', label: 'Tasks', icon: <AssignmentIcon /> },
    { id: 'projects', label: 'Projects', icon: <FolderIcon /> },
    { id: 'metrics', label: 'Metrics', icon: <MetricsIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const handleMenuClick = pageId => {
    // Navigate to the appropriate route
    const path = pageId === 'dashboard' ? '/' : `/${pageId}`;
    navigate(path);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  // No longer needed - replaced with Routes

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          🤖 MCP Swarm
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map(item => (
          <ListItem
            button
            key={item.id}
            onClick={() => handleMenuClick(item.id)}
            selected={currentPage === item.id}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
              },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <SocketProvider socket={socket}>
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            zIndex: theme => theme.zIndex.drawer + 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              MCP Swarm Dashboard
            </Typography>
            <Chip
              label={getStatusText()}
              color={getStatusColor()}
              variant="outlined"
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                '&.MuiChip-colorSuccess': {
                  backgroundColor: 'rgba(72, 187, 120, 0.2)',
                  borderColor: 'rgba(72, 187, 120, 0.5)',
                },
                '&.MuiChip-colorError': {
                  backgroundColor: 'rgba(245, 101, 101, 0.2)',
                  borderColor: 'rgba(245, 101, 101, 0.5)',
                },
                '&.MuiChip-colorWarning': {
                  backgroundColor: 'rgba(237, 137, 54, 0.2)',
                  borderColor: 'rgba(237, 137, 54, 0.5)',
                },
              }}
            />
          </Toolbar>
        </AppBar>

        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? drawerOpen : true}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 250,
              borderRight: '1px solid rgba(0, 0, 0, 0.08)',
            },
          }}
        >
          {drawer}
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            marginLeft: { md: '250px' },
            width: { md: `calc(100% - 250px)` },
            backgroundColor: 'background.default',
            minHeight: '100vh',
          }}
        >
          <Toolbar />
          <Container maxWidth="xl" sx={{ mt: 2, px: { xs: 1, sm: 2, md: 3 } }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agents" element={<AgentsView />} />
              <Route path="/tasks" element={<TasksView />} />
              <Route path="/projects" element={<ProjectsView />} />
              <Route path="/metrics" element={<MetricsView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </Container>
        </Box>
      </Box>
    </SocketProvider>
  );
}

export default App;
