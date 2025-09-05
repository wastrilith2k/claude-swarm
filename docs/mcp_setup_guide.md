# MCP Servers Setup Guide for Full Development Team

## Prerequisites

Before setting up MCP servers, ensure you have:
- Node.js (v18 or later)
- Python 3.8+
- Git
- Claude Desktop app installed
- Relevant API keys for services you'll use

## Core Development Infrastructure

### 1. Jupyter MCP Server
```bash
# Install via npm
npm install -g @modelcontextprotocol/server-jupyter

# Add to Claude Desktop config (~/.claude/config.json or equivalent)
{
  "mcpServers": {
    "jupyter": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-jupyter"]
    }
  }
}
```

### 2. Context 7 by Upstash
```bash
# Visit Upstash and create account
# Get your API credentials
# Install the server
npm install -g @upstash/context7-mcp

# Add to config with your credentials
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "your_redis_url",
        "UPSTASH_REDIS_REST_TOKEN": "your_token"
      }
    }
  }
}
```

### 3. Exa Search
```bash
# Get API key from exa.ai
# Install server
pip install exa-mcp-server

# Add to config
{
  "mcpServers": {
    "exa": {
      "command": "python",
      "args": ["-m", "exa_mcp_server"],
      "env": {
        "EXA_API_KEY": "your_exa_api_key"
      }
    }
  }
}
```

## Project Management & Memory

### 4. Claude Taskmaster
```bash
# Clone repository (check GitHub for exact repo)
git clone https://github.com/user/claude-taskmaster-mcp
cd claude-taskmaster-mcp
npm install

# Add to config
{
  "mcpServers": {
    "taskmaster": {
      "command": "node",
      "args": ["path/to/taskmaster/index.js"]
    }
  }
}
```

### 5. Graphiti Knowledge Graph Memory
```bash
# Install Neo4j (required for Graphiti)
# On macOS:
brew install neo4j
neo4j start

# Install Graphiti MCP
pip install graphiti-mcp-server

# Add to config
{
  "mcpServers": {
    "graphiti": {
      "command": "python",
      "args": ["-m", "graphiti_mcp_server"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "your_password"
      }
    }
  }
}
```

## Google Workspace Integration

### 6. Google Workspace MCP Server
```bash
# Install the server
npm install -g @google/workspace-mcp-server

# Set up Google Cloud Project and OAuth2
# 1. Go to Google Cloud Console
# 2. Create new project or select existing
# 3. Enable APIs: Gmail, Calendar, Drive, Docs, Sheets, Slides
# 4. Create OAuth2 credentials
# 5. Download credentials.json

# Add to config
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["@google/workspace-mcp-server"],
      "env": {
        "GOOGLE_CREDENTIALS_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

### 7. Firebase CLI MCP Server
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Install Firebase MCP server
npm install -g @firebase/mcp-server

# Login to Firebase
firebase login

# Add to config
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["@firebase/mcp-server"]
    }
  }
}
```

## Database & Platform Integration

### 8. MindsDB MCP Server
```bash
# Install MindsDB
pip install mindsdb

# Install MCP server
pip install mindsdb-mcp-server

# Add to config
{
  "mcpServers": {
    "mindsdb": {
      "command": "python",
      "args": ["-m", "mindsdb_mcp_server"],
      "env": {
        "MINDSDB_EMAIL": "your_email",
        "MINDSDB_PASSWORD": "your_password"
      }
    }
  }
}
```

## Specialized Tools

### 9. Bright Data MCP Server
```bash
# Sign up at brightdata.com for free account
# Install server
npm install -g @brightdata/mcp-server

# Add to config
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["@brightdata/mcp-server"],
      "env": {
        "BRIGHTDATA_API_KEY": "your_api_key"
      }
    }
  }
}
```

### 10. Magic UI MCP Server
```bash
# Install Magic UI MCP
npm install -g @magicui/mcp-server

# Add to config
{
  "mcpServers": {
    "magicui": {
      "command": "npx",
      "args": ["@magicui/mcp-server"]
    }
  }
}
```

### 11. Ragie MCP Server
```bash
# Get API key from ragie.ai
# Install server
pip install ragie-mcp-server

# Add to config
{
  "mcpServers": {
    "ragie": {
      "command": "python",
      "args": ["-m", "ragie_mcp_server"],
      "env": {
        "RAGIE_API_KEY": "your_ragie_api_key"
      }
    }
  }
}
```

### 12. Opik MCP Server (Monitoring)
```bash
# Install from Comet
pip install comet-opik-mcp

# Add to config
{
  "mcpServers": {
    "opik": {
      "command": "python",
      "args": ["-m", "comet_opik_mcp"],
      "env": {
        "COMET_API_KEY": "your_comet_api_key"
      }
    }
  }
}
```

## Complete Configuration Example

Here's what your final `~/.claude/config.json` might look like:

```json
{
  "mcpServers": {
    "jupyter": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-jupyter"]
    },
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "your_redis_url",
        "UPSTASH_REDIS_REST_TOKEN": "your_token"
      }
    },
    "exa": {
      "command": "python",
      "args": ["-m", "exa_mcp_server"],
      "env": {
        "EXA_API_KEY": "your_exa_api_key"
      }
    },
    "graphiti": {
      "command": "python",
      "args": ["-m", "graphiti_mcp_server"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "your_password"
      }
    },
    "google-workspace": {
      "command": "npx",
      "args": ["@google/workspace-mcp-server"],
      "env": {
        "GOOGLE_CREDENTIALS_PATH": "/path/to/credentials.json"
      }
    },
    "firebase": {
      "command": "npx",
      "args": ["@firebase/mcp-server"]
    },
    "mindsdb": {
      "command": "python",
      "args": ["-m", "mindsdb_mcp_server"],
      "env": {
        "MINDSDB_EMAIL": "your_email",
        "MINDSDB_PASSWORD": "your_password"
      }
    },
    "brightdata": {
      "command": "npx",
      "args": ["@brightdata/mcp-server"],
      "env": {
        "BRIGHTDATA_API_KEY": "your_api_key"
      }
    },
    "ragie": {
      "command": "python",
      "args": ["-m", "ragie_mcp_server"],
      "env": {
        "RAGIE_API_KEY": "your_ragie_api_key"
      }
    },
    "opik": {
      "command": "python",
      "args": ["-m", "comet_opik_mcp"],
      "env": {
        "COMET_API_KEY": "your_comet_api_key"
      }
    }
  }
}
```

## Testing Your Setup

1. Restart Claude Desktop after adding configurations
2. Test each server individually:
   - Ask me to run a simple code cell (tests Jupyter)
   - Ask me to search for documentation (tests Context7/Exa)
   - Ask me to create a task breakdown (tests Taskmaster)
   - Ask me to remember something for later (tests knowledge graph)

## Troubleshooting

- **Server won't start**: Check that all dependencies are installed and API keys are valid
- **Authentication errors**: Verify credentials and API key formats
- **Connection timeouts**: Ensure required services (like Neo4j) are running
- **Permission errors**: Check file paths and environment variable access

## Security Notes

- Store API keys in environment variables, not directly in config files
- Use least-privilege access for all API keys
- Regularly rotate credentials
- Monitor usage to detect any unusual activity