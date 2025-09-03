#!/bin/bash

# Test script to verify the swarm setup
echo "🧪 Testing Claude Docker Swarm Setup..."

# Check if required files exist
echo "📁 Checking required files..."

files=(
    "docker-compose.yml"
    ".env.example"
    "start.sh"
    "manage.sh"
    "README.md"
    "config/dependencies.txt"
    "agents/base/Dockerfile.base"
    "shared/communication.js"
    "shared/claude-client.js"
    "shared/ui-mcp-server.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING"
    fi
done

# Check agent directories
echo ""
echo "🤖 Checking agent directories..."

agents=("architect" "frontend" "backend" "devops" "qa" "docs")

for agent in "${agents[@]}"; do
    if [ -d "agents/$agent" ]; then
        echo "✅ agents/$agent/"
        # Check required files in each agent
        if [ -f "agents/$agent/Dockerfile" ] && [ -f "agents/$agent/config.json" ] && [ -f "agents/$agent/agent.js" ]; then
            echo "  ✅ Complete configuration"
        else
            echo "  ❌ Missing files"
        fi
    else
        echo "❌ agents/$agent/ - MISSING"
    fi
done

# Check dashboard
echo ""
echo "📊 Checking dashboard..."
if [ -d "dashboard" ] && [ -f "dashboard/server.js" ] && [ -f "dashboard/package.json" ]; then
    echo "✅ Dashboard complete"
else
    echo "❌ Dashboard incomplete"
fi

# Test docker-compose syntax
echo ""
echo "🐳 Testing Docker Compose syntax..."
if docker-compose config > /dev/null 2>&1; then
    echo "✅ docker-compose.yml syntax valid"
else
    echo "❌ docker-compose.yml syntax error"
    docker-compose config
fi

# Check if .env exists
echo ""
echo "🔧 Environment configuration..."
if [ -f ".env" ]; then
    if grep -q "CLAUDE_API_KEY=" .env && ! grep -q "your_anthropic_api_key_here" .env; then
        echo "✅ .env file configured"
    else
        echo "⚠️  .env file exists but CLAUDE_API_KEY not set"
    fi
else
    echo "⚠️  .env file not found (copy from .env.example)"
fi

echo ""
echo "🎯 Summary:"
echo "   - If all files show ✅, the swarm is ready to deploy"
echo "   - Copy .env.example to .env and add your Claude API key"
echo "   - Run ./start.sh to launch the swarm"
echo "   - Use ./manage.sh for management commands"
echo ""
echo "📖 See README.md for detailed instructions"
