const Anthropic = require('@anthropic-ai/sdk');
const EventEmitter = require('events');
const { createLogger } = require('./utils');

class RealClaudeAgent extends EventEmitter {
  constructor(role, systemPrompt, config) {
    super();
    this.role = role;
    this.systemPrompt = systemPrompt;
    this.config = config;
    this.logger = createLogger(`claude-${role}`);

    // Rate limiting
    this.rateLimiter = config.rateLimiter;
    this.requestCount = 0;
    this.lastRequest = 0;
    this.conversationHistory = [];

    // Claude client
    this.claude = new Anthropic({
      apiKey: config.apiKey,
    });

    // MCP tools available to this agent
    this.mcpTools = new Map();

    // Knowledge sharing
    this.graphiti = config.graphiti;
    this.redis = config.redis;
  }

  async initialize() {
    this.logger.info(`🚀 Initializing real Claude agent: ${this.role}`);

    // Load role-specific MCP tools
    await this.loadMCPTools();

    // Subscribe to inter-agent communication
    await this.setupCommunication();

    // Initialize with system prompt and current knowledge
    await this.initializeConversation();

    this.logger.info(`✅ Claude agent ${this.role} ready`);
  }

  async loadMCPTools() {
    const toolsConfig = this.config.mcpServers || {};

    for (const [toolName, toolConfig] of Object.entries(toolsConfig)) {
      try {
        // Load the actual MCP tool implementation
        const ToolClass = require(`../mcp-tools/${toolName}`);
        const tool = new ToolClass(toolConfig);
        await tool.initialize();

        this.mcpTools.set(toolName, tool);
        this.logger.info(`📧 Loaded MCP tool: ${toolName}`);
      } catch (error) {
        this.logger.warn(
          `⚠️ Failed to load MCP tool ${toolName}:`,
          error.message
        );
      }
    }
  }

