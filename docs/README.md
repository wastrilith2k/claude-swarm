# Claude Docker Swarm - MCP-Powered Development Team

A complete Docker-based swarm of AI agents powered by Model Context Protocol (MCP) servers, designed to work with **Claude Desktop** as a collaborative development team.

## 🎯 How It Works

This system creates specialized AI agents that run as **MCP servers**. Claude Desktop connects to these servers to access their capabilities. Each agent is an expert in their domain and can be accessed through Claude Desktop's interface.

**Important**: This works with **Claude Desktop**, not the Claude API.

## 🏗️ Architecture

The swarm consists of 6 specialized AI agents, each with their own MCP servers and UI interfaces:

- **🏗️ Architect Agent**: System design, architecture decisions, technical planning
- **🎨 Frontend Agent**: UI/UX development, React, Vue, Angular
- **⚙️ Backend Agent**: API development, databases, server-side logic
- **🚀 DevOps Agent**: Infrastructure, CI/CD, deployment, monitoring
- **🧪 QA Agent**: Testing, quality assurance, bug tracking
- **📚 Documentation Agent**: Technical writing, API docs, user guides

## 🚀 Quick Start

1. **Clone and setup**:
   ```bash
   git clone <your-repo>
   cd docker-mcp-swarm
   ```

2. **Configure environment (optional)**:
   ```bash
   cp .env.example .env
   # Edit .env to add external API keys if needed
   ```

3. **Start the swarm**:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

4. **Configure Claude Desktop**:
   - Open Claude Desktop application
   - Configure MCP servers (see config/dependencies.txt for setup)
   - Connect to agents at http://localhost:3001-3006

5. **Access the monitoring interface**:

   - 📊 **Main Dashboard**: <http://localhost:8080>
   - 🏗️ **Architect**: <http://localhost:3001>
   - 🎨 **Frontend**: <http://localhost:3002>
   - ⚙️ **Backend**: <http://localhost:3003>
   - 🚀 **DevOps**: <http://localhost:3004>
   - 🧪 **QA**: <http://localhost:3005>
   - 📚 **Docs**: <http://localhost:3006>

## 📋 Requirements

- **Claude Desktop**: Download from https://claude.ai/download
- Docker Engine 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- No API keys required for basic operation

## 🛠️ Management

Use the management script for common operations:

```bash
chmod +x manage.sh

# Start all services
./manage.sh start

# Check status
./manage.sh status

# View logs
./manage.sh logs [service-name]

# Open shell in container
./manage.sh shell [service-name]

# Health check
./manage.sh health

# Restart services
./manage.sh restart [service-name]

# Stop all services
./manage.sh stop

# Clean up everything
./manage.sh clean
```

## 🔧 Configuration

### Environment Variables

Required in `.env`:
- `CLAUDE_API_KEY`: Your Anthropic API key (required)
- Database and Redis settings (defaults provided)

Optional:
- `OPENAI_API_KEY`: For additional AI capabilities
- `GITHUB_TOKEN`: For repository operations

### Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Dashboard | 8080 | Main React dashboard UI |
| Dashboard API | 3000 | Backend API server |
| Architect | 3001 | Architecture agent UI |
| Frontend | 3002 | Frontend agent UI |
| Backend | 3003 | Backend agent UI |
| DevOps | 3004 | DevOps agent UI |
| QA | 3005 | QA agent UI |
| Docs | 3006 | Documentation agent UI |
| Neo4j | 7474 | Database browser |
| Redis | 6379 | Cache/messaging |

## 🏃 Agent Capabilities

### MCP Servers per Agent

Each agent is equipped with specialized MCP servers:

- **Memory**: Persistent conversation and context storage
- **Filesystem**: File operations and code management
- **Fetch**: Web requests and API integration
- **Search**: Brave search for research
- **Database**: SQLite and Postgres connectivity
- **Firebase**: Cloud platform integration

### Inter-Agent Communication

- **Redis**: Real-time messaging between agents
- **Neo4j**: Project graph database for coordination
- **WebSocket**: Live updates and collaboration
- **REST APIs**: Structured communication protocols

## 📊 Monitoring

The dashboard provides:
- Real-time agent status
- Task progress tracking
- Communication flows
- Resource utilization
- Error monitoring

## 🔒 Security

- Environment variable isolation
- Container network segmentation
- Database authentication
- API key protection
- Optional JWT authentication

## 🗄️ Data Persistence

- **Neo4j**: Project data, agent relationships
- **Redis**: Message queues, session storage
- **Volumes**: Shared file storage between agents

## 🐛 Troubleshooting

### Common Issues

1. **Services won't start**:
   - Check CLAUDE_API_KEY is valid
   - Ensure ports 3000-3006 are free
   - Verify Docker has enough memory (8GB+)

2. **Agents can't communicate**:
   - Check Redis and Neo4j are running
   - Verify network connectivity: `docker network ls`
   - Check logs: `./manage.sh logs redis`

3. **Performance issues**:
   - Monitor resource usage: `./manage.sh status`
   - Check Docker limits
   - Review agent logs for errors

### Debug Commands

```bash
# Check all container logs
docker-compose logs

# Inspect specific service
docker-compose exec [service] sh

# Check network connectivity
docker-compose exec architect ping redis

# Monitor resource usage
docker stats
```

## 🔄 Development

### Adding New Agents

1. Create agent directory in `agents/`
2. Copy base configuration from existing agent
3. Customize MCP servers and capabilities
4. Add to `docker-compose.yml`
5. Update dashboard monitoring

### Extending MCP Servers

1. Add new MCP server to `agents/base/Dockerfile.base`
2. Configure in agent's `config.json`
3. Update agent logic in `agent.js`
4. Test with specific agent

### Custom UI Components

1. Modify agent's UI MCP server
2. Update dashboard integration
3. Add real-time event handling
4. Test cross-agent communication

## 📚 Documentation

- [MCP Protocol](https://modelcontextprotocol.io/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Neo4j](https://neo4j.com/docs/)
- [Redis](https://redis.io/documentation)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## 📄 License

[Add your license here]

## 🆘 Support

- Check `config/dependencies.txt` for setup requirements
- Use `./manage.sh health` for system diagnostics
- Review logs with `./manage.sh logs [service]`
- Open issues for bugs or feature requests

---

**Made with ❤️ for collaborative AI development**
