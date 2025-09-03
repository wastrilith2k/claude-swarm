#!/bin/bash

# Network Access Helper Script for MCP Swarm Dashboard
# This script helps you find your IP address and test network connectivity

echo "🌐 MCP Swarm Dashboard - Network Access Helper"
echo "=============================================="
echo

# Get the host IP addresses
echo "📍 Available IP Addresses:"
echo

# Linux/macOS method
if command -v ip &> /dev/null; then
    echo "Local Network IPs (from 'ip' command):"
    ip addr show | grep -E 'inet [0-9]' | grep -v '127.0.0.1' | awk '{print "  - " $2}' | sed 's/\/.*$//'
    echo
fi

# Alternative method using ifconfig
if command -v ifconfig &> /dev/null; then
    echo "Local Network IPs (from 'ifconfig' command):"
    ifconfig | grep -E 'inet [0-9]' | grep -v '127.0.0.1' | awk '{print "  - " $2}'
    echo
fi

# Windows WSL method
if command -v powershell.exe &> /dev/null; then
    echo "Windows Host IP (for WSL users):"
    powershell.exe "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {\$_.InterfaceAlias -notlike '*Loopback*' -and \$_.InterfaceAlias -notlike '*Docker*' -and \$_.InterfaceAlias -notlike '*vEthernet*'} | Select-Object -First 1).IPAddress" 2>/dev/null | tr -d '\r' | awk '{if($1 != "") print "  - " $1}'
    echo
fi

# Get the most likely IP for local network
MAIN_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
if [ -z "$MAIN_IP" ]; then
    MAIN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -n "$MAIN_IP" ]; then
    echo "🎯 Most Likely Network IP: $MAIN_IP"
    echo
    echo "📱 Access URLs from other devices:"
    echo "  - Dashboard UI: http://$MAIN_IP:8080"
    echo "  - API Server:   http://$MAIN_IP:8080/api"
    echo "  - Neo4j Browser: http://$MAIN_IP:7474"
    echo
fi

echo "🔧 Service Status Check:"
echo "========================"

# Check if services are running
if command -v docker &> /dev/null; then
    if docker ps | grep -q "mcp_dashboard"; then
        echo "✅ Dashboard service is running"
    else
        echo "❌ Dashboard service is not running"
        echo "   Run: ./start.sh to start all services"
    fi
    
    if docker ps | grep -q "mcp_redis"; then
        echo "✅ Redis service is running"
    else
        echo "❌ Redis service is not running"
    fi
    
    if docker ps | grep -q "mcp_neo4j"; then
        echo "✅ Neo4j service is running"
    else
        echo "❌ Neo4j service is not running"
    fi
else
    echo "❌ Docker is not available"
fi

echo
echo "🔥 Firewall & Network Notes:"
echo "============================"
echo "• Make sure port 8080 is open on your firewall"
echo "• On Windows: Windows Defender Firewall"
echo "• On macOS: System Preferences > Security & Privacy > Firewall"
echo "• On Linux: ufw allow 8080 or iptables rules"
echo "• Router settings may also need port forwarding for external access"
echo

echo "🧪 Test Network Connectivity:"
echo "============================="
if [ -n "$MAIN_IP" ]; then
    echo "From another device on your network, try:"
    echo "  curl http://$MAIN_IP:8080/health"
    echo
    echo "Or open in a browser:"
    echo "  http://$MAIN_IP:8080"
    echo
fi

echo "📋 Quick Troubleshooting:"
echo "========================="
echo "1. Verify services are running: ./manage.sh status"
echo "2. Check Docker logs: docker logs mcp_dashboard_api"
echo "3. Test local access first: http://localhost:8080"
echo "4. Check firewall settings on the host machine"
echo "5. Ensure devices are on the same network"
echo

echo "✨ Happy monitoring! 📊"