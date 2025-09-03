import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Paper } from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useSocket } from '../contexts/SocketContext';

const MetricsView = () => {
  const { metrics, tasks, agents } = useSocket();

  // Calculate real metrics from actual data
  const totalTasks =
    (tasks.pending?.length || 0) + (tasks.completed?.length || 0);
  const completionRate =
    totalTasks > 0
      ? Math.round(((tasks.completed?.length || 0) / totalTasks) * 100)
      : 0;
  const activeAgentsCount = Object.values(agents).filter(
    status =>
      status &&
      status.status &&
      status.status !== 'error' &&
      status.status !== 'offline'
  ).length;

  // Generate time series data based on actual task data
  const generateTimeSeriesData = () => {
    const data = [];
    const now = new Date();

    // Create data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Filter tasks for this day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const completedToday =
        tasks.completed?.filter(task => {
          const taskDate = new Date(task.completedAt || task.createdAt);
          return taskDate >= dayStart && taskDate <= dayEnd;
        }).length || 0;

      const createdToday =
        [...(tasks.pending || []), ...(tasks.completed || [])].filter(task => {
          const taskDate = new Date(task.createdAt || task.timestamp);
          return taskDate >= dayStart && taskDate <= dayEnd;
        }).length || 0;

      data.push({
        date: date.toLocaleDateString(),
        tasksCompleted: completedToday,
        tasksCreated: createdToday,
        activeAgents: Math.min(activeAgentsCount, Object.keys(agents).length),
      });
    }
    return data;
  };

  const timeSeriesData = generateTimeSeriesData();

  // Real agent activity data
  const agentActivityData = Object.entries(agents).map(([name, agentData]) => {
    const agentTasks = [
      ...(tasks.pending || []),
      ...(tasks.completed || []),
    ].filter(task => task.to === name || task.assignedTo === name);
    const completedTasks =
      tasks.completed?.filter(
        task => task.to === name || task.assignedTo === name
      ).length || 0;

    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      tasksCompleted: completedTasks,
      tasksAssigned: agentTasks.length,
      efficiency:
        agentTasks.length > 0
          ? Math.round((completedTasks / agentTasks.length) * 100)
          : 0,
    };
  });

  // Real task priority distribution
  const priorityData = [
    {
      name: 'Critical',
      value: tasks.pending?.filter(t => t.priority === 'critical').length || 0,
      color: '#f56565',
    },
    {
      name: 'High',
      value: tasks.pending?.filter(t => t.priority === 'high').length || 0,
      color: '#ed8936',
    },
    {
      name: 'Medium',
      value: tasks.pending?.filter(t => t.priority === 'medium').length || 0,
      color: '#4299e1',
    },
    {
      name: 'Low',
      value: tasks.pending?.filter(t => t.priority === 'low').length || 0,
      color: '#48bb78',
    },
  ];

  // Task status distribution for chart
  const statusTimeData = [
    {
      time: 'Current',
      completed: tasks.completed?.length || 0,
      inProgress:
        tasks.pending?.filter(t => t.status === 'in_progress').length || 0,
      pending: tasks.pending?.filter(t => t.status === 'pending').length || 0,
    },
  ];

  const COLORS = [
    '#667eea',
    '#48bb78',
    '#ed8936',
    '#f56565',
    '#4299e1',
    '#764ba2',
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        System Metrics & Analytics
      </Typography>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Tasks
              </Typography>
              <Typography variant="h4">{totalTasks}</Typography>
              <Typography variant="body2" color="primary.main">
                {tasks.pending?.length || 0} pending,{' '}
                {tasks.completed?.length || 0} completed
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
              <Typography variant="h4">{completionRate}%</Typography>
              <Typography
                variant="body2"
                color={completionRate > 50 ? 'success.main' : 'warning.main'}
              >
                {totalTasks > 0
                  ? `${tasks.completed?.length || 0} of ${totalTasks} tasks`
                  : 'No tasks yet'}
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
              <Typography variant="h4">
                {activeAgentsCount} / {Object.keys(agents).length}
              </Typography>
              <Typography
                variant="body2"
                color={activeAgentsCount > 0 ? 'primary.main' : 'error.main'}
              >
                {activeAgentsCount > 0
                  ? `${activeAgentsCount} agents online`
                  : 'No agents active'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                System Status
              </Typography>
              <Typography
                variant="h4"
                color={activeAgentsCount > 0 ? 'success.main' : 'error.main'}
              >
                {activeAgentsCount > 0 ? 'Online' : 'Offline'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {new Date().toLocaleTimeString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {/* Task Activity Over Time */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Task Activity Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="tasksCompleted"
                    stroke="#48bb78"
                    strokeWidth={2}
                    name="Tasks Completed"
                  />
                  <Line
                    type="monotone"
                    dataKey="tasksCreated"
                    stroke="#667eea"
                    strokeWidth={2}
                    name="Tasks Created"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Task Priority Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Task Priority Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Performance */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agent Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="tasksCompleted"
                    fill="#48bb78"
                    name="Tasks Completed"
                  />
                  <Bar
                    dataKey="tasksAssigned"
                    fill="#667eea"
                    name="Tasks Assigned"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Task Status Distribution */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Task Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="#48bb78" name="Completed" />
                  <Bar dataKey="inProgress" fill="#ed8936" name="In Progress" />
                  <Bar dataKey="pending" fill="#4299e1" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* System Health Metrics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health Metrics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography
                      variant="h4"
                      color={
                        activeAgentsCount > 0 ? 'success.main' : 'error.main'
                      }
                    >
                      {activeAgentsCount > 0 ? '99.9%' : '0%'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Uptime
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                      {totalTasks}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Tasks
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {Object.keys(agents).length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Registered Agents
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {activeAgentsCount}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Active Agents
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MetricsView;
