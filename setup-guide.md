# Claude Desktop + VS Code Integration Setup

This guide walks you through setting up the Claude Swarm system to work with both Claude Desktop and VS Code using MCP servers.

## 🚀 Quick Setup

### 1. Install MCP Servers

```bash
# Install chat server dependencies
cd /home/james/projs/claude-swarm/mcp-chat-server
npm install

# Install tools server dependencies
cd /home/james/projs/claude-swarm/mcp-tools-server
npm install
```

### 2. Configure Claude Desktop

Add to your `~/.config/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claude-swarm-chat": {
      "command": "node",
      "args": ["/home/james/projs/claude-swarm/mcp-chat-server/index.js"],
      "env": {
        "REDIS_URL": "redis://localhost:6379"
      }
    },
    "claude-swarm-tools": {
      "command": "node",
      "args": ["/home/james/projs/claude-swarm/mcp-tools-server/index.js"]
    }
  }
}
```

### 3. Install VS Code Extension

The Claude Code extension is already installed! You can also try these alternatives:

```vscode-extensions
saoudrizwan.claude-dev,continue.continue,rooveterinaryinc.roo-cline
```

### 4. Configure VS Code

Add to your VS Code `settings.json`:

```json
{
  "claude.mcpServers": {
    "claude-swarm-chat": {
      "command": "node",
      "args": ["/home/james/projs/claude-swarm/mcp-chat-server/index.js"],
      "env": {
        "REDIS_URL": "redis://localhost:6379"
      }
    },
    "claude-swarm-tools": {
      "command": "node",
      "args": ["/home/james/projs/claude-swarm/mcp-tools-server/index.js"]
    }
  }
}
```

## 🔧 Start the System

### 1. Start Redis and Core Services

```bash
cd /home/james/projs/claude-swarm
docker-compose up -d redis neo4j
```

### 2. Start Agent Services

```bash
# Start all agents
docker-compose up -d dashboard architect frontend backend devops qa docs

# Or start individually
docker-compose up -d architect
docker-compose up -d frontend
# etc.
```

### 3. Verify Everything is Running

```bash
# Check containers
docker ps

# Check Redis connectivity
redis-cli ping

# Check Neo4j
curl http://localhost:7474

# Check dashboard
curl http://localhost:8080
```

## 💬 Usage Examples

### In Claude Desktop

Once configured, you'll have these tools available:

**Chat with specific agents:**
```
Use the chat_with_agent tool:
- agentName: "architect"
- message: "Design a microservices architecture for an e-commerce platform"
- priority: "normal"
```

**Check system status:**
```
Use the get_swarm_status tool to see:
- Which agents are online
- Current task queues
- Rate limiting status
```

**Coordinate multiple agents:**
```
Use the coordinate_agents tool:
- task: "Build a React dashboard with Node.js backend and deploy to AWS"
- agents: ["frontend", "backend", "devops"]
```

**Work with project files:**
```
Use tools from claude-swarm-tools:
- read_project_file: Read any file in the project
- write_project_file: Create or update files
- list_project_files: Explore project structure
- get_docker_status: Monitor containers
- get_swarm_logs: Debug issues
```

### In VS Code

#### With Claude Code Extension

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Claude: Start Chat"
3. Use tools directly:
   - `@chat_with_agent architect "Help me design this system"`
   - `@get_swarm_status`
   - `@read_project_file "shared/real-claude-agent.js"`

#### With Cline (Alternative)

1. Open Cline sidebar
2. Start conversation
3. Cline automatically discovers MCP tools
4. Ask natural language questions:
   - "Get the architect agent to help design this feature"
   - "Check what files are in the shared directory"
   - "Deploy the swarm to development environment"

## 🛠️ Advanced Configuration

### Environment-Specific Settings

Create different configs for dev/staging/prod:

**Development (`claude_desktop_config.dev.json`):**
```json
{
  "mcpServers": {
    "claude-swarm-chat": {
      "command": "node",
      "args": ["/home/james/projs/claude-swarm/mcp-chat-server/index.js"],
      "env": {
        "REDIS_URL": "redis://localhost:6379",
        "SWARM_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**Production:**
```json
{
  "mcpServers": {
    "claude-swarm-chat": {
      "command": "node",
      "args": ["/home/james/projs/claude-swarm/mcp-chat-server/index.js"],
      "env": {
        "REDIS_URL": "redis://prod-redis:6379",
        "SWARM_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Rate Limiting Configuration

The system includes intelligent rate limiting to manage your 5-hour API quota:

```json
{
  "claude.rateLimiting": {
    "enabled": true,
    "requestsPerHour": 50,
    "tokensPerHour": 100000,
    "priorityMultipliers": {
      "high": 1.5,
      "normal": 1.0,
      "low": 0.5
    }
  }
}
```

### Custom Keybindings

Add to VS Code `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+a",
    "command": "claude.tools.chat_with_agent",
    "args": { "agentName": "architect" }
  },
  {
    "key": "ctrl+shift+s",
    "command": "claude.tools.get_swarm_status"
  },
  {
    "key": "ctrl+shift+d",
    "command": "claude.tools.get_docker_status"
  }
]
```

## 🐛 Troubleshooting

### Common Issues

**1. MCP Server Connection Failed**
```bash
# Check if Redis is running
redis-cli ping

# Check if node is installed
node --version

# Test MCP server directly
node /home/james/projs/claude-swarm/mcp-chat-server/index.js
```

**2. Agent Not Responding**
```bash
# Check agent containers
docker ps | grep claude-swarm

# Check agent logs
docker logs claude-swarm-architect

# Check Redis for tasks
redis-cli llen queue:architect
```

**3. VS Code Extension Issues**
```bash
# Check VS Code logs
# View → Output → Claude

# Reload VS Code window
# Ctrl+Shift+P → "Developer: Reload Window"

# Check extension is enabled
# Extensions → Claude Code → Enabled
```

### Debug Mode

Enable debugging in both environments:

**Claude Desktop:**
Add to config:
```json
{
  "debug": true,
  "logLevel": "debug"
}
```

**VS Code:**
```json
{
  "claude.debug": true,
  "claude.logLevel": "debug"
}
```

### Health Checks

**System Health:**
```bash
# Check all services
curl http://localhost:8080/health

# Check individual agents via MCP
# Use get_swarm_status tool
```

**Performance Monitoring:**
```bash
# Redis memory usage
redis-cli info memory

# Docker stats
docker stats

# Agent response times
# Use get_swarm_status tool for timing info
```

## 🎯 What You Can Do Now

With this setup, you can:

✅ **Chat with specialized AI agents** from Claude Desktop or VS Code
✅ **Coordinate multi-agent tasks** for complex development work
✅ **Monitor system health** and agent availability
✅ **Read/write project files** directly through MCP tools
✅ **Deploy and manage** the swarm system
✅ **Debug issues** with comprehensive logging
✅ **Rate limit API usage** to protect your quota
✅ **Scale the system** across multiple environments

The agents work together intelligently, sharing knowledge through Graphiti and coordinating through Redis, while the rate limiter ensures you don't exceed your API limits!

## 🔗 Quick Links

- [Dashboard](http://localhost:8080) - Web interface
- [Neo4j Browser](http://localhost:7474) - Knowledge graph
- [Redis Commander](http://localhost:8081) - Redis management
- [Agent Documentation](./agents/README.md) - Agent capabilities
- [MCP Chat Server](./mcp-chat-server/README.md) - Chat interface
- [VS Code Integration](./vscode-integration.md) - Detailed VS Code setup
