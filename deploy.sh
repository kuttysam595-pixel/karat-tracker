#!/bin/bash

# Karat Tracker Deployment Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-production}

echo -e "${BLUE}🚀 Starting Karat Tracker Deployment...${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${BLUE}📦 Installing/updating dependencies...${NC}"
npm install

echo -e "${BLUE}🔍 Running linting checks...${NC}"
npm run lint || {
    echo -e "${YELLOW}⚠️  Lint warnings found, but continuing deployment...${NC}"
}

echo -e "${BLUE}🏗️  Building application for ${ENVIRONMENT}...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    npm run build
else
    npm run build:dev
fi

echo -e "${BLUE}🔧 Managing PM2 processes...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not found. Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Stop existing processes gracefully
if pm2 describe karat-tracker > /dev/null 2>&1; then
    echo -e "${YELLOW}🔄 Stopping existing processes...${NC}"
    pm2 stop karat-tracker
fi

# Start/restart the application
echo -e "${GREEN}🚀 Starting Karat Tracker...${NC}"
pm2 start ecosystem.config.js --env ${ENVIRONMENT}

# Save PM2 configuration
pm2 save

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}📊 Application Status:${NC}"
pm2 status karat-tracker

echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo -e "  • View logs: ${YELLOW}pm2 logs karat-tracker${NC}"
echo -e "  • Monitor: ${YELLOW}pm2 monit${NC}"
echo -e "  • Restart: ${YELLOW}pm2 restart karat-tracker${NC}"
echo -e "  • Stop: ${YELLOW}pm2 stop karat-tracker${NC}"
echo ""

# Show application URL
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${GREEN}🌐 Application should be available at your configured domain${NC}"
else
    echo -e "${GREEN}🌐 Application should be available at http://localhost:3000${NC}"
fi

echo -e "${BLUE}🎉 Happy tracking! 💎${NC}"