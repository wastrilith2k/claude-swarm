import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Chip,
  Alert,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Speed as PerformanceIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

const SettingsView = () => {
  const { logs, fetchAllData } = useSocket();
  const [tabValue, setTabValue] = useState(0);

  // Load settings from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('mcp-swarm-settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }

    // Default settings
    return {
      notifications: {
        taskUpdates: true,
        agentStatus: true,
        systemAlerts: true,
        emailNotifications: false,
      },
      performance: {
        autoRefresh: true,
        refreshInterval: 30,
        maxLogEntries: 1000,
        enableMetrics: true,
      },
      security: {
        requireAuth: false,
        sessionTimeout: 60,
        enableAuditLog: true,
      },
      system: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
      },
    };
  });

  // Save settings to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('mcp-swarm-settings', JSON.stringify(settings));
  }, [settings]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value,
      },
    }));
    toast.success('Setting saved successfully');
  };

  const handleResetSettings = () => {
    const defaultSettings = {
      notifications: {
        taskUpdates: true,
        agentStatus: true,
        systemAlerts: true,
        emailNotifications: false,
      },
      performance: {
        autoRefresh: true,
        refreshInterval: 30,
        maxLogEntries: 1000,
        enableMetrics: true,
      },
      security: {
        requireAuth: false,
        sessionTimeout: 60,
        enableAuditLog: true,
      },
      system: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
      },
    };

    setSettings(defaultSettings);
    localStorage.setItem('mcp-swarm-settings', JSON.stringify(defaultSettings));
    toast.success('Settings reset to default values');
  };

  const handleRefreshData = async () => {
    try {
      await fetchAllData();
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    }
  };

  const handleExportLogs = () => {
    const logData = logs.map(log => ({
      timestamp: log.timestamp,
      message: log.message,
    }));

    const blob = new Blob([JSON.stringify(logData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-swarm-logs-${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Logs exported successfully');
  };

  const tabContent = [
    {
      label: 'General',
      icon: <SettingsIcon />,
      content: (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Preferences
                </Typography>
                <List>
                  <ListItem>
                    <FormControl fullWidth>
                      <InputLabel>Theme</InputLabel>
                      <Select
                        value={settings.system.theme}
                        label="Theme"
                        onChange={e =>
                          handleSettingChange('system', 'theme', e.target.value)
                        }
                      >
                        <MenuItem value="light">Light</MenuItem>
                        <MenuItem value="dark">Dark</MenuItem>
                        <MenuItem value="auto">Auto</MenuItem>
                      </Select>
                    </FormControl>
                  </ListItem>
                  <ListItem>
                    <FormControl fullWidth>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={settings.system.language}
                        label="Language"
                        onChange={e =>
                          handleSettingChange(
                            'system',
                            'language',
                            e.target.value
                          )
                        }
                      >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="es">Spanish</MenuItem>
                        <MenuItem value="fr">French</MenuItem>
                        <MenuItem value="de">German</MenuItem>
                      </Select>
                    </FormControl>
                  </ListItem>
                  <ListItem>
                    <FormControl fullWidth>
                      <InputLabel>Timezone</InputLabel>
                      <Select
                        value={settings.system.timezone}
                        label="Timezone"
                        onChange={e =>
                          handleSettingChange(
                            'system',
                            'timezone',
                            e.target.value
                          )
                        }
                      >
                        <MenuItem value="UTC">UTC</MenuItem>
                        <MenuItem value="America/New_York">
                          Eastern Time
                        </MenuItem>
                        <MenuItem value="America/Chicago">
                          Central Time
                        </MenuItem>
                        <MenuItem value="America/Denver">
                          Mountain Time
                        </MenuItem>
                        <MenuItem value="America/Los_Angeles">
                          Pacific Time
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Actions
                </Typography>
                <List>
                  <ListItem>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleRefreshData}
                      fullWidth
                    >
                      Refresh All Data
                    </Button>
                  </ListItem>
                  <ListItem>
                    <Button
                      variant="outlined"
                      onClick={handleExportLogs}
                      fullWidth
                    >
                      Export System Logs
                    </Button>
                  </ListItem>
                  <ListItem>
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={handleResetSettings}
                      fullWidth
                    >
                      Reset All Settings
                    </Button>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ),
    },
    {
      label: 'Notifications',
      icon: <NotificationsIcon />,
      content: (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Task Updates"
                  secondary="Get notified when tasks are created, updated, or completed"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.taskUpdates}
                      onChange={e =>
                        handleSettingChange(
                          'notifications',
                          'taskUpdates',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Agent Status Changes"
                  secondary="Get notified when agents go online/offline or change status"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.agentStatus}
                      onChange={e =>
                        handleSettingChange(
                          'notifications',
                          'agentStatus',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="System Alerts"
                  secondary="Get notified about system errors and important events"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.systemAlerts}
                      onChange={e =>
                        handleSettingChange(
                          'notifications',
                          'systemAlerts',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Email Notifications"
                  secondary="Receive notifications via email (requires configuration)"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.emailNotifications}
                      onChange={e =>
                        handleSettingChange(
                          'notifications',
                          'emailNotifications',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      ),
    },
    {
      label: 'Performance',
      icon: <PerformanceIcon />,
      content: (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance Settings
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Auto Refresh"
                  secondary="Automatically refresh dashboard data"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.performance.autoRefresh}
                      onChange={e =>
                        handleSettingChange(
                          'performance',
                          'autoRefresh',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Refresh Interval (seconds)"
                  secondary="How often to refresh data when auto-refresh is enabled"
                />
                <TextField
                  type="number"
                  value={settings.performance.refreshInterval}
                  onChange={e =>
                    handleSettingChange(
                      'performance',
                      'refreshInterval',
                      parseInt(e.target.value)
                    )
                  }
                  size="small"
                  sx={{ width: 100 }}
                  inputProps={{ min: 5, max: 300 }}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Max Log Entries"
                  secondary="Maximum number of log entries to keep in memory"
                />
                <TextField
                  type="number"
                  value={settings.performance.maxLogEntries}
                  onChange={e =>
                    handleSettingChange(
                      'performance',
                      'maxLogEntries',
                      parseInt(e.target.value)
                    )
                  }
                  size="small"
                  sx={{ width: 100 }}
                  inputProps={{ min: 100, max: 10000 }}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Enable Metrics Collection"
                  secondary="Collect and display performance metrics"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.performance.enableMetrics}
                      onChange={e =>
                        handleSettingChange(
                          'performance',
                          'enableMetrics',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      ),
    },
    {
      label: 'Security',
      icon: <SecurityIcon />,
      content: (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Security Settings
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Security features are currently in development and may not be
              fully functional.
            </Alert>
            <List>
              <ListItem>
                <ListItemText
                  primary="Require Authentication"
                  secondary="Require users to log in to access the dashboard"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.requireAuth}
                      onChange={e =>
                        handleSettingChange(
                          'security',
                          'requireAuth',
                          e.target.checked
                        )
                      }
                      disabled
                    />
                  }
                  label=""
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Session Timeout (minutes)"
                  secondary="How long users stay logged in without activity"
                />
                <TextField
                  type="number"
                  value={settings.security.sessionTimeout}
                  onChange={e =>
                    handleSettingChange(
                      'security',
                      'sessionTimeout',
                      parseInt(e.target.value)
                    )
                  }
                  size="small"
                  sx={{ width: 100 }}
                  inputProps={{ min: 5, max: 480 }}
                  disabled
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Enable Audit Log"
                  secondary="Log all user actions for security auditing"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.enableAuditLog}
                      onChange={e =>
                        handleSettingChange(
                          'security',
                          'enableAuditLog',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label=""
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      ),
    },
    {
      label: 'System Info',
      icon: <StorageIcon />,
      content: (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Information
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText primary="Version" secondary="1.0.0" />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Environment"
                      secondary="Development"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Node.js Version"
                      secondary="18.17.0"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Database" secondary="Neo4j 5.12" />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Message Broker"
                      secondary="Redis 7.2"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Logs ({logs.length})
                </Typography>
                <Paper
                  sx={{
                    backgroundColor: '#1e1e1e',
                    color: '#e0e0e0',
                    p: 2,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {logs.slice(-10).map((log, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography
                        component="span"
                        sx={{ color: '#9e9e9e', fontSize: '0.7rem' }}
                      >
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </Typography>{' '}
                      <Typography component="span" sx={{ fontSize: '0.75rem' }}>
                        {log.message}
                      </Typography>
                    </Box>
                  ))}
                  {logs.length === 0 && (
                    <Typography sx={{ textAlign: 'center', color: '#9e9e9e' }}>
                      No logs available
                    </Typography>
                  )}
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Settings & Configuration
      </Typography>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabContent.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ minHeight: 64 }}
              />
            ))}
          </Tabs>
        </Box>
        <CardContent>{tabContent[tabValue]?.content}</CardContent>
      </Card>

      {/* Status Indicators */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Chip label="System Online" color="success" />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              All services operational
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Chip
              label="Auto-Refresh Active"
              color={settings.performance.autoRefresh ? 'primary' : 'default'}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Every {settings.performance.refreshInterval}s
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Chip
              label="Notifications Enabled"
              color={settings.notifications.taskUpdates ? 'success' : 'default'}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Task & agent updates
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Chip
              label="Audit Log Active"
              color={settings.security.enableAuditLog ? 'primary' : 'default'}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Security monitoring
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsView;
