import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Get current time (LLMs don't know this)
export const timeTool = new DynamicStructuredTool({
  name: "get_current_time",
  description: "Returns the current date and time.",
  schema: z.object({}),
  func: async () => new Date().toISOString(),
});

// Example Tool: You can add a Supabase lookup tool here later
export const tools = [timeTool];

// Create a map of tools by name for easy lookup
export const toolsByName: Record<string, DynamicStructuredTool> = {
  get_current_time: timeTool,
};