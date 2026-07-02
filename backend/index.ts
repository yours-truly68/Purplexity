import express, { text } from "express";
import dotenv from "dotenv";
import { tavily } from "@tavily/core";
import { streamText, type ModelMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";
import { authMiddleware } from "./middleware";
import cors from "cors";
import { prisma } from "./db";
import { slugify, sourcesBlock } from "./utils";
import path from "path";


declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

dotenv.config();

const client = tavily({ apiKey: Bun.env.TAVILY_API_KEY });
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*", // Allows any website/domain to hit your API endpoints
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP actions
    allowedHeaders: ["Content-Type", "Authorization", "X-Conversation-Id"], // Allowed headers (including your custom stream tracker)
    exposedHeaders: ["X-Conversation-Id"], // Crucial! Tells the browser it's safe to read your custom header during streams
  })
);
app.use(express.urlencoded());

const PORT = Bun.env.PORT ?? 3001;

app.get("/conversations", authMiddleware, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.userId },
    select: { id: true, title: true, slug: true },
  });
  res.json({
    conversations,
  });
});

app.get("/conversations/:conversationId", authMiddleware, async (req, res) => {
  const conversationId = req.params.conversationId;
  if (typeof conversationId !== "string") {
    return res.status(400).json({
      message: "Invalid conversation Id",
    });
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId: req.userId,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return res.status(404).json({
      message: "Conversation not found",
    });
  }
  res.json({ conversation });
});

app.post("/purplexity_ask", authMiddleware, async (req, res) => {
  // Step 1:get the user's message from the request body
  const query = req.body.query;
  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      message: "Missing Query",
    });
  }

  //make sure they have enough credits

  //check if we have similar web search indexed in the database

  //if we dont, we need to do a web search and index the results
  const webSearchResponse = client.search(query, {
    searchDepth: "advanced",
  });

  const webSearchResults = (await webSearchResponse).results;

  //Create the conversation with the user message upfront so the client can associate the stream with a persistent conversationId
  const conversation = await prisma.conversation.create({
    data: {
      title: query.slice(0, 80),
      slug: slugify(query),
      userId: req.userId,
      messages: {
        create: {
          content: query,
          role: "User",
        },
      },
    },
  });

  //do some context engineering on the prompt + web search responses

  //hit the LLM to stream the response

  const PROMPT = PROMPT_TEMPLATE.replace(
    "{{WEB_SEARCH_RESULTS}}",
    JSON.stringify(webSearchResults),
  ).replace("{{USER_QUERY}}", query);

  const result = streamText({
    model: groq("qwen/qwen3.6-27b"),
    prompt: PROMPT,
    system: SYSTEM_PROMPT,
  });

  res.header("Cache-Control", "no-cache");
  res.header("Content-Type", "text/event-stream");
  res.header("X-Conversation-Id", conversation.id);

  const sources = sourcesBlock(webSearchResults);
  res.write(sources);

  let assistantText = "";
  for await (const textPart of result.textStream) {
    assistantText += textPart;
    res.write(textPart);
  }

  //Close Event Stream
  res.end();

  //Persist the full assistant reply
  await prisma.message.create({
    data: {
      content: sources + assistantText,
      role: "Assistant",
      conversationId: conversation.id,
    },
  });

  //update the user's credits

  //return the response to the user

  //log the conversation for analytics

  //return the response to the user

  //log the conversation for analytics

  //update the user's credits

  //return the response to the user
});

//follow up questions
app.post("/purplexity_ask/follow_up", authMiddleware, async (req, res) => {
  const query = req.body.query;
  const conversationId = req.body.conversationId;

  if (
    typeof query !== "string" ||
    !query.trim() ||
    typeof conversationId !== "string"
  ) {
    return res.status(400).json({
      messages: "Invalid query or conversation id",
    });
  }
  //Step 1: get the existing chat from db scoped to the user
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId: req.userId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!conversation) {
    return res.status(404).json({
      message: "Conversation Not Found",
    });
  }
  //Fresh websearch for followup query
  const webSearchResponse = await client.search(query, {
    searchDepth: "advanced",
  });
  const webSearchResults = webSearchResponse.results;

  await prisma.message.create({
    data: {
      content: query,
      role: "User",
      conversationId: conversation.id,
    },
  });

  //Step 2: Forward the full chat history to LLM

  const history: ModelMessage[] = conversation.messages.map((m) => ({
    role: m.role === "User" ? "user" : "assistant",
    content: m.content,
  }));

  const currentPrompt = PROMPT_TEMPLATE.replace(
    "{{WEB_SEARCH_RESULTS}}",
    JSON.stringify(webSearchResults),
  ).replace("{{USER_QUERY}}", query);

  const result = streamText({
    model: groq("qwen/qwen3.6-27b"),
    system: SYSTEM_PROMPT,
    messages: [...history, { role: "user", content: currentPrompt }],
  });

  res.header("Cache-Control", "no-cache");
  res.header("Content-Type", "text/event-stream");
  res.header("X-Conversation-Id", conversation.id);
  //Step 2.5: Do some context engineering
  //Step 3: Stream the response to the user

  const sources = sourcesBlock(webSearchResults);
  res.write(sources);

  let assistantText = "";
  for await (const textPart of result.textStream) {
    assistantText += textPart;
    res.write(textPart);
  }

  res.end();

  await prisma.message.create({
    data: {
      content: sources + assistantText,
      role: "Assistant",
      conversationId: conversation.id,
    },
  });
});

// 1. Serve the static assets from the React build directory
app.use(express.static(path.join(__dirname, "../dist")));

// 2. Handle React Routing (SPA)
// If a request doesn't match any API endpoints, send back index.html so React Router takes over
// ✅ Express v5 compliant named wildcard syntax
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
