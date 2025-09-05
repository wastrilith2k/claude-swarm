import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import winston from 'winston';

/**
 * Bridge between MCP servers and Claude API agents
 * Converts MCP tools into Claude API function tools
 */
export class MCPToolBridge extends EventEmitter {
  constructor() {
    super();
    this.mcpServers = new Map();
    this.availableTools = [];
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [MCPBridge] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/mcp-bridge.log' }),
      ],
    });
  }

  async initialize() {
    this.logger.info('Initializing MCP Tool Bridge...');

    // Connect to existing MCP servers
    await this.connectToMCPServer('chat', '../mcp-chat-server');
    await this.connectToMCPServer('tools', '../mcp-tools-server');

    this.logger.info(
      `MCP Bridge initialized with ${this.availableTools.length} tools`
    );
  }

  async connectToMCPServer(name, serverPath) {
    try {
      this.logger.info(`Connecting to MCP server: ${name} at ${serverPath}`);

      // For now, we'll create direct tool implementations
      // In a full implementation, you'd spawn the MCP server process
      // and communicate via stdio

      if (name === 'chat') {
        this.registerChatTools();
      } else if (name === 'tools') {
        this.registerDevelopmentTools();
      }

      this.logger.info(`Connected to MCP server: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to connect to MCP server ${name}: ${error.message}`
      );
    }
  }

  registerChatTools() {
    const chatTools = [
      {
        name: 'chat_with_agent',
        description: 'Send a message to another agent in the swarm',
        input_schema: {
          type: 'object',
          properties: {
            target_agent: {
              type: 'string',
              description: 'Name of the target agent',
            },
            message: {
              type: 'string',
              description: 'Message to send',
            },
          },
          required: ['target_agent', 'message'],
        },
        execute: async input => {
          // Implementation for inter-agent communication
          return await this.executeAgentChat(input.target_agent, input.message);
        },
      },
      {
        name: 'get_swarm_status',
        description: 'Get current status of all agents in the swarm',
        input_schema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          // Implementation for swarm status
          return await this.getSwarmStatus();
        },
      },
      {
        name: 'coordinate_agents',
        description: 'Coordinate multiple agents for a complex task',
        input_schema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Task description',
            },
            agents: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of agent names to coordinate',
            },
            strategy: {
              type: 'string',
              enum: ['sequential', 'parallel'],
              description: 'Coordination strategy',
            },
          },
          required: ['task'],
        },
        execute: async input => {
          return await this.coordinateAgents(
            input.task,
            input.agents,
            input.strategy
          );
        },
      },
    ];

    this.availableTools.push(...chatTools);
  }

  registerDevelopmentTools() {
    const devTools = [
      {
        name: 'read_project_file',
        description: 'Read a file from the project workspace',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the file to read',
            },
          },
          required: ['file_path'],
        },
        execute: async input => {
          return await this.readProjectFile(input.file_path);
        },
      },
      {
        name: 'write_project_file',
        description: 'Write content to a file in the project workspace',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the file to write',
            },
            content: {
              type: 'string',
              description: 'Content to write to the file',
            },
          },
          required: ['file_path', 'content'],
        },
        execute: async input => {
          return await this.writeProjectFile(input.file_path, input.content);
        },
      },
      {
        name: 'list_project_files',
        description: 'List files in the project workspace',
        input_schema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to list (optional, defaults to root)',
            },
          },
        },
        execute: async input => {
          return await this.listProjectFiles(input.directory || '.');
        },
      },
      {
        name: 'run_shell_command',
        description: 'Execute a shell command in the project workspace',
        input_schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Shell command to execute',
            },
            working_directory: {
              type: 'string',
              description: 'Working directory for the command (optional)',
            },
          },
          required: ['command'],
        },
        execute: async input => {
          return await this.runShellCommand(
            input.command,
            input.working_directory
          );
        },
      },
      {
        name: 'get_docker_status',
        description: 'Get status of Docker containers',
        input_schema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          return await this.getDockerStatus();
        },
      },
    ];

    this.availableTools.push(...devTools);
  }

  // Tool implementations
  async executeAgentChat(targetAgent, message) {
    // This would integrate with the swarm manager to send messages between agents
    return {
      success: true,
      message: `Message sent to ${targetAgent}: ${message}`,
      timestamp: new Date().toISOString(),
    };
  }

  async getSwarmStatus() {
    // This would get actual swarm status
    return {
      agents: ['architect', 'coder', 'qa', 'devops', 'docs'],
      status: 'active',
      timestamp: new Date().toISOString(),
    };
  }

  async coordinateAgents(task, agents, strategy) {
    // This would integrate with swarm coordination
    return {
      success: true,
      task,
      agents: agents || ['architect', 'coder'],
      strategy: strategy || 'sequential',
      status: 'initiated',
      timestamp: new Date().toISOString(),
    };
  }

  async readProjectFile(filePath) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Security: ensure file is within project directory
      const safePath = path.resolve(
        process.env.WORKSPACE_PATH || './workspace',
        filePath
      );
      const content = await fs.readFile(safePath, 'utf-8');

      return {
        success: true,
        file_path: filePath,
        content,
        size: content.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async writeProjectFile(filePath, content) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Security: ensure file is within project directory
      const safePath = path.resolve(
        process.env.WORKSPACE_PATH || './workspace',
        filePath
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(safePath), { recursive: true });

      await fs.writeFile(safePath, content, 'utf-8');

      return {
        success: true,
        file_path: filePath,
        size: content.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async listProjectFiles(directory) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const safePath = path.resolve(
        process.env.WORKSPACE_PATH || './workspace',
        directory
      );
      const files = await fs.readdir(safePath, { withFileTypes: true });

      return {
        success: true,
        directory,
        files: files.map(file => ({
          name: file.name,
          type: file.isDirectory() ? 'directory' : 'file',
          isDirectory: file.isDirectory(),
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async runShellCommand(command, workingDirectory) {
    return new Promise(resolve => {
      const cwd =
        workingDirectory || process.env.WORKSPACE_PATH || './workspace';

      const child = spawn('bash', ['-c', command], {
        cwd,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({
          success: code === 0,
          command,
          exit_code: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timestamp: new Date().toISOString(),
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: 'Command timeout after 30 seconds',
          command,
        });
      }, 30000);
    });
  }

  async getDockerStatus() {
    try {
      const result = await this.runShellCommand(
        'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"'
      );
      return {
        success: true,
        containers: result.stdout,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getAvailableTools() {
    return this.availableTools;
  }

  getToolCount() {
    return this.availableTools.length;
  }
}
