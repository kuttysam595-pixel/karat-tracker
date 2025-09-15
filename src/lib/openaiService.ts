import { TableSchema, schemaService } from './schemaService';
import { DataMaskingService } from './dataMasking';

interface QueryContext {
  tableName: string;
  columns: string[];
  sampleData: any[];
  dateRange?: {
    from: string;
    to: string;
  };
  tableSchema?: TableSchema;
}

interface QueryResponse {
  sql: string;
  explanation: string;
  summary: string;
  expectedResultType?: 'aggregation' | 'list' | 'single_value';
}

export class OpenAIService {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file');
    }
  }

  async generateSQLQuery(query: string, context: QueryContext): Promise<QueryResponse> {
    // Get table schema if not provided
    if (!context.tableSchema) {
      try {
        context.tableSchema = await schemaService.getTableSchema(context.tableName);
      } catch (error) {
        console.warn(`Failed to fetch schema for ${context.tableName}, proceeding without schema`);
      }
    }

    const prompt = this.buildPrompt(query, context);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Options: 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-4'
          messages: [
            {
              role: 'system',
              content: 'You are a SQL expert who generates safe, read-only SQL queries based on natural language requests. Only generate SELECT statements. Never use DROP, DELETE, UPDATE, INSERT, or any destructive operations. IMPORTANT: You must respect customer privacy - never include actual customer names or phone numbers in examples, and focus on business analytics rather than individual customer details.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return this.parseResponse(content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate SQL query. Please try again.');
    }
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      console.log('Transcribing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      // Convert blob to proper format for Whisper
      const fileName = audioBlob.type.includes('webm') ? 'audio.webm' :
                      audioBlob.type.includes('mp4') ? 'audio.mp4' : 'audio.wav';

      const formData = new FormData();
      formData.append('file', audioBlob, fileName);
      formData.append('model', 'whisper-1');

      // Try without language forcing first - let Whisper auto-detect
      // formData.append('language', 'en');

      // Remove business context prompt - might be too restrictive
      // formData.append('prompt', 'This is a business query about sales, profits, expenses, or financial data.');

      // Use default temperature
      // formData.append('temperature', '0');

      console.log('Sending request to Whisper API...');
      const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      console.log('Whisper API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error response:', errorText);
        throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Whisper API response data:', data);

      const transcription = data.text || '';
      console.log('Final transcription:', transcription);

      return transcription;
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSummary(query: string, results: any[]): Promise<string> {
    if (results.length === 0) {
      return "No data found matching your query criteria.";
    }

    // *** PRIVACY PROTECTION: Mask sensitive customer data before sending to LLM ***
    const maskedResults = DataMaskingService.maskQueryResults(results);
    const safeDataDescription = DataMaskingService.createSafeDataDescription(results);

    // Use masked data for analysis
    const resultSample = maskedResults.slice(0, 10);
    const resultColumns = Object.keys(results[0] || {});
    const resultCount = results.length;

    // Check for common aggregation patterns
    const hasAggregations = resultColumns.some(col =>
      col.includes('total_') || col.includes('sum_') || col.includes('count_') || col.includes('avg_')
    );

    const prompt = `
Based on the original user query: "${query}"
${safeDataDescription}

PRIVACY NOTE: Customer names and phone numbers have been masked in the data below for privacy protection.

Sample results (with masked personal data): ${JSON.stringify(resultSample, null, 2)}

Generate a very brief 2-line summary that:
1. States the key finding in response to the user's question
2. Uses Indian Rupee (₹) formatting for currency values
3. Keep it under 50 words total
4. Be direct and specific
5. Do NOT include any customer names or phone numbers in your response

${hasAggregations ? 'Focus only on the main aggregated value and its business meaning.' : 'Mention the most important data point found.'}

Format: Line 1 = Main result, Line 2 = Brief business insight.
`;

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Options: 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o', 'gpt-4'
          messages: [
            {
              role: 'system',
              content: 'You are a business analyst who creates clear, concise summaries of data analysis results. Always reference the original user question in your response.'
            },
            {
              role: 'user',
              content: `Original User Question: "${query}"\n\n${prompt}`
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || 'Summary generation failed.';
      return summary;
    } catch (error) {
      console.error('Summary generation error:', error);
      return `Found ${results.length} records matching your query.`;
    }
  }

  private buildPrompt(query: string, context: QueryContext): string {
    const { dateRange, sampleData } = context;

    // *** PRIVACY PROTECTION: Mask sensitive data in sample data ***
    const maskedSampleData = sampleData && sampleData.length > 0
      ? DataMaskingService.maskSampleData(sampleData)
      : [];

    // Analyze if the query mentions dates, time periods, or specific ranges
    const queryLower = query.toLowerCase();
    const hasDatesInQuery = /\b(today|yesterday|this month|last month|this week|last week|this year|last year|between|from|to|since|until|ago|recent|latest|current)\b/.test(queryLower) ||
                           /\b\d{4}-\d{2}-\d{2}\b/.test(query) || // Date format YYYY-MM-DD
                           /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(queryLower);

    let dateContext = '';
    if (hasDatesInQuery && dateRange) {
      dateContext = `- Available date range: ${dateRange.from} to ${dateRange.to}\n- Use this date range in your WHERE clauses when dates are mentioned\n`;
    }

    // Add sample data context if available (with masked sensitive data)
    let sampleDataContext = '';
    if (maskedSampleData.length > 0) {
      sampleDataContext = `\nSample Data (with customer information masked for privacy):\n${JSON.stringify(maskedSampleData, null, 2)}\n`;
    }

    return `
Generate a PostgreSQL SELECT query for this request: "${query}"

AVAILABLE TABLES & RELATIONSHIPS:
You can query ANY of these tables and JOIN them as needed (exclude 'users' table for security):

1. sales_log - Main sales transactions
   - Columns: id, asof_date, inserted_by, date_time, material, type, item_name, tag_no, customer_name, customer_phone, o1_gram, o1_purity, o2_gram, o2_purity, o_cost, p_grams, p_purity, p_cost, s_purity, wastage, s_cost, profit, created_at

2. expense_log - Business expenses
   - Columns: id, asof_date, expense_type, item_name, cost, udhaar, created_at

3. daily_rates - Daily precious metal rates
   - Columns: id, asof_date, inserted_by, date_time, material, karat, n_price, o_price, created_at

4. activity_log - System activity tracking
   - Columns: id, user_id, action, details, timestamp, ip_address, user_agent

BUSINESS RELATIONSHIPS:
- sales_log.material connects to daily_rates.material (gold/silver)
- sales_log.asof_date can be joined with daily_rates.asof_date for rate analysis
- expense_log.asof_date for expense analysis on same dates
- All tables have date fields for temporal analysis

Database Context:
${dateContext}${sampleDataContext}

PRIVACY & SECURITY REQUIREMENTS:
⚠️  IMPORTANT: This system handles sensitive customer data. Follow these rules:
- Customer names and phone numbers are masked in any sample data provided
- NEVER include actual customer names or phone numbers in query examples
- Use generic placeholders like 'customer_name' and 'customer_phone' in column references
- Focus on business analytics rather than individual customer details

Business Context:
- This is a jewelry business tracking sales, expenses, and daily rates
- Materials are 'gold' and 'silver'
- Transaction types are 'wholesale' and 'retail'
- Profits = selling cost - purchase cost (considering old materials)
- Currency is Indian Rupees (₹)

Business Logic Rules:
- profit = s_cost - p_cost (+ considerations for old materials o_cost)
- p_grams/s_grams: Weight in grams (with up to 3 decimal precision)
- p_purity/s_purity: Purity percentage (e.g., 91.6 for 22k gold)
- wastage: Additional percentage for retail sales
- asof_date: Transaction date (YYYY-MM-DD format)
- created_at: System timestamp when record was created
- expense means cost from expense_log table expense of two type direct and indirect

QUERY GENERATION RULES:
1. ONLY generate SELECT statements - never INSERT, UPDATE, DELETE, DROP
2. Use proper PostgreSQL syntax with correct data types
3. You can JOIN multiple tables to answer complex questions
4. Only include date filtering if the user query mentions dates, time periods, or ranges
5. For queries without date mentions, query all available data
6. Use appropriate JOINs when data from multiple tables is needed
7. Use LIMIT for general queries to avoid overwhelming results (suggest 20-50 for data browsing)
8. Use appropriate ORDER BY for meaningful results
9. Handle NULL values in calculations using COALESCE or IS NOT NULL
10. Format the response as JSON with these fields:
    - sql: the SQL query
    - explanation: brief explanation of what the query does
    - summary: what business insight this provides

COMMON QUERY PATTERNS:
- Sales analysis: Query sales_log table
- Expense analysis: Query expense_log table
- Rate analysis: Query daily_rates table
- Combined analysis: JOIN sales_log with daily_rates for profit vs rate analysis
- Financial overview: JOIN sales_log and expense_log for complete financial picture
- Performance analysis: Aggregate across multiple tables

Example format:
{
  "sql": "SELECT s.material, SUM(s.profit) as total_profit, AVG(d.n_price) as avg_rate FROM sales_log s LEFT JOIN daily_rates d ON s.material = d.material AND s.asof_date = d.asof_date WHERE s.profit IS NOT NULL GROUP BY s.material ORDER BY total_profit DESC",
  "explanation": "Analyzes total profit by material with average daily rates",
  "summary": "Shows which materials are most profitable and their corresponding market rates",
  "expectedResultType": "aggregation"
}

Additional Notes:
- For queries asking about "highest" or "maximum" values, include MAX() functions
- For rate queries, use daily_rates table with n_price or o_price columns
- For expense vs income analysis, JOIN sales_log and expense_log
- Always provide meaningful summaries that explain business implications
- Set expectedResultType as "aggregation" for SUM/AVG/COUNT, "list" for multiple rows, "single_value" for single results
`;
  }

  private parseResponse(content: string): QueryResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sql: parsed.sql || '',
          explanation: parsed.explanation || 'Generated SQL query based on your request',
          summary: parsed.summary || 'Custom query to analyze your business data',
          expectedResultType: parsed.expectedResultType || 'list'
        };
      }
    } catch (error) {
      console.error('Failed to parse OpenAI response as JSON:', error);
      console.log('Raw OpenAI response:', content);
    }

    // Fallback: try to extract SQL from code blocks
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const sql = sqlMatch ? sqlMatch[1].trim() : content.trim();

    // Try to extract explanation and summary from the content
    let explanation = 'Generated SQL query based on your request';
    let summary = 'Custom query to analyze your business data';

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('explanation') || line.includes('this query')) {
        explanation = lines[i + 1]?.trim() || explanation;
      }
      if (line.includes('summary') || line.includes('insight') || line.includes('shows')) {
        summary = lines[i + 1]?.trim() || lines[i]?.replace(/summary:?/i, '').trim() || summary;
      }
    }

    return {
      sql,
      explanation,
      summary,
      expectedResultType: 'list'
    };
  }
}

export const openaiService = new OpenAIService();