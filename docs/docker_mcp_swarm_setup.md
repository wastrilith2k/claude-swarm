- **Task**: Implement user authentication UI
  - **Estimated Hours**: 12
  - **Priority**: High
  - **Dependencies**: Backend auth API
  - **Acceptance Criteria**: Login/register forms, password reset

- **Task**: Build dashboard components
  - **Estimated Hours**: 16
  - **Priority**: Medium
  - **Dependencies**: API endpoints
  - **Acceptance Criteria**: Real-time data display, responsive charts

## Backend Developer Tasks
### API Development
- **Task**: Design and implement authentication system
  - **Estimated Hours**: 20
  - **Priority**: High
  - **Dependencies**: Database schema
  - **Acceptance Criteria**: JWT tokens, role-based access

- **Task**: Create core business logic APIs
  - **Estimated Hours**: 24
  - **Priority**: High
  - **Dependencies**: Database models
  - **Acceptance Criteria**: RESTful design, proper error handling

- **Task**: Implement data processing endpoints
  - **Estimated Hours**: 16
  - **Priority**: Medium
  - **Dependencies**: Core APIs
  - **Acceptance Criteria**: Async processing, job queues

## DevOps Engineer Tasks
### Infrastructure Setup
- **Task**: Set up Docker containerization
  - **Estimated Hours**: 8
  - **Priority**: High
  - **Dependencies**: Application code
  - **Acceptance Criteria**: Multi-stage builds, optimized images

- **Task**: Configure CI/CD pipeline
  - **Estimated Hours**: 12
  - **Priority**: High
  - **Dependencies**: Docker setup
  - **Acceptance Criteria**: Automated testing, deployment

## QA Tester Tasks
### Testing Strategy
- **Task**: Create comprehensive test suite
  - **Estimated Hours**: 20
  - **Priority**: Medium
  - **Dependencies**: Feature completion
  - **Acceptance Criteria**: 80%+ code coverage

## Documentation Writer Tasks
### Documentation Creation
- **Task**: Write API documentation
  - **Estimated Hours**: 12
  - **Priority**: Low
  - **Dependencies**: API completion
  - **Acceptance Criteria**: OpenAPI spec, examples
      `,

      architecture_design: `
# System Architecture Design

## High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Backend       │
│   (React)       │◄──►│   (Kong/Nginx)  │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                      │
                                ▼                      ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Load Balancer │    │   Database      │
                       │   (HAProxy)     │    │   (PostgreSQL)  │
                       └─────────────────┘    └─────────────────┘
```

## Database Schema Design
### Users Table
- id (UUID, Primary Key)
- email (String, Unique)
- password_hash (String)
- role (Enum: admin, user)
- created_at (Timestamp)
- updated_at (Timestamp)

### Projects Table
- id (UUID, Primary Key)
- name (String)
- description (Text)
- user_id (UUID, Foreign Key)
- status (Enum: active, completed, archived)
- created_at (Timestamp)

## API Architecture
### Authentication Endpoints
- POST /auth/login
- POST /auth/register
- POST /auth/refresh
- DELETE /auth/logout

### Core Business Endpoints
- GET /api/v1/projects
- POST /api/v1/projects
- GET /api/v1/projects/:id
- PUT /api/v1/projects/:id
- DELETE /api/v1/projects/:id

## Security Considerations
1. **Authentication**: JWT with refresh tokens
2. **Authorization**: Role-based access control
3. **Data Protection**: Encryption at rest and in transit
4. **API Security**: Rate limiting, input validation
5. **Infrastructure**: Network segmentation, firewalls

## Scalability Plan
1. **Horizontal Scaling**: Load balancers for API servers
2. **Database Scaling**: Read replicas, connection pooling
3. **Caching Strategy**: Redis for session/query caching
4. **CDN**: Static asset distribution
5. **Microservices**: Break down into smaller services as needed
      `
    };

    // Simple prompt matching for mock responses
    if (prompt.toLowerCase().includes('analyz')) {
      return responses.project_analysis;
    } else if (prompt.toLowerCase().includes('task breakdown') || prompt.toLowerCase().includes('taskmaster')) {
      return responses.task_breakdown;
    } else if (prompt.toLowerCase().includes('architecture')) {
      return responses.architecture_design;
    }

    // Default response
    return `
Based on your request, I've analyzed the situation using the available MCP servers:

**Analysis Results:**
- Used Knowledge Graph to retrieve relevant context
- Consulted documentation via Context7/Exa search
- Applied best practices from research

**Recommendations:**
1. Proceed with the proposed approach
2. Monitor progress and adjust as needed
3. Coordinate with team members for dependencies

**Next Steps:**
- Implement the recommended solution
- Test thoroughly before deployment
- Document the process for future reference

This response utilized the following MCP servers:
- ${Array.from(this.mcpServers.keys()).join(', ') || 'mock servers'}
    `;
  }

  async close() {
    // Stop all MCP servers
    for (const [name, server] of this.mcpServers) {
      try {
        server.process.kill();
        console.log(`🛑 Stopped MCP server: ${name}`);
      } catch (error) {
        console.error(`❌ Error stopping MCP server ${name}:`, error);
      }
    }

    this.mcpServers.clear();
    this.isReady = false;
    console.log('👋 Claude client closed');
  }
}

module.exports = ClaudeClient;
```

## 8. Web Dashboard

### dashboard/Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### dashboard/package.json
```json
{
  "name": "mcp-swarm-dashboard",
  "version": "1.0.0",
  "description": "Web dashboard for MCP Swarm monitoring",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.7",
    "neo4j-driver": "^5.12.0",
    "socket.io": "^4.7.2",
    "cors": "^2.8.5",
    "morgan": "^1.10.0"
  }
}
```

### dashboard/server.js
```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('redis');
const neo4j = require('neo4j-driver');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

