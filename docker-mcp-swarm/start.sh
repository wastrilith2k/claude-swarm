#!/bin/bash

# Claude Docker Swarm - Quick Start Script
# This script sets up and starts the complete MCP-powered development team

set -e

echo "🚀 Starting Claude Docker Swarm Setup..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "✅ .env file created. You can customize it later if needed."
fi

echo "✅ Environment checks passed"

# Pull required images
echo "📦 Pulling Docker images..."
docker-compose pull

# Build custom images
echo "🔨 Building agent images..."
docker-compose build

# Start the swarm
echo "🎬 Starting Claude Docker Swarm..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Display access information
echo ""
echo "🎉 Claude Docker Swarm is running!"
echo ""
echo "📊 Dashboard: http://localhost:8080"
echo "🏗️  Architect UI: http://localhost:3001"
echo "🎨 Frontend UI: http://localhost:3002"
echo "⚙️  Backend UI: http://localhost:3003"
echo "🚀 DevOps UI: http://localhost:3004"
echo "🧪 QA UI: http://localhost:3005"
echo "📚 Docs UI: http://localhost:3006"
echo ""
echo "🔧 Dashboard API: http://localhost:3000"
echo "💾 Neo4j Browser: http://localhost:7474 (user: neo4j, pass: swarm_password)"
echo ""
echo "📋 To view logs: docker-compose logs -f [service-name]"
echo "🛑 To stop: docker-compose down"
echo "🔧 To restart: docker-compose restart"

# Check if any services failed
failed_services=$(docker-compose ps --services --filter "status=exited")
if [ -n "$failed_services" ]; then
    echo ""
    echo "⚠️  Some services failed to start:"
    echo "$failed_services"
    echo ""
    echo "📋 Check logs with: docker-compose logs [service-name]"
fi

echo ""
echo "✨ Setup complete! Your MCP agent swarm is ready."
echo ""
echo "🎯 Next Steps:"
echo "1. Open Claude Desktop application"
echo "2. Configure MCP servers (see config/dependencies.txt)"
echo "3. Connect to your specialized AI agents"
echo "4. Use the dashboard to monitor agent activity"
