import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import Redis from 'redis';
import neo4j from 'neo4j-driver';

/**
 * Individual Claude Agent with specialized capabilities
 */
export class ClaudeAgent {
  constructor(name, config = {}) {
    this.id = uuidv4();
    this.name = name;
    this.specialization = config.specialization || 'general';
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
    this.conversationHistory = [];
    this.availableTools = [];
    this.isProcessingTask = false;
    this.redis = null;
    this.neo4jDriver = null;
    this.taskPollingInterval = null;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${this.name}] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `logs/${this.name}.log` }),
      ],
    });
  }

  getDefaultSystemPrompt() {
    return `You are ${this.name}, an AI agent specialized in ${this.specialization}.
You work as part of a collaborative agent swarm. You can:
- Use tools to perform tasks
- Communicate with other agents
- Share knowledge through the swarm's knowledge graph
- Coordinate with other agents to solve complex problems

Always be helpful, accurate, and collaborative. When you need assistance with tasks outside your specialization, coordinate with other agents.`;
  }

  /**
   * Register tools that this agent can use
   */
  registerTools(tools) {
    this.availableTools = [...this.availableTools, ...tools];
    this.logger.info(
      `Registered ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`
    );
  }

  /**
   * Main thinking/reasoning method
   */
  async think(prompt, context = {}) {
    this.logger.info(`Processing: ${prompt.substring(0, 100)}...`);

    try {
      const messages = [{ role: 'user', content: prompt }];

      // Add conversation history if available
      if (this.conversationHistory.length > 0) {
        messages.unshift(...this.conversationHistory.slice(-10)); // Keep last 10 messages
      }

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: this.systemPrompt,
        messages,
        tools: this.availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema,
        })),
      });

      // Handle tool use
      if (response.content.some(content => content.type === 'tool_use')) {
        return await this.executeTools(response.content);
      }

      // Regular text response
      const textContent = response.content.find(
        content => content.type === 'text'
      );
      const result = textContent ? textContent.text : 'No response generated';

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: result }
      );

      this.logger.info(`Response: ${result.substring(0, 100)}...`);
      return {
        type: 'text',
        content: result,
        agent: this.name,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error in think(): ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute tools requested by Claude
   */
  async executeTools(content) {
    const results = [];

    for (const item of content) {
      if (item.type === 'tool_use') {
        const tool = this.availableTools.find(t => t.name === item.name);
        if (tool) {
          try {
            this.logger.info(`Executing tool: ${item.name}`);
            const result = await tool.execute(item.input);
            results.push({
              type: 'tool_result',
              tool: item.name,
              result,
              agent: this.name,
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            this.logger.error(
              `Tool execution error (${item.name}): ${error.message}`
            );
            results.push({
              type: 'tool_error',
              tool: item.name,
              error: error.message,
              agent: this.name,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else if (item.type === 'text') {
        results.push({
          type: 'text',
          content: item.text,
          agent: this.name,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Get agent status and metrics
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      specialization: this.specialization,
      conversationHistory: this.conversationHistory.length,
      availableTools: this.availableTools.length,
      status: this.isProcessingTask ? 'busy' : 'idle',
    };
  }

  /**
   * Initialize database connections and start task polling
   */
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

      // Start task polling
      this.startTaskPolling();
      
      this.logger.info('Agent initialized and task polling started');
    } catch (error) {
      this.logger.error(`Failed to initialize agent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start polling for tasks assigned to this agent
   */
  startTaskPolling() {
    this.taskPollingInterval = setInterval(async () => {
      if (!this.isProcessingTask) {
        await this.pollForTasks();
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Stop task polling
   */
  stopTaskPolling() {
    if (this.taskPollingInterval) {
      clearInterval(this.taskPollingInterval);
      this.taskPollingInterval = null;
    }
  }

  /**
   * Poll for pending tasks assigned to this agent
   */
  async pollForTasks() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.agent = $agentName 
        AND t.status = 'pending'
        RETURN t
        ORDER BY t.priority DESC, t.createdAt ASC
        LIMIT 1
      `, { agentName: this.name });
      
      await session.close();

      if (result.records.length > 0) {
        const task = result.records[0].get('t').properties;
        await this.processTask(task);
      }
    } catch (error) {
      this.logger.error(`Error polling for tasks: ${error.message}`);
    }
  }

  /**
   * Process a specific task
   */
  async processTask(task) {
    if (this.isProcessingTask) {
      return; // Already processing a task
    }

    this.isProcessingTask = true;
    this.logger.info(`Starting task: ${task.title}`);

    try {
      // Update task status to in_progress
      await this.updateTaskStatus(task.id, 'in_progress', { startedAt: new Date().toISOString() });

      // Process the task using Claude
      const result = await this.think(task.description, {
        taskId: task.id,
        taskTitle: task.title,
        taskPriority: task.priority,
      });

      // Update task status to completed
      await this.updateTaskStatus(task.id, 'completed', { 
        completedAt: new Date().toISOString(),
        result: JSON.stringify(result)
      });

      // Publish completion event
      await this.redis.publish(`task:${task.id}:status`, JSON.stringify({
        taskId: task.id,
        status: 'completed',
        result: result,
        agent: this.name,
        timestamp: new Date().toISOString(),
      }));

      this.logger.info(`Completed task: ${task.title}`);
    } catch (error) {
      this.logger.error(`Task processing error: ${error.message}`);
      
      // Update task status to failed
      await this.updateTaskStatus(task.id, 'failed', { 
        failedAt: new Date().toISOString(),
        error: error.message
      });
      
      // Publish failure event
      await this.redis.publish(`task:${task.id}:status`, JSON.stringify({
        taskId: task.id,
        status: 'failed',
        error: error.message,
        agent: this.name,
        timestamp: new Date().toISOString(),
      }));
    } finally {
      this.isProcessingTask = false;
    }
  }

  /**
   * Update task status in Neo4j
   */
  async updateTaskStatus(taskId, status, additionalFields = {}) {
    const session = this.neo4jDriver.session();
    try {
      let setClause = `SET t.status = $status, t.updatedAt = datetime()`;
      const params = { taskId, status };

      // Add additional fields
      for (const [key, value] of Object.entries(additionalFields)) {
        setClause += `, t.${key} = $${key}`;
        params[key] = value;
      }

      await session.run(`
        MATCH (t:Task {id: $taskId})
        ${setClause}
        RETURN t
      `, params);
    } finally {
      await session.close();
    }
  }

  /**
   * Reset conversation history
   */
  reset() {
    this.conversationHistory = [];
    this.logger.info('Conversation history reset');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopTaskPolling();
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
    }
  }
}
