import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  Architecture as ArchitectIcon,
  Web as FrontendIcon,
  Storage as BackendIcon,
  Cloud as DevopsIcon,
  BugReport as QaIcon,
  Description as DocsIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';

const Dashboard = () => {
  const { agents, metrics, tasks } = useSocket();

  const agentIcons = {
    architect: <ArchitectIcon />,
    frontend: <FrontendIcon />,
    backend: <BackendIcon />,
    devops: <DevopsIcon />,
    qa: <QaIcon />,
    docs: <DocsIcon />,
  };

  const agentColors = {
    architect: '#667eea',
    frontend: '#48bb78',
    backend: '#ed8936',
    devops: '#4299e1',
    qa: '#f56565',
    docs: '#764ba2',
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

  const completionRate =
    metrics.tasks?.total > 0
      ? Math.round((metrics.tasks?.completed / metrics.tasks?.total) * 100)
      : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Dashboard Overview
      </Typography>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Tasks
              </Typography>
              <Typography variant="h4" component="div">
                {metrics.tasks?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Agents
              </Typography>
              <Typography variant="h4" component="div">
                {metrics.agents?.active || 0} / {Object.keys(agents).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed Tasks
              </Typography>
              <Typography variant="h4" component="div">
                {metrics.tasks?.completed || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completion Rate
              </Typography>
              <Typography variant="h4" component="div">
                {completionRate}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={completionRate}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Agent Status Grid */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Agent Status
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Object.entries(agents).map(([agentName, agentStatus]) => (
          <Grid item xs={12} sm={6} md={4} key={agentName}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: agentColors[agentName] || '#gray',
                      mr: 2,
                    }}
                  >
                    {agentIcons[agentName]}
                  </Avatar>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                    {agentName}
                  </Typography>
                </Box>
                <Chip
                  label={getStatusText(agentStatus)}
                  color={getStatusColor(agentStatus)}
                  size="small"
                  sx={{ mb: 1 }}
                />
                {agentStatus?.lastSeen && (
                  <Typography variant="body2" color="textSecondary">
                    Last seen:{' '}
                    {new Date(agentStatus.lastSeen).toLocaleTimeString()}
                  </Typography>
                )}
                {agentStatus?.currentTask && (
                  <Typography variant="body2" color="textSecondary">
                    Current: {agentStatus.currentTask}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Tasks */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Pending Tasks
              </Typography>
              {tasks.pending?.slice(0, 5).map((task, index) => (
                <Box
                  key={task.id || index}
                  sx={{
                    p: 2,
                    mb: 1,
                    borderLeft: 4,
                    borderLeftColor:
                      task.priority === 'high'
                        ? 'error.main'
                        : task.priority === 'medium'
                        ? 'warning.main'
                        : 'success.main',
                    backgroundColor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {task.title || task.id}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Assigned to: {task.to || 'Unknown'} | Priority:{' '}
                    {task.priority || 'medium'}
                  </Typography>
                  {task.description && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {task.description}
                    </Typography>
                  )}
                </Box>
              )) || (
                <Typography color="textSecondary">No pending tasks</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recently Completed Tasks
              </Typography>
              {tasks.completed?.slice(0, 5).map((task, index) => (
                <Box
                  key={task.id || index}
                  sx={{
                    p: 2,
                    mb: 1,
                    borderLeft: 4,
                    borderLeftColor: 'success.main',
                    backgroundColor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {task.title || task.id}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Completed by: {task.completedBy || 'Unknown'}
                  </Typography>
                  {task.description && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {task.description}
                    </Typography>
                  )}
                </Box>
              )) || (
                <Typography color="textSecondary">
                  No completed tasks
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
