# 🚀 Karat Tracker - Production Deployment Guide

This comprehensive guide will walk you through deploying Karat Tracker to a production environment with all necessary optimizations and security configurations.

## 📋 Prerequisites

### Server Requirements
- **Ubuntu 20.04 LTS** or newer (recommended)
- **Minimum 2GB RAM** (4GB recommended for optimal performance)
- **2 CPU cores** (4 cores recommended)
- **20GB SSD storage** minimum
- **Root or sudo access**

### Required Accounts & Services
- **Domain name** with DNS control
- **Supabase account** and project
- **OpenAI API account** (for AI features)
- **SSL certificate** (Let's Encrypt recommended)

---

## 🔧 Phase 1: Server Setup

### 1.1 Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create a non-root user (recommended)
sudo adduser karat-user
sudo usermod -aG sudo karat-user
```

### 1.2 Install Node.js

```bash
# Install Node.js 18.x using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 8.x.x or higher
```

### 1.3 Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Configure PM2 to start on boot
pm2 startup
# Follow the instructions displayed by the command above
```

### 1.4 Install and Configure Nginx

```bash
# Install Nginx
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

---

## 📥 Phase 2: Application Deployment

### 2.1 Clone and Setup Application

```bash
# Switch to application user
sudo su - karat-user

# Clone the repository
git clone https://github.com/your-username/karat-tracker.git
cd karat-tracker

# Install dependencies
npm install

# Make deployment script executable
chmod +x deploy.sh
```

### 2.2 Environment Configuration

```bash
# Create environment file from template
cp .env.example .env

# Edit environment variables
nano .env
```

Fill in your environment variables:

```env
# Production Supabase Configuration
VITE_SUPABASE_PROJECT_ID="your-production-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-production-anon-key"
VITE_SUPABASE_URL="https://your-production-project.supabase.co"
SUPABASE_PROJECT_ID="your-production-project-id"

# OpenAI Configuration
VITE_OPENAI_API_KEY="sk-your-production-openai-key"

# Production Settings
NODE_ENV="production"
```

### 2.3 Build and Deploy Application

```bash
# Run the deployment script
./deploy.sh production

# Verify deployment
pm2 status
pm2 logs karat-tracker
```

---

## 🌐 Phase 3: Nginx Configuration

### 3.1 Setup Nginx Server Block

```bash
# Copy the nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/karat-tracker

# Edit the configuration with your domain
sudo nano /etc/nginx/sites-available/karat-tracker
# Replace 'your-domain.com' with your actual domain

# Enable the site
sudo ln -s /etc/nginx/sites-available/karat-tracker /etc/nginx/sites-enabled/

# Remove default nginx site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### 3.2 DNS Configuration

Configure your domain's DNS records:

```
Type: A
Name: @
Value: YOUR_SERVER_IP

Type: A
Name: www
Value: YOUR_SERVER_IP
```

---

## 🔒 Phase 4: SSL Certificate Setup

### 4.1 Install Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 4.2 Obtain SSL Certificate

```bash
# Get SSL certificate for your domain
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 4.3 Configure Auto-renewal

```bash
# Create renewal job
sudo crontab -e

# Add this line to run renewal check twice daily
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🗄️ Phase 5: Database Setup

### 5.1 Configure Supabase for Production

1. **Create Production Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project for production
   - Note down the project URL and anon key

2. **Run Database Migrations**
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Link to your project
   supabase link --project-ref YOUR_PROJECT_ID

   # Push migrations
   supabase db push
   ```

3. **Configure Row Level Security**
   - All tables should have RLS enabled (done automatically by migrations)
   - Verify policies are correctly applied

### 5.2 Execute SQL Functions

Run these SQL commands in your Supabase SQL Editor:

```sql
-- 1. Execute schema function
-- Copy content from: supabase/migrations/schema-function.sql

-- 2. Execute query function
-- Copy content from: supabase/migrations/execute-query-function.sql
```

---

## 📊 Phase 6: Monitoring and Logging

### 6.1 Setup Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/karat-tracker

# Add this content:
/home/karat-user/karat-tracker/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 karat-user karat-user
    postrotate
        pm2 reload karat-tracker
    endscript
}
```

### 6.2 Setup Monitoring

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Configure monitoring alerts (optional)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

---

## 🔐 Phase 7: Security Hardening

### 7.1 Configure UFW Firewall

```bash
# Review current rules
sudo ufw status numbered

# Allow only necessary ports
sudo ufw delete allow 22/tcp
sudo ufw limit ssh  # Rate limit SSH connections

# Enable logging
sudo ufw logging on
```

### 7.2 Configure Fail2Ban (Optional but Recommended)

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Create jail configuration
sudo nano /etc/fail2ban/jail.local

# Add this content:
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log

# Start fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 7.3 Regular Security Updates

```bash
# Create update script
sudo nano /usr/local/bin/security-updates.sh

# Add this content:
#!/bin/bash
apt update
apt upgrade -y
apt autoremove -y
systemctl restart nginx
pm2 reload all

# Make executable
sudo chmod +x /usr/local/bin/security-updates.sh

# Schedule weekly updates
sudo crontab -e

# Add this line:
0 2 * * 0 /usr/local/bin/security-updates.sh
```

---

## 🚀 Phase 8: Performance Optimization

### 8.1 Configure PM2 for Production

```bash
# Set PM2 to use all CPU cores
pm2 delete karat-tracker
pm2 start ecosystem.config.js --env production

# Save configuration
pm2 save

# Setup monitoring
pm2 monit
```

### 8.2 Optimize Nginx

The provided `nginx.conf` already includes:
- Gzip compression
- Static asset caching
- Security headers
- Rate limiting

### 8.3 Database Optimization

1. **Supabase Performance**
   - Enable connection pooling in Supabase dashboard
   - Set up read replicas if needed
   - Monitor query performance

2. **Indexing**
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX CONCURRENTLY idx_sales_log_asof_date ON sales_log(asof_date);
   CREATE INDEX CONCURRENTLY idx_expense_log_asof_date ON expense_log(asof_date);
   CREATE INDEX CONCURRENTLY idx_daily_rates_asof_date ON daily_rates(asof_date);
   ```

---

## 📋 Phase 9: Backup Strategy

### 9.1 Database Backups

```bash
# Create backup script
nano ~/backup-db.sh

# Add this content:
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/karat-user/backups"
mkdir -p $BACKUP_DIR

# Use Supabase CLI to backup
supabase db dump --file $BACKUP_DIR/karat_tracker_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete

# Make executable
chmod +x ~/backup-db.sh

# Schedule daily backups
crontab -e

# Add this line:
0 1 * * * /home/karat-user/backup-db.sh
```

### 9.2 Application Backups

```bash
# Create application backup script
nano ~/backup-app.sh

# Add this content:
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/karat-user/backups"
APP_DIR="/home/karat-user/karat-tracker"

mkdir -p $BACKUP_DIR

# Backup application files (excluding node_modules)
tar --exclude='node_modules' --exclude='dist' --exclude='logs' \
    -czf $BACKUP_DIR/karat_tracker_app_$DATE.tar.gz $APP_DIR

# Keep only last 7 days
find $BACKUP_DIR -name "*_app_*.tar.gz" -mtime +7 -delete

# Make executable
chmod +x ~/backup-app.sh
```

---

## 🔄 Phase 10: Deployment Automation

### 10.1 Setup Git Hooks for Auto-Deployment

```bash
# Create webhook handler (optional)
nano ~/webhook-deploy.sh

# Add this content:
#!/bin/bash
cd /home/karat-user/karat-tracker
git pull origin main
./deploy.sh production

# Send notification (optional)
curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Karat Tracker deployed successfully!"}' \
    YOUR_SLACK_WEBHOOK_URL
```

### 10.2 Health Check Script

```bash
# Create health check script
nano ~/health-check.sh

# Add this content:
#!/bin/bash
APP_URL="https://your-domain.com"
HEALTH_URL="$APP_URL/health"

if curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo "$(date): Application is healthy"
else
    echo "$(date): Application is down, restarting..."
    pm2 restart karat-tracker

    # Send alert (optional)
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"⚠️ Karat Tracker was down and has been restarted"}' \
        YOUR_SLACK_WEBHOOK_URL
