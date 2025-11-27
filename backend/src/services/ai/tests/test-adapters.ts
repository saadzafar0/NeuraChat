import dotenv from 'dotenv';
import { AIService } from '../AIService';

// 1. Load Environment Variables (Crucial!)
dotenv.config();

async function testAI() {
  console.log('------------------------------------------------');
  console.log(`🧪 Testing AI Service with Provider: ${process.env.AI_PROVIDER?.toUpperCase()}`);
  console.log('------------------------------------------------');

  const aiService = new AIService();

  try {
    // --- Test 1: Grammar Correction ---
    console.log('\n[1] Testing Grammar Correction...');
    const badGrammar = "Me want go store now.";
    const grammarResult = await aiService.correctGrammar(badGrammar);
    console.log(`   Input: "${badGrammar}"`);
    console.log(`   Output: "${grammarResult.text}"`);

    // --- Test 2: Summarization ---
    console.log('\n[2] Testing Summarization...');
    const longText = "NeuraChat is a new application that uses AI to help people communicate better. It has features like grammar correction and summarization. The team is working very hard to implement WebRTC for video calls as well.";
    const summaryResult = await aiService.summarizeMessage(longText);
    console.log(`   Input Length: ${longText.length} chars`);
    console.log(`   Summary: "${summaryResult.text}"`);

    // --- Test 3: AI Agent Chat ---
    console.log('\n[3] Testing AI Agent Chat...');
    // Simulate a short history
    const history = [
      { role: 'user', content: 'Hi, I am Anees.' },
      { role: 'model', content: 'Hello Anees! How can I help you with NeuraChat today?' }
    ];
    const newQuery = "What is my name?";
    const chatResult = await aiService.agentChat(history, newQuery);
    console.log(`   Query: "${newQuery}"`);
    console.log(`   Response: "${chatResult.text}"`);

  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error('Error Message:', error.message);
    console.error('Check your .env keys and internet connection.');
  }

  console.log('\n[4] Testing Enhancement...');
    const messyText = "hey i think maybe we should prolly delay the meetin cuz im busy";
    const enhanced = await aiService.enhanceMessage(messyText);
    console.log(`   Input: "${messyText}"`);
    console.log(`   Enhanced: "${enhanced.text}"`);

    // --- Test 5: Expand (Drafting) ---
    console.log('\n[5] Testing Expansion...');
    const seed = "Project delayed. Supply chain issues.";
    const expanded = await aiService.expandMessage(seed);
    console.log(`   Seed: "${seed}"`);
    console.log(`   Expanded: "${expanded.text}"`);

    // --- Test 6: Tone Change (Empathetic) ---
    console.log('\n[6] Testing Tone (Empathetic)...');
    const bluntText = "You missed the deadline. Fix it.";
    const kindText = await aiService.changeTone(bluntText, 'empathetic');
    console.log(`   Original: "${bluntText}"`);
    console.log(`   Empathetic: "${kindText.text}"`);

    // --- Test 7: Translation ---
    console.log('\n[7] Testing Translation...');
    const englishText = "Hello, welcome to NeuraChat.";
    const spanish = await aiService.translateMessage(englishText, "Spanish");
    const urdu = await aiService.translateMessage(englishText, "Urdu");
    console.log(`   Original: "${englishText}"`);
    console.log(`   Spanish: "${spanish.text}"`);
    console.log(`   Urdu: "${urdu.text}"`);
}

testAI();