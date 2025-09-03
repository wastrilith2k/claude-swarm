import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Architecture as ArchitectIcon,
  Web as FrontendIcon,
  Storage as BackendIcon,
  Cloud as DevopsIcon,
  BugReport as QaIcon,
  Description as DocsIcon,
  RateReview as ReviewerIcon,
  RestartAlt as RestartIcon,
  Assignment as TaskIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

const AgentsView = () => {
  const { agents, assignTask, restartAgent, getAgentLogs } = useSocket();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [agentLogs, setAgentLogs] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    type: 'manual',
  });

  const agentIcons = {
    architect: <ArchitectIcon />,
    frontend: <FrontendIcon />,
    backend: <BackendIcon />,
    devops: <DevopsIcon />,
    qa: <QaIcon />,
    docs: <DocsIcon />,
    reviewer: <ReviewerIcon />,
  };

  const agentColors = {
    architect: '#667eea',
    frontend: '#48bb78',
    backend: '#ed8936',
    devops: '#4299e1',
    qa: '#f56565',
    docs: '#764ba2',
    reviewer: '#9f7aea',
  };

  const getStatusColor = status => {
    switch (status?.status) {
      case 'idle':
        return 'success';
      case 'working':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = status => {
    return status?.status ? status.status.toUpperCase() : 'UNKNOWN';
  };

  const handleAssignTask = agentName => {
    setSelectedAgent(agentName);
    setTaskDialogOpen(true);
  };

  const handleRestartAgent = async agentName => {
    try {
      await restartAgent(agentName);
      toast.success(`Restart signal sent to ${agentName}`);
    } catch (error) {
      toast.error(`Failed to restart ${agentName}: ${error.message}`);
    }
  };

  const handleViewLogs = async agentName => {
    try {
      const logs = await getAgentLogs(agentName);
      setAgentLogs(logs);
      setSelectedAgent(agentName);
      setLogsDialogOpen(true);
    } catch (error) {
      toast.error(`Failed to fetch logs for ${agentName}`);
    }
  };

  const handleSubmitTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      await assignTask(selectedAgent, taskForm);
      toast.success(`Task assigned to ${selectedAgent}`);
      setTaskDialogOpen(false);
      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        type: 'manual',
      });
    } catch (error) {
      toast.error(`Failed to assign task: ${error.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Agent Management
      </Typography>

      <Grid container spacing={3}>
        {Object.entries(agents).map(([agentName, agentStatus]) => (
          <Grid item xs={12} sm={6} md={4} key={agentName}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: agentColors[agentName] || '#gray',
                      mr: 2,
                      width: 56,
                      height: 56,
                    }}
                  >
                    {agentIcons[agentName]}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{ textTransform: 'capitalize', fontWeight: 'bold' }}
                    >
                      {agentName}
                    </Typography>
                    <Chip
                      label={getStatusText(agentStatus)}
                      color={getStatusColor(agentStatus)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  {agentStatus?.lastSeen && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ mb: 0.5 }}
                    >
                      Last seen:{' '}
                      {new Date(agentStatus.lastSeen).toLocaleString()}
                    </Typography>
                  )}
                  {agentStatus?.currentTask && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ mb: 0.5 }}
                    >
                      Current task: {agentStatus.currentTask}
                    </Typography>
                  )}
                  {agentStatus?.tasksCompleted && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ mb: 0.5 }}
                    >
                      Tasks completed: {agentStatus.tasksCompleted}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TaskIcon />}
                    onClick={() => handleAssignTask(agentName)}
                  >
                    Assign Task
                  </Button>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleViewLogs(agentName)}
                    title="View Logs"
                  >
                    <ViewIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={() => handleRestartAgent(agentName)}
                    title="Restart Agent"
                  >
                    <RestartIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Task Assignment Dialog */}
      <Dialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Task to{' '}
          {selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1)}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Task Title"
              value={taskForm.title}
              onChange={e =>
                setTaskForm({ ...taskForm, title: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Task Description"
              multiline
              rows={3}
              value={taskForm.description}
              onChange={e =>
                setTaskForm({ ...taskForm, description: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={taskForm.priority}
                label="Priority"
                onChange={e =>
                  setTaskForm({ ...taskForm, priority: e.target.value })
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Task Type</InputLabel>
              <Select
                value={taskForm.type}
                label="Task Type"
                onChange={e =>
                  setTaskForm({ ...taskForm, type: e.target.value })
                }
              >
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="development">Development</MenuItem>
                <MenuItem value="testing">Testing</MenuItem>
                <MenuItem value="deployment">Deployment</MenuItem>
                <MenuItem value="documentation">Documentation</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitTask} variant="contained">
            Assign Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog
        open={logsDialogOpen}
        onClose={() => setLogsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Logs for{' '}
          {selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1)}
        </DialogTitle>
        <DialogContent>
          <Paper
            sx={{
              backgroundColor: '#1e1e1e',
              color: '#e0e0e0',
              p: 2,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {agentLogs.length > 0 ? (
              <List dense>
                {agentLogs.map((log, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={log.message || log.output || 'No message'}
                        secondary={new Date(log.timestamp).toLocaleString()}
                        primaryTypographyProps={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: '#e0e0e0',
                        }}
                        secondaryTypographyProps={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: '#9e9e9e',
                        }}
                      />
                    </ListItem>
                    {index < agentLogs.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography
                color="textSecondary"
                sx={{ textAlign: 'center', py: 4 }}
              >
                No logs available for this agent
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentsView;
