const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  const data: ClaudeResponse = await response.json();
  return data.content[0]?.text || '';
}

// Grocery-specific prompts and parsing
export const groceryPrompts = {
  suggestRecipes: (pantryItems: string[]) => `You are a helpful cooking assistant. The user has these ingredients available:
${pantryItems.join(', ')}

Suggest 3-4 realistic recipes they can make with these ingredients. For each recipe, list:
1. Recipe name
2. Ingredients they have
3. Ingredients they're missing (if any)
4. Brief cooking time estimate

Respond in this exact JSON format:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "ingredients": ["ingredient1", "ingredient2"],
      "missingIngredients": ["missing1"],
      "cookTime": "30 mins"
    }
  ]
}

Only respond with the JSON, no other text.`,

  createShoppingList: (recipe: string, missingIngredients: string[]) => `The user wants to make "${recipe}" and is missing these ingredients:
${missingIngredients.join(', ')}

Create a shopping list with quantities. Also suggest any complementary items they might want.

Respond in this exact JSON format:
{
  "shoppingList": [
    { "name": "ingredient", "quantity": "amount", "category": "produce/dairy/meat/pantry/other" }
  ],
  "suggestions": ["optional item 1", "optional item 2"]
}

Only respond with the JSON, no other text.`,

  parseIngredients: (userInput: string) => `The user listed these items they have at home:
"${userInput}"

Parse this into a clean list of individual ingredients. Normalize the names (e.g., "tomatos" -> "tomatoes").

Respond in this exact JSON format:
{
  "ingredients": ["ingredient1", "ingredient2", "ingredient3"]
}

Only respond with the JSON, no other text.`,
};

export function parseJsonResponse<T>(response: string): T | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch {
    console.error('Failed to parse JSON response:', response);
    return null;
  }
}