class SwarmDashboard {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.redis = null;
    this.neo4jDriver = null;
    this.agents = ['architect', 'frontend', 'backend', 'devops', 'qa', 'docs'];
    this.clientSockets = new Set();
  }

  async initialize() {
    try {
      // Initialize Redis connection
      this.redis = Redis.createClient({
        url: process.env.REDIS_URL
      });
      await this.redis.connect();

      // Initialize Neo4j connection
      this.neo4jDriver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
      );

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup WebSocket handlers
      this.setupWebSocket();

      // Start periodic updates
      this.startPeriodicUpdates();

      console.log('✅ Dashboard initialized');
    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(morgan('combined'));
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // Dashboard home
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
        const tasks = await this.getPendingTasks();
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/tasks/completed', async (req, res) => {
      try {
        const tasks = await this.getCompletedTasks();
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
        res.json({ status: 'restarting' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/tasks', async (req, res) => {
      try {
        const { agent, task } = req.body;
        const taskId = await this.assignTask(agent, task);
        res.json({ taskId });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('📡 Dashboard client connected');
      this.clientSockets.add(socket);

      socket.on('disconnect', () => {
        console.log('📡 Dashboard client disconnected');
        this.clientSockets.delete(socket);
      });

      socket.on('subscribe_agent_logs', (agent) => {
        socket.join(`logs_${agent}`);
      });

      socket.on('unsubscribe_agent_logs', (agent) => {
        socket.leave(`logs_${agent}`);
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
      const agent = channel.split(':')[1];
      const statusData = JSON.parse(message);
      this.broadcastToClients('agent_status_update', { agent, status: statusData });
    });

    // Subscribe to task updates
    await subscriber.pSubscribe('task:*:status', (message, channel) => {
      const taskId = channel.split(':')[1];
      const taskUpdate = JSON.parse(message);
      this.broadcastToClients('task_update', { taskId, ...taskUpdate });
    });

    // Subscribe to outputs
    await subscriber.pSubscribe('outputs:*', (message, channel) => {
      const agent = channel.split(':')[1];
      const output = JSON.parse(message);
      this.broadcastToClients('agent_output', { agent, output });
    });
  }

  startPeriodicUpdates() {
    // Send periodic updates to clients
    setInterval(async () => {
      try {
        const statuses = await this.getAllAgentStatuses();
        const metrics = await this.getMetrics();

        this.broadcastToClients('periodic_update', {
          timestamp: Date.now(),
          statuses,
          metrics
        });
      } catch (error) {
        console.error('Error in periodic update:', error);
      }
    }, 10000); // Every 10 seconds
  }

  broadcastToClients(event, data) {
    this.io.emit(event, data);
  }

  async getAllAgentStatuses() {
    const statuses = {};

    for (const agent of this.agents) {
      try {
        const status = await this.redis.get(`agent_status:${agent}`);
        statuses[agent] = status ? JSON.parse(status) : null;
      } catch (error) {
        statuses[agent] = { error: error.message };
      }
    }

    return statuses;
  }

  async getPendingTasks() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status = 'pending'
        OPTIONAL MATCH (t)-[:TO]->(agent:Agent)
        RETURN t, agent.name as assignedTo
        ORDER BY t.created DESC
        LIMIT 50
      `);

      await session.close();

      return result.records.map(record => {
        const task = record.get('t').properties;
        const assignedTo = record.get('assignedTo');
        return { ...task, assignedTo };
      });
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return [];
    }
  }

  async getCompletedTasks() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status = 'completed'
        OPTIONAL MATCH (t)-[:TO]->(agent:Agent)
        RETURN t, agent.name as assignedTo
        ORDER BY t.completed DESC
        LIMIT 50
      `);

      await session.close();

      return result.records.map(record => {
        const task = record.get('t').properties;
        const assignedTo = record.get('assignedTo');
        return { ...task, assignedTo };
      });
    } catch (error) {
      console.error('Error getting completed tasks:', error);
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
        ORDER BY p.created DESC
      `);

      await session.close();

      return result.records.map(record => {
        const project = record.get('p').properties;
        return {
          ...project,
          data: JSON.parse(project.data || '{}')
        };
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
      const taskMetrics = await session.run(`
        MATCH (t:Task)
        RETURN
          count(CASE WHEN t.status = 'pending' THEN 1 END) as pendingTasks,
          count(CASE WHEN t.status = 'in_progress' THEN 1 END) as inProgressTasks,
          count(CASE WHEN t.status = 'completed' THEN 1 END) as completedTasks,
          count(CASE WHEN t.status = 'failed' THEN 1 END) as failedTasks
      `);

      // Get project metrics
      const projectMetrics = await session.run(`
        MATCH (p:Knowledge)
        WHERE p.type = 'project'
        RETURN count(p) as totalProjects
      `);

      await session.close();

      const taskData = taskMetrics.records[0];
      const projectData = projectMetrics.records[0];

      return {
        tasks: {
          pending: taskData.get('pendingTasks').toNumber(),
          inProgress: taskData.get('inProgressTasks').toNumber(),
          completed: taskData.get('completedTasks').toNumber(),
          failed: taskData.get('failedTasks').toNumber()
        },
        projects: {
          total: projectData.get('totalProjects').toNumber()
        },
        agents: {
          total: this.agents.length,
          active: await this.getActiveAgentCount()
        }
      };
    } catch (error) {
      console.error('Error getting metrics:', error);
      return {
        tasks: { pending: 0, inProgress: 0, completed: 0, failed: 0 },
        projects: { total: 0 },
        agents: { total: this.agents.length, active: 0 }
      };
    }
  }

  async getActiveAgentCount() {
    let activeCount = 0;

    for (const agent of this.agents) {
      try {
        const status = await this.redis.get(`agent_status:${agent}`);
        if (status) {
          const statusData = JSON.parse(status);
          const timeSinceUpdate = Date.now() - statusData.timestamp;
          if (timeSinceUpdate < 60000) { // Active within last minute
            activeCount++;
          }
        }
      } catch (error) {
        // Ignore errors for individual agents
      }
    }

    return activeCount;
  }

  async getAgentLogs(agent) {
    try {
      // In a real implementation, you would read from log files
      // For now, return recent outputs from Redis
      const outputs = await this.redis.lRange(`outputs:${agent}`, 0, 49);
      return outputs.map(output => JSON.parse(output));
    } catch (error) {
      console.error(`Error getting logs for ${agent}:`, error);
      return [];
    }
  }

  async restartAgent(agent) {
    // Send restart signal via Redis
    await this.redis.publish(`agent:${agent}:control`, JSON.stringify({
      command: 'restart',
      timestamp: Date.now()
    }));
  }

  async assignTask(agent, task) {
    const taskId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send task via Redis
    await this.redis.publish(`agent:${agent}:tasks`, JSON.stringify({
      id: taskId,
      from: 'dashboard',
      timestamp: Date.now(),
      ...task
    }));

    return taskId;
  }

  async start() {
    const port = process.env.PORT || 3000;

    this.server.listen(port, () => {
      console.log(`🌐 Dashboard server running on port ${port}`);
      console.log(`📊 Dashboard available at http://localhost:${port}`);
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

  dashboard.initialize()
    .then(() => dashboard.start())
    .catch(error => {
      console.error('Failed to start dashboard:', error);
      process.exit(1);
    });
}

module.exports = SwarmDashboard;
```

### dashboard/public/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Swarm Dashboard</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>🤖 MCP Swarm Dashboard</h1>
            <div class="status-indicator" id="connection-status">
                <span class="status-dot"></span>
                Connected
            </div>
        </header>

        <div class="dashboard-grid">
            <!-- Agent Status Section -->
            <section class="panel agent-status">
                <h2>Agent Status</h2>
                <div class="agent-grid" id="agent-grid">
                    <!-- Agent cards will be populated by JavaScript -->
                </div>
            </section>

            <!-- Metrics Section -->
            <section class="panel metrics">
                <h2>System Metrics</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>Tasks</h3>
                        <canvas id="tasks-chart"></canvas>
                    </div>
                    <div class="metric-card">
                        <h3>Agent Activity</h3>
                        <div class="metric-value" id="active-agents">0/6</div>
                    </div>
                    <div class="metric-card">
                        <h3>Projects</h3>
                        <div class="metric-value" id="total-projects">0</div>
                    </div>
                </div>
            </section>

            <!-- Tasks Section -->
            <section class="panel tasks">
                <h2>Recent Tasks</h2>
                <div class="task-tabs">
                    <button class="tab-button active" data-tab="pending">Pending</button>
                    <button class="tab-button" data-tab="completed">Completed</button>
                </div>
                <div class="task-list" id="task-list">
                    <!-- Tasks will be populated by JavaScript -->
                </div>
            </section>

            <!-- Logs Section -->
            <section class="panel logs">
                <h2>Agent Logs</h2>
                <div class="log-controls">
                    <select id="log-agent-select">
                        <option value="">Select Agent</option>
                        <option value="architect">Architect</option>
                        <option value="frontend">Frontend</option>
                        <option value="backend">Backend</option>
                        <option value="devops">DevOps</option>
                        <option value="qa">QA</option>
                        <option value="docs">Documentation</option>
                    </select>
                    <button id="clear-logs">Clear</button>
                </div>
                <div class="log-content" id="log-content">
                    <p>Select an agent to view logs</p>
                </div>
            </section>
        </div>

        <!-- Task Assignment Modal -->
        <div class="modal" id="task-modal">
            <div class="modal-content">
                <h3>Assign New Task</h3>
                <form id="task-form">
                    <div class="form-group">
                        <label for="task-agent">Agent:</label>
                        <select id="task-agent" required>
                            <option value="">Select Agent</option>
                            <option value="architect">Architect</option>
                            <option value="frontend">Frontend</option>
                            <option value="backend">Backend</option>
                            <option value="devops">DevOps</option>
                            <option value="qa">QA</option>
                            <option value="docs">Documentation</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="task-title">Title:</label>
                        <input type="text" id="task-title" required>
                    </div>
                    <div class="form-group">
                        <label for="task-description">Description:</label>
                        <textarea id="task-description" rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="task-priority">Priority:</label>
                        <select id="task-priority">
                            <option value="low">Low</option>
                            <option value="normal" selected>Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-cancel">Cancel</button>
                        <button type="submit" class="btn-primary">Assign Task</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
            <button id="assign-task-btn" class="btn-primary">+ Assign Task</button>
            <button id="refresh-btn" class="btn-secondary">🔄 Refresh</button>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

## 9. Management Scripts

### scripts/start-swarm.sh
```bash
#!/bin/bash
set -e

echo "🚀 Starting Docker MCP Swarm..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create necessar```

### agents/architect/start.sh
```bash
#!/bin/bash
set -e

echo "🏗️ Starting Architect Agent MCP servers..."

# Function to check if a port is in use
check_port() {
    nc -z localhost $1 >/dev/null 2>&1
}

# Function to start MCP server with retry
start_mcp_server() {
    local name=$1
    local command=$2
    local port=$3
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        echo "Starting $name (attempt $((retry + 1))/$max_retries)..."

        if [ "$name" == "taskmaster" ]; then
            nohup npx @modelcontextprotocol/server-taskmaster --port $port > /workspace/logs/$name.log 2>&1 &
        elif [ "$name" == "google-workspace" ]; then
            nohup npx @google/workspace-mcp-server --port $port > /workspace/logs/$name.log 2>&1 &
        elif [ "$name" == "exa" ]; then
            nohup python3 -m exa_mcp_server --port $port > /workspace/logs/$name.log 2>&1 &
        elif [ "$name" == "graphiti" ]; then
            nohup python3 -m graphiti_mcp_server --port $port > /workspace/logs/$name.log 2>&1 &
        fi

        sleep 3

        if check_port $port; then
            echo "✅ $name started successfully on port $port"
            return 0
        else
            echo "❌ Failed to start $name on port $port"
            retry=$((retry + 1))
        fi
    done

    echo "⚠️  $name failed to start after $max_retries attempts, using mock server"
    return 1
}

# Create logs directory
mkdir -p /workspace/logs

# Start MCP servers
start_mcp_server "taskmaster" "npx @modelcontextprotocol/server-taskmaster" 9001
start_mcp_server "google-workspace" "npx @google/workspace-mcp-server" 9002
start_mcp_server "exa" "python3 -m exa_mcp_server" 9003
start_mcp_server "graphiti" "python3 -m graphiti_mcp_server" 9004

# Wait for all MCP servers to be ready
echo "⏳ Waiting for MCP servers to initialize..."
sleep 10

# Start the main agent process
echo "🚀 Starting Architect Agent main process..."
exec node agent.js
```

### agents/architect/config.json
```json
{
  "role": "architect",
  "description": "Lead Architect responsible for project planning, task breakdown, and team coordination",
  "capabilities": [
    "project_planning",
    "task_breakdown",
    "architecture_design",
    "team_coordination",
    "requirements_analysis"
  ],
  "mcpServers": {
    "taskmaster": {
      "port": 9001,
      "description": "Project task management and breakdown",
      "capabilities": ["task_creation", "project_planning", "milestone_tracking"]
    },
    "google_workspace": {
      "port": 9002,
      "description": "Google Workspace integration for documentation",
      "capabilities": ["document_creation", "sheet_management", "collaboration"]
    },
    "exa": {
      "port": 9003,
      "description": "Programming search and research",
      "capabilities": ["code_search", "documentation_lookup", "best_practices"]
    },
    "graphiti": {
      "port": 9004,
      "description": "Knowledge graph for project memory",
      "capabilities": ["knowledge_storage", "relationship_tracking", "context_retrieval"]
    }
  },
  "workflows": {
    "project_initialization": [
      "analyze_requirements",
      "design_architecture",
      "create_task_breakdown",
      "delegate_tasks",
      "setup_monitoring"
    ],
    "team_coordination": [
      "check_agent_status",
      "identify_bottlenecks",
      "reassign_tasks",
      "update_stakeholders"
    ]
  },
  "priorities": {
    "project_analysis": "high",
    "task_breakdown": "high",
    "architecture_design": "medium",
    "team_coordination": "medium",
    "documentation": "low"
  }
}
```

## 7. Shared Claude Client

### shared/claude-client.js
```javascript
const WebSocket = require('ws');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class ClaudeClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.mcpServers = new Map();
    this.claudeProcess = null;
    this.isReady = false;
    this.messageQueue = [];
  }

  async initialize() {
    try {
      // Start MCP servers
      await this.startMCPServers();

      // Initialize Claude client (mock implementation)
      await this.initializeClaudeConnection();

      this.isReady = true;
      console.log('✅ Claude client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Claude client:', error);
      throw error;
    }
  }

  async startMCPServers() {
    if (!this.config.mcpServers) return;

    for (const [name, serverConfig] of Object.entries(this.config.mcpServers)) {
      try {
        const process = spawn(serverConfig.command, serverConfig.args, {
          env: { ...process.env, ...serverConfig.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        process.stdout.on('data', (data) => {
          console.log(`[${name}] ${data.toString().trim()}`);
        });

        process.stderr.on('data', (data) => {
          console.error(`[${name}] ${data.toString().trim()}`);
        });

        process.on('exit', (code) => {
          console.log(`[${name}] MCP server exited with code ${code}`);
          this.mcpServers.delete(name);
        });

        this.mcpServers.set(name, {
          process,
          config: serverConfig,
          status: 'running'
        });

        console.log(`✅ Started MCP server: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to start MCP server ${name}:`, error);
      }
    }

    // Wait for servers to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async initializeClaudeConnection() {
    // Mock Claude connection - in reality, this would connect to Claude API
    // or use a headless Claude client
    console.log('🔗 Initializing Claude connection (mock)...');

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✅ Claude connection established (mock)');
  }

  async ask(prompt, options = {}) {
    if (!this.isReady) {
      throw new Error('Claude client not ready');
    }

    try {
      // Mock Claude response - in reality, this would send the prompt to Claude
      // with access to all configured MCP servers
      console.log('🤔 Processing prompt with Claude...');

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock response that includes MCP server usage
      const response = await this.generateMockResponse(prompt, options);

      console.log('✅ Claude response generated');
      return response;
    } catch (error) {
      console.error('❌ Claude request failed:', error);
      throw error;
    }
  }

  async generateMockResponse(prompt, options) {
    // This is a mock implementation
    // In reality, Claude would process the prompt with access to MCP servers

    const responses = {
      project_analysis: `
# Project Analysis Report

## Technical Architecture Overview
Based on the requirements analysis, this project follows a modern microservices architecture with:
- **Frontend**: React.js with responsive design
- **Backend**: Node.js/Express REST API
- **Database**: PostgreSQL with Redis caching
- **Infrastructure**: Docker containers with Kubernetes orchestration

## Key Components
1. **User Management Service**: Authentication and authorization
2. **Core Business Logic**: Main application functionality
3. **Data Processing Service**: Analytics and reporting
4. **Notification Service**: Email and push notifications

## Technology Stack Recommendations
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js 18, Express.js, TypeScript
- **Database**: PostgreSQL 15, Redis 7
- **Infrastructure**: Docker, Kubernetes, AWS/GCP
- **Monitoring**: Prometheus, Grafana, ELK Stack

## Potential Risks and Challenges
1. **Scalability**: Need to plan for horizontal scaling
2. **Security**: Implement comprehensive security measures
3. **Performance**: Optimize database queries and API responses
4. **Complexity**: Manage microservices communication

## Development Timeline Estimate
- **Phase 1**: Architecture and setup (1-2 weeks)
- **Phase 2**: Core development (6-8 weeks)
- **Phase 3**: Testing and optimization (2-3 weeks)
- **Phase 4**: Deployment and monitoring (1 week)

**Total Estimated Timeline**: 10-14 weeks
      `,

      task_breakdown: `
# Detailed Task Breakdown

## Frontend Developer Tasks
### UI/UX Development
- **Task**: Create responsive landing page
  - **Estimated Hours**: 8
  - **Priority**: High
  - **Dependencies**: Design mockups
  - **Acceptance Criteria**: Mobile-first, < 3s load time

- **Task**: Implement user authentication UI
  - **Estimated Hours**: 12
  - **Priority**: High
  - **Dependencies**: Backen# Complete Docker MCP Swarm Setup

## Project Structure
```
docker-mcp-swarm/
├── docker-compose.yml
├── .env
├── agents/
│   ├── base/
│   │   ├── Dockerfile.base
│   │   ├── package.json
│   │   └── requirements.txt
│   ├── architect/
│   │   ├── Dockerfile
│   │   ├── agent.js
│   │   ├── start.sh
│   │   └── config.json
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── agent.js
│   │   ├── start.sh
│   │   └── config.json
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── agent.js
│   │   ├── start.sh
│   │   └── config.json
│   ├── devops/
│   │   ├── Dockerfile
│   │   ├── agent.js
│   │   ├── start.sh
│   │   └── config.json
│   ├── qa/
│   │   ├── Dockerfile
│   │   ├── agent.js
│   │   ├── start.sh
│   │   └── config.json
│   └── docs/
│       ├── Dockerfile
│       ├── agent.js
│       ├── start.sh
│       └── config.json
├── shared/
│   ├── communication.js
│   ├── claude-client.js
│   └── utils.js
├── dashboard/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── public/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── scripts/
│   ├── start-swarm.sh
│   ├── stop-swarm.sh
│   ├── monitor-swarm.sh
│   ├── shell-agent.sh
│   └── project-init.py
└── workspace/
    ├── projects/
    ├── shared/
    └── logs/
```

## 1. Environment Configuration

### .env
```bash
# Neo4j Configuration
NEO4J_AUTH=neo4j/swarmpassword
NEO4J_PLUGINS=["apoc"]

# Redis Configuration
REDIS_PASSWORD=swarmredis

# Google Services (add your credentials)
GOOGLE_CREDENTIALS_PATH=/config/google-credentials.json

# API Keys (replace with your actual keys)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=fc2d5d94-cc7a-41d5-9278-3033329068e8
EXA_API_KEY=your_exa_api_key
BRIGHTDATA_API_KEY=your_brightdata_key
RAGIE_API_KEY=your_ragie_key
COMET_API_KEY=your_comet_key
MINDSDB_EMAIL=your_mindsdb_email
MINDSDB_PASSWORD=your_mindsdb_password

# Swarm Configuration
SWARM_NETWORK=mcp_swarm_network
WORKSPACE_PATH=./workspace
```

## 2. Docker Compose Configuration

### docker-compose.yml
```yaml
version: '3.8'

services:
  # Infrastructure Services
  neo4j:
    image: neo4j:5.12-community
    container_name: swarm_neo4j
    environment:
      - NEO4J_AUTH=${NEO4J_AUTH}
      - NEO4J_PLUGINS=${NEO4J_PLUGINS}
      - NEO4J_dbms_security_procedures_unrestricted=apoc.*
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    networks:
      - ${SWARM_NETWORK}
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p swarmpassword 'RETURN 1'"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: swarm_redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - ${SWARM_NETWORK}
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  # Agent Services
  architect:
    build:
      context: ./agents/architect
      dockerfile: Dockerfile
    container_name: swarm_architect
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - AGENT_ROLE=architect
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - GOOGLE_CREDENTIALS_PATH=${GOOGLE_CREDENTIALS_PATH}
      - EXA_API_KEY=${EXA_API_KEY}
      - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
      - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
    volumes:
      - ${WORKSPACE_PATH}:/workspace
      - ./config/google-credentials.json:${GOOGLE_CREDENTIALS_PATH}:ro
    networks:
      - ${SWARM_NETWORK}
    stdin_open: true
    tty: true
    restart: unless-stopped

  frontend:
    build:
      context: ./agents/frontend
      dockerfile: Dockerfile
    container_name: swarm_frontend
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - AGENT_ROLE=frontend
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
      - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
    volumes:
      - ${WORKSPACE_PATH}:/workspace
    networks:
      - ${SWARM_NETWORK}
    stdin_open: true
    tty: true
    restart: unless-stopped

  backend:
    build:
      context: ./agents/backend
      dockerfile: Dockerfile
    container_name: swarm_backend
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - AGENT_ROLE=backend
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - GOOGLE_CREDENTIALS_PATH=${GOOGLE_CREDENTIALS_PATH}
      - MINDSDB_EMAIL=${MINDSDB_EMAIL}
      - MINDSDB_PASSWORD=${MINDSDB_PASSWORD}
      - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
      - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
    volumes:
      - ${WORKSPACE_PATH}:/workspace
      - ./config/google-credentials.json:${GOOGLE_CREDENTIALS_PATH}:ro
    networks:
      - ${SWARM_NETWORK}
    stdin_open: true
    tty: true
    restart: unless-stopped

  devops:
    build:
      context: ./agents/devops
      dockerfile: Dockerfile
    container_name: swarm_devops
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - AGENT_ROLE=devops
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - GOOGLE_CREDENTIALS_PATH=${GOOGLE_CREDENTIALS_PATH}
      - BRIGHTDATA_API_KEY=${BRIGHTDATA_API_KEY}
      - COMET_API_KEY=${COMET_API_KEY}
    volumes:
      - ${WORKSPACE_PATH}:/workspace
      - ./config/google-credentials.json:${GOOGLE_CREDENTIALS_PATH}:ro
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - ${SWARM_NETWORK}
    stdin_open: true
    tty: true
    restart: unless-stopped

  qa:
    build:
      context: ./agents/qa
      dockerfile: Dockerfile
    container_name: swarm_qa
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - AGENT_ROLE=qa
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - EXA_API_KEY=${EXA_API_KEY}
      - RAGIE_API_KEY=${RAGIE_API_KEY}
    volumes:
      - ${WORKSPACE_PATH}:/workspace
    networks:
      - ${SWARM_NETWORK}
    stdin_open: true
    tty: true
    restart: unless-stopped

  docs:
    build:
      context: ./agents/docs
      dockerfile: Dockerfile
    container_name: swarm_docs
    depends_on:
      neo4j:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - AGENT_ROLE=docs
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - GOOGLE_CREDENTIALS_PATH=${GOOGLE_CREDENTIALS_PATH}
      - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
      - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
    volumes:
      - ${WORKSPACE_PATH}:/workspace
      - ./config/google-credentials.json:${GOOGLE_CREDENTIALS_PATH}:ro
    networks:
      - ${SWARM_NETWORK}
    stdin_open: true
    tty: true
    restart: unless-stopped

  # Dashboard Service
  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    container_name: swarm_dashboard
    depends_on:
      redis:
        condition: service_healthy
      neo4j:
        condition: service_healthy
    environment:
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=swarmpassword
    ports:
      - "3000:3000"
    volumes:
      - ${WORKSPACE_PATH}:/workspace:ro
    networks:
      - ${SWARM_NETWORK}
    restart: unless-stopped

networks:
  mcp_swarm_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  neo4j_data:
  neo4j_logs:
  redis_data:
```

## 3. Base Docker Image

### agents/base/Dockerfile.base
```dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    curl \
    bash \
    openssh-client \
    docker-cli

# Create app directory
WORKDIR /app

# Install global Node.js packages (common to all agents)
RUN npm install -g pm2

# Copy base package.json and install common dependencies
COPY package.json requirements.txt ./
RUN npm install
RUN pip3 install -r requirements.txt

# Copy shared utilities
COPY ../shared/ ./shared/

# Create workspace directory
RUN mkdir -p /workspace

# Set up entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

### agents/base/package.json
```json
{
  "name": "mcp-swarm-base",
  "version": "1.0.0",
  "description": "Base package for MCP Swarm agents",
  "dependencies": {
    "redis": "^4.6.7",
    "neo4j-driver": "^5.12.0",
    "uuid": "^9.0.0",
    "axios": "^1.4.0",
    "ws": "^8.13.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "winston": "^3.10.0"
  }
}
```

### agents/base/requirements.txt
```txt
asyncio
aioredis
neo4j
python-dotenv
requests
websockets
pyyaml
```

### agents/base/entrypoint.sh
```bash
#!/bin/bash
set -e

echo "🤖 Starting MCP Swarm Agent: $AGENT_ROLE"

# Wait for infrastructure services
echo "⏳ Waiting for Neo4j..."
while ! nc -z neo4j 7687; do
  sleep 1
done

echo "⏳ Waiting for Redis..."
while ! nc -z redis 6379; do
  sleep 1
done

echo "✅ Infrastructure ready"

# Execute the main command
exec "$@"
```

## 4. Agent Dockerfiles

### agents/architect/Dockerfile
```dockerfile
FROM mcp-swarm-base:latest

# Install architect-specific MCP servers
RUN npm install -g @modelcontextprotocol/server-taskmaster || echo "Taskmaster not available, using mock"
RUN npm install -g @google/workspace-mcp-server || echo "Google Workspace not available, using mock"
RUN pip3 install exa-mcp-server || echo "Exa not available, using mock"
RUN pip3 install graphiti-mcp-server || echo "Graphiti not available, using mock"

# Copy agent-specific files
COPY agent.js config.json start.sh ./
RUN chmod +x start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["./start.sh"]
```

### agents/frontend/Dockerfile
```dockerfile
FROM mcp-swarm-base:latest

# Install frontend-specific MCP servers
RUN npm install -g @modelcontextprotocol/server-jupyter || echo "Jupyter not available, using mock"
RUN npm install -g @magicui/mcp-server || echo "Magic UI not available, using mock"
RUN npm install -g @upstash/context7-mcp || echo "Context7 not available, using mock"
RUN pip3 install graphiti-mcp-server || echo "Graphiti not available, using mock"

COPY agent.js config.json start.sh ./
RUN chmod +x start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8081/health || exit 1

EXPOSE 8081

CMD ["./start.sh"]
```

### agents/backend/Dockerfile
```dockerfile
FROM mcp-swarm-base:latest

# Install backend-specific MCP servers
RUN npm install -g @modelcontextprotocol/server-jupyter || echo "Jupyter not available, using mock"
RUN npm install -g @firebase/mcp-server || echo "Firebase not available, using mock"
RUN pip3 install mindsdb-mcp-server || echo "MindsDB not available, using mock"
RUN pip3 install graphiti-mcp-server || echo "Graphiti not available, using mock"

COPY agent.js config.json start.sh ./
RUN chmod +x start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8082/health || exit 1

EXPOSE 8082

CMD ["./start.sh"]
```

### agents/devops/Dockerfile
```dockerfile
FROM mcp-swarm-base:latest

# Install DevOps tools
RUN apk add --no-cache docker-cli kubectl

# Install devops-specific MCP servers
RUN npm install -g @firebase/mcp-server || echo "Firebase not available, using mock"
RUN npm install -g @brightdata/mcp-server || echo "Bright Data not available, using mock"
RUN pip3 install comet-opik-mcp || echo "Opik not available, using mock"
RUN npm install -g @modelcontextprotocol/server-jupyter || echo "Jupyter not available, using mock"

COPY agent.js config.json start.sh ./
RUN chmod +x start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8083/health || exit 1

EXPOSE 8083

CMD ["./start.sh"]
```

### agents/qa/Dockerfile
```dockerfile
FROM mcp-swarm-base:latest

# Install QA-specific MCP servers
RUN npm install -g @modelcontextprotocol/server-jupyter || echo "Jupyter not available, using mock"
RUN pip3 install exa-mcp-server || echo "Exa not available, using mock"
RUN pip3 install ragie-mcp-server || echo "Ragie not available, using mock"
RUN pip3 install graphiti-mcp-server || echo "Graphiti not available, using mock"

COPY agent.js config.json start.sh ./
RUN chmod +x start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8084/health || exit 1

EXPOSE 8084

CMD ["./start.sh"]
```

### agents/docs/Dockerfile
```dockerfile
FROM mcp-swarm-base:latest

# Install docs-specific MCP servers
RUN npm install -g @google/workspace-mcp-server || echo "Google Workspace not available, using mock"
RUN npm install -g @upstash/context7-mcp || echo "Context7 not available, using mock"
RUN pip3 install graphiti-mcp-server || echo "Graphiti not available, using mock"

COPY agent.js config.json start.sh ./
RUN chmod +x start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8085/health || exit 1

EXPOSE 8085

CMD ["./start.sh"]
```

## 5. Shared Communication System

### shared/communication.js
```javascript
const Redis = require('redis');
const neo4j = require('neo4j-driver');
const EventEmitter = require('events');

class SwarmCommunicator extends EventEmitter {
  constructor(agentRole, config) {
    super();
    this.agentRole = agentRole;
    this.config = config;
    this.redis = null;
    this.neo4jDriver = null;
    this.session = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Initialize Redis connection
      this.redis = Redis.createClient({
        url: this.config.redisUrl,
        retry_delay_on_failure: 100,
        retry_delay_on_cluster_down: 300,
        retry_delay_on_failover: 100,
        max_attempts: 3
      });

      await this.redis.connect();

      // Initialize Neo4j connection
      this.neo4jDriver = neo4j.driver(
        this.config.neo4jUri,
        neo4j.auth.basic(this.config.neo4jUser, this.config.neo4jPassword)
      );

      // Set up subscriptions
      await this.setupSubscriptions();

      this.isConnected = true;
      console.log(`✅ ${this.agentRole} communicator initialized`);
    } catch (error) {
      console.error(`❌ Failed to initialize communicator:`, error);
      throw error;
    }
  }

  async setupSubscriptions() {
    // Subscribe to agent-specific channels
    const subscriber = this.redis.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(`agent:${this.agentRole}:tasks`, (message) => {
      this.handleTask(JSON.parse(message));
    });

    await subscriber.subscribe(`agent:${this.agentRole}:messages`, (message) => {
      this.handleMessage(JSON.parse(message));
    });

    await subscriber.subscribe('broadcast:all', (message) => {
      this.handleBroadcast(JSON.parse(message));
    });

    // Status updates from other agents
    await subscriber.pSubscribe('status:*', (message, channel) => {
      const agentRole = channel.split(':')[1];
      if (agentRole !== this.agentRole) {
        this.handleStatusUpdate(agentRole, JSON.parse(message));
      }
    });
  }

  async sendTask(targetAgent, task) {
    if (!this.isConnected) {
      throw new Error('Communicator not initialized');
    }

    const taskData = {
      id: `${this.agentRole}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: this.agentRole,
      to: targetAgent,
      timestamp: Date.now(),
      ...task
    };

    try {
      // Send via Redis pub/sub
      await this.redis.publish(`agent:${targetAgent}:tasks`, JSON.stringify(taskData));

      // Store in Neo4j for persistence and analytics
      const session = this.neo4jDriver.session();
      await session.run(`
        MERGE (from:Agent {name: $fromAgent})
        MERGE (to:Agent {name: $toAgent})
        CREATE (t:Task {
          id: $id,
          title: $title,
          description: $description,
          status: 'pending',
          priority: $priority,
          created: datetime($timestamp),
          estimatedHours: $estimatedHours
        })
        CREATE (from)-[:ASSIGNED]->(t)-[:TO]->(to)
      `, {
        fromAgent: this.agentRole,
        toAgent: targetAgent,
        id: taskData.id,
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        priority: taskData.priority || 'normal',
        timestamp: new Date(taskData.timestamp).toISOString(),
        estimatedHours: taskData.estimatedHours || 0
      });
      await session.close();

      console.log(`📤 Task sent to ${targetAgent}: ${taskData.title || taskData.id}`);
      return taskData.id;
    } catch (error) {
      console.error(`❌ Failed to send task to ${targetAgent}:`, error);
      throw error;
    }
  }

  async updateTaskStatus(taskId, status, result = null) {
    try {
      const session = this.neo4jDriver.session();
      await session.run(`
        MATCH (t:Task {id: $taskId})
        SET t.status = $status,
            t.completed = CASE WHEN $status = 'completed' THEN datetime() ELSE t.completed END,
            t.result = $result
      `, {
        taskId,
        status,
        result: result ? JSON.stringify(result) : null
      });
      await session.close();

      // Notify other agents
      await this.redis.publish(`task:${taskId}:status`, JSON.stringify({
        taskId,
        status,
        completedBy: this.agentRole,
        result,
        timestamp: Date.now()
      }));

      console.log(`✅ Task ${taskId} status updated: ${status}`);
    } catch (error) {
      console.error(`❌ Failed to update task status:`, error);
      throw error;
    }
  }

  async updateStatus(status, details = {}) {
    const statusData = {
      agent: this.agentRole,
      status,
      details,
      timestamp: Date.now()
    };

    try {
      // Store current status in Redis
      await this.redis.setEx(`agent_status:${this.agentRole}`, 3600, JSON.stringify(statusData));

      // Broadcast status update
      await this.redis.publish(`status:${this.agentRole}`, JSON.stringify(statusData));

      console.log(`🔄 Status updated: ${status}`);
    } catch (error) {
      console.error(`❌ Failed to update status:`, error);
      throw error;
    }
  }

  async shareOutput(output) {
    const outputData = {
      id: `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agent: this.agentRole,
      timestamp: Date.now(),
      ...output
    };

    try {
      // Store in Redis with expiration
      await this.redis.lPush(`outputs:${this.agentRole}`, JSON.stringify(outputData));
      await this.redis.lTrim(`outputs:${this.agentRole}`, 0, 99); // Keep last 100 outputs

      // Broadcast to interested parties
      await this.redis.publish(`outputs:${this.agentRole}`, JSON.stringify(outputData));

      console.log(`📊 Output shared: ${outputData.type || 'result'}`);
      return outputData.id;
    } catch (error) {
      console.error(`❌ Failed to share output:`, error);
      throw error;
    }
  }

  async getAgentStatus(agentRole) {
    try {
      const status = await this.redis.get(`agent_status:${agentRole}`);
      return status ? JSON.parse(status) : null;
    } catch (error) {
      console.error(`❌ Failed to get agent status:`, error);
      return null;
    }
  }

  async getAllAgentStatuses() {
    const agents = ['architect', 'frontend', 'backend', 'devops', 'qa', 'docs'];
    const statuses = {};

    for (const agent of agents) {
      statuses[agent] = await this.getAgentStatus(agent);
    }

    return statuses;
  }

  async getPendingTasks() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (t:Task)-[:TO]->(agent:Agent {name: $agentName})
        WHERE t.status = 'pending'
        RETURN t
        ORDER BY t.created DESC
      `, { agentName: this.agentRole });

      await session.close();
      return result.records.map(record => record.get('t').properties);
    } catch (error) {
      console.error(`❌ Failed to get pending tasks:`, error);
      return [];
    }
  }

  async storeKnowledge(type, data, relationships = []) {
    try {
      const session = this.neo4jDriver.session();
      const knowledgeId = `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store knowledge node
      await session.run(`
        CREATE (k:Knowledge {
          id: $id,
          type: $type,
          data: $data,
          createdBy: $agent,
          created: datetime()
        })
      `, {
        id: knowledgeId,
        type,
        data: JSON.stringify(data),
        agent: this.agentRole
      });

      // Create relationships if specified
      for (const rel of relationships) {
        await session.run(`
          MATCH (k:Knowledge {id: $knowledgeId})
          MATCH (target) WHERE target.id = $targetId
          CREATE (k)-[:${rel.type}]->(target)
        `, {
          knowledgeId,
          targetId: rel.targetId
        });
      }

      await session.close();
      console.log(`🧠 Knowledge stored: ${type}`);
      return knowledgeId;
    } catch (error) {
      console.error(`❌ Failed to store knowledge:`, error);
      throw error;
    }
  }

  handleTask(taskData) {
    console.log(`📥 Received task: ${taskData.title || taskData.id}`);
    this.emit('task', taskData);
  }

  handleMessage(messageData) {
    console.log(`💬 Received message from ${messageData.from}`);
    this.emit('message', messageData);
  }

  handleBroadcast(broadcastData) {
    console.log(`📢 Received broadcast: ${broadcastData.type}`);
    this.emit('broadcast', broadcastData);
  }

  handleStatusUpdate(agentRole, statusData) {
    this.emit('status_update', agentRole, statusData);
  }

  async close() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      if (this.neo4jDriver) {
        await this.neo4jDriver.close();
      }
      this.isConnected = false;
      console.log(`👋 ${this.agentRole} communicator closed`);
    } catch (error) {
      console.error(`❌ Error closing communicator:`, error);
    }
  }
}