  async setupCommunication() {
    // Subscribe to messages for this agent
    await this.redis.subscribe(`agent:${this.role}:message`);

    // Subscribe to broadcast messages
    await this.redis.subscribe('agent:broadcast');

    // Handle incoming messages
    this.redis.on('message', async (channel, message) => {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(data);
      } catch (error) {
        this.logger.error('Error handling message:', error);
      }
    });
  }

  async initializeConversation() {
    // Get recent project knowledge from Graphiti
    const recentKnowledge = await this.getRecentKnowledge();

    // Create enhanced system prompt with current context
    const enhancedPrompt = `${this.systemPrompt}

## Current Project Context
${recentKnowledge}

## Available MCP Tools
You have access to the following specialized tools:
${Array.from(this.mcpTools.keys())
  .map(tool => `- ${tool}`)
  .join('\n')}

## Communication Protocol
- You can message other agents using sendMessage(agentRole, message)
- You can query shared knowledge using queryKnowledge(query)
- You can store insights using storeKnowledge(knowledge)

## Rate Limiting
- Be mindful of API usage - prioritize important tasks
- Use cached knowledge when possible
- Batch related questions together`;

    this.conversationHistory = [
      {
        role: 'system',
        content: enhancedPrompt,
      },
    ];
  }

  async ask(prompt, options = {}) {
    // Check rate limits
    if (!(await this.checkRateLimit())) {
      return this.handleRateLimited(prompt, options);
    }

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: prompt,
      });

      // Prepare Claude API call
      const response = await this.claude.messages.create({
        model: options.model || 'claude-3-sonnet-20240229',
        max_tokens: options.maxTokens || 4000,
        messages: this.conversationHistory.slice(-10), // Keep last 10 messages
        tools: this.getAvailableTools(),
        temperature: options.temperature || 0.7,
      });

      // Handle tool calls
      if (response.stop_reason === 'tool_use') {
        const toolResults = await this.handleToolCalls(response.content);

        // Add assistant response with tool calls
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content,
        });

        // Add tool results
        this.conversationHistory.push({
          role: 'user',
          content: toolResults,
        });

        // Get final response after tool execution
        const finalResponse = await this.claude.messages.create({
          model: options.model || 'claude-3-sonnet-20240229',
          max_tokens: options.maxTokens || 4000,
          messages: this.conversationHistory.slice(-10),
        });

        this.conversationHistory.push({
          role: 'assistant',
          content: finalResponse.content[0].text,
        });

        return finalResponse.content[0].text;
      }

      // Regular response
      const responseText = response.content[0].text;
      this.conversationHistory.push({
        role: 'assistant',
        content: responseText,
      });

      // Store insights in knowledge graph
      await this.storeInsights(prompt, responseText);

      this.requestCount++;
      this.lastRequest = Date.now();

      return responseText;
    } catch (error) {
      this.logger.error(`Error in Claude API call:`, error);

      // Fallback to knowledge base
      return await this.fallbackToKnowledge(prompt);
    }
  }

  async checkRateLimit() {
    // Check global rate limiter
    if (!(await this.rateLimiter.canMakeRequest(this.role))) {
      this.logger.warn(`🚫 Rate limit reached for ${this.role}`);
      return false;
    }

    // Check per-agent limits
    const timeSinceLastRequest = Date.now() - this.lastRequest;
    const minInterval = this.config.minRequestInterval || 2000; // 2 seconds

    if (timeSinceLastRequest < minInterval) {
      this.logger.info(
        `⏰ Waiting ${minInterval - timeSinceLastRequest}ms before next request`
      );
      await new Promise(resolve =>
        setTimeout(resolve, minInterval - timeSinceLastRequest)
      );
    }

    return true;
  }

  async handleRateLimited(prompt, options) {
    this.logger.info(`🔄 Rate limited - falling back to knowledge base`);

    // Try to answer from existing knowledge
    const knowledgeResponse = await this.fallbackToKnowledge(prompt);

    if (knowledgeResponse) {
      return `[From Knowledge Base] ${knowledgeResponse}`;
    }

    // Queue for later processing
    await this.redis.lpush(
      `queue:${this.role}`,
      JSON.stringify({
        prompt,
        options,
        timestamp: Date.now(),
      })
    );

    return `Request queued due to rate limiting. Will process when capacity is available.`;
  }

  getAvailableTools() {
    const tools = [];

    // Add MCP tools
    for (const [name, tool] of this.mcpTools) {
      tools.push(...tool.getClaudeTools());
    }

    // Add communication tools
    tools.push(
      {
        name: 'sendMessage',
        description: 'Send a message to another agent',
        input_schema: {
          type: 'object',
          properties: {
            agentRole: {
              type: 'string',
              description: 'The role of the target agent',
            },
            message: { type: 'string', description: 'The message to send' },
          },
          required: ['agentRole', 'message'],
        },
      },
      {
        name: 'queryKnowledge',
        description: 'Query the shared knowledge graph',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The knowledge query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'storeKnowledge',
        description: 'Store new knowledge in the shared graph',
        input_schema: {
          type: 'object',
          properties: {
            knowledge: {
              type: 'string',
              description: 'The knowledge to store',
            },
            category: { type: 'string', description: 'Knowledge category' },
          },
          required: ['knowledge'],
        },
      }
    );

    return tools;
  }

  async handleToolCalls(content) {
    const results = [];

    for (const item of content) {
      if (item.type === 'tool_use') {
        try {
          let result;

          if (item.name === 'sendMessage') {
            result = await this.sendMessage(
              item.input.agentRole,
              item.input.message
            );
          } else if (item.name === 'queryKnowledge') {
            result = await this.queryKnowledge(item.input.query);
          } else if (item.name === 'storeKnowledge') {
            result = await this.storeKnowledge(
              item.input.knowledge,
              item.input.category
            );
          } else {
            // MCP tool
            const tool = this.mcpTools.get(item.name.split('_')[0]);
            if (tool) {
              result = await tool.execute(item.name, item.input);
            } else {
              result = `Tool ${item.name} not available`;
            }
          }

          results.push({
            tool_use_id: item.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          this.logger.error(`Tool execution error (${item.name}):`, error);
          results.push({
            tool_use_id: item.id,
            content: `Error: ${error.message}`,
          });
        }
      }
    }

    return results;
  }

  async sendMessage(targetRole, message) {
    await this.redis.publish(
      `agent:${targetRole}:message`,
      JSON.stringify({
        from: this.role,
        message,
        timestamp: Date.now(),
      })
    );

    this.logger.info(
      `📤 Sent message to ${targetRole}: ${message.substring(0, 50)}...`
    );
    return `Message sent to ${targetRole}`;
  }

  async queryKnowledge(query) {
    try {
      // Use Graphiti to query knowledge
      const results = await this.graphiti.search(query, {
        limit: 5,
        context: this.role,
      });

      this.logger.info(
        `🔍 Knowledge query: ${query} (${results.length} results)`
      );
      return results;
    } catch (error) {
      this.logger.error('Knowledge query error:', error);
      return [];
    }
  }

  async storeKnowledge(knowledge, category = 'general') {
    try {
      await this.graphiti.addEpisode(knowledge, {
        agent: this.role,
        category,
        timestamp: Date.now(),
      });

      this.logger.info(`💾 Stored knowledge: ${knowledge.substring(0, 50)}...`);
      return 'Knowledge stored successfully';
    } catch (error) {
      this.logger.error('Knowledge storage error:', error);
      return 'Failed to store knowledge';
    }
  }

  async getRecentKnowledge() {
    try {
      const recent = await this.graphiti.getRecentEpisodes({
        limit: 10,
        relevantTo: this.role,
      });

      return recent.map(episode => `- ${episode.content}`).join('\n');
    } catch (error) {
      this.logger.error('Error getting recent knowledge:', error);
      return 'No recent knowledge available';
    }
  }

  async storeInsights(prompt, response) {
    // Extract and store key insights
    const insight = `${this.role} processed: ${prompt.substring(0, 100)}...
Response summary: ${response.substring(0, 200)}...`;

    await this.storeKnowledge(insight, 'conversation');
  }

  async fallbackToKnowledge(prompt) {
    try {
      const relevantKnowledge = await this.queryKnowledge(prompt);

      if (relevantKnowledge.length > 0) {
        return `Based on previous knowledge: ${relevantKnowledge[0].content}`;
      }

      return null;
    } catch (error) {
      this.logger.error('Fallback to knowledge failed:', error);
      return null;
    }
  }

  async handleMessage(data) {
    this.logger.info(`📥 Received message from ${data.from}: ${data.message}`);

    // Process the message and potentially respond
    if (data.message.includes('urgent') || data.message.includes('help')) {
      const response = await this.ask(
        `Another agent (${data.from}) sent me this message: "${data.message}". How should I respond?`
      );

      if (response && !response.includes('queued')) {
        await this.sendMessage(data.from, response);
      }
    }
  }

  async processQueuedRequests() {
    // Process queued requests when rate limit allows
    while (await this.checkRateLimit()) {
      const queuedItem = await this.redis.rpop(`queue:${this.role}`);

      if (!queuedItem) break;

      try {
        const { prompt, options } = JSON.parse(queuedItem);
        const response = await this.ask(prompt, options);

        // Store result for retrieval
        await this.redis.set(`result:${this.role}:${Date.now()}`, response);
      } catch (error) {
        this.logger.error('Error processing queued request:', error);
      }
    }
  }

  async close() {
    this.logger.info(`👋 Shutting down Claude agent: ${this.role}`);

    // Close MCP tools
    for (const tool of this.mcpTools.values()) {
      await tool.close();
    }

    // Close Redis connections
    await this.redis.unsubscribe();
  }
}

module.exports = RealClaudeAgent;
