const Redis = require('redis');
const neo4j = require('neo4j-driver');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class SwarmCommunicator extends EventEmitter {
  constructor(agentRole, config = {}) {
    super();
    this.agentRole = agentRole;
    this.redisClient = null;
    this.redisSubscriber = null;
    this.neo4jDriver = null;
    this.isConnected = false;
    this.config = config;
    this.messageQueue = [];
  }

  async initialize() {
    try {
      // Initialize Redis connections
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      this.redisClient = Redis.createClient({
        url: redisUrl,
        password: redisPassword,
      });

      this.redisSubscriber = this.redisClient.duplicate();

      await this.redisClient.connect();
      await this.redisSubscriber.connect();

      // Initialize Neo4j connection
      const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const neo4jUser = process.env.NEO4J_USER || 'neo4j';
      const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

      this.neo4jDriver = neo4j.driver(
        neo4jUri,
        neo4j.auth.basic(neo4jUser, neo4jPassword)
      );

      // Test connections
      await this.neo4jDriver.verifyConnectivity();

      await this.setupSubscriptions();
      await this.initializeAgentInGraph();

      this.isConnected = true;
      console.log(`✅ ${this.agentRole} communicator initialized`);
    } catch (error) {
      console.error(
        `❌ Failed to initialize ${this.agentRole} communicator:`,
        error
      );
      throw error;
    }
  }

  async setupSubscriptions() {
    // Subscribe to agent-specific channels
    await this.redisSubscriber.subscribe(
      `agent:${this.agentRole}:task`,
      message => {
        this.handleTask(JSON.parse(message));
      }
    );

    await this.redisSubscriber.subscribe(
      `agent:${this.agentRole}:message`,
      message => {
        this.handleMessage(JSON.parse(message));
      }
    );

    // Subscribe to broadcast channels
    await this.redisSubscriber.subscribe('broadcast:all', message => {
      this.handleBroadcast(JSON.parse(message));
    });

    // Subscribe to status updates from other agents
    await this.redisSubscriber.pSubscribe('status:*', (message, channel) => {
      const agentRole = channel.split(':')[1];
      if (agentRole !== this.agentRole) {
        this.handleStatusUpdate(agentRole, JSON.parse(message));
      }
    });
  }

  async initializeAgentInGraph() {
    const session = this.neo4jDriver.session();
    try {
      await session.run(
        `
        MERGE (a:Agent {role: $role})
        SET a.status = 'initializing',
            a.lastSeen = datetime(),
            a.capabilities = $capabilities
      `,
        {
          role: this.agentRole,
          capabilities: this.config.capabilities || [],
        }
      );
    } finally {
      await session.close();
    }
  }

  async sendTask(targetAgent, task) {
    if (!this.isConnected) {
      throw new Error('Communicator not initialized');
    }

    const taskData = {
      id: task.id || uuidv4(),
      from: this.agentRole,
      to: targetAgent,
      type: task.type,
      title: task.title,
      description: task.description,
      priority: task.priority || 'medium',
      data: task.data || {},
      timestamp: new Date().toISOString(),
    };

    // Store task in graph
    await this.storeTaskInGraph(taskData);

    // Send via Redis
    await this.redisClient.publish(
      `agent:${targetAgent}:task`,
      JSON.stringify(taskData)
    );

    console.log(`📤 Sent task ${taskData.id} to ${targetAgent}`);
    return taskData.id;
  }

  async updateTaskStatus(taskId, status, result = null) {
    try {
      const session = this.neo4jDriver.session();
      await session.run(
        `
        MATCH (t:Task {id: $taskId})
        SET t.status = $status,
            t.completedBy = $agentRole,
            t.completedAt = datetime(),
            t.result = $result
      `,
        {
          taskId,
          status,
          agentRole: this.agentRole,
          result: result ? JSON.stringify(result) : null,
        }
      );
      await session.close();

      // Publish status update
      await this.redisClient.publish(
        `task:${taskId}:status`,
        JSON.stringify({
          taskId,
          status,
          completedBy: this.agentRole,
          result,
        })
      );
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  }

  async updateStatus(status, details = {}) {
    const statusData = {
      role: this.agentRole,
      status,
      details,
      timestamp: new Date().toISOString(),
    };

    // Update in graph
    const session = this.neo4jDriver.session();
    try {
      await session.run(
        `
        MATCH (a:Agent {role: $role})
        SET a.status = $status,
            a.lastSeen = datetime(),
            a.details = $details
      `,
        {
          role: this.agentRole,
          status,
          details: JSON.stringify(details),
        }
      );
    } finally {
      await session.close();
    }

    // Publish status update
    await this.redisClient.publish(
      `status:${this.agentRole}`,
      JSON.stringify(statusData)
    );
  }

  async shareOutput(output) {
    const outputData = {
      from: this.agentRole,
      output,
      timestamp: new Date().toISOString(),
    };

    await this.redisClient.publish(
      `outputs:${this.agentRole}`,
      JSON.stringify(outputData)
    );
  }

  async sendMessage(targetAgent, subject, content, data = {}) {
    const message = {
      id: uuidv4(),
      from: this.agentRole,
      to: targetAgent,
      subject,
      content,
      data,
      timestamp: new Date().toISOString(),
    };

    await this.redisClient.publish(
      `agent:${targetAgent}:message`,
      JSON.stringify(message)
    );
    console.log(`💬 Sent message to ${targetAgent}: ${subject}`);
    return message.id;
  }

  async broadcast(type, content, data = {}) {
    const broadcast = {
      id: uuidv4(),
      from: this.agentRole,
      type,
      content,
      data,
      timestamp: new Date().toISOString(),
    };

    await this.redisClient.publish('broadcast:all', JSON.stringify(broadcast));
    console.log(`📢 Broadcast sent: ${type}`);
  }

  async getAgentStatus(agentRole) {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(
        `
        MATCH (a:Agent {role: $role})
        RETURN a.status as status, a.details as details, a.lastSeen as lastSeen
      `,
        { role: agentRole }
      );

      await session.close();

      if (result.records.length > 0) {
        const record = result.records[0];
        return {
          status: record.get('status'),
          details: JSON.parse(record.get('details') || '{}'),
          lastSeen: record.get('lastSeen'),
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting agent status:', error);
      return null;
    }
  }

  async getAllAgentStatuses() {
    const agents = ['architect', 'frontend', 'backend', 'devops', 'qa', 'docs'];
    const statuses = {};

    for (const agent of agents) {
      statuses[agent] = await this.getAgentStatus(agent);
    }

    return statuses;
  }

  async getPendingTasks() {
    try {
      const session = this.neo4jDriver.session();
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status IN ['pending', 'in_progress']
        RETURN t
        ORDER BY t.priority DESC, t.createdAt ASC
      `);

      await session.close();
      return result.records.map(record => record.get('t').properties);
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return [];
    }
  }

  async storeTaskInGraph(taskData) {
    const session = this.neo4jDriver.session();
    try {
      await session.run(
        `
        CREATE (t:Task {
          id: $id,
          type: $type,
          title: $title,
          description: $description,
          priority: $priority,
          status: 'pending',
          createdAt: datetime(),
          data: $data
        })
        WITH t
        MATCH (from:Agent {role: $from})
        MATCH (to:Agent {role: $to})
        CREATE (from)-[:ASSIGNED]->(t)-[:ASSIGNED_TO]->(to)
      `,
        {
          id: taskData.id,
          type: taskData.type,
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          data: JSON.stringify(taskData.data),
          from: taskData.from,
          to: taskData.to,
        }
      );
    } finally {
      await session.close();
    }
  }

  async storeKnowledge(type, data, relationships = []) {
    try {
      const session = this.neo4jDriver.session();
      const nodeId = uuidv4();

      await session.run(
        `
        CREATE (k:Knowledge {
          id: $id,
          type: $type,
          data: $data,
          createdBy: $agentRole,
          createdAt: datetime()
        })
      `,
        {
          id: nodeId,
          type,
          data: JSON.stringify(data),
          agentRole: this.agentRole,
        }
      );

      // Create relationships if provided
      for (const rel of relationships) {
        await session.run(
          `
          MATCH (k:Knowledge {id: $nodeId})
          MATCH (target) WHERE target.id = $targetId
          CREATE (k)-[:${rel.type}]->(target)
        `,
          {
            nodeId,
            targetId: rel.targetId,
          }
        );
      }

      await session.close();
      return nodeId;
    } catch (error) {
      console.error('Error storing knowledge:', error);
      throw error;
    }
  }

  handleTask(taskData) {
    console.log(`📥 Received task: ${taskData.title || taskData.id}`);
    this.emit('task', taskData);
  }

  handleMessage(messageData) {
    console.log(
      `💬 Received message from ${messageData.from}: ${messageData.subject}`
    );
    this.emit('message', messageData);
  }

  handleBroadcast(broadcastData) {
    console.log(`📢 Received broadcast: ${broadcastData.type}`);
    this.emit('broadcast', broadcastData);
  }

  handleStatusUpdate(agentRole, statusData) {
    this.emit('status_update', agentRole, statusData);
  }

  async close() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      if (this.redisSubscriber) {
        await this.redisSubscriber.quit();
      }
      if (this.neo4jDriver) {
        await this.neo4jDriver.close();
      }
      this.isConnected = false;
      console.log(`👋 ${this.agentRole} communicator closed`);
    } catch (error) {
      console.error('Error closing communicator:', error);
    }
  }
}

module.exports = SwarmCommunicator;
