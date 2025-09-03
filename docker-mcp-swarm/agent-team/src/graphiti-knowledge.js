import neo4j from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

/**
 * Graphiti-style knowledge graph for agent coordination and learning
 */
export class GraphitiKnowledge {
  constructor() {
    this.driver = null;
    this.session = null;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [GraphitiKnowledge] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/graphiti-knowledge.log',
        }),
      ],
    });
  }

  async initialize() {
    try {
      this.logger.info('Initializing Graphiti Knowledge Graph...');

      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'swarmpassword123';

      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      this.session = this.driver.session();

      // Test connection
      await this.session.run('RETURN 1');

      // Initialize schema
      await this.initializeSchema();

      this.logger.info('Graphiti Knowledge Graph initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize knowledge graph: ${error.message}`
      );
      throw error;
    }
  }

  async initializeSchema() {
    const constraints = [
      // Node constraints
      'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
      'CREATE CONSTRAINT interaction_id IF NOT EXISTS FOR (i:Interaction) REQUIRE i.id IS UNIQUE',
      'CREATE CONSTRAINT knowledge_id IF NOT EXISTS FOR (k:Knowledge) REQUIRE k.id IS UNIQUE',

      // Indexes for performance
      'CREATE INDEX agent_name IF NOT EXISTS FOR (a:Agent) ON (a.name)',
      'CREATE INDEX task_type IF NOT EXISTS FOR (t:Task) ON (t.type)',
      'CREATE INDEX interaction_timestamp IF NOT EXISTS FOR (i:Interaction) ON (i.timestamp)',
      'CREATE INDEX knowledge_topic IF NOT EXISTS FOR (k:Knowledge) ON (k.topic)',
    ];

    for (const constraint of constraints) {
      try {
        await this.session.run(constraint);
      } catch (error) {
        // Constraint might already exist, that's okay
        if (!error.message.includes('already exists')) {
          this.logger.warn(`Schema constraint warning: ${error.message}`);
        }
      }
    }

    this.logger.info('Knowledge graph schema initialized');
  }

  /**
   * Store an interaction between agent and task
   */
  async storeInteraction(task, result, agentName) {
    try {
      const interactionId = uuidv4();
      const timestamp = new Date().toISOString();

      const query = `
        MERGE (a:Agent {name: $agentName})
        ON CREATE SET a.id = $agentId, a.created = $timestamp

        CREATE (t:Task {
          id: $taskId,
          description: $taskDescription,
          type: $taskType,
          timestamp: $timestamp
        })

        CREATE (i:Interaction {
          id: $interactionId,
          result: $result,
          success: $success,
          timestamp: $timestamp
        })

        CREATE (a)-[:EXECUTED]->(t)
        CREATE (t)-[:PRODUCED]->(i)

        RETURN i.id as interactionId
      `;

      const params = {
        agentName,
        agentId: uuidv4(),
        taskId: uuidv4(),
        taskDescription: task.substring(0, 500), // Limit length
        taskType: this.categorizeTask(task),
        interactionId,
        result: JSON.stringify(result).substring(0, 1000), // Limit length
        success: result && !result.error,
        timestamp,
      };

      const resultRecord = await this.session.run(query, params);
      this.logger.info(`Stored interaction: ${interactionId}`);

      // Extract and store knowledge
      await this.extractKnowledge(task, result, agentName);

      return interactionId;
    } catch (error) {
      this.logger.error(`Failed to store interaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store coordination results between multiple agents
   */
  async storeCoordination(task, results) {
    try {
      const coordinationId = uuidv4();
      const timestamp = new Date().toISOString();

      const query = `
        CREATE (c:Coordination {
          id: $coordinationId,
          task: $task,
          timestamp: $timestamp,
          agentCount: $agentCount
        })

        WITH c
        UNWIND $results as result
        MATCH (a:Agent {name: result.agentName})
        CREATE (a)-[:PARTICIPATED_IN]->(c)

        RETURN c.id as coordinationId
      `;

      const params = {
        coordinationId,
        task: task.substring(0, 500),
        timestamp,
        agentCount: results.length,
        results: results.map(r => ({ agentName: r.agent })),
      };

      await this.session.run(query, params);
      this.logger.info(`Stored coordination: ${coordinationId}`);

      return coordinationId;
    } catch (error) {
      this.logger.error(`Failed to store coordination: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract and store knowledge from interactions
   */
  async extractKnowledge(task, result, agentName) {
    try {
      // Simple knowledge extraction - could be enhanced with AI
      const topics = this.extractTopics(task);
      const timestamp = new Date().toISOString();

      for (const topic of topics) {
        const knowledgeId = uuidv4();

        const query = `
          MERGE (k:Knowledge {topic: $topic})
          ON CREATE SET k.id = $knowledgeId, k.created = $timestamp, k.count = 1
          ON MATCH SET k.count = k.count + 1, k.lastUpdated = $timestamp

          MERGE (a:Agent {name: $agentName})
          MERGE (a)-[r:KNOWS]->(k)
          ON CREATE SET r.strength = 1, r.firstLearned = $timestamp
          ON MATCH SET r.strength = r.strength + 1, r.lastReinforced = $timestamp

          RETURN k.topic as topic
        `;

        await this.session.run(query, {
          topic,
          knowledgeId,
          agentName,
          timestamp,
        });
      }

      this.logger.info(`Extracted knowledge for topics: ${topics.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to extract knowledge: ${error.message}`);
    }
  }

  /**
   * Get relevant context for a task
   */
  async getRelevantContext(task) {
    try {
      const topics = this.extractTopics(task);

      const query = `
        MATCH (k:Knowledge)
        WHERE ANY(topic IN $topics WHERE k.topic CONTAINS topic)

        OPTIONAL MATCH (a:Agent)-[r:KNOWS]->(k)

        RETURN k.topic as topic,
               k.count as usage_count,
               collect({agent: a.name, strength: r.strength}) as experts
        ORDER BY k.count DESC
        LIMIT 10
      `;

      const result = await this.session.run(query, { topics });

      const context = result.records.map(record => ({
        topic: record.get('topic'),
        usageCount: record.get('usage_count'),
        experts: record.get('experts').filter(e => e.agent),
      }));

      return context;
    } catch (error) {
      this.logger.error(`Failed to get relevant context: ${error.message}`);
      return [];
    }
  }

  /**
   * Get agent expertise and specializations
   */
  async getAgentExpertise(agentName) {
    try {
      const query = `
        MATCH (a:Agent {name: $agentName})-[r:KNOWS]->(k:Knowledge)
        RETURN k.topic as topic, r.strength as strength
        ORDER BY r.strength DESC
        LIMIT 20
      `;

      const result = await this.session.run(query, { agentName });

      return result.records.map(record => ({
        topic: record.get('topic'),
        strength: record.get('strength'),
      }));
    } catch (error) {
      this.logger.error(`Failed to get agent expertise: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the best agent for a task based on knowledge graph
   */
  async findBestAgent(task) {
    try {
      const topics = this.extractTopics(task);

      const query = `
        MATCH (a:Agent)-[r:KNOWS]->(k:Knowledge)
        WHERE ANY(topic IN $topics WHERE k.topic CONTAINS topic)

        WITH a, sum(r.strength) as totalStrength, count(k) as knowledgeCount
        RETURN a.name as agent, totalStrength, knowledgeCount
        ORDER BY totalStrength DESC, knowledgeCount DESC
        LIMIT 5
      `;

      const result = await this.session.run(query, { topics });

      return result.records.map(record => ({
        agent: record.get('agent'),
        strength: record.get('totalStrength'),
        knowledgeCount: record.get('knowledgeCount'),
      }));
    } catch (error) {
      this.logger.error(`Failed to find best agent: ${error.message}`);
      return [];
    }
  }

  /**
   * Simple topic extraction from text
   */
  extractTopics(text) {
    const keywords = [
      'code',
      'coding',
      'programming',
      'development',
      'test',
      'testing',
      'qa',
      'quality',
      'deploy',
      'deployment',
      'docker',
      'infrastructure',
      'design',
      'architecture',
      'system',
      'planning',
      'document',
      'documentation',
      'docs',
      'api',
      'database',
      'web',
      'frontend',
      'backend',
      'javascript',
      'python',
      'node',
      'react',
      'html',
      'css',
    ];

    const textLower = text.toLowerCase();
    return keywords.filter(keyword => textLower.includes(keyword));
  }

  /**
   * Categorize task type
   */
  categorizeTask(task) {
    const taskLower = task.toLowerCase();

    if (taskLower.includes('code') || taskLower.includes('implement'))
      return 'development';
    if (taskLower.includes('test') || taskLower.includes('qa'))
      return 'testing';
    if (taskLower.includes('deploy') || taskLower.includes('docker'))
      return 'deployment';
    if (taskLower.includes('design') || taskLower.includes('architect'))
      return 'design';
    if (taskLower.includes('document') || taskLower.includes('explain'))
      return 'documentation';

    return 'general';
  }

  /**
   * Store project information in knowledge graph
   */
  async storeProject(projectData) {
    try {
      const projectId = uuidv4();
      const timestamp = new Date().toISOString();
      
      const query = `
        CREATE (p:Project {
          id: $projectId,
          title: $title,
          description: $description,
          requirements: $requirements,
          status: $status,
          createdAt: $timestamp,
          planningResult: $planningResult
        })
        RETURN p.id as projectId
      `;
      
      const params = {
        projectId,
        title: projectData.title,
        description: projectData.description,
        requirements: JSON.stringify(projectData.requirements || {}),
        status: projectData.status || 'planned',
        timestamp,
        planningResult: JSON.stringify(projectData.planningResult || {})
      };
      
      await this.session.run(query, params);
      this.logger.info(`Stored project: ${projectData.title} (${projectId})`);
      
      return projectId;
    } catch (error) {
      this.logger.error(`Failed to store project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get knowledge graph statistics
   */
  async getStatus() {
    try {
      const query = `
        MATCH (a:Agent) WITH count(a) as agents
        MATCH (t:Task) WITH agents, count(t) as tasks
        MATCH (i:Interaction) WITH agents, tasks, count(i) as interactions
        MATCH (k:Knowledge) WITH agents, tasks, interactions, count(k) as knowledge
        MATCH (c:Coordination) WITH agents, tasks, interactions, knowledge, count(c) as coordinations

        RETURN agents, tasks, interactions, knowledge, coordinations
      `;

      const result = await this.session.run(query);
      const record = result.records[0];

      return {
        agents: record.get('agents').toNumber(),
        tasks: record.get('tasks').toNumber(),
        interactions: record.get('interactions').toNumber(),
        knowledge: record.get('knowledge').toNumber(),
        coordinations: record.get('coordinations').toNumber(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get status: ${error.message}`);
      return {
        agents: 0,
        tasks: 0,
        interactions: 0,
        knowledge: 0,
        coordinations: 0,
        error: error.message,
      };
    }
  }

  /**
   * Clean up resources
   */
  async close() {
    if (this.session) {
      await this.session.close();
    }
    if (this.driver) {
      await this.driver.close();
    }
    this.logger.info('Knowledge graph connection closed');
  }
}
