export const projectManagerAgent = {
  name: 'project-manager',
  displayName: 'Project Manager',
  role: 'Project Manager & Task Coordinator',
  specialization:
    'Task assignment, project organization, workflow coordination',
  capabilities: [
    'Task analysis and categorization',
    'Agent assignment based on task requirements',
    'Project creation and organization',
    'Workflow coordination',
    'Sprint planning and task prioritization',
    'Quality assurance coordination',
  ],
  systemPrompt: `You are an AI Project Manager responsible for task coordination and workflow management.

Your primary responsibilities:
1. **Task Analysis**: Analyze incoming tasks to understand requirements, complexity, and scope
2. **Agent Assignment**: Assign tasks to the most appropriate agent based on:
   - Task type (frontend, backend, DevOps, testing, architecture, documentation)
   - Required skills and expertise
   - Current agent workload
   - Task dependencies
3. **Project Organization**: Group related tasks into logical projects
4. **Workflow Coordination**: Ensure tasks flow properly through the development lifecycle:
   - Architecture/Design → Development → Testing → Review → Deployment
5. **Quality Assurance**: Ensure all tasks go through proper review and testing
6. **Blocked Task Management**: Monitor and resolve blocked tasks that need additional information

When analyzing a task, consider:
- **Keywords**: Look for technology-specific terms (React, API, database, deployment, etc.)
- **Complexity**: Estimate effort and break down large tasks if needed
- **Dependencies**: Identify if this task depends on or enables other work
- **Project Context**: Determine if this belongs to an existing project or needs a new one
- **Information Completeness**: Determine if task has sufficient information to proceed

Assignment Rules:
- **System Architecture/Design** → system-architect
- **Frontend UI/UX work** → frontend-developer
- **Backend/API/Database** → backend-developer
- **Infrastructure/Deployment** → devops-engineer
- **Testing/QA** → qa-engineer
- **Code Review/Security** → code-reviewer

Blocking Rules:
- If a task lacks sufficient technical details, requirements, or dependencies, mark it as "Blocked"
- Add clear notes about what information is needed
- Schedule for re-evaluation once information is provided

Debug Mode:
- When DEBUG_MODE is enabled, do not make Claude API calls
- Simply assign tasks to the appropriate agent based on keywords and logic
- Simulate task progression through workflow states

Always provide clear reasoning for your assignments and include:
1. Assigned agent and reasoning
2. Project assignment (existing or new)
3. Estimated effort and priority
4. Next steps in the workflow
5. Any dependencies or blockers
6. Status (In Progress, Blocked, etc.)

Respond in JSON format with your analysis and assignments.`,

  maxConcurrentTasks: 10, // Can handle multiple coordination tasks
  canDelegate: true,

  // Project Manager specific methods
  analyzeTask: function (task) {
    const keywords = (task.title + ' ' + task.description).toLowerCase();

    // Check if task has sufficient information
    if (this.isTaskBlocked(task)) {
      return {
        status: 'Blocked',
        reason: this.getBlockingReason(task),
        primaryAgent: null,
        projectType: 'blocked',
        estimatedEffort: 'unknown',
        workflowSteps: [],
        dependencies: [],
        nextAction: 'Requires additional information before assignment',
      };
    }

    // Determine primary agent based on task content
    let primaryAgent = 'system-architect'; // Default
    let projectType = 'general';

    if (
      keywords.includes('ui') ||
      keywords.includes('frontend') ||
      keywords.includes('react') ||
      keywords.includes('component')
    ) {
      primaryAgent = 'frontend-developer';
      projectType = 'frontend';
    } else if (
      keywords.includes('api') ||
      keywords.includes('backend') ||
      keywords.includes('database') ||
      keywords.includes('server')
    ) {
      primaryAgent = 'backend-developer';
      projectType = 'backend';
    } else if (
      keywords.includes('deploy') ||
      keywords.includes('docker') ||
      keywords.includes('infrastructure') ||
      keywords.includes('devops')
    ) {
      primaryAgent = 'devops-engineer';
      projectType = 'infrastructure';
    } else if (
      keywords.includes('test') ||
      keywords.includes('qa') ||
      keywords.includes('quality') ||
      keywords.includes('bug')
    ) {
      primaryAgent = 'qa-engineer';
      projectType = 'testing';
    } else if (
      keywords.includes('review') ||
      keywords.includes('security') ||
      keywords.includes('audit') ||
      keywords.includes('optimize')
    ) {
      primaryAgent = 'code-reviewer';
      projectType = 'review';
    } else if (
      keywords.includes('design') ||
      keywords.includes('architecture') ||
      keywords.includes('plan') ||
      keywords.includes('system')
    ) {
      primaryAgent = 'system-architect';
      projectType = 'architecture';
    }

    return {
      status: 'Ready',
      primaryAgent,
      projectType,
      estimatedEffort: this.estimateEffort(task),
      workflowSteps: this.determineWorkflow(primaryAgent, task),
      dependencies: this.identifyDependencies(task),
    };
  },

  isTaskBlocked: function (task) {
    const description = (
      task.title +
      ' ' +
      (task.description || '')
    ).toLowerCase();

    // Check for vague or incomplete requirements
    if (description.length < 20) return true;

    // Check for missing technical details for development tasks
    if (
      description.includes('create') ||
      description.includes('build') ||
      description.includes('implement')
    ) {
      // Development tasks need more specific requirements
      const hasSpecifics =
        description.includes('api') ||
        description.includes('component') ||
        description.includes('database') ||
        description.includes('ui') ||
        description.includes('test') ||
        description.includes('deploy');

      if (!hasSpecifics && description.split(' ').length < 10) {
        return true;
      }
    }

    return false;
  },

  getBlockingReason: function (task) {
    const description = (
      task.title +
      ' ' +
      (task.description || '')
    ).toLowerCase();

    if (description.length < 20) {
      return 'Task description is too brief. Please provide more detailed requirements.';
    }

    if (
      description.includes('create') ||
      description.includes('build') ||
      description.includes('implement')
    ) {
      return 'Development task needs more technical specifications (API endpoints, UI mockups, database schema, etc.)';
    }

    return 'Task requires additional clarification or requirements before assignment.';
  },

  processInDebugMode: function (task, targetAgent) {
    // In debug mode, simulate task processing without Claude API calls
    const debugResponse = {
      taskId: task.id,
      agent: targetAgent,
      status: 'In Progress',
      debugMode: true,
      simulatedResponse: `[DEBUG MODE] Task "${task.title}" assigned to ${targetAgent}.
        This is a simulated response - no actual Claude API call was made.

        Simulated actions:
        1. Task analyzed and categorized
        2. Initial implementation plan created
        3. Dependencies identified
        4. Ready for next workflow step

        Next steps would normally involve actual implementation.`,
      timestamp: new Date().toISOString(),
      nextAgent: this.getNextAgentInWorkflow(targetAgent, task),
    };

    return debugResponse;
  },

  getNextAgentInWorkflow: function (currentAgent, task) {
    const workflow = this.determineWorkflow(currentAgent, task);
    const currentIndex = workflow.indexOf(currentAgent);

    if (currentIndex !== -1 && currentIndex < workflow.length - 1) {
      return workflow[currentIndex + 1];
    }

    return null; // End of workflow
  },

  estimateEffort: function (task) {
    const description = (task.title + ' ' + task.description).toLowerCase();
    const wordCount = description.split(' ').length;

    if (wordCount < 20) return 'small';
    if (wordCount < 50) return 'medium';
    return 'large';
  },

  determineWorkflow: function (primaryAgent, task) {
    const baseWorkflow = [primaryAgent];

    // Add QA step for development tasks
    if (
      ['frontend-developer', 'backend-developer', 'devops-engineer'].includes(
        primaryAgent
      )
    ) {
      baseWorkflow.push('qa-engineer');
    }

    // Add review step for all code-related tasks
    if (primaryAgent !== 'code-reviewer') {
      baseWorkflow.push('code-reviewer');
    }

    return baseWorkflow;
  },

  identifyDependencies: function (task) {
    // Simple dependency detection based on keywords
    const dependencies = [];
    const description = (task.title + ' ' + task.description).toLowerCase();

    if (description.includes('api') && description.includes('frontend')) {
      dependencies.push('backend-api-first');
    }

    if (description.includes('deploy') || description.includes('production')) {
      dependencies.push('testing-complete');
    }

    return dependencies;
  },
};
