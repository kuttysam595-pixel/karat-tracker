# 💎 Karat Tracker - Premium Jewelry Management System

<div align="center">

![Karat Tracker Logo](https://img.shields.io/badge/Karat-Tracker-gold?style=for-the-badge&logo=crown&logoColor=white)

[![React](https://img.shields.io/badge/React-18.3-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-cyan?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

*A comprehensive jewelry management application for tracking daily rates, sales transactions, expenses, and business analytics with AI-powered insights.*

</div>

---

## 🌟 Key Features

### 💰 **Financial Management**
- **Daily Rates Tracking** - Real-time gold/silver pricing (24k, 22k, 18k)
- **Sales Transaction Management** - Comprehensive wholesale/retail tracking
- **Expense Logging** - Direct/indirect expense categorization with Udhaar support
- **Profit Analytics** - Automated profit calculations and reporting

### 🤖 **AI-Powered Analytics**
- **Natural Language Queries** - Ask questions in plain English
- **Voice Input Support** - Speak your queries using advanced speech recognition
- **Intelligent Data Insights** - AI-generated summaries and recommendations
- **Smart SQL Generation** - Convert natural language to optimized SQL queries
- **🛡️ Privacy Protection** - Customer data automatically masked before AI processing

### 📊 **Advanced Reporting**
- **Interactive Dashboard** - Real-time business metrics and KPIs
- **Data Export** - CSV export with customizable columns and date filtering
- **Visual Analytics** - Charts and graphs for trend analysis
- **Activity Logging** - Complete audit trail of all transactions

### 🔐 **Security & Access Control**
- **Role-Based Access** - Admin, Owner, and Employee permission levels
- **Secure Authentication** - Session-based login system
- **Row-Level Security** - Database-level access protection
- **Activity Monitoring** - IP tracking and user agent logging

### 🎨 **Modern User Experience**
- **Responsive Design** - Mobile-first approach with beautiful gradients
- **Dark/Light Theme** - Customizable UI preferences
- **Real-time Updates** - Live data synchronization
- **Intuitive Interface** - Clean, professional jewelry industry design

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher) - [Install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- **npm** or **yarn** package manager
- **Supabase Account** - [Sign up for free](https://supabase.com/)
- **OpenAI API Key** - [Get your API key](https://platform.openai.com/api-keys) (for AI features)

### 🛠️ Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/karat-tracker.git
cd karat-tracker

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your actual configuration values

# 4. Start development server
npm run dev
```

The application will be available at `http://localhost:8080`

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PROJECT_ID="your-project-id"

# OpenAI Configuration (for AI features)
VITE_OPENAI_API_KEY="sk-your-openai-api-key"

# Optional: Development Settings
NODE_ENV="development"
```

### 🔑 Getting Your Keys

1. **Supabase Setup:**
   - Create a new project at [supabase.com](https://supabase.com/)
   - Go to Settings > API
   - Copy your Project URL and Anon Key

2. **OpenAI Setup:**
   - Sign up at [platform.openai.com](https://platform.openai.com/)
   - Navigate to API Keys section
   - Create a new API key

---

## 🗄️ Database Setup

### Automated Setup (Recommended)

The application includes migration files that will automatically set up your database schema:

```bash
# Apply migrations using Supabase CLI
supabase db reset
```

### Manual Setup

If you prefer to set up the database manually, execute the following SQL scripts in your Supabase SQL Editor:

#### 1. Core Schema Setup
```sql
-- Execute the main migration file
-- File: supabase/migrations/20250902061940_2164445b-4f80-4c98-862a-da65f704d667.sql
```

#### 2. AI Query Functions
```sql
-- Execute schema function
-- File: supabase/migrations/schema-function.sql

-- Execute query execution function
-- File: supabase/migrations/execute-query-function.sql
```

### 📋 Database Tables

| Table | Description | Key Features |
|-------|-------------|--------------|
| `users` | User authentication and roles | Role-based access (admin/owner/employee) |
| `daily_rates` | Gold/silver pricing | Material type, karat levels, price tracking |
| `sales_log` | Sales transactions | Customer info, profit calculations, gold exchange |
| `expense_log` | Business expenses | Direct/indirect categorization, Udhaar support |
| `activity_log` | Audit trail | Complete transaction history with IP tracking |

---

## 🏗️ Project Architecture

```
karat-tracker/
├── 📁 src/
│   ├── 📁 components/          # React components
│   │   ├── 📄 Dashboard.tsx     # Main dashboard
│   │   ├── 📄 AddSales.tsx     # Sales entry form
│   │   ├── 📄 AddExpense.tsx   # Expense logging
│   │   ├── 📄 TableDataExport.tsx # AI-powered data export
│   │   └── 📁 ui/              # Reusable UI components
│   ├── 📁 contexts/            # React contexts
│   ├── 📁 hooks/               # Custom React hooks
│   ├── 📁 lib/                 # Utility libraries
│   │   ├── 📄 openaiService.ts  # AI integration
│   │   └── 📄 activityLogger.ts # Audit logging
│   ├── 📁 pages/               # Page components
│   └── 📁 integrations/        # External service integrations
├── 📁 supabase/
│   ├── 📁 migrations/          # Database migration files
│   └── 📄 config.toml          # Supabase configuration
├── 📄 package.json            # Dependencies and scripts
├── 📄 vite.config.ts          # Vite configuration
└── 📄 tailwind.config.js      # Tailwind CSS configuration
```

---

## 🎯 Core Functionality

### 👤 User Management
- **Multi-role Authentication** (Admin, Owner, Employee)
- **Session Management** with automatic timeout
- **Security Logging** with IP and user agent tracking

### 💎 Daily Rates Management
```typescript
// Example: Setting daily rates
{
  material: 'gold',
  karat: '24k',
  n_price: 7500.00,
  o_price: 7400.00,
  asof_date: '2024-12-15'
}
```

### 📈 Sales Transaction Recording
```typescript
// Example: Complete sales transaction
{
  customer_name: 'John Doe',
  customer_phone: '+91-9876543210',
  material: 'gold',
  type: 'retail',
  item_name: 'Gold Chain',
  tag_no: 'GC001',
  p_grams: 25.500,
  p_purity: 91.60,
  p_cost: 191250.00,
  s_cost: 210000.00,
  profit: 18750.00
}
```

### 💰 Expense Tracking
```typescript
// Example: Business expense entry
{
  expense_type: 'direct',
  item_name: 'Gold Purchase',
  cost: 50000.00,
  udhaar: false,
  asof_date: '2024-12-15'
}
```

### 🤖 AI Query Examples

Natural language queries you can use:

- *"What's the total profit this month?"*
- *"Show me top 10 customers by sales value"*
- *"Compare gold vs silver sales performance"*
- *"What are my highest expense categories?"*
- *"Calculate net profit after all expenses"*

#### 🛡️ Privacy Protection in AI Queries

The system automatically protects customer privacy when processing AI queries:

- **Automatic Data Masking**: Customer names and phone numbers are masked before sending to AI services
- **Format Preservation**: Data structure is maintained while protecting sensitive information
- **Visual Indicators**: Masked fields are clearly marked in the UI with 🔒 icons
- **Zero Data Leakage**: Original customer data never leaves your secure database to external AI services

**Example of Data Masking:**
```
Original: "John Doe", "+91-9876543210"
Masked:   "J***e", "+91-98****3210"
```

---

## 🚀 Deployment Guide

### Prerequisites for Production

- **VPS/Cloud Server** (Ubuntu 20.04+ recommended)
- **Node.js** (v18+)
- **PM2** (for process management)
- **Nginx** (web server)
- **SSL Certificate** (Let's Encrypt recommended)

### 🌐 Server Setup

#### 1. Initial Server Configuration
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js using NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### 2. Application Deployment
```bash
# Clone repository to server
git clone https://github.com/your-username/karat-tracker.git
cd karat-tracker

# Install dependencies
npm install

# Build for production
npm run build

# Set up environment variables
sudo nano .env
# Add your production environment variables

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. PM2 Configuration

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'karat-tracker',
    script: 'npm',
    args: 'run preview',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

#### 4. Nginx Configuration

Create `/etc/nginx/sites-available/karat-tracker`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
```

#### 5. Enable Site and SSL
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/karat-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 🔄 Automated Deployment Script

Create `deploy.sh`:
```bash
#!/bin/bash
echo "🚀 Deploying Karat Tracker..."

# Pull latest changes
git pull origin main

# Install/update dependencies
npm install

# Build application
npm run build

# Restart PM2 process
pm2 reload karat-tracker

echo "✅ Deployment completed successfully!"
```

---

## 📊 API Documentation

### Authentication Endpoints

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <session-token>
```

### Data Endpoints

#### Get Daily Rates
```http
GET /api/daily-rates?date=2024-12-15
Authorization: Bearer <session-token>
```

#### Create Sales Transaction
```http
POST /api/sales
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "customer_name": "John Doe",
  "material": "gold",
  "p_grams": 25.5,
  "p_cost": 191250.00,
  "s_cost": 210000.00
}
```

#### AI Query Execution
```http
POST /api/ai-query
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "query": "What's the total profit this month?",
  "context": {
    "table": "sales_log",
    "dateRange": {
      "from": "2024-12-01",
      "to": "2024-12-31"
    }
  }
}
```

---

## 🛠️ Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run build:dev` | Build for development environment |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint for code quality |
| `npm run type-check` | TypeScript type checking |

---

## 🔧 Configuration Options

### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    historyApiFallback: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser'
  }
})
```

### Tailwind CSS Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        amber: { /* Custom amber palette */ },
        gold: { /* Gold color variations */ }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    }
  }
}
```

---

## 🐛 Troubleshooting

### Common Issues

#### Environment Variables Not Loading
```bash
# Check if .env file exists and has correct permissions
ls -la .env
# Restart development server
npm run dev
```

#### Database Connection Issues
```bash
# Verify Supabase credentials
curl -H "apikey: YOUR_ANON_KEY" https://YOUR_PROJECT_ID.supabase.co/rest/v1/
```

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### PM2 Process Issues
```bash
# Check PM2 status
pm2 status
pm2 logs karat-tracker
pm2 restart karat-tracker
```

---

## 📈 Performance Optimization

### Frontend Optimizations
- **Code Splitting** - Lazy loading of components
- **Image Optimization** - WebP format with fallbacks
- **Bundle Analysis** - Regular bundle size monitoring
- **Caching Strategy** - Service worker implementation

### Database Optimizations
- **Indexing** - Optimized indexes on frequently queried columns
- **Query Optimization** - Efficient SQL query patterns
- **Connection Pooling** - Supabase connection optimization
- **Row Level Security** - Minimal performance impact security

### Server Optimizations
- **Gzip Compression** - Reduced payload sizes
- **CDN Integration** - Static asset delivery
- **Process Management** - PM2 cluster mode
- **Memory Management** - Automated process restarts

---

## 🔒 Security Best Practices

### Database Security
- ✅ Row Level Security (RLS) enabled
- ✅ SQL injection prevention with parameterized queries
- ✅ Role-based access control
- ✅ Audit logging for all transactions

### Application Security
- ✅ Input validation and sanitization
- ✅ CORS protection
- ✅ Session timeout management
- ✅ Environment variable protection
- ✅ Customer data masking for AI services
- ✅ Privacy-first AI query processing

### Infrastructure Security
- ✅ SSL/TLS encryption
- ✅ Firewall configuration
- ✅ Regular security updates
- ✅ Backup and recovery procedures

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Standards
- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for code formatting
- **Conventional Commits** for commit messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

## 🆘 Support

### Documentation
- 📚 **Full Documentation**: [Wiki](https://github.com/your-username/karat-tracker/wiki)
- 🎥 **Video Tutorials**: [YouTube Playlist](https://youtube.com/playlist)
- 📖 **API Reference**: [API Docs](https://api-docs.karat-tracker.com)

### Community
- 💬 **Discord Community**: [Join our Discord](https://discord.gg/karat-tracker)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-username/karat-tracker/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/your-username/karat-tracker/discussions)

### Professional Support
For enterprise support and custom development:
- 📧 **Email**: support@karat-tracker.com
- 🌐 **Website**: [www.karat-tracker.com](https://www.karat-tracker.com)

---

<div align="center">

**Made with ❤️ for the Jewelry Industry**

*Transforming traditional jewelry business management with modern technology*

[![Star on GitHub](https://img.shields.io/github/stars/your-username/karat-tracker?style=social)](https://github.com/your-username/karat-tracker)
[![Follow on Twitter](https://img.shields.io/twitter/follow/karat_tracker?style=social)](https://twitter.com/karat_tracker)

---

© 2024 Karat Tracker. All rights reserved.

</div>