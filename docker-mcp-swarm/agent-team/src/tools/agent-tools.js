/**
 * Agent Tool Registry - Defines available tools for each agent
 */

export const agentTools = {
  // System Architect Tools
  'system-architect': [
    {
      name: 'create_system_design',
      description: 'Create a system architecture design document',
      input_schema: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Name of the project' },
          requirements: { type: 'array', items: { type: 'string' }, description: 'List of system requirements' },
          scale: { type: 'string', enum: ['small', 'medium', 'large'], description: 'Expected system scale' }
        },
        required: ['project_name', 'requirements']
      },
      execute: async (input) => {
        return {
          design: {
            architecture_type: input.scale === 'large' ? 'microservices' : 'monolithic',
            recommended_stack: {
              frontend: 'React/Next.js',
              backend: 'Node.js/Express',
              database: 'PostgreSQL',
              cache: 'Redis',
              deployment: 'Docker + Kubernetes'
            },
            components: input.requirements.map(req => ({
              name: req.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
              description: req,
              type: 'service'
            })),
            estimated_timeline: `${Math.max(4, input.requirements.length * 2)} weeks`
          }
        };
      }
    },
    {
      name: 'analyze_requirements',
      description: 'Analyze project requirements and create implementation plan',
      input_schema: {
        type: 'object',
        properties: {
          requirements: { type: 'string', description: 'Project requirements description' }
        },
        required: ['requirements']
      },
      execute: async (input) => {
        const complexity = input.requirements.length > 500 ? 'high' : input.requirements.length > 200 ? 'medium' : 'low';
        return {
          analysis: {
            complexity_level: complexity,
            estimated_effort: complexity === 'high' ? '8-12 weeks' : complexity === 'medium' ? '4-8 weeks' : '2-4 weeks',
            recommended_team_size: complexity === 'high' ? '4-6 people' : complexity === 'medium' ? '2-4 people' : '1-2 people',
            key_components: ['Frontend UI', 'Backend API', 'Database', 'Authentication', 'Deployment'],
            risk_factors: complexity === 'high' ? ['Integration complexity', 'Scalability concerns'] : ['Timeline pressure']
          }
        };
      }
    }
  ],

  // Backend Developer Tools
  'backend-developer': [
    {
      name: 'design_api',
      description: 'Design REST API endpoints',
      input_schema: {
        type: 'object',
        properties: {
          entity: { type: 'string', description: 'Main entity (e.g., user, product)' },
          operations: { type: 'array', items: { type: 'string' }, description: 'Required operations (CRUD)' }
        },
        required: ['entity', 'operations']
      },
      execute: async (input) => {
        const endpoints = [];
        if (input.operations.includes('create')) endpoints.push(`POST /api/${input.entity.toLowerCase()}s`);
        if (input.operations.includes('read')) endpoints.push(`GET /api/${input.entity.toLowerCase()}s/:id`);
        if (input.operations.includes('update')) endpoints.push(`PUT /api/${input.entity.toLowerCase()}s/:id`);
        if (input.operations.includes('delete')) endpoints.push(`DELETE /api/${input.entity.toLowerCase()}s/:id`);
        if (input.operations.includes('list')) endpoints.push(`GET /api/${input.entity.toLowerCase()}s`);
        
        return {
          api_design: {
            entity: input.entity,
            endpoints: endpoints,
            authentication: 'JWT Bearer token',
            validation: 'JSON Schema validation',
            error_handling: 'Standard HTTP status codes'
          }
        };
      }
    },
    {
      name: 'create_database_schema',
      description: 'Create database schema design',
      input_schema: {
        type: 'object',
        properties: {
          entities: { type: 'array', items: { type: 'string' }, description: 'Database entities' },
          relationships: { type: 'array', items: { type: 'string' }, description: 'Entity relationships' }
        },
        required: ['entities']
      },
      execute: async (input) => {
        return {
          schema: {
            tables: input.entities.map(entity => ({
              name: entity.toLowerCase(),
              columns: ['id (UUID, Primary Key)', 'created_at (Timestamp)', 'updated_at (Timestamp)'],
              indexes: ['PRIMARY KEY (id)', 'INDEX (created_at)']
            })),
            relationships: input.relationships || [],
            constraints: ['Foreign key constraints', 'NOT NULL constraints', 'Unique constraints']
          }
        };
      }
    }
  ],

  // Frontend Developer Tools
  'frontend-developer': [
    {
      name: 'create_ui_mockup',
      description: 'Create UI mockup and component structure',
      input_schema: {
        type: 'object',
        properties: {
          page_type: { type: 'string', description: 'Type of page (dashboard, form, list, etc.)' },
          features: { type: 'array', items: { type: 'string' }, description: 'Required features' }
        },
        required: ['page_type', 'features']
      },
      execute: async (input) => {
        return {
          ui_design: {
            page_type: input.page_type,
            components: input.features.map(feature => ({
              name: feature.replace(/\s+/g, '') + 'Component',
              props: ['data', 'onUpdate', 'loading'],
              state: ['isLoading', 'error', 'data']
            })),
            styling: 'Tailwind CSS or Material-UI',
            responsive: 'Mobile-first responsive design',
            accessibility: 'WCAG 2.1 AA compliance'
          }
        };
      }
    },
    {
      name: 'optimize_performance',
      description: 'Analyze and optimize frontend performance',
      input_schema: {
        type: 'object',
        properties: {
          current_issues: { type: 'array', items: { type: 'string' }, description: 'Current performance issues' }
        },
        required: ['current_issues']
      },
      execute: async (input) => {
        return {
          optimizations: {
            issues_analyzed: input.current_issues,
            recommendations: [
              'Implement code splitting',
              'Use React.memo for expensive components',
              'Optimize images with WebP format',
              'Implement virtual scrolling for large lists',
              'Use service workers for caching'
            ],
            estimated_improvement: '30-50% faster load times'
          }
        };
      }
    }
  ],

  // QA Engineer Tools
  'qa-engineer': [
    {
      name: 'create_test_plan',
      description: 'Create comprehensive test plan',
      input_schema: {
        type: 'object',
        properties: {
          features: { type: 'array', items: { type: 'string' }, description: 'Features to test' },
          test_types: { type: 'array', items: { type: 'string' }, description: 'Types of tests needed' }
        },
        required: ['features']
      },
      execute: async (input) => {
        return {
          test_plan: {
            features_covered: input.features,
            test_cases: input.features.map(feature => ({
              feature,
              test_cases: ['Happy path test', 'Edge case test', 'Error handling test'],
              priority: 'high'
            })),
            test_types: input.test_types || ['unit', 'integration', 'e2e'],
            tools: ['Jest', 'Cypress', 'Testing Library'],
            coverage_target: '85%'
          }
        };
      }
    },
    {
      name: 'analyze_bug_report',
      description: 'Analyze bug report and suggest fixes',
      input_schema: {
        type: 'object',
        properties: {
          bug_description: { type: 'string', description: 'Description of the bug' },
          steps_to_reproduce: { type: 'array', items: { type: 'string' }, description: 'Steps to reproduce' }
        },
        required: ['bug_description']
      },
      execute: async (input) => {
        return {
          bug_analysis: {
            severity: input.bug_description.includes('crash') ? 'critical' : 'medium',
            probable_cause: 'Needs investigation',
            suggested_fix: 'Debug and fix root cause',
            test_needed: 'Regression test to prevent recurrence',
            estimated_effort: '2-4 hours'
          }
        };
      }
    }
  ],

  // DevOps Engineer Tools
  'devops-engineer': [
    {
      name: 'create_deployment_config',
      description: 'Create deployment configuration',
      input_schema: {
        type: 'object',
        properties: {
          environment: { type: 'string', enum: ['development', 'staging', 'production'], description: 'Target environment' },
          services: { type: 'array', items: { type: 'string' }, description: 'Services to deploy' }
        },
        required: ['environment', 'services']
      },
      execute: async (input) => {
        return {
          deployment_config: {
            environment: input.environment,
            services: input.services.map(service => ({
              name: service,
              replicas: input.environment === 'production' ? 3 : 1,
              resources: {
                cpu: '500m',
                memory: '512Mi'
              },
              health_check: '/health'
            })),
            infrastructure: 'Kubernetes',
            monitoring: 'Prometheus + Grafana',
            logging: 'ELK Stack'
          }
        };
      }
    },
    {
      name: 'setup_ci_cd',
      description: 'Set up CI/CD pipeline',
      input_schema: {
        type: 'object',
        properties: {
          repository: { type: 'string', description: 'Repository URL' },
          build_steps: { type: 'array', items: { type: 'string' }, description: 'Build steps required' }
        },
        required: ['repository']
      },
      execute: async (input) => {
        return {
          cicd_config: {
            repository: input.repository,
            pipeline_steps: [
              'Checkout code',
              'Install dependencies',
              'Run tests',
              'Build application',
              'Security scan',
              'Deploy to staging',
              'Run integration tests',
              'Deploy to production'
            ],
            tools: 'GitHub Actions or Jenkins',
            deployment_strategy: 'Blue-green deployment'
          }
        };
      }
    }
  ],

  // Code Reviewer Tools
  'code-reviewer': [
    {
      name: 'review_code_quality',
      description: 'Review code quality and suggest improvements',
      input_schema: {
        type: 'object',
        properties: {
          code_snippet: { type: 'string', description: 'Code to review' },
          language: { type: 'string', description: 'Programming language' }
        },
        required: ['code_snippet']
      },
      execute: async (input) => {
        return {
          review: {
            overall_quality: 'Good',
            issues_found: [
              'Consider adding error handling',
              'Add input validation',
              'Improve variable naming',
              'Add unit tests'
            ],
            security_concerns: ['Input sanitization needed'],
            performance_suggestions: ['Consider caching results'],
            maintainability_score: '7/10'
          }
        };
      }
    },
    {
      name: 'suggest_refactoring',
      description: 'Analyze code and suggest refactoring opportunities',
      input_schema: {
        type: 'object',
        properties: {
          code_complexity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Current code complexity' },
          pain_points: { type: 'array', items: { type: 'string' }, description: 'Current pain points' }
        },
        required: ['code_complexity']
      },
      execute: async (input) => {
        return {
          refactoring_suggestions: {
            complexity: input.code_complexity,
            recommendations: input.code_complexity === 'high' ? [
              'Extract functions for better modularity',
              'Implement design patterns',
              'Reduce cyclomatic complexity',
              'Add comprehensive tests'
            ] : [
              'Minor cleanup opportunities',
              'Improve documentation'
            ],
            estimated_effort: input.code_complexity === 'high' ? '1-2 weeks' : '2-3 days'
          }
        };
      }
    }
  ]
};

/**
 * Get tools for a specific agent
 */
export function getToolsForAgent(agentName) {
  return agentTools[agentName] || [];
}

/**
 * Get all available tools
 */
export function getAllTools() {
  return Object.values(agentTools).flat();
}