module.exports = SwarmCommunicator;
```

## 6. Agent Implementation Example

### agents/architect/agent.js
```javascript
const express = require('express');
const SwarmCommunicator = require('../shared/communication');
const ClaudeClient = require('../shared/claude-client');
const winston = require('winston');

class ArchitectAgent {
  constructor() {
    this.role = 'architect';
    this.communicator = null;
    this.claudeClient = null;
    this.app = express();
    this.mcpServers = new Map();
    this.currentProject = null;
    this.activeTasks = new Map();

    // Setup logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level.toUpperCase()}] [ARCHITECT]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: '/workspace/logs/architect.log' })
      ]
    });
  }

  async initialize() {
    try {
      // Initialize communication system
      this.communicator = new SwarmCommunicator(this.role, {
        redisUrl: process.env.REDIS_URL,
        neo4jUri: process.env.NEO4J_URI,
        neo4jUser: process.env.NEO4J_USER,
        neo4jPassword: process.env.NEO4J_PASSWORD
      });

      await this.communicator.initialize();

      // Initialize Claude client with MCP servers
      this.claudeClient = new ClaudeClient({
        mcpServers: {
          taskmaster: {
            command: 'npx',
            args: ['@modelcontextprotocol/server-taskmaster'],
            env: process.env
          },
          graphiti: {
            command: 'python3',
            args: ['-m', 'graphiti_mcp_server'],
            env: process.env
          },
          google_workspace: {
            command: 'npx',
            args: ['@google/workspace-mcp-server'],
            env: process.env
          },
          exa: {
            command: 'python3',
            args: ['-m', 'exa_mcp_server'],
            env: process.env
          }
        }
      });

      await this.claudeClient.initialize();

      // Setup event handlers
      this.setupEventHandlers();

      // Setup Express server
      this.setupWebServer();

      // Start the agent
      this.start();

      this.logger.info('Architect agent initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize architect agent: ${error.message}`);
      throw error;
    }
  }

  setupEventHandlers() {
    // Handle incoming tasks
    this.communicator.on('task', async (taskData) => {
      this.logger.info(`Received task: ${taskData.title}`);
      await this.handleTask(taskData);
    });

    // Handle messages from other agents
    this.communicator.on('message', async (messageData) => {
      this.logger.info(`Received message from ${messageData.from}: ${messageData.subject}`);
      await this.handleMessage(messageData);
    });

    // Handle status updates from other agents
    this.communicator.on('status_update', (agentRole, statusData) => {
      this.logger.info(`Agent ${agentRole} status: ${statusData.status}`);
      this.handleAgentStatusUpdate(agentRole, statusData);
    });

    // Handle broadcast messages
    this.communicator.on('broadcast', async (broadcastData) => {
      this.logger.info(`Received broadcast: ${broadcastData.type}`);
      await this.handleBroadcast(broadcastData);
    });
  }

  setupWebServer() {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        agent: this.role,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Agent status endpoint
    this.app.get('/status', async (req, res) => {
      const status = await this.communicator.getAgentStatus(this.role);
      const allStatuses = await this.communicator.getAllAgentStatuses();

      res.json({
        agent: this.role,
        status,
        allAgents: allStatuses,
        activeTasks: Array.from(this.activeTasks.keys()),
        currentProject: this.currentProject
      });
    });

    // Project management endpoints
    this.app.post('/project/initialize', async (req, res) => {
      try {
        const { name, type, requirements } = req.body;
        const projectId = await this.initializeProject(name, type, requirements);
        res.json({ projectId, status: 'initialized' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/project/:id/breakdown', async (req, res) => {
      try {
        const breakdown = await this.getProjectBreakdown(req.params.id);
        res.json(breakdown);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Task management endpoints
    this.app.get('/tasks/pending', async (req, res) => {
      try {
        const tasks = await this.communicator.getPendingTasks();
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/tasks/delegate', async (req, res) => {
      try {
        const { agent, task } = req.body;
        const taskId = await this.delegateTask(agent, task);
        res.json({ taskId, status: 'delegated' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    const port = process.env.PORT || 8080;
    this.app.listen(port, () => {
      this.logger.info(`Architect agent web server listening on port ${port}`);
    });
  }

  async start() {
    await this.communicator.updateStatus('idle', {
      capabilities: [
        'project_planning',
        'task_breakdown',
        'architecture_design',
        'team_coordination',
        'requirements_analysis'
      ]
    });

    // Check for any existing projects or pending work
    await this.checkForWork();

    // Start periodic status checks
    setInterval(() => {
      this.performPeriodicTasks();
    }, 30000); // Every 30 seconds

    this.logger.info('Architect agent started and ready for work');
  }

  async checkForWork() {
    // Check for pending tasks
    const pendingTasks = await this.communicator.getPendingTasks();
    if (pendingTasks.length > 0) {
      this.logger.info(`Found ${pendingTasks.length} pending tasks`);
      for (const task of pendingTasks) {
        await this.handleTask(task);
      }
    }

    // Check for new project requirements
    const requirementsFile = '/workspace/requirements.txt';
    try {
      const fs = require('fs');
      if (fs.existsSync(requirementsFile)) {
        const requirements = fs.readFileSync(requirementsFile, 'utf8');
        if (requirements.trim() && !this.currentProject) {
          this.logger.info('Found new project requirements');
          await this.processProjectRequirements(requirements);
        }
      }
    } catch (error) {
      this.logger.warn(`Error checking requirements file: ${error.message}`);
    }
  }

  async handleTask(taskData) {
    this.activeTasks.set(taskData.id, taskData);
    await this.communicator.updateTaskStatus(taskData.id, 'in_progress');
    await this.communicator.updateStatus('working', { currentTask: taskData.title });

    try {
      let result;

      switch (taskData.type) {
        case 'project_analysis':
          result = await this.analyzeProject(taskData);
          break;
        case 'task_breakdown':
          result = await this.createTaskBreakdown(taskData);
          break;
        case 'architecture_design':
          result = await this.designArchitecture(taskData);
          break;
        case 'team_coordination':
          result = await this.coordinateTeam(taskData);
          break;
        default:
          result = await this.handleGenericTask(taskData);
      }

      await this.communicator.updateTaskStatus(taskData.id, 'completed', result);
      await this.communicator.shareOutput({
        type: 'task_completion',
        taskId: taskData.id,
        result
      });

      this.activeTasks.delete(taskData.id);
      this.logger.info(`Task completed: ${taskData.title}`);
    } catch (error) {
      this.logger.error(`Task failed: ${error.message}`);
      await this.communicator.updateTaskStatus(taskData.id, 'failed', { error: error.message });
      this.activeTasks.delete(taskData.id);
    }

    // Update status back to idle if no more active tasks
    if (this.activeTasks.size === 0) {
      await this.communicator.updateStatus('idle');
    }
  }

  async analyzeProject(taskData) {
    this.logger.info('Analyzing project requirements...');

    // Use Claude with MCP servers to analyze the project
    const analysis = await this.claudeClient.ask(`
      As the lead architect, analyze this project:
      ${JSON.stringify(taskData.projectData, null, 2)}

      Please provide:
      1. Technical architecture overview
      2. Key components and their relationships
      3. Technology stack recommendations
      4. Potential risks and challenges
      5. Development timeline estimate

      Use your knowledge graph to store this analysis for future reference.
    `);

    // Store analysis in knowledge graph
    await this.communicator.storeKnowledge('project_analysis', {
      projectId: taskData.projectId,
      analysis,
      timestamp: Date.now()
    });

    return {
      analysis,
      recommendations: this.extractRecommendations(analysis),
      nextSteps: ['Create detailed task breakdown', 'Design system architecture', 'Set up development environment']
    };
  }

  async createTaskBreakdown(taskData) {
    this.logger.info('Creating detailed task breakdown...');

    const breakdown = await this.claudeClient.ask(`
      Using the Taskmaster MCP server, create a detailed task breakdown for this project:
      ${JSON.stringify(taskData, null, 2)}

      Break this down into specific tasks for each team member:
      - Frontend Developer: UI/UX tasks
      - Backend Developer: API and database tasks
      - DevOps Engineer: Infrastructure and deployment tasks
      - QA Tester: Testing and quality assurance tasks
      - Documentation Writer: Documentation tasks

      For each task, include:
      - Clear title and description
      - Estimated hours
      - Dependencies
      - Priority level
      - Acceptance criteria
    `);

    // Parse the breakdown and delegate tasks
    const tasks = this.parseTaskBreakdown(breakdown);

    for (const task of tasks) {
      await this.delegateTask(task.assignee, task);
    }

    return {
      breakdown,
      totalTasks: tasks.length,
      delegatedTasks: tasks.map(t => ({ id: t.id, assignee: t.assignee, title: t.title }))
    };
  }

  async designArchitecture(taskData) {
    this.logger.info('Designing system architecture...');

    const architecture = await this.claudeClient.ask(`
      Design a comprehensive system architecture for this project:
      ${JSON.stringify(taskData, null, 2)}

      Include:
      1. High-level system diagram
      2. Database schema design
      3. API architecture
      4. Frontend architecture
      5. Deployment architecture
      6. Security considerations
      7. Scalability plan

      Use the Google Workspace MCP server to create documentation that can be shared with the team.
    `);

    // Create architecture document
    await this.communicator.shareOutput({
      type: 'architecture_design',
      projectId: taskData.projectId,
      architecture,
      diagrams: this.extractDiagrams(architecture),
      specifications: this.extractSpecifications(architecture)
    });

    return architecture;
  }

  async coordinateTeam(taskData) {
    this.logger.info('Coordinating team activities...');

    // Get status of all agents
    const agentStatuses = await this.communicator.getAllAgentStatuses();

    // Identify bottlenecks or issues
    const issues = this.identifyIssues(agentStatuses);

    // Reassign tasks if needed
    const reassignments = await this.handleTaskReassignments(issues);

    // Broadcast coordination update
    await this.communicator.shareOutput({
      type: 'coordination_update',
      agentStatuses,
      issues,
      reassignments,
      recommendations: this.generateCoordinationRecommendations(agentStatuses)
    });

    return {
      status: 'coordinated',
      issues,
      reassignments,
      nextCheckIn: Date.now() + (30 * 60 * 1000) // 30 minutes
    };
  }

  async handleGenericTask(taskData) {
    this.logger.info(`Handling generic task: ${taskData.type}`);

    const response = await this.claudeClient.ask(`
      As the lead architect, handle this task:
      ${JSON.stringify(taskData, null, 2)}

      Provide a comprehensive response and any necessary follow-up actions.
      Use all available MCP servers as needed.
    `);

    return { response, handledBy: 'architect' };
  }

  async delegateTask(targetAgent, task) {
    const taskId = await this.communicator.sendTask(targetAgent, {
      type: 'development',
      title: task.title,
      description: task.description,
      priority: task.priority || 'normal',
      estimatedHours: task.estimatedHours || 1,
      deadline: task.deadline,
      dependencies: task.dependencies || [],
      acceptanceCriteria: task.acceptanceCriteria || []
    });

    this.logger.info(`Delegated task ${taskId} to ${targetAgent}: ${task.title}`);
    return taskId;
  }

  async processProjectRequirements(requirements) {
    this.logger.info('Processing new project requirements');

    // Create project analysis task
    await this.handleTask({
      id: 'project_init',
      type: 'project_analysis',
      title: 'Analyze New Project Requirements',
      projectData: { requirements },
      priority: 'high'
    });
  }

  async initializeProject(name, type, requirements) {
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentProject = {
      id: projectId,
      name,
      type,
      requirements,
      status: 'initializing',
      created: Date.now()
    };

    // Store project in knowledge graph
    await this.communicator.storeKnowledge('project', this.currentProject);

    // Start project analysis
    await this.handleTask({
      id: `${projectId}_analysis`,
      type: 'project_analysis',
      title: `Analyze ${name}`,
      projectId,
      projectData: this.currentProject
    });

    return projectId;
  }

  async performPeriodicTasks() {
    // Check agent statuses
    const statuses = await this.communicator.getAllAgentStatuses();

    // Look for stuck or failed agents
    const stuckAgents = Object.entries(statuses)
      .filter(([agent, status]) => {
        if (!status) return false;
        const timeSinceUpdate = Date.now() - status.timestamp;
        return timeSinceUpdate > 5 * 60 * 1000; // 5 minutes
      })
      .map(([agent]) => agent);

    if (stuckAgents.length > 0) {
      this.logger.warn(`Potentially stuck agents: ${stuckAgents.join(', ')}`);
      // Could implement recovery logic here
    }

    // Update our own status
    await this.communicator.updateStatus(
      this.activeTasks.size > 0 ? 'working' : 'idle',
      {
        activeTasks: this.activeTasks.size,
        currentProject: this.currentProject?.id
      }
    );
  }

  // Helper methods
  extractRecommendations(analysis) {
    // Extract key recommendations from analysis text
    const lines = analysis.split('\n');
    return lines.filter(line =>
      line.toLowerCase().includes('recommend') ||
      line.toLowerCase().includes('suggest')
    );
  }

  parseTaskBreakdown(breakdown) {
    // Parse the breakdown text and create task objects
    // This would need to be implemented based on the actual format
    // returned by the Taskmaster MCP server
    return [];
  }

  extractDiagrams(architecture) {
    // Extract diagram descriptions from architecture text
    return [];
  }

  extractSpecifications(architecture) {
    // Extract technical specifications
    return {};
  }

  identifyIssues(agentStatuses) {
    const issues = [];

    Object.entries(agentStatuses).forEach(([agent, status]) => {
      if (!status) {
        issues.push({ type: 'offline', agent, severity: 'high' });
        return;
      }

      const timeSinceUpdate = Date.now() - status.timestamp;

      if (timeSinceUpdate > 10 * 60 * 1000) { // 10 minutes
        issues.push({ type: 'unresponsive', agent, severity: 'medium', duration: timeSinceUpdate });
      }

      if (status.status === 'error') {
        issues.push({ type: 'error', agent, severity: 'high', details: status.details });
      }
    });

    return issues;
  }

  async handleTaskReassignments(issues) {
    const reassignments = [];

    for (const issue of issues.filter(i => i.severity === 'high')) {
      // Logic to reassign tasks from problematic agents
      // This would involve querying the knowledge graph for pending tasks
      this.logger.warn(`High severity issue with ${issue.agent}: ${issue.type}`);
    }

    return reassignments;
  }

  generateCoordinationRecommendations(agentStatuses) {
    const recommendations = [];

    // Analyze workload distribution
    const workingAgents = Object.entries(agentStatuses)
      .filter(([, status]) => status?.status === 'working').length;

    const idleAgents = Object.entries(agentStatuses)
      .filter(([, status]) => status?.status === 'idle').length;

    if (idleAgents > workingAgents) {
      recommendations.push('Consider redistributing work to idle agents');
    }

    return recommendations;
  }

  async handleMessage(messageData) {
    // Handle direct messages from other agents
    this.logger.info(`Processing message from ${messageData.from}: ${messageData.subject}`);
  }

  handleAgentStatusUpdate(agentRole, statusData) {
    // React to status changes from other agents
    if (statusData.status === 'error') {
      this.logger.warn(`Agent ${agentRole} reported an error: ${JSON.stringify(statusData.details)}`);
    }
  }

  async handleBroadcast(broadcastData) {
    // Handle broadcast messages
    switch (broadcastData.type) {
      case 'project_milestone':
        this.logger.info(`Project milestone reached: ${broadcastData.milestone}`);
        break;
      case 'emergency':
        this.logger.error(`Emergency broadcast: ${broadcastData.message}`);
        break;
    }
  }
}

// Start the agent if this file is run directly
if (require.main === module) {
  const agent = new ArchitectAgent();

  process.on('SIGINT', async () => {
    console.log('\nShutting down architect agent...');
    if (agent.communicator) {
      await agent.communicator.close();
    }
    process.exit(0);
  });

  agent.initialize().catch(error => {
    console.error('Failed to start architect agent:', error);
    process.exit(1);
  });
}

module.exports = ArchitectAgent;
