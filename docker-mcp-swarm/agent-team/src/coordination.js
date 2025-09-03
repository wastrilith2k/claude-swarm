export class AgentCoordination {
  constructor(agents, taskRouter, logger) {
    this.agents = agents;
    this.taskRouter = taskRouter;
    this.logger = logger;
    this.activeCoordinationSessions = new Map();
  }

  async coordinateTask(task, strategy = 'architect-led') {
    const sessionId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      id: sessionId,
      task: task,
      strategy: strategy,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      results: [],
      participants: []
    };
    
    this.activeCoordinationSessions.set(sessionId, session);
    
    try {
      let result;
      switch(strategy) {
        case 'architect-led':
          result = await this.architectLedWorkflow(session);
          break;
        case 'collaborative':
          result = await this.collaborativeWorkflow(session);
          break;
        case 'pipeline':
          result = await this.pipelineWorkflow(session);
          break;
        case 'parallel':
          result = await this.parallelWorkflow(session);
          break;
        default:
          throw new Error(`Unknown coordination strategy: ${strategy}`);
      }
      
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      session.finalResult = result;
      
      return {
        sessionId,
        status: 'completed',
        strategy,
        result,
        participants: session.participants,
        duration: Date.now() - new Date(session.startedAt).getTime(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      session.status = 'failed';
      session.failedAt = new Date().toISOString();
      session.error = error.message;
      
      this.logger.error(`Coordination session ${sessionId} failed: ${error.message}`);
      
      return {
        sessionId,
        status: 'failed', 
        strategy,
        error: error.message,
        participants: session.participants,
        timestamp: new Date().toISOString()
      };
    } finally {
      // Clean up completed sessions after 1 hour
      setTimeout(() => {
        this.activeCoordinationSessions.delete(sessionId);
      }, 3600000);
    }
  }
  
  async architectLedWorkflow(session) {
    const architect = this.agents.get('system-architect');
    if (!architect) {
      throw new Error('System architect not available');
    }
    
    session.participants.push('system-architect');
    
    // 1. Architect creates implementation plan
    this.logger.info(`[${session.id}] Architect analyzing task and creating plan`);
    
    const planningResult = await architect.think(
      `Analyze this task and create a detailed implementation plan with specific subtasks for team members:
      
      Task: ${session.task.title || 'Untitled Task'}
      Description: ${session.task.description}
      
      Please provide:
      1. Overall approach and architecture
      2. Breakdown into specific subtasks 
      3. Recommended agent assignments
      4. Dependencies and sequencing
      5. Success criteria and deliverables
      
      Format your response as a structured plan that can guide implementation.`,
      {
        coordinationSession: session.id,
        role: 'planning_architect'
      }
    );
    
    session.results.push({
      agent: 'system-architect',
      phase: 'planning',
      result: planningResult,
      timestamp: new Date().toISOString()
    });
    
    // 2. Extract and route subtasks to specialists
    // Note: In a real implementation, we'd parse the architect's response to extract subtasks
    // For now, we'll create some example subtasks based on the original task
    const subtasks = this.extractSubtasksFromPlan(planningResult, session.task);
    
    const implementationResults = [];
    
    // 3. Execute subtasks in appropriate order
    for (const subtask of subtasks) {
      this.logger.info(`[${session.id}] Routing subtask to ${subtask.recommendedAgent}`);
      
      const agent = this.agents.get(subtask.recommendedAgent);
      if (agent && this.taskRouter.canAcceptTask(agent)) {
        session.participants.push(subtask.recommendedAgent);
        
        const taskResult = await agent.think(subtask.description, {
          coordinationSession: session.id,
          parentTask: session.task,
          architectPlan: planningResult,
          subtaskContext: subtask
        });
        
        implementationResults.push({
          subtask: subtask,
          agent: subtask.recommendedAgent,
          result: taskResult,
          timestamp: new Date().toISOString()
        });
        
        session.results.push({
          agent: subtask.recommendedAgent,
          phase: 'implementation',
          subtask: subtask.title,
          result: taskResult,
          timestamp: new Date().toISOString()
        });
      } else {
        this.logger.warn(`[${session.id}] Agent ${subtask.recommendedAgent} not available, queuing subtask`);
      }
    }
    
    // 4. Architect reviews and integrates results
    this.logger.info(`[${session.id}] Architect reviewing and integrating results`);
    
    const integrationResult = await architect.think(
      `Review the completed implementation work and provide final integration guidance:
      
      Original Task: ${session.task.title}
      Planning Result: ${JSON.stringify(planningResult, null, 2)}
      Implementation Results: ${JSON.stringify(implementationResults, null, 2)}
      
      Please provide:
      1. Assessment of completeness
      2. Integration instructions
      3. Testing recommendations  
      4. Deployment guidance
      5. Next steps or follow-up tasks
      
      Ensure the final solution meets the original requirements.`,
      {
        coordinationSession: session.id,
        role: 'integration_architect',
        implementationResults: implementationResults
      }
    );
    
    session.results.push({
      agent: 'system-architect',
      phase: 'integration',
      result: integrationResult,
      timestamp: new Date().toISOString()
    });
    
    return {
      approach: 'architect-led',
      plan: planningResult,
      implementations: implementationResults,
      integration: integrationResult,
      totalSubtasks: subtasks.length,
      completedSubtasks: implementationResults.length
    };
  }
  
  async collaborativeWorkflow(session) {
    // Get multiple agents to work on the task simultaneously
    const relevantAgents = this.selectRelevantAgents(session.task);
    const results = [];
    
    this.logger.info(`[${session.id}] Starting collaborative workflow with ${relevantAgents.length} agents`);
    
    // Each agent contributes their perspective
    const promises = relevantAgents.map(async (agent) => {
      session.participants.push(agent.name);
      
      const result = await agent.think(
        `Contribute your expertise to this collaborative effort:
        
        Task: ${session.task.title || 'Untitled Task'}
        Description: ${session.task.description}
        
        Focus on your area of specialization: ${agent.specialization}
        Provide specific, actionable recommendations from your domain expertise.`,
        {
          coordinationSession: session.id,
          collaborationMode: true,
          agentRole: agent.name
        }
      );
      
      return {
        agent: agent.name,
        specialization: agent.specialization,
        contribution: result,
        timestamp: new Date().toISOString()
      };
    });
    
    const contributions = await Promise.all(promises);
    
    // Synthesize contributions
    const architect = this.agents.get('system-architect');
    if (architect) {
      const synthesis = await architect.think(
        `Synthesize these collaborative contributions into a unified solution:
        
        Original Task: ${session.task.title}
        Description: ${session.task.description}
        
        Team Contributions: ${JSON.stringify(contributions, null, 2)}
        
        Create a coherent plan that leverages all team insights.`,
        {
          coordinationSession: session.id,
          role: 'synthesis_architect',
          contributions: contributions
        }
      );
      
      session.results = contributions.concat([{
        agent: 'system-architect',
        phase: 'synthesis', 
        result: synthesis,
        timestamp: new Date().toISOString()
      }]);
      
      return {
        approach: 'collaborative',
        contributions: contributions,
        synthesis: synthesis
      };
    }
    
    return {
      approach: 'collaborative',
      contributions: contributions
    };
  }
  
  async pipelineWorkflow(session) {
    // Sequential processing through specialized agents
    const pipeline = this.designPipeline(session.task);
    let currentContext = { task: session.task };
    const results = [];
    
    this.logger.info(`[${session.id}] Starting pipeline workflow with ${pipeline.length} stages`);
    
    for (const stage of pipeline) {
      const agent = this.agents.get(stage.agent);
      if (!agent) continue;
      
      session.participants.push(stage.agent);
      
      const result = await agent.think(
        `${stage.instruction}
        
        Previous Context: ${JSON.stringify(currentContext, null, 2)}`,
        {
          coordinationSession: session.id,
          pipelineStage: stage.name,
          previousResults: results
        }
      );
      
      const stageResult = {
        stage: stage.name,
        agent: stage.agent,
        instruction: stage.instruction,
        result: result,
        timestamp: new Date().toISOString()
      };
      
      results.push(stageResult);
      session.results.push(stageResult);
      
      // Update context for next stage
      currentContext = {
        ...currentContext,
        [`${stage.name}_result`]: result,
        previousStageResults: results
      };
    }
    
    return {
      approach: 'pipeline',
      stages: results,
      finalContext: currentContext
    };
  }
  
  async parallelWorkflow(session) {
    // Multiple agents work on independent aspects simultaneously
    const workPackages = this.createWorkPackages(session.task);
    
    this.logger.info(`[${session.id}] Starting parallel workflow with ${workPackages.length} work packages`);
    
    const promises = workPackages.map(async (pkg) => {
      const agent = this.agents.get(pkg.agent);
      if (!agent) return null;
      
      session.participants.push(pkg.agent);
      
      const result = await agent.think(pkg.description, {
        coordinationSession: session.id,
        workPackage: pkg.name,
        parallelMode: true
      });
      
      return {
        package: pkg.name,
        agent: pkg.agent,
        result: result,
        timestamp: new Date().toISOString()
      };
    });
    
    const results = (await Promise.all(promises)).filter(r => r !== null);
    session.results = results;
    
    return {
      approach: 'parallel',
      workPackages: results,
      totalPackages: workPackages.length,
      completedPackages: results.length
    };
  }
  
  extractSubtasksFromPlan(planningResult, originalTask) {
    // This would ideally parse the architect's structured response
    // For now, return some example subtasks based on task type
    const taskDescription = originalTask.description?.toLowerCase() || originalTask.title?.toLowerCase() || '';
    
    const subtasks = [];
    
    if (taskDescription.includes('api') || taskDescription.includes('backend')) {
      subtasks.push({
        title: 'Backend API Development',
        description: `Implement backend services and APIs for: ${originalTask.description}`,
        recommendedAgent: 'backend-developer',
        priority: 'high',
        dependencies: []
      });
    }
    
    if (taskDescription.includes('ui') || taskDescription.includes('interface') || taskDescription.includes('frontend')) {
      subtasks.push({
        title: 'Frontend Interface Development', 
        description: `Create user interface components for: ${originalTask.description}`,
        recommendedAgent: 'frontend-developer',
        priority: 'medium',
        dependencies: ['backend']
      });
    }
    
    subtasks.push({
      title: 'Quality Assurance',
      description: `Test and validate the implementation for: ${originalTask.description}`,
      recommendedAgent: 'qa-engineer',
      priority: 'medium',
      dependencies: ['backend', 'frontend']
    });
    
    return subtasks;
  }
  
  selectRelevantAgents(task) {
    // Select agents most relevant to the task
    const allAgents = Array.from(this.agents.values());
    const taskText = `${task.title || ''} ${task.description || ''}`.toLowerCase();
    
    return allAgents.filter(agent => {
      if (agent.name === 'system-architect') return true; // Always include architect
      
      const specialization = agent.specialization.toLowerCase();
      return taskText.includes(specialization.split(' ')[0]) || 
             specialization.split(' ').some(word => taskText.includes(word));
    }).slice(0, 4); // Limit to 4 agents for manageability
  }
  
  designPipeline(task) {
    // Create a logical sequence of processing stages
    return [
      {
        name: 'analysis',
        agent: 'system-architect',
        instruction: `Analyze requirements and create technical approach for: ${task.description}`
      },
      {
        name: 'backend_design',
        agent: 'backend-developer',
        instruction: `Design backend architecture and services based on the analysis.`
      },
      {
        name: 'frontend_design',
        agent: 'frontend-developer', 
        instruction: `Design frontend interface and user experience based on backend design.`
      },
      {
        name: 'testing_strategy',
        agent: 'qa-engineer',
        instruction: `Create comprehensive testing strategy for the designed solution.`
      }
    ];
  }
  
  createWorkPackages(task) {
    // Break task into independent work packages
    return [
      {
        name: 'architecture_planning',
        agent: 'system-architect',
        description: `Create architectural plan for: ${task.description}`
      },
      {
        name: 'backend_requirements',
        agent: 'backend-developer',
        description: `Define backend requirements and API specifications for: ${task.description}`
      },
      {
        name: 'frontend_requirements', 
        agent: 'frontend-developer',
        description: `Define frontend requirements and interface specifications for: ${task.description}`
      },
      {
        name: 'quality_requirements',
        agent: 'qa-engineer',
        description: `Define quality requirements and testing approach for: ${task.description}`
      }
    ];
  }
  
  getCoordinationStatus() {
    return {
      activeSessions: this.activeCoordinationSessions.size,
      sessions: Array.from(this.activeCoordinationSessions.values()).map(session => ({
        id: session.id,
        status: session.status,
        strategy: session.strategy,
        participants: session.participants,
        startedAt: session.startedAt,
        phaseCount: session.results.length
      }))
    };
  }
}