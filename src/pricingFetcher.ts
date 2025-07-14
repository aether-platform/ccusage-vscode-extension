/**
 * Model pricing data fetcher inspired by ccusage
 * Fetches latest pricing from LiteLLM's database
 */

interface ModelPricing {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
}

export class PricingFetcher {
  private static instance: PricingFetcher;
  private cachedPricing: Map<string, ModelPricing> | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

  private constructor() {}

  static getInstance(): PricingFetcher {
    if (!PricingFetcher.instance) {
      PricingFetcher.instance = new PricingFetcher();
    }
    return PricingFetcher.instance;
  }

  async fetchPricing(): Promise<Map<string, ModelPricing>> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cachedPricing && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return this.cachedPricing;
    }

    try {
      console.log('[PricingFetcher] Fetching latest model pricing from LiteLLM...');
      const response = await fetch(this.LITELLM_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pricing: ${response.statusText}`);
      }

      const data = await response.json();
      this.cachedPricing = new Map();
      
      // Convert LiteLLM format to our format
      for (const [modelName, modelData] of Object.entries(data)) {
        if (typeof modelData === 'object' && modelData !== null) {
          const pricing = modelData as any;
          this.cachedPricing.set(modelName, {
            input_cost_per_token: pricing.input_cost_per_token,
            output_cost_per_token: pricing.output_cost_per_token,
            cache_creation_input_token_cost: pricing.cache_creation_input_token_cost,
            cache_read_input_token_cost: pricing.cache_read_input_token_cost
          });
        }
      }
      
      this.lastFetchTime = now;
      console.log(`[PricingFetcher] Loaded pricing for ${this.cachedPricing.size} models`);
      
      return this.cachedPricing;
    } catch (error) {
      console.error('[PricingFetcher] Failed to fetch pricing:', error);
      
      // Return fallback pricing if fetch fails
      return this.getFallbackPricing();
    }
  }

  private getFallbackPricing(): Map<string, ModelPricing> {
    // Fallback pricing data (same as our current hardcoded values)
    const fallback = new Map<string, ModelPricing>();
    
    // Claude 3.5 Sonnet
    fallback.set('claude-3-5-sonnet-20241022', {
      input_cost_per_token: 3.0 / 1_000_000,
      output_cost_per_token: 15.0 / 1_000_000,
      cache_creation_input_token_cost: 3.75 / 1_000_000,
      cache_read_input_token_cost: 0.30 / 1_000_000
    });
    
    // Claude 3 Opus
    fallback.set('claude-3-opus-20240229', {
      input_cost_per_token: 15.0 / 1_000_000,
      output_cost_per_token: 75.0 / 1_000_000,
      cache_creation_input_token_cost: 18.75 / 1_000_000,
      cache_read_input_token_cost: 1.50 / 1_000_000
    });
    
    // Claude 3 Haiku
    fallback.set('claude-3-haiku-20240307', {
      input_cost_per_token: 0.25 / 1_000_000,
      output_cost_per_token: 1.25 / 1_000_000,
      cache_creation_input_token_cost: 0.30 / 1_000_000,
      cache_read_input_token_cost: 0.03 / 1_000_000
    });
    
    // Claude 4 models
    fallback.set('claude-opus-4-20250514', {
      input_cost_per_token: 15.0 / 1_000_000,
      output_cost_per_token: 75.0 / 1_000_000,
      cache_creation_input_token_cost: 18.75 / 1_000_000,
      cache_read_input_token_cost: 1.50 / 1_000_000
    });
    
    fallback.set('claude-sonnet-4-20250514', {
      input_cost_per_token: 3.0 / 1_000_000,
      output_cost_per_token: 15.0 / 1_000_000,
      cache_creation_input_token_cost: 3.75 / 1_000_000,
      cache_read_input_token_cost: 0.30 / 1_000_000
    });
    
    fallback.set('claude-haiku-4-20250514', {
      input_cost_per_token: 0.25 / 1_000_000,
      output_cost_per_token: 1.25 / 1_000_000,
      cache_creation_input_token_cost: 0.30 / 1_000_000,
      cache_read_input_token_cost: 0.03 / 1_000_000
    });
    
    console.log('[PricingFetcher] Using fallback pricing data');
    return fallback;
  }

  clearCache(): void {
    this.cachedPricing = null;
    this.lastFetchTime = 0;
  }
}