fi

# Make executable
chmod +x ~/health-check.sh

# Schedule health checks every 5 minutes
crontab -e

# Add this line:
*/5 * * * * /home/karat-user/health-check.sh
```

---

## 📈 Phase 11: Monitoring and Maintenance

### 11.1 Log Analysis

```bash
# View application logs
pm2 logs karat-tracker

# View nginx logs
sudo tail -f /var/log/nginx/karat-tracker.access.log
sudo tail -f /var/log/nginx/karat-tracker.error.log

# View system logs
sudo journalctl -u nginx -f
```

### 11.2 Performance Monitoring

```bash
# Monitor system resources
htop
iotop
netstat -tulpn

# Monitor PM2 processes
pm2 monit

# Check disk usage
df -h
du -sh /home/karat-user/karat-tracker/*
```

### 11.3 Regular Maintenance Tasks

```bash
# Create maintenance script
nano ~/maintenance.sh

# Add this content:
#!/bin/bash
echo "Starting maintenance tasks..."

# Update application
cd /home/karat-user/karat-tracker
git pull origin main
npm update
./deploy.sh production

# Clean up logs
pm2 flush karat-tracker

# Clean up system
sudo apt autoremove -y
sudo apt autoclean

# Restart services
sudo systemctl restart nginx
pm2 restart karat-tracker

echo "Maintenance completed!"

# Make executable
chmod +x ~/maintenance.sh
```

---

## 🚨 Troubleshooting Common Issues

### Application Won't Start

```bash
# Check PM2 status
pm2 status
pm2 logs karat-tracker

# Check environment variables
pm2 show karat-tracker

# Restart application
pm2 restart karat-tracker
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check nginx configuration
sudo nginx -t
```

### Database Connection Issues

```bash
# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://YOUR_PROJECT.supabase.co/rest/v1/

# Check environment variables
cat .env | grep SUPABASE
```

### High Memory Usage

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart PM2 with memory limit
pm2 delete karat-tracker
pm2 start ecosystem.config.js --env production
```

---

## 📞 Support and Maintenance Contacts

### Emergency Contacts
- **System Administrator**: your-admin@company.com
- **Developer Team**: dev-team@company.com
- **Hosting Provider**: hosting-support@provider.com

### Service Providers
- **Domain Registrar**: [Provider] - Account: [Account Info]
- **DNS Provider**: [Provider] - Account: [Account Info]
- **Server Provider**: [Provider] - Account: [Account Info]
- **Supabase**: [Account Email]
- **OpenAI**: [Account Email]

---

## ✅ Post-Deployment Checklist

- [ ] Application accessible via HTTPS
- [ ] SSL certificate properly configured
- [ ] All environment variables set correctly
- [ ] Database migrations applied successfully
- [ ] PM2 processes running and auto-restart configured
- [ ] Nginx properly configured with security headers
- [ ] Firewall rules configured
- [ ] Monitoring and logging set up
- [ ] Backup systems operational
- [ ] Performance optimization applied
- [ ] Security hardening completed
- [ ] Documentation updated with production details

---

**🎉 Congratulations! Your Karat Tracker application is now successfully deployed to production!**

For ongoing support and updates, refer to the main README.md file and keep this deployment guide handy for future reference.