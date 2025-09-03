import Redis from 'redis';

export class TaskRouter {
  constructor(agents, neo4jDriver, logger) {
    console.log('========== TASKROUTER CONSTRUCTOR CALLED ==========');
    console.log('DEBUG_MODE env var:', process.env.DEBUG_MODE);

    this.agents = agents;
    this.neo4jDriver = neo4jDriver;
    this.logger = logger;
    this.taskQueue = [];
    this.activeTasksByAgent = new Map();
    this.isAutoProcessingEnabled = true;
    this.processingInterval = null;
    this.debugMode = process.env.DEBUG_MODE === 'true';
    this.redis = null;

    // Initialize Redis for real-time updates
    this.initializeRedis();

    // Log debug mode status
    if (this.debugMode) {
      console.log('🐛 DEBUG MODE ENABLED - No Claude API calls will be made');
      this.logger.info(
        '🐛 DEBUG MODE ENABLED - No Claude API calls will be made'
      );
    } else {
      console.log('🔧 DEBUG MODE DISABLED - Normal Claude API operations');
      this.logger.info('🔧 DEBUG MODE DISABLED - Normal Claude API operations');
    }

    // Initialize tracking for each agent
    for (const [agentName, agent] of this.agents) {
      this.activeTasksByAgent.set(agentName, []);
    }

    // Start automatic task processing (delay slightly to ensure Neo4j is fully ready)
    setTimeout(() => {
      this.startAutoProcessing();
    }, 2000);
  }

  async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      this.redis = Redis.createClient({
        url: redisUrl,
        password: redisPassword,
      });

