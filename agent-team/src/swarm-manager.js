import { ClaudeAgent } from './claude-agent.js';
import { MCPToolBridge } from './mcp-tool-bridge.js';
import { GraphitiKnowledge } from './graphiti-knowledge.js';
import { RateLimiter } from './rate-limiter.js';
import { TaskRouter } from './task-router.js';
import { TeamManager } from './team-manager.js';
import { AgentCoordination } from './coordination.js';
import { architectAgent } from './agents/architect.js';
import { backendAgent } from './agents/backend.js';
import { frontendAgent } from './agents/frontend.js';
import { qaAgent } from './agents/qa.js';
import { devopsAgent } from './agents/devops.js';
import { reviewerAgent } from './agents/reviewer.js';
import { projectManagerAgent } from './agents/project-manager.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Swarm Manager - Orchestrates multiple Claude agents
 */
export class SwarmManager {
  constructor() {
    this.agents = new Map();
    this.mcpBridge = new MCPToolBridge();
    this.knowledge = new GraphitiKnowledge();
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 50,
      requestsPerHour: 1000,
    });
    this.taskRouter = null;
    this.teamManager = null;
    this.coordination = null;

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [SwarmManager] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/swarm-manager.log' }),
      ],
    });

    this.app = express();
    this.setupExpress();
  }

  setupExpress() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        agents: Array.from(this.agents.keys()),
        timestamp: new Date().toISOString(),
      });
    });

    // Debug endpoint to check active tasks
    this.app.get('/debug/active-tasks', (req, res) => {
      const activeTasksMap = {};
      for (const [agentName, agent] of this.agents) {
        const activeTasks = this.taskRouter.activeTasksByAgent.get(agentName) || [];
        activeTasksMap[agentName] = {
          activeTasks: activeTasks.length,
          maxConcurrent: agent.maxConcurrentTasks,
          canAccept: this.taskRouter.canAcceptTask(agent),
          tasks: activeTasks.map(t => ({ id: t.id, title: t.title, status: t.status }))
        };
      }
      res.json({
        activeTasksByAgent: activeTasksMap,
        timestamp: new Date().toISOString()
      });
    });

    // Force reset active tasks endpoint
    this.app.post('/debug/reset-active-tasks', (req, res) => {
      // Clear all active tasks from memory
      for (const [agentName] of this.agents) {
        this.taskRouter.activeTasksByAgent.set(agentName, []);
      }
      res.json({
        message: 'Active tasks cleared for all agents',
        timestamp: new Date().toISOString()
      });
    });

    // Agent status
    this.app.get('/agents', (req, res) => {
      const agentStatus = Array.from(this.agents.values()).map(agent =>
        agent.getStatus()
      );
      res.json(agentStatus);
    });

    // Execute task
    this.app.post('/execute', async (req, res) => {
      try {
        const { task, agent: agentName, context } = req.body;

        if (!task) {
          return res.status(400).json({ error: 'Task is required' });
        }

        const result = await this.executeTask(task, agentName, context);
        res.json(result);
      } catch (error) {
        this.logger.error(`Task execution error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Swarm coordination
    this.app.post('/coordinate', async (req, res) => {
      try {
        const { task, agents, strategy } = req.body;
        const result = await this.coordinateAgents(task, agents, strategy);
        res.json(result);
      } catch (error) {
        this.logger.error(`Coordination error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Auto-assign task to best available agent
    this.app.post('/auto-assign', async (req, res) => {
      try {
        const { task } = req.body;
        if (!task) {
          return res.status(400).json({ error: 'Task is required' });
        }

        const result = await this.teamManager.assignTask(task);
        res.json(result);
      } catch (error) {
        this.logger.error(`Auto-assignment error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Project creation endpoint
    this.app.post('/projects', async (req, res) => {
      try {
        const { title, description, requirements } = req.body;
        if (!title || !description) {
          return res
            .status(400)
            .json({ error: 'Title and description are required' });
        }

        const result = await this.createProject({
          title,
          description,
          requirements,
        });
        res.json(result);
      } catch (error) {
        this.logger.error(`Project creation error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Team status endpoint
    this.app.get('/team/status', (req, res) => {
      try {
        const status = this.teamManager.getTeamStatus();
        res.json(status);
      } catch (error) {
        this.logger.error(`Team status error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Agent recommendation endpoint
    this.app.post('/recommend-agent', (req, res) => {
      try {
        const { taskDescription } = req.body;
        if (!taskDescription) {
          return res
            .status(400)
            .json({ error: 'Task description is required' });
        }

        const recommendation =
          this.teamManager.getAgentRecommendation(taskDescription);
        res.json(recommendation);
      } catch (error) {
        this.logger.error(`Agent recommendation error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Workload balancing endpoint
    this.app.post('/balance-workload', async (req, res) => {
      try {
        const result = await this.teamManager.balanceWorkload();
        res.json(result);
      } catch (error) {
        this.logger.error(`Workload balancing error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupServer() {
    // Manual task trigger endpoint
    this.app.post('/tasks/:taskId/trigger', async (req, res) => {
      try {
        const { taskId } = req.params;
        if (!taskId) {
          return res.status(400).json({ error: 'Task ID is required' });
        }

        const result = await this.taskRouter.manualTriggerTask(taskId);
        res.json(result);
      } catch (error) {
        this.logger.error(`Manual task trigger error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Task queue status endpoint
    this.app.get('/tasks/queue', (req, res) => {
      try {
        this.logger.info('Queue status endpoint called');
        if (!this.taskRouter) {
          return res.status(500).json({ error: 'TaskRouter not initialized' });
        }
        const queueStatus = this.taskRouter.getQueueStatus();
        res.json(queueStatus);
      } catch (error) {
        this.logger.error(`Queue status error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Auto-processing control endpoints
    this.app.post('/tasks/auto-processing/start', (req, res) => {
      try {
        this.taskRouter.isAutoProcessingEnabled = true;
        this.taskRouter.startAutoProcessing();
        res.json({ message: 'Auto-processing started', status: 'enabled' });
      } catch (error) {
        this.logger.error(`Start auto-processing error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/tasks/auto-processing/stop', (req, res) => {
      try {
        this.taskRouter.stopAutoProcessing();
        res.json({ message: 'Auto-processing stopped', status: 'disabled' });
      } catch (error) {
        this.logger.error(`Stop auto-processing error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/tasks/auto-processing/status', (req, res) => {
      try {
        const status = {
          enabled: this.taskRouter.isAutoProcessingEnabled,
          hasInterval: !!this.taskRouter.processingInterval,
        };
        res.json(status);
      } catch (error) {
        this.logger.error(`Auto-processing status error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Task synchronization endpoint
    this.app.post('/tasks/sync', async (req, res) => {
      try {
        await this.taskRouter.syncTaskState();
        res.json({
          message: 'Task synchronization completed',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(`Task sync error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Task consistency check endpoint
    this.app.post('/tasks/consistency-check', async (req, res) => {
      try {
        await this.taskRouter.ensureTaskConsistency();
        res.json({
          message: 'Task consistency check completed',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(`Task consistency check error: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async initializeAgents() {
    this.logger.info('Initializing agent swarm...');

    // Initialize MCP tool bridge
    await this.mcpBridge.initialize();
    const mcpTools = await this.mcpBridge.getAvailableTools();

    // Define specialized agents with their configurations
    const agentConfigs = [
      architectAgent,
      backendAgent,
      frontendAgent,
      qaAgent,
      devopsAgent,
      reviewerAgent,
      projectManagerAgent,
    ];

    // Create and register agents
    for (const config of agentConfigs) {
      const agent = new ClaudeAgent(config.name, config);
      agent.registerTools(mcpTools);
      await agent.initialize(); // Initialize database connections and start polling
      this.agents.set(config.name, agent);
      this.logger.info(`Initialized agent: ${config.name}`);
    }

    // Initialize knowledge graph
    await this.knowledge.initialize();

    // Initialize team management systems
    this.taskRouter = new TaskRouter(
      this.agents,
      this.knowledge.driver,
      this.logger
    );
    this.coordination = new AgentCoordination(
      this.agents,
      this.taskRouter,
      this.logger
    );
    this.teamManager = new TeamManager(
      this.agents,
      this.taskRouter,
      this.coordination,
      this.logger
    );

    this.logger.info(`Swarm initialized with ${this.agents.size} agents`);
    this.logger.info('Team management systems initialized');
  }

  /**
   * Execute a task with a specific agent or auto-select best agent
   */
  async executeTask(task, agentName = null, context = {}) {
    // Check rate limits
    await this.rateLimiter.checkLimit();

    let agent;
    if (agentName) {
      agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent '${agentName}' not found`);
      }
    } else {
      // Auto-select best agent based on task
      agent = await this.selectBestAgent(task);
    }

    this.logger.info(`Executing task with agent: ${agent.name}`);

    // Add context from knowledge graph
    const knowledgeContext = await this.knowledge.getRelevantContext(task);
    const enrichedContext = { ...context, knowledge: knowledgeContext };

    // Execute task
    const result = await agent.think(task, enrichedContext);

    // Store result in knowledge graph
    await this.knowledge.storeInteraction(task, result, agent.name);

    return {
      task,
      agent: agent.name,
      result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Coordinate multiple agents for complex tasks
   */
  async coordinateAgents(task, agentNames = null, strategy = 'sequential') {
    this.logger.info(
      `Coordinating agents for task: ${task.substring(0, 50)}...`
    );

    const agents = agentNames
      ? agentNames.map(name => this.agents.get(name)).filter(Boolean)
      : Array.from(this.agents.values());

    if (agents.length === 0) {
      throw new Error('No valid agents found for coordination');
    }

    const results = [];

    if (strategy === 'sequential') {
      // Execute in sequence, passing results between agents
      let currentContext = {};
      for (const agent of agents) {
        await this.rateLimiter.checkLimit();
        const result = await agent.think(task, currentContext);
        results.push({
          agent: agent.name,
          result,
          timestamp: new Date().toISOString(),
        });
        // Pass result as context to next agent
        currentContext.previousResults = results;
      }
    } else if (strategy === 'parallel') {
      // Execute in parallel
      const promises = agents.map(async agent => {
        await this.rateLimiter.checkLimit();
        const result = await agent.think(task);
        return {
          agent: agent.name,
          result,
          timestamp: new Date().toISOString(),
        };
      });
      results.push(...(await Promise.all(promises)));
    }

    // Store coordination results in knowledge graph
    await this.knowledge.storeCoordination(task, results);

    return {
      task,
      strategy,
      agents: agents.map(a => a.name),
      results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Auto-select best agent for a task based on specialization
   */
  async selectBestAgent(task) {
    const taskLower = task.toLowerCase();

    // Simple keyword matching - could be enhanced with AI
    if (
      taskLower.includes('architect') ||
      taskLower.includes('design') ||
      taskLower.includes('system')
    ) {
      return this.agents.get('architect');
    }
    if (
      taskLower.includes('frontend') ||
      taskLower.includes('ui') ||
      taskLower.includes('react') ||
      taskLower.includes('component')
    ) {
      return this.agents.get('frontend');
    }
    if (
      taskLower.includes('backend') ||
      taskLower.includes('api') ||
      taskLower.includes('database') ||
      taskLower.includes('server')
    ) {
      return this.agents.get('backend');
    }
    if (
      taskLower.includes('code') ||
      taskLower.includes('implement') ||
      taskLower.includes('develop')
    ) {
      // Default to backend for general coding tasks
      return this.agents.get('backend');
    }
    if (
      taskLower.includes('test') ||
      taskLower.includes('qa') ||
      taskLower.includes('quality')
    ) {
      return this.agents.get('qa');
    }
    if (
      taskLower.includes('deploy') ||
      taskLower.includes('docker') ||
      taskLower.includes('infrastructure')
    ) {
      return this.agents.get('devops');
    }
    if (
      taskLower.includes('document') ||
      taskLower.includes('docs') ||
      taskLower.includes('explain')
    ) {
      return this.agents.get('docs');
    }
    if (
      taskLower.includes('review') ||
      taskLower.includes('optimize') ||
      taskLower.includes('refactor') ||
      taskLower.includes('standards')
    ) {
      return this.agents.get('reviewer');
    }

    // Default to architect for planning
    return this.agents.get('architect');
  }

  /**
   * Auto-assign a task to the best available agent
   */
  async autoAssignTask(taskDetails) {
    const {
      title,
      description,
      priority = 'medium',
      type = 'auto',
    } = taskDetails;

    // Select best agent based on task content
    const bestAgent = await this.selectBestAgent(description || title);

    if (!bestAgent) {
      throw new Error('No suitable agent found for task');
    }

    // Create task ID
    const taskId = `auto_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store task in Neo4j via the agent's database connection
    const session = bestAgent.neo4jDriver.session();
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
          title: title,
          description: description,
          type: type,
          priority: priority,
          agent: bestAgent.name,
          data: JSON.stringify(taskDetails.data || {}),
        }
      );
    } finally {
      await session.close();
    }

    this.logger.info(
      `Auto-assigned task "${title}" to agent: ${bestAgent.name}`
    );

    return {
      taskId,
      assignedAgent: bestAgent.name,
      title,
      description,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a new project with coordinated team approach
   */
  async createProject({ title, description, requirements = {} }) {
    this.logger.info(`Creating new project: ${title}`);

    try {
      // Create architect-led coordination for project planning
      const planningTask = {
        title: `Project Planning: ${title}`,
        description: `Analyze and create comprehensive project plan:

        Project: ${title}
        Description: ${description}
        Requirements: ${JSON.stringify(requirements, null, 2)}

        Create detailed technical architecture, implementation phases, and team coordination plan.`,
        priority: 'high',
        type: 'project_planning',
      };

      const planningResult = await this.coordination.coordinateTask(
        planningTask,
        'architect-led'
      );

      // Store project in knowledge graph
      await this.knowledge.storeProject({
        title,
        description,
        requirements,
        planningResult,
        status: 'planned',
        createdAt: new Date().toISOString(),
      });

      return {
        projectId: `proj_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        title,
        description,
        status: 'planned',
        planning: planningResult,
        teamAssignments: this.extractTeamAssignments(planningResult),
        nextSteps: this.extractNextSteps(planningResult),
        estimatedDuration: this.estimateProjectDuration(planningResult),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Project creation failed: ${error.message}`);
      throw error;
    }
  }

  extractTeamAssignments(planningResult) {
    // Extract team member assignments from planning result
    // This would be enhanced to parse the actual architect response
    return {
      'system-architect': 'Project coordination and technical oversight',
      'backend-developer': 'API and server-side implementation',
      'frontend-developer': 'User interface and client-side development',
      'qa-engineer': 'Testing strategy and quality assurance',
      'devops-engineer': 'Infrastructure setup and deployment',
      'code-reviewer': 'Code quality and standards enforcement',
    };
  }

  extractNextSteps(planningResult) {
    // Extract actionable next steps from planning result
    return [
      'Backend API design and database schema creation',
      'Frontend component architecture planning',
      'Testing framework setup and strategy definition',
      'Infrastructure provisioning and CI/CD pipeline setup',
    ];
  }

  estimateProjectDuration(planningResult) {
    // Simple estimation - could be enhanced with ML or historical data
    return {
      planning: '1-2 days',
      development: '2-4 weeks',
      testing: '3-5 days',
      deployment: '1-2 days',
      total: '3-5 weeks',
    };
  }

  /**
   * Get swarm status
   */
  getStatus() {
    return {
      agents: Array.from(this.agents.values()).map(agent => agent.getStatus()),
      rateLimiter: this.rateLimiter.getStatus(),
      knowledge: this.knowledge.getStatus(),
      mcpTools: this.mcpBridge.getToolCount(),
      teamStatus: this.teamManager ? this.teamManager.getTeamStatus() : null,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Start the swarm manager
   */
  async start(port = 3000) {
    this.logger.info('Starting Swarm Manager initialization...');

    // Initialize the swarm first
    this.logger.info('Initializing agents and knowledge graph...');
    await this.initializeAgents();
    this.logger.info('Agent initialization completed');

    // Wait a moment for all async initializations to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Set up server routes
    this.logger.info(
      `Setting up server routes. TaskRouter available: ${!!this.taskRouter}`
    );
    this.setupServer();
    this.logger.info('Server routes configured');

    // Start the server
    this.logger.info('Starting HTTP server...');
    return new Promise(resolve => {
      this.app.listen(port, '0.0.0.0', () => {
        this.logger.info(`Swarm Manager started on port ${port}`);
        this.logger.info(`Access from network: http://[your-ip]:${port}`);
        this.logger.info(
          `Agents: ${Array.from(this.agents.keys()).join(', ')}`
        );
        this.logger.info('🚀 All systems ready!');
        resolve();
      });
    });
  }
}

// Start the swarm if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const swarm = new SwarmManager();

  process.on('SIGINT', async () => {
    console.log('\nShutting down swarm...');
    if (swarm.taskRouter) {
      await swarm.taskRouter.cleanup();
    }
    for (const agent of swarm.agents.values()) {
      await agent.cleanup();
    }
    if (swarm.knowledge) {
      await swarm.knowledge.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down swarm...');
    if (swarm.taskRouter) {
      await swarm.taskRouter.cleanup();
    }
    for (const agent of swarm.agents.values()) {
      await agent.cleanup();
    }
    if (swarm.knowledge) {
      await swarm.knowledge.close();
    }
    process.exit(0);
  });

  // Start with proper async handling
  (async () => {
    try {
      await swarm.start();
    } catch (error) {
      console.error('Failed to start swarm:', error);
      process.exit(1);
    }
  })();
}
