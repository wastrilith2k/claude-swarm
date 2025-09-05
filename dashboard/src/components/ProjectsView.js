import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Web as WebIcon,
  Storage as DatabaseIcon,
  Api as ApiIcon,
  Description as DocsIcon,
  BugReport as BugIcon,
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';

const ProjectsView = () => {
  const { projects } = useSocket();

  const getProjectIcon = type => {
    switch (type?.toLowerCase()) {
      case 'web':
      case 'frontend':
        return <WebIcon />;
      case 'api':
      case 'backend':
        return <ApiIcon />;
      case 'database':
        return <DatabaseIcon />;
      case 'documentation':
        return <DocsIcon />;
      case 'bug_fix':
        return <BugIcon />;
      default:
        return <FolderIcon />;
    }
  };

  const getProjectTypeColor = type => {
    switch (type?.toLowerCase()) {
      case 'web':
      case 'frontend':
        return '#48bb78';
      case 'api':
      case 'backend':
        return '#ed8936';
      case 'database':
        return '#4299e1';
      case 'documentation':
        return '#764ba2';
      case 'bug_fix':
        return '#f56565';
      default:
        return '#667eea';
    }
  };

  const getStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'planning':
        return 'warning';
      case 'on_hold':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = dateString => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.data?.status === 'in_progress').length,
    completed: projects.filter(p => p.data?.status === 'completed').length,
    planning: projects.filter(p => p.data?.status === 'planning').length,
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Projects Overview
      </Typography>

      {/* Project Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Projects
              </Typography>
              <Typography variant="h4">{projectStats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Projects
              </Typography>
              <Typography variant="h4" color="primary.main">
                {projectStats.active}
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
                {projectStats.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Planning
              </Typography>
              <Typography variant="h4" color="warning.main">
                {projectStats.planning}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Projects Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            All Projects
          </Typography>
          {projects.length > 0 ? (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projects.map((project, index) => {
                    const data = project.data || {};
                    return (
                      <TableRow key={project.id || index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar
                              sx={{
                                bgcolor: getProjectTypeColor(data.type),
                                mr: 2,
                                width: 40,
                                height: 40,
                              }}
                            >
                              {getProjectIcon(data.type)}
                            </Avatar>
                            <Box>
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 'bold' }}
                              >
                                {data.name || project.id || 'Unnamed Project'}
                              </Typography>
                              {data.description && (
                                <Typography
                                  variant="body2"
                                  color="textSecondary"
                                >
                                  {data.description.length > 100
                                    ? `${data.description.substring(0, 100)}...`
                                    : data.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={data.type || 'Unknown'}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: getProjectTypeColor(data.type),
                              color: getProjectTypeColor(data.type),
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={(data.status || 'unknown')
                              .replace('_', ' ')
                              .toUpperCase()}
                            color={getStatusColor(data.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(project.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {data.progress ? `${data.progress}%` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" title="View Project">
                            <ViewIcon />
                          </IconButton>
                          <IconButton size="small" title="Download">
                            <DownloadIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <FolderIcon
                sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="textSecondary">
                No projects found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Projects will appear here as agents create and manage them
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Project Types Distribution */}
      {projects.length > 0 && (
        <Grid container spacing={3} sx={{ mt: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Types
                </Typography>
                {Object.entries(
                  projects.reduce((acc, project) => {
                    const type = project.data?.type || 'unknown';
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([type, count]) => (
                  <Box
                    key={type}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ textTransform: 'capitalize' }}
                    >
                      {type.replace('_', ' ')}
                    </Typography>
                    <Chip
                      label={count}
                      size="small"
                      sx={{
                        bgcolor: getProjectTypeColor(type),
                        color: 'white',
                        minWidth: 40,
                      }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Status
                </Typography>
                {Object.entries(
                  projects.reduce((acc, project) => {
                    const status = project.data?.status || 'unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([status, count]) => (
                  <Box
                    key={status}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ textTransform: 'capitalize' }}
                    >
                      {status.replace('_', ' ')}
                    </Typography>
                    <Chip
                      label={count}
                      size="small"
                      color={getStatusColor(status)}
                      sx={{ minWidth: 40 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ProjectsView;
