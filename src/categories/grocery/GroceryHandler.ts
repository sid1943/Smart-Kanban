import { ConversationState, GroceryItem, Recipe } from '../../types';
import { callClaude, groceryPrompts, parseJsonResponse } from '../../services/claude';

export type GroceryStep = 
  | 'initial'
  | 'awaiting_pantry'
  | 'showing_recipes'
  | 'recipe_selected'
  | 'showing_list'
  | 'complete';

export interface GroceryData {
  pantryItems?: string[];
  recipes?: Recipe[];
  selectedRecipe?: Recipe;
  shoppingList?: GroceryItem[];
}

export interface GroceryState extends ConversationState<GroceryStep, GroceryData> {}

export interface GroceryResponse {
  message: string;
  newState: GroceryState;
  recipes?: Recipe[];
  shoppingList?: GroceryItem[];
}

export async function handleGroceryMessage(
  userMessage: string,
  currentState: GroceryState | null,
  apiKey: string
): Promise<GroceryResponse> {
  const state = currentState || {
    category: 'grocery' as const,
    step: 'initial' as GroceryStep,
    data: {},
  };

  switch (state.step) {
    case 'initial':
      return {
        message: "Let's help you with groceries! 🥬\n\nWhat ingredients do you currently have at home? Just list them out naturally, like:\n\n*\"eggs, rice, onions, tomatoes, chicken, soy sauce\"*",
        newState: {
          ...state,
          step: 'awaiting_pantry',
        },
      };

    case 'awaiting_pantry':
      return await processPantryInput(userMessage, state, apiKey);

    case 'showing_recipes':
      return await processRecipeSelection(userMessage, state, apiKey);

    case 'recipe_selected':
      return processListConfirmation(userMessage, state);

    case 'showing_list':
      return processListAction(userMessage, state);

    default:
      return {
        message: "I'm not sure where we were. Let's start fresh! What ingredients do you have at home?",
        newState: {
          category: 'grocery',
          step: 'awaiting_pantry',
          data: {},
        },
      };
  }
}

async function processPantryInput(
  userMessage: string,
  state: GroceryState,
  apiKey: string
): Promise<GroceryResponse> {
  try {
    // Parse the user's ingredients
    const parseResponse = await callClaude(
      apiKey,
      groceryPrompts.parseIngredients(userMessage),
      [{ role: 'user', content: userMessage }]
    );

    const parsed = parseJsonResponse<{ ingredients: string[] }>(parseResponse);
    const pantryItems = parsed?.ingredients || userMessage.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

    // Get recipe suggestions
    const recipeResponse = await callClaude(
      apiKey,
      groceryPrompts.suggestRecipes(pantryItems),
      [{ role: 'user', content: `I have: ${pantryItems.join(', ')}` }]
    );

    const recipeParsed = parseJsonResponse<{ recipes: Recipe[] }>(recipeResponse);
    const recipes = recipeParsed?.recipes?.map((r, i) => ({
      ...r,
      id: `recipe-${i}`,
    })) || [];

    if (recipes.length === 0) {
      return {
        message: "I couldn't generate recipes from those ingredients. Could you try listing them again?",
        newState: state,
      };
    }

    let message = `Great! With **${pantryItems.join(', ')}**, here's what you can make:\n\n`;
    
    recipes.forEach((recipe, index) => {
      message += `**${index + 1}. ${recipe.name}** ⏱️ ${recipe.cookTime || '30 mins'}\n`;
      if (recipe.missingIngredients && recipe.missingIngredients.length > 0) {
        message += `   Missing: ${recipe.missingIngredients.join(', ')}\n`;
      } else {
        message += `   ✅ You have everything!\n`;
      }
      message += '\n';
    });

    message += '\nWhich recipe would you like to make? Just say the number or name.';

    return {
      message,
      newState: {
        ...state,
        step: 'showing_recipes',
        data: {
          ...state.data,
          pantryItems,
          recipes,
        },
      },
      recipes,
    };
  } catch (error) {
    console.error('Error processing pantry input:', error);
    return {
      message: "Sorry, I had trouble processing that. Could you list your ingredients again?",
      newState: state,
    };
  }
}

