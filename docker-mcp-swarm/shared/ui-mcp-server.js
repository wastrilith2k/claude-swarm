const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

class AgentUIMCPServer {
  constructor(agentRole, port, communicator) {
    this.agentRole = agentRole;
    this.port = port;
    this.communicator = communicator;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Set();
    this.agentData = {
      tasks: [],
      status: 'idle',
      logs: [],
      metrics: {},
    };
  }

  initialize() {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupCommunicatorListeners();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'ui-static')));
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
      );
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        agent: this.agentRole,
        timestamp: new Date().toISOString(),
      });
    });

    // Agent dashboard
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json({
        agent: this.agentRole,
        status: this.agentData.status,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        tasks: {
          total: this.agentData.tasks.length,
          pending: this.agentData.tasks.filter(t => t.status === 'pending')
            .length,
          inProgress: this.agentData.tasks.filter(
            t => t.status === 'in_progress'
          ).length,
          completed: this.agentData.tasks.filter(t => t.status === 'completed')
            .length,
        },
      });
    });

    this.app.get('/api/tasks', (req, res) => {
      res.json(this.agentData.tasks);
    });

    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      res.json(this.agentData.logs.slice(-limit));
    });

    this.app.get('/api/metrics', (req, res) => {
      res.json(this.agentData.metrics);
    });

    // Control endpoints
    this.app.post('/api/tasks', async (req, res) => {
      try {
        const { targetAgent, task } = req.body;
        const taskId = await this.communicator.sendTask(targetAgent, task);
        res.json({ success: true, taskId });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/message', async (req, res) => {
      try {
        const { targetAgent, subject, content, data } = req.body;
        const messageId = await this.communicator.sendMessage(
          targetAgent,
          subject,
          content,
          data
        );
        res.json({ success: true, messageId });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/broadcast', async (req, res) => {
      try {
        const { type, content, data } = req.body;
        await this.communicator.broadcast(type, content, data);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', ws => {
      console.log(`🔌 UI client connected to ${this.agentRole} interface`);
      this.clients.add(ws);

      // Send initial data
      ws.send(
        JSON.stringify({
          type: 'initial_data',
          data: this.agentData,
        })
      );

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(
          `🔌 UI client disconnected from ${this.agentRole} interface`
        );
      });

      ws.on('error', error => {
        console.error(`WebSocket error for ${this.agentRole}:`, error);
        this.clients.delete(ws);
      });
    });
  }

  setupCommunicatorListeners() {
    this.communicator.on('task', task => {
      this.agentData.tasks.push({
        ...task,
        receivedAt: new Date().toISOString(),
      });
      this.addLog('info', `Received task: ${task.title}`);
      this.broadcastUpdate('task_received', task);
    });

    this.communicator.on('message', message => {
      this.addLog('info', `Message from ${message.from}: ${message.subject}`);
      this.broadcastUpdate('message_received', message);
    });

    this.communicator.on('status_update', (agentRole, status) => {
      this.addLog('info', `Status update from ${agentRole}: ${status.status}`);
      this.broadcastUpdate('agent_status_update', { agentRole, status });
    });
  }

  addLog(level, message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      agent: this.agentRole,
    };

    this.agentData.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.agentData.logs.length > 1000) {
      this.agentData.logs = this.agentData.logs.slice(-1000);
    }

    this.broadcastUpdate('log_entry', logEntry);
  }

  updateStatus(status, details = {}) {
    this.agentData.status = status;
    this.addLog('info', `Status changed to: ${status}`);
    this.broadcastUpdate('status_change', { status, details });
  }

  updateMetrics(metrics) {
    this.agentData.metrics = { ...this.agentData.metrics, ...metrics };
    this.broadcastUpdate('metrics_update', this.agentData.metrics);
  }

  broadcastUpdate(type, data) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error(`Error sending to client:`, error);
          this.clients.delete(client);
        }
      }
    });
  }

  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.agentRole.toUpperCase()} Agent Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .header h1 {
            color: #4a5568;
            margin-bottom: 10px;
        }

        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
        }

        .status-idle { background: #48bb78; }
        .status-working { background: #ed8936; }
        .status-error { background: #f56565; }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .card h2 {
            color: #4a5568;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }

        .task-item, .log-item {
            padding: 10px;
            margin: 5px 0;
            border-left: 4px solid #667eea;
            background: #f7fafc;
            border-radius: 5px;
        }

        .task-priority-high { border-left-color: #f56565; }
        .task-priority-medium { border-left-color: #ed8936; }
        .task-priority-low { border-left-color: #48bb78; }

        .log-error { border-left-color: #f56565; }
        .log-warn { border-left-color: #ed8936; }
        .log-info { border-left-color: #4299e1; }

        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }

        .metric {
            text-align: center;
            padding: 15px;
            background: #f7fafc;
            border-radius: 8px;
        }

        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }

        .metric-label {
            font-size: 12px;
            color: #718096;
            margin-top: 5px;
        }

        .controls {
            margin-top: 20px;
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
        }

        .btn:hover { background: #5a67d8; }

        .input-group {
            margin: 10px 0;
        }

        .input-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .input-group input, .input-group select, .input-group textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }

        .connected { color: #48bb78; }
        .disconnected { color: #f56565; }

        #logs {
            max-height: 300px;
            overflow-y: auto;
        }

        #tasks {
            max-height: 400px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.agentRole.toUpperCase()} Agent Dashboard</h1>
            <span class="status-badge status-idle" id="status">IDLE</span>
            <span id="connection-status" class="connected">● Connected</span>
        </div>

        <div class="grid">
            <div class="card">
                <h2>System Metrics</h2>
                <div class="metrics" id="metrics">
                    <div class="metric">
                        <div class="metric-value" id="uptime">0s</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="memory">0 MB</div>
                        <div class="metric-label">Memory</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="task-count">0</div>
                        <div class="metric-label">Tasks</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>Current Tasks</h2>
                <div id="tasks"></div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h2>Recent Logs</h2>
                <div id="logs"></div>
            </div>

            <div class="card">
                <h2>Agent Controls</h2>
                <div class="controls">
                    <h3>Send Task</h3>
                    <div class="input-group">
                        <label>Target Agent:</label>
                        <select id="target-agent">
                            <option value="architect">Architect</option>
                            <option value="frontend">Frontend</option>
                            <option value="backend">Backend</option>
                            <option value="devops">DevOps</option>
                            <option value="qa">QA</option>
                            <option value="docs">Docs</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Task Title:</label>
                        <input type="text" id="task-title" placeholder="Enter task title">
                    </div>
                    <div class="input-group">
                        <label>Task Description:</label>
                        <textarea id="task-description" placeholder="Enter task description"></textarea>
                    </div>
                    <button class="btn" onclick="sendTask()">Send Task</button>

                    <h3 style="margin-top: 20px;">Broadcast Message</h3>
                    <div class="input-group">
                        <label>Message Type:</label>
                        <input type="text" id="broadcast-type" placeholder="announcement">
                    </div>
                    <div class="input-group">
                        <label>Message Content:</label>
                        <textarea id="broadcast-content" placeholder="Enter broadcast message"></textarea>
                    </div>
                    <button class="btn" onclick="sendBroadcast()">Broadcast</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        let ws;
        let agentData = { tasks: [], logs: [], metrics: {} };

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(\`\${protocol}//\${window.location.host}\`);

            ws.onopen = function() {
                document.getElementById('connection-status').textContent = '● Connected';
                document.getElementById('connection-status').className = 'connected';
            };

            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };

            ws.onclose = function() {
                document.getElementById('connection-status').textContent = '● Disconnected';
                document.getElementById('connection-status').className = 'disconnected';
                setTimeout(connect, 5000); // Reconnect after 5 seconds
            };

            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
        }

        function handleMessage(message) {
            switch(message.type) {
                case 'initial_data':
                    agentData = message.data;
                    updateUI();
                    break;
                case 'task_received':
                    agentData.tasks.push(message.data);
                    updateTasks();
                    break;
                case 'log_entry':
                    agentData.logs.push(message.data);
                    updateLogs();
                    break;
                case 'status_change':
                    updateStatus(message.data.status);
                    break;
                case 'metrics_update':
                    agentData.metrics = message.data;
                    updateMetrics();
                    break;
            }
        }

        function updateUI() {
            updateTasks();
            updateLogs();
            updateMetrics();
        }

        function updateTasks() {
            const container = document.getElementById('tasks');
            container.innerHTML = agentData.tasks.slice(-10).map(task => \`
                <div class="task-item task-priority-\${task.priority || 'medium'}">
                    <strong>\${task.title}</strong><br>
                    <small>From: \${task.from} | Priority: \${task.priority || 'medium'} | Status: \${task.status || 'pending'}</small><br>
                    <span>\${task.description || 'No description'}</span>
                </div>
            \`).join('');
        }

        function updateLogs() {
            const container = document.getElementById('logs');
            container.innerHTML = agentData.logs.slice(-20).map(log => \`
                <div class="log-item log-\${log.level}">
                    <small>\${new Date(log.timestamp).toLocaleTimeString()}</small><br>
                    \${log.message}
                </div>
            \`).join('');
            container.scrollTop = container.scrollHeight;
        }

        function updateStatus(status) {
            const badge = document.getElementById('status');
            badge.textContent = status.toUpperCase();
            badge.className = \`status-badge status-\${status}\`;
        }

        function updateMetrics() {
            // Update metrics from API
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('uptime').textContent = Math.floor(data.uptime) + 's';
                    document.getElementById('memory').textContent = Math.floor(data.memory.heapUsed / 1024 / 1024) + ' MB';
                    document.getElementById('task-count').textContent = data.tasks.total;
                });
        }

        async function sendTask() {
            const targetAgent = document.getElementById('target-agent').value;
            const title = document.getElementById('task-title').value;
            const description = document.getElementById('task-description').value;

            if (!title) {
                alert('Please enter a task title');
                return;
            }

            try {
                const response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetAgent,
                        task: {
                            type: 'manual',
                            title,
                            description,
                            priority: 'medium'
                        }
                    })
                });

                if (response.ok) {
                    document.getElementById('task-title').value = '';
                    document.getElementById('task-description').value = '';
                    alert('Task sent successfully!');
                } else {
                    alert('Failed to send task');
                }
            } catch (error) {
                alert('Error sending task: ' + error.message);
            }
        }

        async function sendBroadcast() {
            const type = document.getElementById('broadcast-type').value;
            const content = document.getElementById('broadcast-content').value;

            if (!type || !content) {
                alert('Please enter both type and content');
                return;
            }

            try {
                const response = await fetch('/api/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, content })
                });

                if (response.ok) {
                    document.getElementById('broadcast-type').value = '';
                    document.getElementById('broadcast-content').value = '';
                    alert('Broadcast sent successfully!');
                } else {
                    alert('Failed to send broadcast');
                }
            } catch (error) {
                alert('Error sending broadcast: ' + error.message);
            }
        }

        // Initialize
        connect();
        setInterval(updateMetrics, 10000); // Update metrics every 10 seconds
    </script>
</body>
</html>
    `;
  }

  start() {
    return new Promise(resolve => {
      this.server.listen(this.port, () => {
        console.log(
          `🌐 ${this.agentRole} UI server running on port ${this.port}`
        );
        resolve();
      });
    });
  }

  close() {
    return new Promise(resolve => {
      this.wss.close();
      this.server.close(() => {
        console.log(`👋 ${this.agentRole} UI server closed`);
        resolve();
      });
    });
  }
}

module.exports = AgentUIMCPServer;
