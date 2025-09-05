# Debug Mode Configuration

## Overview

The `DEBUG_MODE` environment variable allows you to test the agent swarm workflow without making actual Claude API calls. This is particularly useful for:

- Testing the task assignment logic
- Validating the scrum/kanban workflow
- Debugging task routing and status transitions
- Development and testing without incurring API costs

## Configuration

Set the `DEBUG_MODE` environment variable in your `.env` file:

```bash
# Enable debug mode (no Claude API calls)
DEBUG_MODE=true

# Disable debug mode (normal operation with Claude API)
DEBUG_MODE=false
```

## Behavior in Debug Mode

When `DEBUG_MODE=true`:

1. **No Claude API Calls**: Agents will not make actual calls to the Claude API
2. **Simulated Responses**: Tasks will receive simulated responses that mimic real agent processing
3. **Task Progression**: Tasks still move through the normal workflow states
4. **Project Manager**: The Project Manager still analyzes and assigns tasks normally
5. **Blocked Tasks**: Task blocking logic still works for incomplete requirements

## Debug Mode Features

### Task Assignment
- Project Manager still analyzes task content and assigns to appropriate agents
- Agent selection based on keywords still functions
- Task routing follows the same logic as production

### Simulated Processing
- Each agent returns a debug response indicating what would have been processed
- Responses include timestamp and next workflow step
- Tasks progress through states: Pending → In Progress → Completed

### Blocked Task Handling
- Tasks with insufficient information are still marked as "Blocked"
- Project Manager provides clear reasons for blocking
- Blocked tasks appear in the dashboard's "Blocked" tab

## Blocked Status

Tasks are automatically marked as "Blocked" when:

- Task description is too brief (< 20 characters)
- Development tasks lack technical specifications
- Requirements are unclear or incomplete

Blocked tasks include:
- **Blocking Reason**: Clear explanation of what information is missing
- **Next Action**: Guidance on how to unblock the task
- **Project Manager Review**: Blocked tasks are monitored by the Project Manager

## Testing Workflow

1. Set `DEBUG_MODE=true` in your `.env` file
2. Restart the services: `docker-compose down && docker-compose up -d`
3. Create test tasks through the dashboard
4. Watch tasks progress through the workflow without API costs
5. View blocked tasks in the "Blocked" tab
6. Monitor logs to see debug processing messages

## Example Debug Response

```json
{
  "taskId": "task_1234567890_abc123",
  "agent": "frontend-developer",
  "status": "In Progress",
  "debugMode": true,
  "simulatedResponse": "[DEBUG MODE] Task 'Create user login form' assigned to frontend-developer. This is a simulated response - no actual Claude API call was made.",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "nextAgent": "qa-engineer"
}
```

## Switching Back to Production

To return to normal operation:

1. Set `DEBUG_MODE=false` in your `.env` file
2. Ensure your `CLAUDE_API_KEY` is properly configured
3. Restart the services: `docker-compose down && docker-compose up -d`

## Monitoring

Watch the logs to see debug mode status:

```bash
# View agent-team logs
docker logs mcp_agent_team -f

# Look for debug mode messages
🐛 DEBUG MODE ENABLED - No Claude API calls will be made
🐛 DEBUG: Simulated task processing for frontend-developer
```
