import OpenAI from 'openai';
import logger from '../lib/logger';
import fs from 'fs';
import path from 'path';

/**
 * AI Service using NVIDIA NIM (build.nvidia.com)
 * Provides intelligent insights and chat capabilities for the Task Scheduler.
 */
export class AIService {
  private client: OpenAI | null = null;
  private model: string = 'nvidia/llama-3.1-nemotron-70b-instruct'; // Upgraded to high-performance Nemotron model
  private docsPath: string = path.join(process.cwd(), 'docs');

  constructor() {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (apiKey && apiKey !== 'nvapi-your-key-here') {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      logger.info('NVIDIA NIM AI Service initialized');
    } else {
      logger.warn('NVIDIA_API_KEY not configured. AI Service running in mock mode.');
    }
  }

  /**
   * Multi-Agent Orchestrator Chat
   * Delegates queries to specialized agents based on intent
   */
  async chat(message: string, history: { role: 'user' | 'assistant' | 'system', content: string }[] = []): Promise<string> {
    if (!this.client) {
      return this.mockResponse(message);
    }

    try {
      // 1. Intent Classification / Routing
      const agentRole = this.classifyIntent(message);
      
      // 2. Gather Context for the specific agent
      const context = await this.getAgentContext(agentRole, message);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: this.getSystemPrompt(agentRole, context)
          },
          ...history,
          { role: 'user', content: message }
        ],
        temperature: 0.2,
        max_tokens: 1024,
      });

      return response.choices[0].message.content || 'I am sorry, I could not process that request.';
    } catch (error) {
      logger.error('NVIDIA NIM Multi-Agent Error:', error);
      return 'I encountered an error in my neural orchestration layer. Please try again later.';
    }
  }

  private classifyIntent(message: string): 'asset' | 'optimization' | 'health' | 'docs' | 'general' {
    const msg = message.toLowerCase();
    if (msg.includes('node') || msg.includes('fog') || msg.includes('cloud') || msg.includes('resource')) return 'asset';
    if (msg.includes('algorithm') || msg.includes('schedule') || msg.includes('optimize') || msg.includes('cuopt')) return 'optimization';
    if (msg.includes('error') || msg.includes('failure') || msg.includes('circuit') || msg.includes('down')) return 'health';
    if (msg.includes('project') || msg.includes('phase') || msg.includes('report') || msg.includes('documentation')) return 'docs';
    return 'general';
  }

  private async getAgentContext(role: string, query: string): Promise<string> {
    switch (role) {
      case 'asset':
        return 'Context: The system uses a 3-layer architecture (Terminal, Fog, Cloud). Current Fog Nodes include Alpha, Beta, and Gamma. Cloud offloading is enabled for high-load scenarios.';
      case 'optimization':
        return 'Context: Algorithms implemented include Hybrid Heuristic (IPSO + IACO), FCFS, and NVIDIA cuOpt. cuOpt provides world-record GPU-accelerated solving.';
      case 'health':
        return 'Context: The system uses an Advanced Error Recovery Service with Circuit Breakers for Database, Redis, and ML-Service. Automatic retry with exponential backoff is implemented.';
      case 'docs':
        return await this.getProjectContext(query);
      default:
        return '';
    }
  }

  private getSystemPrompt(role: string, context: string): string {
    const base = `You are Nova, the intelligent assistant for the AI Task Scheduler. 
    You are part of a Multi-Agent system inspired by NVIDIA Intelligent Warehouse blueprints. 
    ${context ? `Relevant context for your specialized role: ${context}` : ''}`;

    switch (role) {
      case 'asset':
        return `${base} You are the Asset Operations Agent. Focus on hardware utilization, latency, and resource telemetry.`;
      case 'optimization':
        return `${base} You are the Operations Coordination Agent. Focus on scheduling efficiency, algorithm convergence, and mathematical optimization.`;
      case 'health':
        return `${base} You are the Safety & Compliance Agent. Focus on system reliability, error patterns, and circuit breaker status.`;
      case 'docs':
        return `${base} You are the Knowledge Retrieval Agent. Focus on technical documentation and project requirements.`;
      default:
        return `${base} You are the General System Assistant. Provide helpful, technical guidance.`;
    }
  }

  /**
   * SDG: Synthetic Data Generation
   * Generates a realistic set of tasks based on a scenario description
   */
  async generateScenario(description: string): Promise<any[]> {
    if (!this.client) {
      return this.mockScenario(description);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI Synthetic Data Generator. Generate a JSON array of 5 task objects. Each object MUST have: { name: string, type: "COMPUTE"|"IO"|"DATA", size: number(1-100), priority: number(1-5), dataSize: number(Mb), computationIntensity: number(cycles/bit) }. Return ONLY the JSON array.' 
          },
          { role: 'user', content: `Scenario: ${description}` }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content || '[]';
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : (parsed.tasks || []);
    } catch (error) {
      logger.error('SDG Error:', error);
      return this.mockScenario(description);
    }
  }

  private async getProjectContext(query: string): Promise<string> {
    try {
      // In a real RAG, we would use embeddings. Here we do a simple file search.
      const files = ['PHASE1_REPORT.md', 'Phase2_SRS_Document.md', 'Phase3_Implementation_Validation.md'];
      let context = '';
      for (const file of files) {
        const filePath = path.join(this.docsPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8').slice(0, 1000); // Take a snippet
          context += `\n--- Context from ${file} ---\n${content}\n`;
        }
      }
      return context;
    } catch (e) {
      return '';
    }
  }

  private mockScenario(description: string): any[] {
    return [
      { name: 'Generated Task Alpha', type: 'COMPUTE', size: 85, priority: 5, dataSize: 120, computationIntensity: 25 },
      { name: 'Generated Task Beta', type: 'IO', size: 30, priority: 2, dataSize: 500, computationIntensity: 5 },
      { name: 'Generated Task Gamma', type: 'DATA', size: 50, priority: 3, dataSize: 80, computationIntensity: 15 },
    ];
  }

  /**
   * Mock response for when API key is not provided
   */
  private mockResponse(message: string): string {
    const msg = message.toLowerCase();
    if (msg.includes('status') || msg.includes('how is the system')) {
      return "Nova (Mock): The 3-layer fog architecture is stable. Node Alpha is at 85% load, while Cloud Instance Beta is idling at 20%. I recommend rebalancing if more CPU-bound tasks arrive.";
    }
    if (msg.includes('anomaly') || msg.includes('anomalies')) {
      return "Nova (Mock): I've analyzed the recent cycle. Task #427 had a execution time 300% higher than predicted. This usually indicates a bandwidth bottleneck on the Fog-to-Cloud link.";
    }
    return "Nova (Mock): I'm currently running in simulation mode because my NVIDIA API key is not configured. However, I can still provide architectural insights based on local heuristics!";
  }
}

export const aiService = new AIService();
