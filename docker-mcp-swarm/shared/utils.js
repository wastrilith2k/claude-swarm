const winston = require('winston');
const path = require('path');

function createLogger(agentRole) {
  const logDir = process.env.LOG_DIR || '/app/logs';

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${agentRole.toUpperCase()}] ${level}: ${message}${
          stack ? '\n' + stack : ''
        }`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      new winston.transports.File({
        filename: path.join(logDir, agentRole, 'error.log'),
        level: 'error',
      }),
      new winston.transports.File({
        filename: path.join(logDir, agentRole, 'combined.log'),
      }),
    ],
  });
}

function validateTask(task) {
  const required = ['type', 'title'];
  for (const field of required) {
    if (!task[field]) {
      throw new Error(`Task missing required field: ${field}`);
    }
  }

  if (
    task.priority &&
    !['low', 'medium', 'high', 'critical'].includes(task.priority)
  ) {
    throw new Error(`Invalid priority: ${task.priority}`);
  }

  return true;
}

function formatTaskForUI(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    status: task.status,
    assignedTo: task.to,
    assignedBy: task.from,
    createdAt: task.timestamp,
    estimatedHours: task.data?.estimatedHours,
    dependencies: task.data?.dependencies || [],
  };
}

function parseEnvironmentVariables() {
  return {
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
    },
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
    },
    ports: {
      architect: process.env.ARCHITECT_PORT || 8080,
      frontend: process.env.FRONTEND_PORT || 8081,
      backend: process.env.BACKEND_PORT || 8082,
      devops: process.env.DEVOPS_PORT || 8083,
      qa: process.env.QA_PORT || 8084,
      docs: process.env.DOCS_PORT || 8085,
    },
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retry(fn, maxRetries = 3, delay = 1000) {
  return async (...args) => {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await sleep(delay * Math.pow(2, i)); // Exponential backoff
        }
      }
    }

    throw lastError;
  };
}

function sanitizeForLogging(obj) {
  const sensitive = ['password', 'token', 'key', 'secret'];
  const sanitized = { ...obj };

  function sanitizeRecursive(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        obj[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitizeRecursive(value);
      }
    }
  }

  sanitizeRecursive(sanitized);
  return sanitized;
}

module.exports = {
  createLogger,
  validateTask,
  formatTaskForUI,
  parseEnvironmentVariables,
  sleep,
  retry,
  sanitizeForLogging,
};
