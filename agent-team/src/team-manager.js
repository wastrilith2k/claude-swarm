export class TeamManager {
  constructor(agents, taskRouter, coordination, logger) {
    this.agents = agents;
    this.taskRouter = taskRouter;
    this.coordination = coordination;
    this.logger = logger;
    this.performanceMetrics = new Map();
    this.teamMetrics = {
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      averageTaskTime: 0,
      teamEfficiencyScore: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Initialize performance tracking for each agent
    for (const [agentName] of this.agents) {
      this.performanceMetrics.set(agentName, {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageCompletionTime: 0,
        lastActiveAt: null,
        totalProcessingTime: 0,
        specialtyMatchScore: 0,
      });
    }

    this.startPerformanceTracking();
  }

  startPerformanceTracking() {
    // Update metrics every 5 minutes
    setInterval(() => {
      this.updateTeamMetrics();
    }, 300000);
  }

  getTeamStatus() {
    const agentStatuses = [];

    for (const [agentName, agent] of this.agents) {
      const performance = this.performanceMetrics.get(agentName);
      const activeTasks =
        this.taskRouter.activeTasksByAgent.get(agentName) || [];

      agentStatuses.push({
        name: agent.name,
        specialization: agent.specialization,
        status: activeTasks.length > 0 ? 'busy' : 'available',
        currentTasks: activeTasks.length,
        maxTasks: agent.maxConcurrentTasks,
        utilization: (activeTasks.length / agent.maxConcurrentTasks) * 100,
        canDelegate: agent.canDelegate || false,
        priority: agent.priority || 'medium',
        performance: {
          completedTasks: performance.tasksCompleted,
          failedTasks: performance.tasksFailed,
          successRate:
            performance.tasksCompleted > 0
              ? (performance.tasksCompleted /
                  (performance.tasksCompleted + performance.tasksFailed)) *
                100
              : 0,
          averageTaskTime: Math.round(
            performance.averageCompletionTime / 1000 / 60
          ), // in minutes
          lastActiveAt: performance.lastActiveAt,
          specialtyMatch: performance.specialtyMatchScore,
        },
      });
    }

    const queueStatus = this.taskRouter.getQueueStatus();
    const coordinationStatus = this.coordination.getCoordinationStatus();

    return {
      agents: agentStatuses,
      team: {
        totalAgents: this.agents.size,
        availableAgents: agentStatuses.filter(a => a.status === 'available')
          .length,
        busyAgents: agentStatuses.filter(a => a.status === 'busy').length,
        totalCapacity: agentStatuses.reduce((sum, a) => sum + a.maxTasks, 0),
        currentLoad: agentStatuses.reduce((sum, a) => sum + a.currentTasks, 0),
        overallUtilization:
          agentStatuses.length > 0
            ? agentStatuses.reduce((sum, a) => sum + a.utilization, 0) /
              agentStatuses.length
            : 0,
        efficiency: this.teamMetrics.teamEfficiencyScore,
      },
      queue: queueStatus,
      coordination: coordinationStatus,
      metrics: this.teamMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  async assignTask(taskDetails, options = {}) {
    const {
      preferredAgent = null,
      priority = 'medium',
      coordination = false,
      coordinationStrategy = 'architect-led',
    } = options;

    try {
      if (coordination) {
        // Use coordination for complex tasks
        this.logger.info(`Coordinating task: ${taskDetails.title}`);
        return await this.coordination.coordinateTask(
          taskDetails,
          coordinationStrategy
        );
      } else if (preferredAgent) {
        // Direct assignment to specific agent
        const agent = this.agents.get(preferredAgent);
        if (!agent) {
          throw new Error(`Agent ${preferredAgent} not found`);
        }

        if (!this.taskRouter.canAcceptTask(agent)) {
          return await this.taskRouter.routeTask(taskDetails);
        }

        return await this.taskRouter.assignTask(agent, taskDetails);
      } else {
        // Automatic routing
        return await this.taskRouter.routeTask(taskDetails);
      }
    } catch (error) {
      this.logger.error(`Task assignment failed: ${error.message}`);
      this.teamMetrics.totalTasksFailed++;
      throw error;
    }
  }

  async reassignTask(
    taskId,
    fromAgent,
    toAgent,
    reason = 'manual_reassignment'
  ) {
    try {
      const fromAgentObj = this.agents.get(fromAgent);
      const toAgentObj = this.agents.get(toAgent);

      if (!fromAgentObj || !toAgentObj) {
        throw new Error('Invalid agent names for reassignment');
      }

      if (!this.taskRouter.canAcceptTask(toAgentObj)) {
        throw new Error(`Target agent ${toAgent} is at capacity`);
      }

      // Find and remove task from source agent
      const activeTasks = this.taskRouter.activeTasksByAgent.get(fromAgent);
      const taskIndex = activeTasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        throw new Error(
          `Task ${taskId} not found in ${fromAgent}'s active tasks`
        );
      }

      const task = activeTasks.splice(taskIndex, 1)[0];

      // Reassign to new agent
      task.reassignedFrom = fromAgent;
      task.reassignedTo = toAgent;
      task.reassignmentReason = reason;
      task.reassignedAt = new Date().toISOString();

      const result = await this.taskRouter.assignTask(toAgentObj, task);

      this.logger.info(
        `Task ${taskId} reassigned from ${fromAgent} to ${toAgent}: ${reason}`
      );

      return {
        success: true,
        taskId,
        fromAgent,
        toAgent,
        reason,
        newAssignment: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Task reassignment failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async balanceWorkload() {
    const agentLoads = [];

    // Calculate current load for each agent
    for (const [agentName, agent] of this.agents) {
      const activeTasks =
        this.taskRouter.activeTasksByAgent.get(agentName) || [];
      const utilization = activeTasks.length / agent.maxConcurrentTasks;

      agentLoads.push({
        name: agentName,
        agent: agent,
        activeTasks: activeTasks,
        utilization: utilization,
        capacity: agent.maxConcurrentTasks,
      });
    }

    // Sort by utilization (highest first)
    agentLoads.sort((a, b) => b.utilization - a.utilization);

    const overloadedAgents = agentLoads.filter(a => a.utilization > 0.8);
    const underloadedAgents = agentLoads.filter(a => a.utilization < 0.5);

    const rebalancingActions = [];

    // Attempt to rebalance
    for (const overloaded of overloadedAgents) {
      for (const underloaded of underloadedAgents) {
        if (overloaded.utilization <= 0.8) break; // No longer overloaded

        // Find compatible tasks that can be reassigned
        const reassignableTask = this.findReassignableTask(
          overloaded.activeTasks,
          underloaded.agent
        );

        if (reassignableTask) {
          const reassignResult = await this.reassignTask(
            reassignableTask.id,
            overloaded.name,
            underloaded.name,
            'workload_balancing'
          );

          if (reassignResult.success) {
            rebalancingActions.push(reassignResult);

            // Update utilization calculations
            overloaded.activeTasks = overloaded.activeTasks.filter(
              t => t.id !== reassignableTask.id
            );
            overloaded.utilization =
              overloaded.activeTasks.length / overloaded.capacity;
            underloaded.utilization =
              (underloaded.activeTasks.length + 1) / underloaded.capacity;
          }
        }
      }
    }

    return {
      rebalanced: rebalancingActions.length > 0,
      actions: rebalancingActions,
      beforeBalance: {
        overloadedAgents: overloadedAgents.length,
        underloadedAgents: underloadedAgents.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  findReassignableTask(tasks, targetAgent) {
    // Look for tasks that match the target agent's specialization
    const targetSpecialty = targetAgent.specialization.toLowerCase();

    return tasks.find(task => {
      const taskText = `${task.title || ''} ${
        task.description || ''
      }`.toLowerCase();
      return targetSpecialty.split(' ').some(word => taskText.includes(word));
    });
  }

  updateTaskPerformance(agentName, taskResult) {
    const performance = this.performanceMetrics.get(agentName);
    if (!performance) return;

    if (taskResult.status === 'completed') {
      performance.tasksCompleted++;
      this.teamMetrics.totalTasksCompleted++;

      if (taskResult.duration) {
        const newTotal =
          performance.averageCompletionTime * (performance.tasksCompleted - 1) +
          taskResult.duration;
        performance.averageCompletionTime =
          newTotal / performance.tasksCompleted;
        performance.totalProcessingTime += taskResult.duration;
      }
    } else if (taskResult.status === 'failed') {
      performance.tasksFailed++;
      this.teamMetrics.totalTasksFailed++;
    }

    performance.lastActiveAt = new Date().toISOString();

    // Update specialty match score based on task relevance
    if (taskResult.specialtyMatch) {
      performance.specialtyMatchScore =
        (performance.specialtyMatchScore + taskResult.specialtyMatch) / 2;
    }
  }

  updateTeamMetrics() {
    const totalTasks =
      this.teamMetrics.totalTasksCompleted + this.teamMetrics.totalTasksFailed;

    if (totalTasks > 0) {
      const successRate = this.teamMetrics.totalTasksCompleted / totalTasks;
      const avgUtilization =
        Array.from(this.agents.values()).reduce((sum, agent) => {
          const activeTasks =
            this.taskRouter.activeTasksByAgent.get(agent.name) || [];
          return sum + activeTasks.length / agent.maxConcurrentTasks;
        }, 0) / this.agents.size;

      // Calculate efficiency score (combination of success rate and utilization)
      this.teamMetrics.teamEfficiencyScore = Math.round(
        (successRate * 0.6 + avgUtilization * 0.4) * 100
      );
    }

    // Update average task time
    const completionTimes = Array.from(this.performanceMetrics.values())
      .filter(p => p.averageCompletionTime > 0)
      .map(p => p.averageCompletionTime);

    if (completionTimes.length > 0) {
      this.teamMetrics.averageTaskTime = Math.round(
        completionTimes.reduce((sum, time) => sum + time, 0) /
          completionTimes.length /
          1000 /
          60
      ); // in minutes
    }

    this.teamMetrics.lastUpdated = new Date().toISOString();
  }

  getAgentRecommendation(taskDescription) {
    const scores = new Map();

    // Score each agent based on task relevance
    for (const [agentName, agent] of this.agents) {
      const performance = this.performanceMetrics.get(agentName);
      const activeTasks =
        this.taskRouter.activeTasksByAgent.get(agentName) || [];

      let score = 0;

      // Special handling for Project Manager
      if (agentName === 'project-manager') {
        // Project Manager gets high score for coordination and planning tasks
        const coordinationKeywords = [
          'plan',
          'organize',
          'coordinate',
          'manage',
          'strategy',
          'workflow',
        ];
        const hasCoordinationNeed = coordinationKeywords.some(keyword =>
          taskDescription.toLowerCase().includes(keyword)
        );

        if (hasCoordinationNeed) {
          score = 95; // Very high score for coordination tasks
        } else {
          score = 20; // Lower score for technical implementation tasks
        }
      } else {
        // Regular scoring for other agents

        // Specialization match (40% of score)
        const specialtyWords = agent.specialization.toLowerCase().split(' ');
        const taskWords = taskDescription.toLowerCase();
        const matchCount = specialtyWords.filter(word =>
          taskWords.includes(word)
        ).length;
        score += (matchCount / specialtyWords.length) * 40;

        // Availability (30% of score)
        const availability = 1 - activeTasks.length / agent.maxConcurrentTasks;
        score += availability * 30;

        // Performance history (20% of score)
        const successRate =
          performance.tasksCompleted > 0
            ? performance.tasksCompleted /
              (performance.tasksCompleted + performance.tasksFailed)
            : 0.5;
        score += successRate * 20;

        // Priority boost (10% of score)
        const priorityBoost =
          agent.priority === 'high' ? 10 : agent.priority === 'low' ? 0 : 5;
        score += priorityBoost;
      }

      scores.set(agentName, {
        agent: agentName,
        score: Math.round(score),
        specialization: agent.specialization,
        availability: Math.round(
          (1 - activeTasks.length / agent.maxConcurrentTasks) * 100
        ),
        successRate: Math.round(
          (performance.tasksCompleted > 0
            ? performance.tasksCompleted /
              (performance.tasksCompleted + performance.tasksFailed)
            : 0.5) * 100
        ),
        reasoning: this.generateRecommendationReasoning(
          agent,
          taskDescription,
          activeTasks.length / agent.maxConcurrentTasks
        ),
      });
    }

    // Sort by score
    const sortedRecommendations = Array.from(scores.values()).sort(
      (a, b) => b.score - a.score
    );

    return {
      recommendations: sortedRecommendations,
      topChoice: sortedRecommendations[0],
      alternatives: sortedRecommendations.slice(1, 3),
      timestamp: new Date().toISOString(),
    };
  }

  generateRecommendationReasoning(agent, taskDescription, utilization) {
    const reasons = [];

    if (agent.name === 'project-manager') {
      const coordinationKeywords = [
        'plan',
        'organize',
        'coordinate',
        'manage',
        'strategy',
        'workflow',
      ];
      const hasCoordinationNeed = coordinationKeywords.some(keyword =>
        taskDescription.toLowerCase().includes(keyword)
      );

      if (hasCoordinationNeed) {
        reasons.push('Task requires project coordination and planning');
      } else {
        reasons.push(
          'Task appears to be technical implementation, may need specialist'
        );
      }
    } else {
      const specialtyWords = agent.specialization.toLowerCase().split(' ');
      const taskWords = taskDescription.toLowerCase();
      const matchCount = specialtyWords.filter(word =>
        taskWords.includes(word)
      ).length;
      const specialtyMatch = matchCount / specialtyWords.length;

      if (specialtyMatch > 0.5) {
        reasons.push(`High specialty match for ${agent.specialization}`);
      }
    }

    const availability = 1 - utilization;
    if (availability > 0.7) {
      reasons.push('High availability');
    } else if (availability < 0.3) {
      reasons.push('Limited availability - may cause delays');
    }

    const performance = this.performanceMetrics.get(agent.name);
    const successRate =
      performance.tasksCompleted > 0
        ? performance.tasksCompleted /
          (performance.tasksCompleted + performance.tasksFailed)
        : 0.5;

    if (successRate > 0.8) {
      reasons.push('Excellent track record');
    } else if (successRate < 0.6) {
      reasons.push('Mixed performance history');
    }

    if (agent.canDelegate) {
      reasons.push('Can delegate to specialists if needed');
    }

    return reasons.join('; ');
  }

  getTeamHealthReport() {
    const agents = Array.from(this.agents.values());
    const performances = Array.from(this.performanceMetrics.values());

    const healthIndicators = {
      overallHealth: 'good', // good, warning, critical
      issues: [],
      recommendations: [],
      strengths: [],
    };

    // Check for overloaded agents
    const overloadedCount = agents.filter(agent => {
      const activeTasks =
        this.taskRouter.activeTasksByAgent.get(agent.name) || [];
      return activeTasks.length / agent.maxConcurrentTasks > 0.9;
    }).length;

    if (overloadedCount > agents.length * 0.5) {
      healthIndicators.overallHealth = 'critical';
      healthIndicators.issues.push('Majority of agents are overloaded');
      healthIndicators.recommendations.push(
        'Consider scaling the team or redistributing workload'
      );
    } else if (overloadedCount > 0) {
      healthIndicators.overallHealth = 'warning';
      healthIndicators.issues.push(`${overloadedCount} agents are overloaded`);
      healthIndicators.recommendations.push(
        'Balance workload across available agents'
      );
    }

    // Check success rates
    const avgSuccessRate =
      performances.reduce((sum, p) => {
        const total = p.tasksCompleted + p.tasksFailed;
        return sum + (total > 0 ? p.tasksCompleted / total : 1);
      }, 0) / performances.length;

    if (avgSuccessRate < 0.7) {
      healthIndicators.overallHealth = 'warning';
      healthIndicators.issues.push('Low team success rate');
      healthIndicators.recommendations.push(
        'Review task complexity and agent capabilities'
      );
    } else if (avgSuccessRate > 0.9) {
      healthIndicators.strengths.push('Excellent team success rate');
    }

    // Check queue length
    const queueLength = this.taskRouter.taskQueue.length;
    if (queueLength > 10) {
      healthIndicators.issues.push('Large task backlog');
      healthIndicators.recommendations.push(
        'Consider adding more agents or optimizing task processing'
      );
    }

    return {
      ...healthIndicators,
      metrics: {
        avgSuccessRate: Math.round(avgSuccessRate * 100),
        overloadedAgents: overloadedCount,
        queueLength: queueLength,
        teamEfficiency: this.teamMetrics.teamEfficiencyScore,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
