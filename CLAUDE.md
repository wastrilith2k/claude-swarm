# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a Docker-based MCP (Model Context Protocol) agent swarm system that creates specialized AI agents designed to work with **Claude Desktop**. The system consists of:

- **Agent Swarm Manager** (`agent-swarm/`): Central orchestration service managing agent communication
- **6 Specialized Agent Services** (`agents/`): Each running as containerized MCP servers
- **Dashboard API** (`dashboard-api/`): Express.js backend API server with WebSocket support
- **Dashboard Frontend** (`dashboard/`): React-based monitoring interface served by nginx
- **Infrastructure**: Redis for messaging, Neo4j for knowledge graphs

### Agent Architecture

Each agent in `agents/*/` follows a consistent pattern:
- `agent.js`: Main agent logic and MCP server implementation
- `config.json`: Agent capabilities, MCP server configurations, and workflows
- `Dockerfile`: Container definition extending the base image
- `start.sh`: Container entrypoint script

The 6 specialized agents are:
- **Architect** (`:3001`): Project planning, architecture decisions, team coordination
- **Frontend** (`:3002`): UI/UX development, React/Vue/Angular work
- **Backend** (`:3003`): API development, databases, server-side logic  
- **DevOps** (`:3004`): Infrastructure, CI/CD, deployment, monitoring
- **QA** (`:3005`): Testing, quality assurance, bug tracking
- **Docs** (`:3006`): Technical writing, API docs, user guides

## Development Commands

### Docker Management
```bash
# Start entire swarm
./start.sh

# Management operations
./manage.sh start|stop|restart|status|logs|clean|rebuild|health

# Individual service operations
./manage.sh restart [service-name]
./manage.sh logs [service-name]
./manage.sh shell [service-name]
```

### Node.js Development
```bash
# Agent Swarm development
cd agent-swarm/
npm run dev          # Development with nodemon
npm start           # Production start
npm test            # Run tests

# Dashboard API development  
cd dashboard-api/
npm run dev         # Development server with nodemon
npm start           # Production start

# Dashboard Frontend development
cd dashboard/
npm start           # Development server
npm run build       # Build React app for production
```

### Service Health Checks

#### Local Access
- **Dashboard Frontend**: http://localhost:8080 (React UI served by nginx)
- **Dashboard API**: http://localhost:3000 (Express backend API)
- **Agent Swarm API**: http://localhost:3001 (Swarm manager API)
- **Reviewer Agent**: http://localhost:3007 (Code review agent)
- **Neo4j Browser**: http://localhost:7474 (Graph database UI)
- **Redis**: localhost:6379 (Cache/messaging)

#### Network Access (from other devices)
Replace `localhost` with your machine's IP address:
- **Dashboard Frontend**: http://[YOUR-IP]:8080
- **Dashboard API**: http://[YOUR-IP]:3000
- **Agent Swarm API**: http://[YOUR-IP]:3001  
- **Reviewer Agent**: http://[YOUR-IP]:3007
- **Neo4j Browser**: http://[YOUR-IP]:7474
- **Redis**: [YOUR-IP]:6379

To find your IP: `ip addr show | grep inet` (Linux) or `ipconfig` (Windows)

## Key Configuration Files

### Environment Setup
- `.env.example`: Template with required API keys and configuration
- `config/claude-desktop-config.json`: MCP server configuration for Claude Desktop
- `config/dependencies.txt`: Complete setup guide and requirements

### Docker Configuration
- `docker-compose.yml`: Main service orchestration
- `agents/base/Dockerfile.base`: Shared base image for all agents
- Each agent has individual `Dockerfile` extending the base

### Agent Configuration
- `agents/*/config.json`: Defines agent capabilities, MCP servers, workflows, and specializations
- Each agent can be configured with different MCP servers like taskmaster, Google Workspace, Exa search, etc.

## Inter-Agent Communication

The system uses multiple communication channels:
- **Redis**: Real-time messaging and task queues between agents
- **Neo4j**: Persistent knowledge graphs and project data storage
- **WebSocket**: Live updates via dashboard
- **REST APIs**: Structured communication protocols

The swarm manager (`agent-swarm/src/swarm-manager.js`) orchestrates agent communication and task distribution.

## MCP Integration

This system works with **Claude Desktop** (not Claude API). Each agent runs as an MCP server that Claude Desktop connects to. The agents provide specialized tools and capabilities through the MCP protocol.

### Database Credentials (defaults)
- **Neo4j**: user: `neo4j`, password: `swarmpassword123`
- **Redis**: password: `swarmredis123`

## Development Workflow

1. **Start Infrastructure**: `./start.sh` boots all services
2. **Configure Claude Desktop**: Use `config/claude-desktop-config.json` to connect
3. **Monitor via Dashboard**: Access http://localhost:8080 for real-time status
4. **Develop Individual Agents**: Each agent can be developed independently
5. **Test Integration**: Use `./manage.sh health` to verify all connections

## Port Allocation
- `3000`: Dashboard API backend
- `3001-3006`: Individual agent MCP servers and UIs  
- `3007`: Reviewer agent
- `6379`: Redis
- `7474/7687`: Neo4j browser/bolt
- `8080`: Dashboard frontend (nginx)

## Common Tasks

### Adding New Agent
1. Copy existing agent directory structure
2. Update `config.json` with new capabilities
3. Modify `agent.js` for specialized logic
4. Add service to `docker-compose.yml`
5. Update dashboard monitoring

### Extending MCP Servers
1. Add new MCP server to agent's `config.json`
2. Update base package dependencies if needed
3. Configure environment variables in agent's config
4. Test MCP server connectivity through Claude Desktop