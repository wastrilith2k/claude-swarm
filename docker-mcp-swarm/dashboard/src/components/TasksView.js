import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
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
  Tab,
  Tabs,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

const TasksView = () => {
  const { tasks, assignTask, agents, socket, fetchTasks } = useSocket();
  const [tabValue, setTabValue] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [taskForm, setTaskForm] = useState({
    agent: '',
    title: '',
    description: '',
    priority: 'medium',
    type: 'manual',
  });

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim() || !taskForm.agent) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await assignTask(taskForm.agent, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        type: taskForm.type,
      });
      toast.success('Task created successfully');
      setCreateDialogOpen(false);
      // Keep the agent selection for next task
      setTaskForm({
        agent: taskForm.agent, // Retain the agent selection
        title: '',
        description: '',
        priority: 'medium',
        type: 'manual',
      });
    } catch (error) {
      toast.error(`Failed to create task: ${error.message}`);
    }
  };

  const handleEditTask = task => {
    setSelectedTask(task);
    setTaskForm({
      agent: task.agent || task.to || task.assignedTo || '',
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      type: task.type || 'manual',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!taskForm.title.trim() || !taskForm.agent) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          priority: taskForm.priority,
          type: taskForm.type,
          agent: taskForm.agent,
        }),
      });

      if (response.ok) {
        toast.success('Task updated successfully');
        setEditDialogOpen(false);
        setSelectedTask(null);
        // Refresh tasks
        setTimeout(fetchTasks, 1000);
      } else {
        throw new Error('Failed to update task');
      }
    } catch (error) {
      toast.error(`Failed to update task: ${error.message}`);
    }
  };

  const handleViewTask = task => {
    setSelectedTask(task);
    setViewDialogOpen(true);
  };

  const handleTaskAction = async (task, action) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success(`Task ${action} successful`);
        // Refresh tasks after action
        setTimeout(fetchTasks, 1000);
      } else {
        throw new Error(`Failed to ${action} task`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} task: ${error.message}`);
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'pending':
        return 'warning';
      case 'paused':
        return 'secondary';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = priority => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'primary';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatDate = dateString => {
    if (!dateString) return 'Unknown';
    try {
      // Handle various date formats
      let date;
      if (typeof dateString === 'string') {
        // Handle ISO string or timestamp
        date = new Date(dateString);
        // If invalid, try parsing as timestamp
        if (isNaN(date.getTime())) {
          date = new Date(parseInt(dateString));
        }
      } else if (typeof dateString === 'number') {
        date = new Date(dateString);
      } else {
        return 'Invalid Date';
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleString();
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Invalid Date';
    }
  };

  const TaskTable = ({ taskList, showCompletedBy = false }) => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedTasks = taskList.slice(startIndex, endIndex);

    return (
      <>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                {showCompletedBy && <TableCell>Completed By</TableCell>}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTasks.map((task, index) => (
                <TableRow key={task.id || index}>
                  <TableCell>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 'bold' }}
                      >
                        {task.title || task.id}
                      </Typography>
                      {task.description && (
                        <Typography variant="body2" color="textSecondary">
                          {task.description.length > 100
                            ? `${task.description.substring(0, 100)}...`
                            : task.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        task.agent || task.to || task.assignedTo || 'Unknown'
                      }
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={(task.priority || 'medium').toUpperCase()}
                      color={getPriorityColor(task.priority)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={(task.status || 'pending')
                        .toUpperCase()
                        .replace('_', ' ')}
                      color={getStatusColor(task.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(task.createdAt || task.timestamp)}
                    </Typography>
                  </TableCell>
                  {showCompletedBy && (
                    <TableCell>
                      <Typography variant="body2">
                        {task.completedBy || 'Unknown'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <IconButton
                      size="small"
                      title="View Details"
                      onClick={() => handleViewTask(task)}
                    >
                      <ViewIcon />
                    </IconButton>
                    {(task.status === 'pending' ||
                      task.status === 'in_progress' ||
                      task.status === 'paused') && (
                      <IconButton
                        size="small"
                        color="primary"
                        title="Edit Task"
                        onClick={() => handleEditTask(task)}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                        </svg>
                      </IconButton>
                    )}
                    {task.status === 'pending' && (
                      <>
                        <IconButton
                          size="small"
                          color="primary"
                          title="Start Task"
                          onClick={() => handleTaskAction(task, 'start')}
                        >
                          <PlayIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          title="Cancel Task"
                          onClick={() => handleTaskAction(task, 'cancel')}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                    {task.status === 'in_progress' && (
                      <>
                        <IconButton
                          size="small"
                          color="warning"
                          title="Pause Task"
                          onClick={() => handleTaskAction(task, 'pause')}
                        >
                          <PauseIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          title="Stop Task"
                          onClick={() => handleTaskAction(task, 'stop')}
                        >
                          <StopIcon />
                        </IconButton>
                      </>
                    )}
                    {task.status === 'paused' && (
                      <>
                        <IconButton
                          size="small"
                          color="primary"
                          title="Resume Task"
                          onClick={() => handleTaskAction(task, 'resume')}
                        >
                          <PlayIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          title="Cancel Task"
                          onClick={() => handleTaskAction(task, 'cancel')}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={taskList.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={event => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Task Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Task
        </Button>
      </Box>

      {/* Task Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Tasks
              </Typography>
              <Typography variant="h4">
                {(tasks.pending?.length || 0) +
                  (tasks.in_progress?.length || 0) +
                  (tasks.completed?.length || 0) +
                  (tasks.failed?.length || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending Tasks
              </Typography>
              <Typography variant="h4" color="warning.main">
                {tasks.pending?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                In Progress
              </Typography>
              <Typography variant="h4" color="primary.main">
                {tasks.in_progress?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4" color="success.main">
                {tasks.completed?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Task Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={`Pending (${tasks.pending?.length || 0})`} />
            <Tab label={`In Progress (${tasks.in_progress?.length || 0})`} />
            <Tab label={`Completed (${tasks.completed?.length || 0})`} />
            <Tab label={`Failed (${tasks.failed?.length || 0})`} />
            <Tab label={`Blocked (${tasks.blocked?.length || 0})`} />
          </Tabs>
        </Box>
        <CardContent>
          {tabValue === 0 && (
            <TaskTable taskList={tasks.pending || []} showCompletedBy={false} />
          )}
          {tabValue === 1 && (
            <TaskTable
              taskList={tasks.in_progress || []}
              showCompletedBy={false}
            />
          )}
          {tabValue === 2 && (
            <TaskTable
              taskList={tasks.completed || []}
              showCompletedBy={true}
            />
          )}
          {tabValue === 3 && (
            <TaskTable taskList={tasks.failed || []} showCompletedBy={false} />
          )}
          {tabValue === 4 && (
            <TaskTable taskList={tasks.blocked || []} showCompletedBy={false} />
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Task</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Assign to Agent</InputLabel>
              <Select
                value={taskForm.agent}
                label="Assign to Agent"
                onChange={e =>
                  setTaskForm({ ...taskForm, agent: e.target.value })
                }
              >
                {Object.keys(agents).map(agentName => (
                  <MenuItem key={agentName} value={agentName}>
                    {agentName.charAt(0).toUpperCase() + agentName.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Task Title"
              value={taskForm.title}
              onChange={e =>
                setTaskForm({ ...taskForm, title: e.target.value })
              }
              sx={{ mb: 2 }}
              required
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
                <MenuItem value="bug_fix">Bug Fix</MenuItem>
                <MenuItem value="feature">Feature</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTask} variant="contained">
            Create Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Task</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Assign to Agent</InputLabel>
              <Select
                value={taskForm.agent}
                label="Assign to Agent"
                onChange={e =>
                  setTaskForm({ ...taskForm, agent: e.target.value })
                }
              >
                {Object.keys(agents).map(agentName => (
                  <MenuItem key={agentName} value={agentName}>
                    {agentName.charAt(0).toUpperCase() + agentName.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Task Title"
              value={taskForm.title}
              onChange={e =>
                setTaskForm({ ...taskForm, title: e.target.value })
              }
              sx={{ mb: 2 }}
              required
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
                <MenuItem value="bug_fix">Bug Fix</MenuItem>
                <MenuItem value="feature">Feature</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateTask} variant="contained">
            Update Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Task Details</DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Task ID
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedTask.id}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Assigned Agent
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedTask.agent ||
                      selectedTask.to ||
                      selectedTask.assignedTo ||
                      'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Title
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedTask.title}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedTask.description || 'No description provided'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Priority
                  </Typography>
                  <Chip
                    label={(selectedTask.priority || 'medium').toUpperCase()}
                    color={getPriorityColor(selectedTask.priority)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={(selectedTask.status || 'pending')
                      .toUpperCase()
                      .replace('_', ' ')}
                    color={getStatusColor(selectedTask.status)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Type
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedTask.type || 'manual'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Created
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatDate(
                      selectedTask.createdAt || selectedTask.timestamp
                    )}
                  </Typography>
                </Grid>
                {selectedTask.completedAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Completed
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {formatDate(selectedTask.completedAt)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TasksView;