      await this.redis.connect();
      this.logger?.info(
        '📡 TaskRouter Redis connection established for real-time updates'
      );
    } catch (error) {
      this.logger?.error(`Failed to connect to Redis: ${error.message}`);
    }
  }

  async publishAgentStatusUpdate(agentName, status) {
    if (this.redis) {
      try {
        await this.redis.publish(
          `status:${agentName}`,
          JSON.stringify({
            agent: agentName,
            status: status,
            timestamp: new Date().toISOString(),
            activeTasks: this.activeTasksByAgent.get(agentName)?.length || 0,
          })
        );
      } catch (error) {
        this.logger?.error(`Failed to publish agent status: ${error.message}`);
      }
    }
  }

  async publishTaskUpdate(taskId, update) {
    if (this.redis) {
      try {
        await this.redis.publish(
          `task:${taskId}:status`,
          JSON.stringify({
            taskId,
            ...update,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        this.logger?.error(`Failed to publish task update: ${error.message}`);
      }
    }
  }

  async publishQueueUpdate() {
    if (this.redis) {
      try {
        await this.redis.publish(
          'queue:update',
          JSON.stringify({
            queueLength: this.taskQueue.length,
            queuedTasks: this.taskQueue.map(t => ({
              id: t.id,
              title: t.title,
              preferredAgent: t.preferredAgent,
              queuedAt: t.queuedAt,
            })),
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        this.logger?.error(`Failed to publish queue update: ${error.message}`);
      }
    }
  }

  async routeTask(task) {
    const bestAgent = this.selectBestAgent(task);

    if (this.canAcceptTask(bestAgent)) {
      return await this.assignTask(bestAgent, task);
    } else if (bestAgent.canDelegate) {
      return await this.delegateTask(bestAgent, task);
    } else {
      const queuedTask = {
        ...task,
        queuedAt: new Date().toISOString(),
        preferredAgent: bestAgent.name,
      };
      this.taskQueue.push(queuedTask);

      // Publish task queued update
      await this.publishTaskUpdate(task.id || `queued_${Date.now()}`, {
        status: 'queued',
        preferredAgent: bestAgent.name,
        position: this.taskQueue.length,
        title: task.title,
      });

      // Publish queue update
      await this.publishQueueUpdate();

      return {
        status: 'queued',
        position: this.taskQueue.length,
        estimatedWait: this.estimateWait(bestAgent),
        preferredAgent: bestAgent.name,
      };
    }
  }

  selectBestAgent(task) {
    const taskKeywords = task.description
      ? task.description.toLowerCase()
      : task.title?.toLowerCase() || '';
    const taskTitle = task.title ? task.title.toLowerCase() : '';
    const combinedText = `${taskKeywords} ${taskTitle}`;

    // Architecture and planning
    if (
      this.matchesKeywords(combinedText, [
        'design',
        'architecture',
        'plan',
        'system',
        'technical',
        'strategy',
        'requirements',
      ])
    ) {
      return this.agents.get('system-architect');
    }

    // Backend development
    if (
      this.matchesKeywords(combinedText, [
        'api',
        'database',
        'server',
        'backend',
        'service',
        'integration',
        'auth',
      ])
    ) {
      return this.agents.get('backend-developer');
    }

    // Frontend development
    if (
      this.matchesKeywords(combinedText, [
        'ui',
        'interface',
        'frontend',
        'component',
        'react',
        'vue',
        'angular',
        'css',
      ])
    ) {
      return this.agents.get('frontend-developer');
    }

    // Testing and QA
    if (
      this.matchesKeywords(combinedText, [
        'test',
        'qa',
        'quality',
        'bug',
        'testing',
        'coverage',
        'validation',
      ])
    ) {
      return this.agents.get('qa-engineer');
    }

    // DevOps and Infrastructure
    if (
      this.matchesKeywords(combinedText, [
        'deploy',
        'docker',
        'infrastructure',
        'devops',
        'pipeline',
        'build',
        'ci/cd',
      ])
    ) {
      return this.agents.get('devops-engineer');
    }

    // Code Review
    if (
      this.matchesKeywords(combinedText, [
        'review',
        'optimize',
        'refactor',
        'standards',
        'code quality',
        'security',
      ])
    ) {
      return this.agents.get('code-reviewer');
    }

    // Default to architect for planning and coordination
    return this.agents.get('system-architect');
  }

  matchesKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  canAcceptTask(agent) {
    const activeTasks = this.activeTasksByAgent.get(agent.name) || [];
    return activeTasks.length < agent.maxConcurrentTasks;
  }

  async assignTask(agent, task) {
    const taskId = `task_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Check if this is the project manager analyzing the task first
    if (agent.name === 'project-manager') {
      const analysis = agent.analyzeTask(task);

      if (analysis.status === 'Blocked') {
        const blockedTask = {
          ...task,
          id: taskId,
          assignedTo: 'project-manager',
          status: 'Blocked',
          assignedAt: new Date().toISOString(),
          blockingReason: analysis.reason,
          nextAction: analysis.nextAction,
        };

        // Store blocked task in Neo4j
        await this.storeTaskInNeo4j(blockedTask);

        // Publish real-time update for blocked task
        await this.publishTaskUpdate(taskId, {
          status: 'Blocked',
          agent: 'project-manager',
          reason: analysis.reason,
          nextAction: analysis.nextAction,
        });

        this.logger.warn(`🚫 Task blocked: ${task.title} - ${analysis.reason}`);

        return {
          taskId,
          status: 'Blocked',
          agent: 'project-manager',
          reason: analysis.reason,
          nextAction: analysis.nextAction,
          timestamp: new Date().toISOString(),
        };
      }

      // If not blocked, assign to the recommended agent
      if (analysis.primaryAgent && this.agents.has(analysis.primaryAgent)) {
        const targetAgent = this.agents.get(analysis.primaryAgent);
        this.logger.info(
          `📋 Project Manager assigning task "${task.title}" to ${analysis.primaryAgent}`
        );
        return await this.assignTask(targetAgent, { ...task, analysis });
      }
    }

    const assignedTask = {
      ...task,
      id: taskId,
      assignedTo: agent.name,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
    };

    // Track the task
    const activeTasks = this.activeTasksByAgent.get(agent.name);
    activeTasks.push(assignedTask);

    // Publish task assignment update
    await this.publishTaskUpdate(taskId, {
      status: 'assigned',
      agent: agent.name,
      title: task.title,
      priority: task.priority,
    });

    // Publish agent status update
    await this.publishAgentStatusUpdate(agent.name, 'busy');

    // Process the task
    try {
      let result;

      if (this.debugMode) {
        // In debug mode, use project manager's debug processing if available
        if (this.agents.has('project-manager')) {
          const projectManager = this.agents.get('project-manager');
          result = projectManager.processInDebugMode(task, agent.name);
          this.logger.info(
            `🐛 DEBUG: Simulated task processing for ${agent.name}`
          );
        } else {
          result = {
            debugMode: true,
            message: `[DEBUG MODE] Task "${task.title}" assigned to ${agent.name}. No actual processing performed.`,
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        // Normal processing with Claude API
        result = await agent.think(task.description || task.title, {
          taskId: taskId,
          taskTitle: task.title,
          taskPriority: task.priority || 'medium',
        });
      }

      assignedTask.status = 'completed';
      assignedTask.completedAt = new Date().toISOString();
      assignedTask.result = result;

      // Store completed task in Neo4j
      await this.storeTaskInNeo4j(assignedTask);

      // Remove from active tasks
      const index = activeTasks.findIndex(t => t.id === taskId);
      if (index > -1) {
        activeTasks.splice(index, 1);
      }

      // Publish task completion update
      await this.publishTaskUpdate(taskId, {
        status: 'completed',
        agent: agent.name,
        result: result,
        debugMode: this.debugMode,
      });

      // Publish agent status update (check if agent is still busy)
      const remainingTasks =
        this.activeTasksByAgent.get(agent.name)?.length || 0;
      await this.publishAgentStatusUpdate(
        agent.name,
        remainingTasks > 0 ? 'busy' : 'idle'
      );

      return {
        taskId,
        status: 'completed',
        agent: agent.name,
        result: result,
        debugMode: this.debugMode,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      assignedTask.status = 'failed';
      assignedTask.failedAt = new Date().toISOString();
      assignedTask.error = error.message;

      // Store failed task in Neo4j
      await this.storeTaskInNeo4j(assignedTask);

      // Remove from active tasks
      const activeTasks = this.activeTasksByAgent.get(agent.name);
      const index = activeTasks.findIndex(t => t.id === taskId);
      if (index > -1) {
        activeTasks.splice(index, 1);
      }

      // Publish task failure update
      await this.publishTaskUpdate(taskId, {
        status: 'failed',
        agent: agent.name,
        error: error.message,
      });

      // Publish agent status update (check if agent is still busy)
      const remainingTasks =
        this.activeTasksByAgent.get(agent.name)?.length || 0;
      await this.publishAgentStatusUpdate(
        agent.name,
        remainingTasks > 0 ? 'busy' : 'idle'
      );

      return {
        taskId,
        status: 'failed',
        agent: agent.name,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async delegateTask(delegatingAgent, task) {
    // For architect, delegate to appropriate specialist
    if (delegatingAgent.name === 'system-architect') {
      const specialist = this.selectSpecialistForDelegation(task);
      if (specialist && this.canAcceptTask(specialist)) {
        return await this.assignTask(specialist, {
          ...task,
          delegatedBy: delegatingAgent.name,
          delegatedAt: new Date().toISOString(),
        });
      }
    }

    // If delegation fails, queue the task
    this.taskQueue.push({
      ...task,
      queuedAt: new Date().toISOString(),
      preferredAgent: delegatingAgent.name,
      delegationFailed: true,
    });

    return {
      status: 'queued_after_delegation_failure',
      position: this.taskQueue.length,
      originalAgent: delegatingAgent.name,
    };
  }

  selectSpecialistForDelegation(task) {
    // Similar logic to selectBestAgent but excludes architect
    const taskKeywords = task.description
      ? task.description.toLowerCase()
      : task.title?.toLowerCase() || '';

    if (taskKeywords.includes('api') || taskKeywords.includes('backend')) {
      return this.agents.get('backend-developer');
    }
    if (taskKeywords.includes('ui') || taskKeywords.includes('frontend')) {
      return this.agents.get('frontend-developer');
    }
    if (taskKeywords.includes('test') || taskKeywords.includes('qa')) {
      return this.agents.get('qa-engineer');
    }
    if (taskKeywords.includes('deploy') || taskKeywords.includes('devops')) {
      return this.agents.get('devops-engineer');
    }

    return this.agents.get('backend-developer'); // Default specialist
  }

  estimateWait(agent) {
    const activeTasks = this.activeTasksByAgent.get(agent.name) || [];
    const queuedForAgent = this.taskQueue.filter(
      t => t.preferredAgent === agent.name
    ).length;

    // Rough estimate: 5 minutes per active task + 3 minutes per queued task
    return activeTasks.length * 5 + queuedForAgent * 3;
  }

  processQueue() {
    // Process queued tasks when agents become available
    if (this.taskQueue.length === 0) return;

    const availableAgents = Array.from(this.agents.values()).filter(agent =>
      this.canAcceptTask(agent)
    );

    for (const agent of availableAgents) {
      const taskIndex = this.taskQueue.findIndex(
        task => task.preferredAgent === agent.name
      );

      if (taskIndex > -1) {
        const task = this.taskQueue.splice(taskIndex, 1)[0];
        this.assignTask(agent, task);
      }
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.taskQueue.length,
      activeTasksByAgent: Object.fromEntries(
        Array.from(this.activeTasksByAgent.entries()).map(([name, tasks]) => [
          name,
          {
            count: tasks.length,
            maxCapacity: this.agents.get(name)?.maxConcurrentTasks || 1,
          },
        ])
      ),
      queuedTasks: this.taskQueue.map(task => ({
        title: task.title,
        preferredAgent: task.preferredAgent,
        queuedAt: task.queuedAt,
        estimatedWait: this.estimateWait(this.agents.get(task.preferredAgent)),
      })),
    };
  }

  startAutoProcessing() {
    if (!this.isAutoProcessingEnabled) return;

    // Start Project Manager coordination
    this.startProjectManagerCoordination();

    // Each agent polls their queue every 10 seconds
    this.agentPollingIntervals = new Map();
    for (const [agentName, agent] of this.agents) {
      const pollingInterval = setInterval(async () => {
        await this.agentPollQueue(agentName);
      }, 10000); // 10 seconds as requested

      this.agentPollingIntervals.set(agentName, pollingInterval);
    }

    // Main processing loop (faster for coordination)
    this.processingInterval = setInterval(async () => {
      await this.pollAndProcessTasks();
    }, 5000); // Check every 5 seconds

    // Start consistency checks
    this.startConsistencyChecks();

    // Initial sync on startup
    setTimeout(async () => {
      await this.syncTaskState();
    }, 1000);

    this.logger?.info(
      'Started automatic task processing with 10-second agent polling and Project Manager coordination'
    );
  }

  stopAutoProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Stop agent polling intervals
    if (this.agentPollingIntervals) {
      for (const [agentName, intervalId] of this.agentPollingIntervals) {
        clearInterval(intervalId);
      }
      this.agentPollingIntervals.clear();
    }

    // Stop project manager coordination
    this.stopProjectManagerCoordination();

    this.stopConsistencyChecks();
    this.isAutoProcessingEnabled = false;
    this.logger?.info(
      'Stopped automatic task processing and all agent polling'
    );
  }

  async pollAndProcessTasks() {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();

    try {
      // Get pending tasks from Neo4j
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status = 'pending' OR t.status = 'assigned'
        RETURN t.id as taskId,
               t.title as title,
               t.description as description,
               t.assignedTo as assignedTo,
               t.priority as priority,
               t.status as status,
               t.createdAt as createdAt
        ORDER BY t.createdAt ASC
        LIMIT 10
      `);

      for (const record of result.records) {
        const task = {
          id: record.get('taskId'),
          title: record.get('title'),
          description: record.get('description'),
          assignedTo: record.get('assignedTo'),
          priority: record.get('priority'),
          status: record.get('status'),
          createdAt: record.get('createdAt'),
        };

        if (task.status === 'pending') {
          // Route unassigned tasks
          await this.processUnassignedTask(task);
        } else if (task.status === 'assigned') {
          // Process assigned tasks
          await this.processAssignedTask(task);
        }
      }
    } catch (error) {
      this.logger?.error(`Error polling tasks: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async processUnassignedTask(task) {
    try {
      const result = await this.routeTask(task);

      // Update task status in Neo4j
      const session = this.neo4jDriver.session();
      await session.run(
        `
        MATCH (t:Task {id: $taskId})
        SET t.status = $status,
            t.assignedTo = $assignedTo,
            t.assignedAt = $timestamp
      `,
        {
          taskId: task.id,
          status: result.status === 'queued' ? 'queued' : 'assigned',
          assignedTo: result.agent || result.preferredAgent,
          timestamp: new Date().toISOString(),
        }
      );
      await session.close();

      this.logger?.info(
        `Processed unassigned task: ${task.id} -> ${result.status}`
      );
    } catch (error) {
      this.logger?.error(
        `Failed to process unassigned task ${task.id}: ${error.message}`
      );
    }
  }

  async processAssignedTask(task) {
    try {
      const agent = this.agents.get(task.assignedTo);
      if (!agent) {
        this.logger?.warn(
          `Agent not found for task ${task.id}: ${task.assignedTo}`
        );
        return;
      }

      // Check if agent can accept task
      if (!this.canAcceptTask(agent)) {
        this.logger?.info(
          `Agent ${task.assignedTo} is busy, task ${task.id} remains queued`
        );
        return;
      }

      // Process the task
      const result = await this.assignTask(agent, task);

      // Update task status in Neo4j
      const session = this.neo4jDriver.session();
      await session.run(
        `
        MATCH (t:Task {id: $taskId})
        SET t.status = $status,
            t.result = $result,
            t.completedAt = $timestamp,
            t.error = $error
      `,
        {
          taskId: task.id,
          status: result.status,
          result: result.result ? JSON.stringify(result.result) : null,
          error: result.error || null,
          timestamp: new Date().toISOString(),
        }
      );
      await session.close();

      this.logger?.info(
        `Processed assigned task: ${task.id} -> ${result.status}`
      );
    } catch (error) {
      this.logger?.error(
        `Failed to process assigned task ${task.id}: ${error.message}`
      );
    }
  }

  async manualTriggerTask(taskId) {
    if (!this.neo4jDriver) throw new Error('Neo4j driver not available');

    const session = this.neo4jDriver.session();

    try {
      // Get specific task
      const result = await session.run(
        `
        MATCH (t:Task {id: $taskId})
        RETURN t.id as taskId,
               t.title as title,
               t.description as description,
               t.assignedTo as assignedTo,
               t.priority as priority,
               t.status as status
      `,
        { taskId }
      );

      if (result.records.length === 0) {
        throw new Error(`Task ${taskId} not found`);
      }

      const task = {
        id: result.records[0].get('taskId'),
        title: result.records[0].get('title'),
        description: result.records[0].get('description'),
        assignedTo: result.records[0].get('assignedTo'),
        priority: result.records[0].get('priority'),
        status: result.records[0].get('status'),
      };

      // Process the task
      let processResult;
      if (task.status === 'pending') {
        processResult = await this.processUnassignedTask(task);
      } else if (task.status === 'assigned') {
        processResult = await this.processAssignedTask(task);
      } else {
        throw new Error(
          `Task ${taskId} is in status ${task.status} and cannot be manually triggered`
        );
      }

      return {
        taskId,
        status: 'triggered',
        message: `Task manually triggered and processed`,
        result: processResult,
      };
    } finally {
      await session.close();
    }
  }

  async syncTaskState() {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();

    try {
      // Get all tasks from Neo4j and sync with in-memory state
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status IN ['assigned', 'in_progress', 'queued']
        RETURN t.id as taskId,
               t.assignedTo as assignedTo,
               t.status as status,
               t.title as title,
               t.description as description,
               t.priority as priority
        ORDER BY t.createdAt ASC
      `);

      // Clear current in-memory queues
      this.taskQueue = [];
      for (const [agentName] of this.agents) {
        this.activeTasksByAgent.set(agentName, []);
      }

      // Rebuild from Neo4j state
      for (const record of result.records) {
        const task = {
          id: record.get('taskId'),
          assignedTo: record.get('assignedTo'),
          status: record.get('status'),
          title: record.get('title'),
          description: record.get('description'),
          priority: record.get('priority'),
        };

        if (task.status === 'queued' || task.status === 'pending') {
          // Add to queue
          this.taskQueue.push({
            ...task,
            preferredAgent: task.assignedTo || 'system-architect',
          });
        } else if (
          task.status === 'assigned' ||
          task.status === 'in_progress'
        ) {
          // Add to agent's active tasks
          const activeTasks = this.activeTasksByAgent.get(task.assignedTo);
          if (activeTasks) {
            activeTasks.push(task);
          }
        }
      }

      this.logger?.info(
        `Synchronized task state: ${result.records.length} tasks processed`
      );
    } catch (error) {
      this.logger?.error(`Failed to sync task state: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async updateTaskInNeo4j(taskId, updates) {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();

    try {
      const setClause = Object.keys(updates)
        .map(key => `t.${key} = $${key}`)
        .join(', ');

      const query = `
        MATCH (t:Task {id: $taskId})
        SET ${setClause}, t.updatedAt = $timestamp
        RETURN t.id as taskId
      `;

      await session.run(query, {
        taskId,
        ...updates,
        timestamp: new Date().toISOString(),
      });

      this.logger?.info(`Updated task ${taskId} in Neo4j`);
    } catch (error) {
      this.logger?.error(`Failed to update task ${taskId}: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async ensureTaskConsistency() {
    // Periodically check for inconsistencies between memory and Neo4j
    const memoryTaskIds = new Set([
      ...this.taskQueue.map(t => t.id),
      ...Array.from(this.activeTasksByAgent.values())
        .flat()
        .map(t => t.id),
    ]);

    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();

    try {
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status IN ['assigned', 'in_progress', 'queued', 'pending']
        RETURN t.id as taskId, t.status as status
      `);

      const neo4jTasks = new Map(
        result.records.map(r => [r.get('taskId'), r.get('status')])
      );

      // Find tasks in Neo4j but not in memory
      const missingInMemory = [];
      for (const [taskId, status] of neo4jTasks) {
        if (!memoryTaskIds.has(taskId)) {
          missingInMemory.push({ id: taskId, status });
        }
      }

      // Find tasks in memory but not in Neo4j (or with different status)
      const inconsistentTasks = [];
      for (const taskId of memoryTaskIds) {
        if (!neo4jTasks.has(taskId)) {
          inconsistentTasks.push(taskId);
        }
      }

      if (missingInMemory.length > 0 || inconsistentTasks.length > 0) {
        this.logger?.warn(
          `Task consistency issues found: ${missingInMemory.length} missing in memory, ${inconsistentTasks.length} inconsistent`
        );

        // Re-sync to resolve inconsistencies
        await this.syncTaskState();
      }
    } catch (error) {
      this.logger?.error(`Failed to check task consistency: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  startConsistencyChecks() {
    // Check consistency every 30 seconds
    this.consistencyInterval = setInterval(async () => {
      await this.ensureTaskConsistency();
    }, 30000);
  }

  stopConsistencyChecks() {
    if (this.consistencyInterval) {
      clearInterval(this.consistencyInterval);
      this.consistencyInterval = null;
    }
  }

  async cleanup() {
    this.stopAutoProcessing();
    this.stopConsistencyChecks();
  }

  // New methods for 10-second agent polling and Project Manager coordination

  async agentPollQueue(agentName) {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();

    try {
      // Get tasks specifically assigned to this agent that are ready to work
      const result = await session.run(
        `
        MATCH (t:Task)
        WHERE t.assignedTo = $agentName
          AND t.status IN ['queued', 'assigned']
        RETURN t.id as taskId,
               t.title as title,
               t.description as description,
               t.priority as priority,
               t.status as status,
               t.assignedAt as assignedAt,
               t.projectId as projectId
        ORDER BY t.priority DESC, t.assignedAt ASC
        LIMIT 1
      `,
        { agentName }
      );

      if (result.records.length > 0) {
        const task = {
          id: result.records[0].get('taskId'),
          title: result.records[0].get('title'),
          description: result.records[0].get('description'),
          priority: result.records[0].get('priority'),
          status: result.records[0].get('status'),
          assignedAt: result.records[0].get('assignedAt'),
          projectId: result.records[0].get('projectId'),
          assignedTo: agentName,
        };

        await this.executeTaskForAgent(agentName, task);
      }
    } catch (error) {
      this.logger?.error(
        `Error in agent polling for ${agentName}: ${error.message}`
      );
    } finally {
      await session.close();
    }
  }

  async executeTaskForAgent(agentName, task) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      this.logger?.error(`Agent ${agentName} not found`);
      return;
    }

    // Check if agent can accept the task
    if (!this.canAcceptTask(agent)) {
      this.logger?.info(`Agent ${agentName} is busy, skipping task ${task.id}`);
      return;
    }

    const session = this.neo4jDriver.session();

    try {
      // Mark task as in progress
      await session.run(
        `
        MATCH (t:Task {id: $taskId})
        SET t.status = 'in_progress',
            t.startedAt = $timestamp
      `,
        {
          taskId: task.id,
          timestamp: new Date().toISOString(),
        }
      );

      this.logger?.info(
        `Agent ${agentName} starting task: ${task.id} - ${task.title}`
      );

      // Execute the task
      const activeTasks = this.activeTasksByAgent.get(agentName);
      activeTasks.push({ ...task, status: 'in_progress' });

      try {
        const result = await agent.think(task.description || task.title, {
          taskId: task.id,
          taskTitle: task.title,
          taskPriority: task.priority || 'medium',
          projectId: task.projectId,
        });

        // Mark task as completed
        await session.run(
          `
          MATCH (t:Task {id: $taskId})
          SET t.status = 'completed',
              t.completedAt = $timestamp,
              t.result = $result
        `,
          {
            taskId: task.id,
            timestamp: new Date().toISOString(),
            result: JSON.stringify(result),
          }
        );

        // Remove from active tasks
        const index = activeTasks.findIndex(t => t.id === task.id);
        if (index > -1) activeTasks.splice(index, 1);

        this.logger?.info(`Agent ${agentName} completed task: ${task.id}`);

        // Trigger next step in workflow if needed
        await this.triggerWorkflowNextStep(task, result);
      } catch (error) {
        // Mark task as failed
        await session.run(
          `
          MATCH (t:Task {id: $taskId})
          SET t.status = 'failed',
              t.failedAt = $timestamp,
              t.error = $error
        `,
          {
            taskId: task.id,
            timestamp: new Date().toISOString(),
            error: error.message,
          }
        );

        // Remove from active tasks
        const index = activeTasks.findIndex(t => t.id === task.id);
        if (index > -1) activeTasks.splice(index, 1);

        this.logger?.error(
          `Agent ${agentName} failed task ${task.id}: ${error.message}`
        );
      }
    } catch (error) {
      this.logger?.error(
        `Failed to execute task ${task.id} for agent ${agentName}: ${error.message}`
      );
    } finally {
      await session.close();
    }
  }

  async triggerWorkflowNextStep(completedTask, result) {
    if (!completedTask.projectId) return;

    const session = this.neo4jDriver.session();

    try {
      // Check if this task is part of a workflow
      const workflowResult = await session.run(
        `
        MATCH (t:Task {id: $taskId})-[:PART_OF]->(p:Project)
        OPTIONAL MATCH (t)-[:NEXT_STEP]->(nextTask:Task)
        RETURN p.workflowSteps as workflowSteps, nextTask.id as nextTaskId
      `,
        { taskId: completedTask.id }
      );

      if (
        workflowResult.records.length > 0 &&
        workflowResult.records[0].get('nextTaskId')
      ) {
        const nextTaskId = workflowResult.records[0].get('nextTaskId');

        // Mark next task as ready
        await session.run(
          `
          MATCH (t:Task {id: $taskId})
          SET t.status = 'queued',
              t.readyAt = $timestamp
        `,
          {
            taskId: nextTaskId,
            timestamp: new Date().toISOString(),
          }
        );

        this.logger?.info(`Triggered next workflow step: ${nextTaskId}`);
      }
    } catch (error) {
      this.logger?.error(
        `Failed to trigger workflow next step: ${error.message}`
      );
    } finally {
      await session.close();
    }
  }

  startProjectManagerCoordination() {
    // Project Manager checks for unmanaged tasks every 15 seconds
    this.projectManagerInterval = setInterval(async () => {
      await this.projectManagerCoordination();
    }, 15000);
  }

  stopProjectManagerCoordination() {
    if (this.projectManagerInterval) {
      clearInterval(this.projectManagerInterval);
      this.projectManagerInterval = null;
    }
  }

  async projectManagerCoordination() {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();

    try {
      // Find tasks that need project management attention
      const result = await session.run(`
        MATCH (t:Task)
        WHERE t.status = 'pending'
          AND (t.projectId IS NULL OR t.assignedTo IS NULL)
        RETURN t.id as taskId,
               t.title as title,
               t.description as description,
               t.priority as priority,
               t.createdAt as createdAt
        ORDER BY t.priority DESC, t.createdAt ASC
        LIMIT 5
      `);

      for (const record of result.records) {
        const task = {
          id: record.get('taskId'),
          title: record.get('title'),
          description: record.get('description'),
          priority: record.get('priority'),
          createdAt: record.get('createdAt'),
        };

        await this.projectManagerAnalyzeAndAssign(task);
      }
    } catch (error) {
      this.logger?.error(
        `Error in project manager coordination: ${error.message}`
      );
    } finally {
      await session.close();
    }
  }

  async projectManagerAnalyzeAndAssign(task) {
    try {
      // Get project manager agent (if it exists)
      const projectManager = this.agents.get('project-manager');
      if (projectManager) {
        // Use project manager to analyze task
        const analysis = projectManager.analyzeTask(task);

        await this.assignTaskToProject(task, analysis);
      } else {
        // Fallback to basic routing
        await this.routeTask(task);
      }
    } catch (error) {
      this.logger?.error(
        `Failed to analyze and assign task ${task.id}: ${error.message}`
      );
    }
  }

  async assignTaskToProject(task, analysis) {
    const session = this.neo4jDriver.session();

    try {
      // Create or find project
      const projectId = `project_${analysis.projectType}_${Date.now()}`;

      await session.run(
        `
        MERGE (p:Project {type: $projectType})
        ON CREATE SET p.id = $projectId,
                      p.name = $projectName,
                      p.createdAt = $timestamp,
                      p.workflowSteps = $workflowSteps
        WITH p
        MATCH (t:Task {id: $taskId})
        SET t.projectId = p.id,
            t.assignedTo = $primaryAgent,
            t.status = 'queued',
            t.estimatedEffort = $effort,
            t.workflowPosition = 0,
            t.assignedAt = $timestamp
        CREATE (t)-[:PART_OF]->(p)
      `,
        {
          projectType: analysis.projectType,
          projectId: projectId,
          projectName: `${
            analysis.projectType.charAt(0).toUpperCase() +
            analysis.projectType.slice(1)
          } Project`,
          workflowSteps: JSON.stringify(analysis.workflowSteps),
          taskId: task.id,
          primaryAgent: analysis.primaryAgent,
          effort: analysis.estimatedEffort,
          timestamp: new Date().toISOString(),
        }
      );

      this.logger?.info(
        `Project Manager assigned task ${task.id} to ${analysis.primaryAgent} in ${analysis.projectType} project`
      );
    } catch (error) {
      this.logger?.error(`Failed to assign task to project: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async storeTaskInNeo4j(task) {
    if (!this.neo4jDriver) {
      this.logger?.warn('Neo4j driver not available for task storage');
      return;
    }

    const session = this.neo4jDriver.session();

    try {
      await session.run(
        `
        MERGE (t:Task {id: $taskId})
        SET t.title = $title,
            t.description = $description,
            t.status = $status,
            t.assignedTo = $assignedTo,
            t.priority = $priority,
            t.assignedAt = $assignedAt,
            t.completedAt = $completedAt,
            t.failedAt = $failedAt,
            t.result = $result,
            t.error = $error,
            t.blockingReason = $blockingReason,
            t.nextAction = $nextAction,
            t.debugMode = $debugMode,
            t.updatedAt = $updatedAt
        `,
        {
          taskId: task.id,
          title: task.title || '',
          description: task.description || '',
          status: task.status,
          assignedTo: task.assignedTo || null,
          priority: task.priority || 'medium',
          assignedAt: task.assignedAt || null,
          completedAt: task.completedAt || null,
          failedAt: task.failedAt || null,
          result: task.result ? JSON.stringify(task.result) : null,
          error: task.error || null,
          blockingReason: task.blockingReason || null,
          nextAction: task.nextAction || null,
          debugMode: !!task.debugMode,
          updatedAt: new Date().toISOString(),
        }
      );

      this.logger?.debug(
        `Stored task ${task.id} in Neo4j with status: ${task.status}`
      );
    } catch (error) {
      this.logger?.error(`Failed to store task in Neo4j: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async cleanup() {
    // Clean up intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.projectManagerInterval) {
      clearInterval(this.projectManagerInterval);
      this.projectManagerInterval = null;
    }

    // Close Redis connection
    if (this.redis) {
      try {
        await this.redis.quit();
        this.logger?.info('📡 TaskRouter Redis connection closed');
      } catch (error) {
        this.logger?.error(`Error closing Redis connection: ${error.message}`);
      }
    }
  }
}