async function processRecipeSelection(
  userMessage: string,
  state: GroceryState,
  apiKey: string
): Promise<GroceryResponse> {
  const recipes = state.data.recipes || [];
  const input = userMessage.toLowerCase().trim();

  // Find selected recipe by number or name
  let selectedRecipe: Recipe | undefined;

  // Check for number
  const numMatch = input.match(/^(\d+)/);
  if (numMatch) {
    const index = parseInt(numMatch[1]) - 1;
    if (index >= 0 && index < recipes.length) {
      selectedRecipe = recipes[index];
    }
  }

  // Check for name match
  if (!selectedRecipe) {
    selectedRecipe = recipes.find(r => 
      input.includes(r.name.toLowerCase()) ||
      r.name.toLowerCase().includes(input)
    );
  }

  if (!selectedRecipe) {
    return {
      message: `I couldn't find that recipe. Please choose from:\n${recipes.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}`,
      newState: state,
    };
  }

  // Check if they need a shopping list
  const missingIngredients = selectedRecipe.missingIngredients || [];

  if (missingIngredients.length === 0) {
    return {
      message: `Excellent choice! **${selectedRecipe.name}** it is! 🎉\n\nYou have all the ingredients you need. Would you like me to:\n\n1. Show you the recipe steps\n2. Start a new grocery planning session\n3. Save this meal to your week plan`,
      newState: {
        ...state,
        step: 'complete',
        data: {
          ...state.data,
          selectedRecipe,
        },
      },
    };
  }

  // Generate shopping list
  try {
    const listResponse = await callClaude(
      apiKey,
      groceryPrompts.createShoppingList(selectedRecipe.name, missingIngredients),
      [{ role: 'user', content: `I want to make ${selectedRecipe.name}` }]
    );

    const listParsed = parseJsonResponse<{
      shoppingList: Array<{ name: string; quantity: string; category: string }>;
      suggestions: string[];
    }>(listResponse);

    const shoppingList: GroceryItem[] = (listParsed?.shoppingList || missingIngredients.map(name => ({
      name,
      quantity: '',
      category: 'other',
    }))).map((item, i) => ({
      id: `item-${i}`,
      name: item.name,
      quantity: item.quantity,
      checked: false,
      category: item.category,
    }));

    let message = `Great choice! **${selectedRecipe.name}** 🍳\n\n`;
    message += `Here's your shopping list:\n\n`;
    
    shoppingList.forEach(item => {
      message += `• ${item.quantity ? `${item.quantity} ` : ''}${item.name}\n`;
    });

    if (listParsed?.suggestions && listParsed.suggestions.length > 0) {
      message += `\n💡 You might also want: ${listParsed.suggestions.join(', ')}\n`;
    }

    message += `\nShould I save this shopping list? You can also add more items.`;

    return {
      message,
      newState: {
        ...state,
        step: 'recipe_selected',
        data: {
          ...state.data,
          selectedRecipe,
          shoppingList,
        },
      },
      shoppingList,
    };
  } catch (error) {
    console.error('Error creating shopping list:', error);
    
    // Fallback shopping list
    const shoppingList: GroceryItem[] = missingIngredients.map((name, i) => ({
      id: `item-${i}`,
      name,
      quantity: '',
      checked: false,
    }));

    return {
      message: `Great choice! **${selectedRecipe.name}** 🍳\n\nYou'll need to get:\n${missingIngredients.map(i => `• ${i}`).join('\n')}\n\nShould I save this shopping list?`,
      newState: {
        ...state,
        step: 'recipe_selected',
        data: {
          ...state.data,
          selectedRecipe,
          shoppingList,
        },
      },
      shoppingList,
    };
  }
}

function processListConfirmation(
  userMessage: string,
  state: GroceryState
): GroceryResponse {
  const input = userMessage.toLowerCase();
  const isYes = input.includes('yes') || input.includes('save') || input.includes('ok') || input.includes('sure');

  if (isYes) {
    return {
      message: `✅ Shopping list saved!\n\nYour list for **${state.data.selectedRecipe?.name}** is ready in the sidebar. Check off items as you shop!\n\nWhat else can I help you with?\n• Plan another meal\n• Add more items to the list\n• Start fresh with new ingredients`,
      newState: {
        ...state,
        step: 'complete',
      },
      shoppingList: state.data.shoppingList,
    };
  }

  return {
    message: "No problem! Would you like to:\n1. Choose a different recipe\n2. Add more items to this list\n3. Start over with different ingredients",
    newState: {
      ...state,
      step: 'showing_recipes',
    },
  };
}

function processListAction(
  _userMessage: string,
  state: GroceryState
): GroceryResponse {
  // Handle ongoing list management
  return {
    message: "Your shopping list is saved! Is there anything else you'd like to add or plan?",
    newState: {
      ...state,
      step: 'complete',
    },
  };
}

export function getInitialGroceryState(): GroceryState {
  return {
    category: 'grocery',
    step: 'initial',
    data: {},
  };
}
