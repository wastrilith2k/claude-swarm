#!/bin/bash

# Claude Docker Swarm - Management Script
# Provides easy management commands for the swarm

set -e

COMMAND=$1
SERVICE=$2

usage() {
    echo "Claude Docker Swarm Management"
    echo ""
    echo "Usage: ./manage.sh [command] [service]"
    echo ""
    echo "Commands:"
    echo "  start         - Start all services"
    echo "  stop          - Stop all services"
    echo "  restart       - Restart all services"
    echo "  status        - Show service status"
    echo "  logs          - Show logs (optionally for specific service)"
    echo "  shell         - Open shell in service container"
    echo "  clean         - Remove all containers and volumes"
    echo "  rebuild       - Rebuild and restart all services"
    echo "  health        - Check health of all services"
    echo "  backup        - Backup Neo4j data"
    echo "  restore       - Restore Neo4j data"
    echo ""
    echo "Services:"
    echo "  neo4j, redis, agent-team, dashboard-api, dashboard"
    echo ""
    echo "Examples:"
    echo "  ./manage.sh start"
    echo "  ./manage.sh logs agent-team"
    echo "  ./manage.sh shell agent-team"
    echo "  ./manage.sh restart dashboard"
}

case $COMMAND in
    start)
        echo "🚀 Starting Claude Docker Swarm..."
        docker-compose up -d
        echo "✅ Swarm started"
        ./manage.sh status
        ;;

    stop)
        echo "🛑 Stopping Claude Docker Swarm..."
        docker-compose down
        echo "✅ Swarm stopped"
        ;;

    restart)
        if [ -n "$SERVICE" ]; then
            echo "🔄 Restarting service: $SERVICE"
            docker-compose restart $SERVICE
        else
            echo "🔄 Restarting all services..."
            docker-compose restart
        fi
        echo "✅ Restart complete"
        ;;

    status)
        echo "📊 Service Status:"
        docker-compose ps
        echo ""
        echo "💾 Storage Usage:"
        docker system df
        ;;

    logs)
        if [ -n "$SERVICE" ]; then
            echo "📋 Logs for $SERVICE:"
            docker-compose logs -f --tail=100 $SERVICE
        else
            echo "📋 All service logs:"
            docker-compose logs -f --tail=50
        fi
        ;;

    shell)
        if [ -z "$SERVICE" ]; then
            echo "❌ Please specify a service name"
            usage
            exit 1
        fi
        echo "🐚 Opening shell in $SERVICE..."
        docker-compose exec $SERVICE /bin/sh
        ;;

    clean)
        echo "🧹 Cleaning up containers and volumes..."
        read -p "This will remove all containers and data. Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v
            docker system prune -f
            echo "✅ Cleanup complete"
        else
            echo "❌ Cleanup cancelled"
        fi
        ;;

    rebuild)
        echo "🔨 Rebuilding and restarting swarm..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        echo "✅ Rebuild complete"
        ./manage.sh status
        ;;

    health)
        echo "🔍 Health Check:"
        echo ""
        echo "📊 Dashboard Frontend: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/ || echo 'DOWN')"
        echo "📊 Dashboard API: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health || echo 'DOWN')"
        echo "🤖 Agent Team: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health || echo 'DOWN')"
        echo ""
        echo "🗄️  Database Status:"
        docker-compose exec neo4j cypher-shell -u neo4j -p swarmpassword123 "CALL db.ping();" || echo "Neo4j: DOWN"
        docker-compose exec redis redis-cli --no-auth-warning -a swarmredis123 ping || echo "Redis: DOWN"
        ;;

    backup)
        echo "💾 Backing up Neo4j data..."
        mkdir -p backups
        BACKUP_FILE="backups/neo4j-backup-$(date +%Y%m%d-%H%M%S).dump"
        docker-compose exec neo4j neo4j-admin database dump neo4j --to-path=/tmp
        docker cp $(docker-compose ps -q neo4j):/tmp/neo4j.dump $BACKUP_FILE
        echo "✅ Backup saved to: $BACKUP_FILE"
        ;;

    restore)
        if [ -z "$SERVICE" ]; then
            echo "❌ Please specify backup file path"
            echo "Usage: ./manage.sh restore backups/neo4j-backup-file.dump"
            exit 1
        fi
        echo "📥 Restoring Neo4j data from: $SERVICE"
        docker-compose stop neo4j
        docker cp $SERVICE $(docker-compose ps -q neo4j):/tmp/restore.dump
        docker-compose start neo4j
        sleep 10
        docker-compose exec neo4j neo4j-admin database load neo4j --from-path=/tmp --overwrite-destination=true
        docker-compose restart neo4j
        echo "✅ Restore complete"
        ;;

    *)
        echo "❌ Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac
