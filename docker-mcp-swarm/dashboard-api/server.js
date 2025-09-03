const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('redis');
const neo4j = require('neo4j-driver');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

class SwarmDashboard {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.redis = null;
    this.neo4jDriver = null;
    this.agents = [
      'system-architect',
      'frontend-developer',
      'backend-developer',
      'devops-engineer',
      'qa-engineer',
      'code-reviewer',
    ];
    this.clientSockets = new Set();
    this.taskRefreshTimeout = null;
  }

  async initialize() {
    try {
      // Initialize Redis connection
      const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      this.redis = Redis.createClient({
        url: redisUrl,
        password: redisPassword,
      });
      await this.redis.connect();

      // Initialize Neo4j connection
      const neo4jUri = process.env.NEO4J_URI || 'bolt://neo4j:7687';
      const neo4jUser = process.env.NEO4J_USER || 'neo4j';
      const neo4jPassword = process.env.NEO4J_PASSWORD || 'swarmpassword123';

      this.neo4jDriver = neo4j.driver(
        neo4jUri,
        neo4j.auth.basic(neo4jUser, neo4jPassword)
      );

      await this.neo4jDriver.verifyConnectivity();

      console.log('✅ Dashboard initialized');
    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "'sha256-l2e7qa94KttWqO+V1zuph/avtAkzSqPvC6znswmIp8w='",
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    });
    this.app.use('/api/', limiter);

    this.app.use(cors());
    this.app.use(morgan('combined'));
    this.app.use(express.json());
  }

  setupRoutes() {
    // API endpoints
    this.app.get('/api/info', (req, res) => {
      res.json({
        message: 'MCP Swarm API Server',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          agents: '/api/agents/status',
          tasks: '/api/tasks/pending',
          projects: '/api/projects',
          metrics: '/api/metrics',
        },
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API Routes
    this.app.get('/api/agents/status', async (req, res) => {
      try {
        const statuses = await this.getAllAgentStatuses();
        res.json(statuses);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/pending', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus(['pending', 'assigned']);
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/in_progress', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus(['in_progress']);
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/completed', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus(['completed']);
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/failed', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus(['failed', 'cancelled']);
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/blocked', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus(['Blocked']);
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get tasks by specific status
    this.app.get('/api/tasks/in_progress', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus('in_progress');
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/paused', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus('paused');
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/cancelled', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus('cancelled');
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/failed', async (req, res) => {
      try {
        const tasks = await this.getTasksByStatus('failed');
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all tasks
    this.app.get('/api/tasks/all', async (req, res) => {
      try {
        const tasks = await this.getAllTasks();
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = await this.getProjects();
        res.json(projects);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/logs/:agent', async (req, res) => {
      try {
        const logs = await this.getAgentLogs(req.params.agent);
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Agent control endpoints
    this.app.post('/api/agents/:agent/restart', async (req, res) => {
      try {
        await this.restartAgent(req.params.agent);
        res.json({
          success: true,
          message: `Restart signal sent to ${req.params.agent}`,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/tasks', async (req, res) => {
      try {
        const { agent, task } = req.body;
        const taskId = await this.assignTask(agent, task);
        res.json({ success: true, taskId });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update task endpoint
    this.app.put('/api/tasks/:taskId', async (req, res) => {
      try {
        const { taskId } = req.params;
        const { title, description, priority, type, agent } = req.body;

        const session = this.neo4jDriver.session();
        try {
          await session.run(
            `
            MATCH (t:Task {id: $taskId})
            SET t.title = $title,
                t.description = $description,
                t.priority = $priority,
                t.type = $type,
                t.agent = $agent,
                t.updatedAt = datetime()
            RETURN t
            `,
            { taskId, title, description, priority, type, agent }
          );

          res.json({ success: true, message: 'Task updated successfully' });
        } finally {
          await session.close();
        }
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Task action endpoints (start, pause, stop, cancel)
    this.app.post('/api/tasks/:taskId/:action', async (req, res) => {
      try {
        const { taskId, action } = req.params;
        await this.handleTaskAction(taskId, action);
        res.json({ success: true, message: `Task ${action} successful` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // API-only server - no catch-all route needed
  }

  setupWebSocket() {
    this.io.on('connection', socket => {
      console.log('📡 Dashboard client connected');
      this.clientSockets.add(socket);

      socket.on('disconnect', () => {
        this.clientSockets.delete(socket);
        console.log('📡 Dashboard client disconnected');
      });

      socket.on('error', error => {
        console.error('WebSocket error:', error);
        this.clientSockets.delete(socket);
      });
    });

    // Subscribe to Redis channels for real-time updates
    this.subscribeToUpdates();
  }

  async subscribeToUpdates() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();

    // Subscribe to status updates
    await subscriber.pSubscribe('status:*', (message, channel) => {
      try {
        const agent = channel.split(':')[1];
        const statusData = JSON.parse(message);
        this.broadcastToClients('agent_status_update', {
          agent,
          status: statusData,
        });
      } catch (error) {
        console.error('Error processing status update:', error);
      }
    });

    // Subscribe to task updates
    await subscriber.pSubscribe('task:*:status', (message, channel) => {
      try {
        const taskId = channel.split(':')[1];
        const taskUpdate = JSON.parse(message);
        this.broadcastToClients('task_update', { taskId, ...taskUpdate });
      } catch (error) {
        console.error('Error processing task update:', error);
      }
    });

    // Subscribe to outputs
    await subscriber.pSubscribe('outputs:*', (message, channel) => {
      try {
        const agent = channel.split(':')[1];
        const output = JSON.parse(message);
        this.broadcastToClients('agent_output', { agent, output });
      } catch (error) {
        console.error('Error processing agent output:', error);
      }
    });

    // Subscribe to queue updates
    await subscriber.subscribe('queue:update', message => {
      try {
        const queueData = JSON.parse(message);
        this.broadcastToClients('queue_update', queueData);
      } catch (error) {
        console.error('Error processing queue update:', error);
      }
    });

    // Subscribe to real-time task updates (any task status change)
    await subscriber.pSubscribe('task:*', (message, channel) => {
      try {
        const parts = channel.split(':');
        const taskId = parts[1];
        const updateType = parts[2] || 'status';
        const taskUpdate = JSON.parse(message);

        this.broadcastToClients('realtime_task_update', {
          taskId,
          updateType,
          ...taskUpdate,
        });

        // Also trigger task data refresh
        this.refreshTaskData();
      } catch (error) {
        console.error('Error processing real-time task update:', error);
      }
    });
  }

  startPeriodicUpdates() {
    // Send periodic updates to clients (reduced frequency since we have real-time updates)
    setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        this.broadcastToClients('metrics_update', metrics);
      } catch (error) {
        console.error('Error in periodic update:', error);
      }
    }, 30000); // Every 30 seconds (reduced from 10)
  }

  async refreshTaskData() {
    // Throttle task data refresh to avoid overwhelming the system
    if (this.taskRefreshTimeout) return;

    this.taskRefreshTimeout = setTimeout(async () => {
      try {
        const [pending, inProgress, completed, failed, blocked] =
          await Promise.all([
            this.getTasksByStatus(['pending', 'assigned']),
            this.getTasksByStatus(['in_progress']),
            this.getTasksByStatus(['completed']),
            this.getTasksByStatus(['failed', 'cancelled']),
            this.getTasksByStatus(['Blocked']),
          ]);

        this.broadcastToClients('tasks_refresh', {
          pending,
          in_progress: inProgress,
          completed,
          failed,
          blocked,
        });
      } catch (error) {
        console.error('Error refreshing task data:', error);
      } finally {
        this.taskRefreshTimeout = null;
      }
    }, 1000); // Throttle to once per second
  }

  broadcastToClients(event, data) {
    this.io.emit(event, data);
  }

  async getAllAgentStatuses() {
    try {
      // Fetch agent status from the swarm HTTP API
      const swarmUrl = process.env.AGENT_SWARM_URL || 'http://agent-swarm:3000';
      const response = await fetch(`${swarmUrl}/agents`);

      if (!response.ok) {
        throw new Error(`Failed to fetch from swarm: ${response.statusText}`);
      }

      const swarmAgents = await response.json();
      const statuses = {};

      // Convert swarm format to dashboard format
      for (const swarmAgent of swarmAgents) {
        statuses[swarmAgent.name] = {
          status: swarmAgent.status === 'active' ? 'idle' : swarmAgent.status,
          lastSeen: new Date().toISOString(),
          specialization: swarmAgent.specialization,
          conversationHistory: swarmAgent.conversationHistory,
          availableTools: swarmAgent.availableTools,
        };
      }

      // Add any missing agents as unknown
      for (const agent of this.agents) {
        if (!statuses[agent]) {
          statuses[agent] = { status: 'unknown', lastSeen: null };
        }
      }

      return statuses;
    } catch (error) {
      console.error('Error fetching agent statuses from swarm:', error);

      // Fallback: return unknown status for all agents
      const statuses = {};
      for (const agent of this.agents) {
        statuses[agent] = { status: 'error', lastSeen: null };
      }
      return statuses;
    }
  }

  // SIMPLIFIED: Single method to get tasks by status
  async getTasksByStatus(statuses) {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(
        `
        MATCH (t:Task)
        WHERE t.status IN $statuses
        RETURN t
        ORDER BY t.priority DESC, t.createdAt ASC
        LIMIT 50
      `,
        { statuses }
      );
      await session.close();

      return result.records.map(record => {
        const task = record.get('t').properties;
        // Convert Neo4j types to regular JavaScript types
        Object.keys(task).forEach(key => {
          if (neo4j.isInt(task[key])) {
            task[key] = task[key].toNumber();
          }
          if (neo4j.isDateTime(task[key])) {
            task[key] = task[key].toString();
          }
        });
        return task;
      });
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      return [];
    }
  }

  async getTasksByStatus(status) {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(
        `
        MATCH (t:Task)
        WHERE t.status = $status
        RETURN t
        ORDER BY t.createdAt DESC
        LIMIT 50
      `,
        { status }
      );
      await session.close();

      return result.records.map(record => {
        const task = record.get('t').properties;
        Object.keys(task).forEach(key => {
          if (neo4j.isInt(task[key])) {
            task[key] = task[key].toNumber();
          }
          // Convert Neo4j DateTime to ISO string
          if (neo4j.isDateTime(task[key])) {
            task[key] = task[key].toString();
          }
        });
        return task;
      });
    } catch (error) {
      console.error(`Error getting ${status} tasks:`, error);
      return [];
    }
  }

  async getAllTasks() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (t:Task)
        RETURN t
        ORDER BY t.createdAt DESC
        LIMIT 100
      `);
      await session.close();

      return result.records.map(record => {
        const task = record.get('t').properties;
        Object.keys(task).forEach(key => {
          if (neo4j.isInt(task[key])) {
            task[key] = task[key].toNumber();
          }
          // Convert Neo4j DateTime to ISO string
          if (neo4j.isDateTime(task[key])) {
            task[key] = task[key].toString();
          }
        });
        return task;
      });
    } catch (error) {
      console.error('Error getting all tasks:', error);
      return [];
    }
  }

  async getProjects() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (p:Knowledge)
        WHERE p.type = 'project'
        RETURN p
        ORDER BY p.createdAt DESC
        LIMIT 20
      `);
      await session.close();

      return result.records.map(record => {
        const project = record.get('p').properties;
        try {
          project.data = JSON.parse(project.data);
        } catch (e) {
          // If parsing fails, keep as string
        }
        return project;
      });
    } catch (error) {
      console.error('Error getting projects:', error);
      return [];
    }
  }

  async getMetrics() {
    try {
      const session = this.neo4jDriver.session();

      // Get task metrics
      const taskResult = await session.run(`
        MATCH (t:Task)
        RETURN
          count(t) as totalTasks,
          count(CASE WHEN t.status = 'completed' THEN 1 END) as completedTasks,
          count(CASE WHEN t.status = 'pending' THEN 1 END) as pendingTasks,
          count(CASE WHEN t.status = 'in_progress' THEN 1 END) as inProgressTasks,
          count(CASE WHEN t.status = 'failed' THEN 1 END) as failedTasks
      `);

      // Get agent metrics
      const agentResult = await session.run(`
        MATCH (a:Agent)
        RETURN count(a) as totalAgents
      `);

      await session.close();

      const taskMetrics = taskResult.records[0];
      const agentMetrics = agentResult.records[0];

      return {
        tasks: {
          total: taskMetrics.get('totalTasks').toNumber(),
          completed: taskMetrics.get('completedTasks').toNumber(),
          pending: taskMetrics.get('pendingTasks').toNumber(),
          inProgress: taskMetrics.get('inProgressTasks').toNumber(),
          failed: taskMetrics.get('failedTasks').toNumber(),
        },
        agents: {
          total: agentMetrics.get('totalAgents').toNumber(),
          active: await this.getActiveAgentCount(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting metrics:', error);
      return {
        tasks: { total: 0, completed: 0, pending: 0, inProgress: 0, failed: 0 },
        agents: { total: 0, active: 0 },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getActiveAgentCount() {
    let activeCount = 0;

    for (const agent of this.agents) {
      try {
        const statusData = await this.redis.get(`status:${agent}`);
        if (statusData) {
          const status = JSON.parse(statusData);
          if (
            status.status &&
            status.status !== 'error' &&
            status.status !== 'offline'
          ) {
            activeCount++;
          }
        }
      } catch (error) {
        // Agent not responding
      }
    }

    return activeCount;
  }

  async getAgentLogs(agent) {
    try {
      const logs = await this.redis.lRange(`logs:${agent}`, -100, -1);
      return logs.map(log => JSON.parse(log));
    } catch (error) {
      console.error(`Error getting logs for ${agent}:`, error);
      return [];
    }
  }

  async restartAgent(agent) {
    // Send restart signal via Redis
    await this.redis.publish(
      `agent:${agent}:control`,
      JSON.stringify({
        command: 'restart',
        timestamp: new Date().toISOString(),
      })
    );
  }

  async assignTask(agent, task) {
    const taskId = `manual_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const taskData = {
      id: taskId,
      title: task.title,
      description: task.description,
      type: task.type || 'manual',
      priority: task.priority || 'medium',
      from: 'dashboard',
      to: agent,
      data: task.data || {},
      timestamp: new Date().toISOString(),
    };

    // Store in graph
    const session = this.neo4jDriver.session();
    try {
      await session.run(
        `
        CREATE (t:Task {
          id: $id,
          title: $title,
          description: $description,
          type: $type,
          priority: $priority,
          agent: $agent,
          status: 'pending',
          createdAt: datetime(),
          data: $data
        })
      `,
        {
          id: taskId,
          title: task.title,
          description: task.description,
          type: task.type || 'manual',
          priority: task.priority || 'medium',
          agent: agent,
          data: JSON.stringify(task.data || {}),
        }
      );
    } finally {
      await session.close();
    }

    // Send via Redis
    await this.redis.publish(`agent:${agent}:task`, JSON.stringify(taskData));

    // SIMPLIFICATION: Immediately trigger processing by calling agent-team directly
    try {
      const agentTeamUrl =
        process.env.AGENT_TEAM_URL || 'http://agent-team:3000';
      const response = await fetch(`${agentTeamUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: {
            id: taskId,
            title: task.title,
            description: task.description,
            priority: task.priority || 'medium',
          },
          agent: agent,
        }),
      });

      if (response.ok) {
        // Update status to assigned in Neo4j
        const updateSession = this.neo4jDriver.session();
        try {
          await updateSession.run(
            `MATCH (t:Task {id: $id}) SET t.status = 'assigned', t.assignedAt = datetime()`,
            { id: taskId }
          );
        } finally {
          await updateSession.close();
        }
        console.log(`✅ Task ${taskId} immediately assigned to ${agent}`);
      }
    } catch (error) {
      console.error('Failed to trigger immediate processing:', error);
      // Task will still be picked up by auto-processing
    }

    return taskId;
  }

  async handleTaskAction(taskId, action) {
    const session = this.neo4jDriver.session();
    try {
      let status;
      let updateTime = 'updatedAt';

      switch (action) {
        case 'start':
        case 'resume':
          status = 'in_progress';
          updateTime = 'startedAt';
          break;
        case 'pause':
          status = 'paused';
          break;
        case 'stop':
        case 'cancel':
          status = 'cancelled';
          updateTime = 'cancelledAt';
          break;
        case 'complete':
          status = 'completed';
          updateTime = 'completedAt';
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      await session.run(
        `
        MATCH (t:Task {id: $taskId})
        SET t.status = $status,
            t.${updateTime} = datetime()
        RETURN t
        `,
        { taskId, status }
      );

      // Publish status update
      await this.redis.publish(
        `task:${taskId}:status`,
        JSON.stringify({
          taskId,
          status,
          action,
          timestamp: new Date().toISOString(),
        })
      );
    } finally {
      await session.close();
    }
  }

  async start() {
    const port = process.env.PORT || 3000;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.startPeriodicUpdates();

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`🌐 MCP Swarm Dashboard running on port ${port}`);
      console.log(`📊 Dashboard URL: http://0.0.0.0:${port}`);
      console.log(`📊 Access from network: http://[your-ip]:${port}`);
    });
  }

  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
    }
    this.server.close();
  }
}

// Start dashboard if this file is run directly
if (require.main === module) {
  const dashboard = new SwarmDashboard();

  process.on('SIGINT', async () => {
    console.log('\nShutting down dashboard...');
    await dashboard.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await dashboard.close();
    process.exit(0);
  });

  dashboard
    .initialize()
    .then(() => dashboard.start())
    .catch(error => {
      console.error('Failed to start dashboard:', error);
      process.exit(1);
    });
}

module.exports = SwarmDashboard;
