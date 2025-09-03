# True Agent Swarm with MCP Enhancement

This system creates multiple Claude API instances, each with:
- Specialized system prompts for their role
- Access to MCP tools for enhanced capabilities
- Shared knowledge through Graphiti/Neo4j
- Rate limiting to manage API usage
- Docker containers for easy deployment

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Architect      │    │  Frontend       │    │  Backend        │
│  Claude Instance│    │  Claude Instance│    │  Claude Instance│
│  + MCP Tools    │    │  + MCP Tools    │    │  + MCP Tools    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Shared        │
                    │   Knowledge     │
                    │   (Graphiti)    │
                    └─────────────────┘
```

Each agent:
1. Runs its own Claude API client with specialized prompts
2. Has access to role-specific MCP tools
3. Shares knowledge via Graphiti knowledge graph
4. Manages its own rate limiting and conversation state
5. Communicates with other agents through Redis pub/sub

## Rate Limiting Strategy

- **Global rate limiter**: Shared across all agents
- **Per-agent quotas**: Each agent gets portion of 5-hour limit
- **Priority system**: Critical tasks get priority
- **Intelligent batching**: Combine related requests
- **Graceful degradation**: Fall back to cached knowledge when rate limited
