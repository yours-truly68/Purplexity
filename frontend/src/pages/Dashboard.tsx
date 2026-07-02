import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import {
  Search,
  MessageSquare,
  Sparkles,
  Layers,
  Compass,
  TrendingUp,
  Heart,
  BookOpen,
  FileText,
  LogOut,
  ChevronDown,
  Plus,
  Send,
  Loader2,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  Cpu,
  Monitor,
  FolderClosed,
  Settings2,
  Database,
  Volume2,
  Mic,
  ArrowRight,
  Clock,
} from "lucide-react";

const supabase = createClient();

interface ChatMessage {
  role: "User" | "Assistant";
  content: string;
  answer?: string;
  followUps?: string[];
  sources?: { url: string }[];
}

interface Conversation {
  id: string;
  title: string;
  slug: string;
}

// ----------------------------------------
// Stream Parsing Helper
// ----------------------------------------
interface ParsedStream {
  answer: string;
  followUps: string[];
  sources: { url: string }[];
}

// Prevents partial tags (e.g. "<ANS", "</FOLLOW") from displaying in UI during stream
function stripPartialTags(val: string): string {
  const partials = [
    "<ANSWER>", "</ANSWER>",
    "<FOLLOW_UPS>", "</FOLLOW_UPS>",
    "<SOURCES>", "</SOURCES>",
    "<think>", "</think>",
    "<question>", "</question>"
  ];
  
  const lastOpenBracket = val.lastIndexOf("<");
  if (lastOpenBracket !== -1) {
    const suffix = val.slice(lastOpenBracket);
    const isPrefix = partials.some(tag => tag.startsWith(suffix));
    if (isPrefix) {
      return val.slice(0, lastOpenBracket);
    }
  }
  return val;
}

function parseStreamContent(text: string): ParsedStream {
  let answer = "";
  const followUps: string[] = [];
  let sources: { url: string }[] = [];

  // 1. Extract Sources
  const sourcesStart = text.indexOf("<SOURCES>");
  if (sourcesStart !== -1) {
    const sourcesEnd = text.indexOf("</SOURCES>");
    const sourcesBlockText =
      sourcesEnd !== -1
        ? text.slice(sourcesStart + 9, sourcesEnd)
        : text.slice(sourcesStart + 9);

    try {
      const trimmed = sourcesBlockText.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        sources = JSON.parse(trimmed);
      }
    } catch (e) {
      // JSON incomplete
    }
  }

  // 2. Extract Follow Ups
  const followUpsStart = text.indexOf("<FOLLOW_UPS>");
  if (followUpsStart !== -1) {
    const followUpsEnd = text.indexOf("</FOLLOW_UPS>");
    const followUpsBlock =
      followUpsEnd !== -1
        ? text.slice(followUpsStart + 12, followUpsEnd)
        : text.slice(followUpsStart + 12);

    const questionRegex = /<question>([\s\S]*?)<\/question>/g;
    let match;
    while ((match = questionRegex.exec(followUpsBlock)) !== null) {
      if (match[1].trim()) {
        followUps.push(match[1].trim());
      }
    }
  }

  // 3. Extract Answer and Clean Tags
  let cleanText = text;

  // Strip <SOURCES>...</SOURCES> block
  const sStart = cleanText.indexOf("<SOURCES>");
  if (sStart !== -1) {
    const sEnd = cleanText.indexOf("</SOURCES>");
    if (sEnd !== -1) {
      cleanText = cleanText.slice(0, sStart) + cleanText.slice(sEnd + 10);
    } else {
      cleanText = cleanText.slice(0, sStart);
    }
  }

  // Strip <FOLLOW_UPS>...</FOLLOW_UPS> block
  const fStart = cleanText.indexOf("<FOLLOW_UPS>");
  if (fStart !== -1) {
    const fEnd = cleanText.indexOf("</FOLLOW_UPS>");
    if (fEnd !== -1) {
      cleanText = cleanText.slice(0, fStart) + cleanText.slice(fEnd + 13);
    } else {
      cleanText = cleanText.slice(0, fStart);
    }
  }

  // Strip <think>...</think> reasoning blocks
  const tStart = cleanText.indexOf("<think>");
  if (tStart !== -1) {
    const tEnd = cleanText.indexOf("</think>");
    if (tEnd !== -1) {
      cleanText = cleanText.slice(0, tStart) + cleanText.slice(tEnd + 8);
    } else {
      cleanText = cleanText.slice(0, tStart);
    }
  }

  // Extract from <ANSWER>...</ANSWER>
  const answerStart = cleanText.indexOf("<ANSWER>");
  if (answerStart !== -1) {
    const answerEnd = cleanText.indexOf("</ANSWER>");
    answer = answerEnd !== -1
      ? cleanText.slice(answerStart + 8, answerEnd)
      : cleanText.slice(answerStart + 8);
  } else {
    // If no tags present at all, treat the cleanText as answer
    answer = cleanText;
  }

  // Remove any remaining stray tags
  answer = answer.replace(/<\/?ANSWER>/g, "");
  answer = answer.replace(/<\/?FOLLOW_UPS>/g, "");
  answer = answer.replace(/<\/?SOURCES>/g, "");
  answer = answer.replace(/<\/?think>/g, "");
  answer = answer.replace(/<\/?question>/g, "");

  // Prevent partial tags from rendering
  answer = stripPartialTags(answer);

  return { answer: answer.trim(), followUps, sources };
}

// ----------------------------------------
// Domain extraction helper
// ----------------------------------------
function getDomain(url: string) {
  try {
    const domain = new URL(url).hostname;
    return domain.startsWith("www.") ? domain.slice(4) : domain;
  } catch (e) {
    return url;
  }
}

// ----------------------------------------
// Code Block with Copy & IFrame Preview
// ----------------------------------------
const CodeBlock = ({ code, language }: { code: string; language: string }) => {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const isHtml =
    language === "html" ||
    language === "svg" ||
    code.trim().startsWith("<!DOCTYPE html>") ||
    (code.trim().startsWith("<html") && code.trim().endsWith("</html>"));

  return (
    <div className="my-4 border border-white/5 rounded-xl bg-black/30 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/5 text-xs text-gray-400 font-semibold select-none">
        <div className="flex items-center space-x-3">
          <span className="uppercase text-teal-400 font-mono tracking-wider">{language || "code"}</span>
          {isHtml && (
            <div className="flex bg-[#1E1E20] rounded-lg p-0.5 border border-white/5">
              <button
                onClick={() => setActiveTab("code")}
                className={`px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  activeTab === "code" ? "bg-teal-500 text-black shadow-sm" : "hover:text-white"
                }`}
              >
                Code
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  activeTab === "preview" ? "bg-teal-500 text-black shadow-sm" : "hover:text-white"
                }`}
              >
                Preview
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md"
        >
          {copied ? (
            <span className="text-teal-400">Copied!</span>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {activeTab === "preview" && isHtml ? (
        <div className="p-2 bg-white rounded-b-xl h-80">
          <iframe
            srcDoc={code}
            title="Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-0 bg-white"
          />
        </div>
      ) : (
        <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed max-h-[400px]">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

// ----------------------------------------
// Copy Answer Button Component
// ----------------------------------------
const CopyAnswerButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy answer:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-white bg-transparent hover:bg-white/5 border border-white/5 rounded-lg transition-all cursor-pointer select-none"
    >
      {copied ? (
        <>
          <span className="text-teal-400">Copied to clipboard!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>Copy Answer</span>
        </>
      )}
    </button>
  );
};

// ----------------------------------------
// Custom Markdown Renderer Component
// ----------------------------------------
const Markdown = ({ text }: { text: string }) => {
  if (!text) return null;

  const lines = text.split("\n");
  let inCodeBlock = false;
  let blockLanguage = "";
  let codeContent: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    // Code block detection
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        const currentLang = blockLanguage;
        const currentContent = codeContent.join("\n");
        renderedElements.push(
          <CodeBlock
            key={`code-${index}`}
            code={currentContent}
            language={currentLang}
          />
        );
        codeContent = [];
        blockLanguage = "";
      } else {
        inCodeBlock = true;
        blockLanguage = line.trim().slice(3).trim().toLowerCase();
      }
      return;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return;
    }

    // Headings
    if (line.startsWith("### ")) {
      renderedElements.push(
        <h3 key={index} className="text-md font-bold text-white mt-4 mb-2">
          {formatInline(line.slice(4))}
        </h3>
      );
      return;
    }
    if (line.startsWith("## ")) {
      renderedElements.push(
        <h2 key={index} className="text-lg font-bold text-white mt-5 mb-2.5 border-b border-white/5 pb-1">
          {formatInline(line.slice(3))}
        </h2>
      );
      return;
    }
    if (line.startsWith("# ")) {
      renderedElements.push(
        <h1 key={index} className="text-xl font-extrabold text-white mt-6 mb-3">
          {formatInline(line.slice(2))}
        </h1>
      );
      return;
    }

    // Bullet Lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const cleanLine = line.trim().slice(2);
      renderedElements.push(
        <ul key={index} className="list-disc pl-5 my-1.5 text-gray-300 text-sm">
          <li>{formatInline(cleanLine)}</li>
        </ul>
      );
      return;
    }

    // Numbered Lists
    const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      renderedElements.push(
        <ol key={index} className="list-decimal pl-5 my-1.5 text-gray-300 text-sm">
          <li value={parseInt(numberedMatch[1])}>{formatInline(numberedMatch[2])}</li>
        </ol>
      );
      return;
    }

    // Paragraph
    if (line.trim()) {
      renderedElements.push(
        <p key={index} className="my-2.5 text-gray-300 text-[14.5px] leading-relaxed">
          {formatInline(line)}
        </p>
      );
    }
  });

  return <div className="space-y-1">{renderedElements}</div>;
};

// Formatting bold, inline code, and links
function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  let match;
  let lastIndex = 0;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    if (matchText.startsWith("**") && matchText.endsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {matchText.slice(2, -2)}
        </strong>
      );
    } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-teal-300 font-mono text-[13px]"
        >
          {matchText.slice(1, -1)}
        </code>
      );
    } else if (matchText.startsWith("[")) {
      const linkMatch = matchText.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(matchText);
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ----------------------------------------
// Main Dashboard Component
// ----------------------------------------
const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Thread and Conversations lists
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchPhase, setSearchPhase] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedFocus, setSelectedFocus] = useState("All");
  const [selectedModel, setSelectedModel] = useState("Qwen 2.5 (High)");
  const [isComputerEnabled, setIsComputerEnabled] = useState(false);

  // Dropdown states
  const [showFocusDropdown, setShowFocusDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Thread scroll reference
  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        setAuthLoading(false);
      } else {
        navigate("/auth");
      }
    }
    checkAuth();
  }, [navigate]);

  // Fetch conversation history
  const getExistingConversations = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) return;

      const response = await axios.get(`${BACKEND_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (response.data && response.data.conversations) {
        setConversations(response.data.conversations);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  useEffect(() => {
    if (user) {
      getExistingConversations();
    }
  }, [user]);

  // Scroll to bottom on new messages or streaming
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSearching]);

  // Auto-resize search input textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  // Load a conversation details
  const loadConversation = async (conversationId: string) => {
    if (!user) return;
    try {
      setActiveConversationId(conversationId);
      setIsSearching(false);
      setSearchPhase("");

      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) return;

      const response = await axios.get(`${BACKEND_URL}/conversations/${conversationId}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (response.data && response.data.conversation) {
        const fetchedMessages = response.data.conversation.messages || [];
        const parsed = fetchedMessages.map((m: any) => {
          if (m.role === "User") {
            return { role: "User" as const, content: m.content };
          } else {
            const parsedStream = parseStreamContent(m.content);
            return {
              role: "Assistant" as const,
              content: m.content,
              answer: parsedStream.answer,
              followUps: parsedStream.followUps,
              sources: parsedStream.sources,
            };
          }
        });
        setMessages(parsed);
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
    }
  };

  // Submit search query
  const handleSearchSubmit = async (searchQuery: string) => {
    if (!searchQuery.trim() || isSearching) return;

    setQuery("");
    setIsSearching(true);
    setSearchPhase("Searching the web...");

    const userMessage: ChatMessage = { role: "User", content: searchQuery };
    const initialAssistantMessage: ChatMessage = {
      role: "Assistant",
      content: "",
      answer: "",
      followUps: [],
      sources: [],
    };

    const isFollowUp = activeConversationId !== null;
    const updatedMessages = [...messages, userMessage, initialAssistantMessage];
    setMessages(updatedMessages);

    const assistantIndex = updatedMessages.length - 1;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error("No session found");

      const url = isFollowUp
        ? `${BACKEND_URL}/purplexity_ask/follow_up`
        : `${BACKEND_URL}/purplexity_ask`;

      const requestBody = isFollowUp
        ? { query: searchQuery, conversationId: activeConversationId }
        : { query: searchQuery };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Server returned error ${response.status}`);
      }

      if (!isFollowUp) {
        const streamConversationId = response.headers.get("X-Conversation-Id");
        if (streamConversationId) {
          setActiveConversationId(streamConversationId);
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      setSearchPhase("Analyzing search results...");

      while (!done) {
        const { value, done: doneReading } = await reader!.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          accumulatedText += chunk;

          const parsed = parseStreamContent(accumulatedText);

          // Dynamically adjust search phase
          if (accumulatedText.includes("<SOURCES>") && !accumulatedText.includes("</SOURCES>")) {
            setSearchPhase("Parsing sources...");
          } else if (accumulatedText.includes("</SOURCES>") && !parsed.answer) {
            setSearchPhase("Synthesizing answer...");
          } else {
            setSearchPhase("");
          }

          setMessages((prev) => {
            const next = [...prev];
            if (next[assistantIndex]) {
              next[assistantIndex] = {
                role: "Assistant",
                content: accumulatedText,
                answer: parsed.answer,
                followUps: parsed.followUps,
                sources: parsed.sources,
              };
            }
            return next;
          });
        }
      }

      setIsSearching(false);
      setSearchPhase("");
      getExistingConversations();
    } catch (err) {
      console.error("Search failed:", err);
      setIsSearching(false);
      setSearchPhase("");
      setMessages((prev) => {
        const next = [...prev];
        if (next[assistantIndex]) {
          next[assistantIndex] = {
            role: "Assistant",
            content: "Sorry, I encountered an error searching for this query. Please check your backend status and API keys.",
            answer: "Sorry, I encountered an error searching for this query. Please check your backend status and API keys.",
          };
        }
        return next;
      });
    }
  };

  const startNewThread = () => {
    setActiveConversationId(null);
    setMessages([]);
    setQuery("");
    setIsSearching(false);
    setSearchPhase("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/auth");
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-[#0A0A0A] text-white">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-4" />
        <span className="text-sm text-gray-400">Verifying session...</span>
      </div>
    );
  }

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <div className="flex h-screen w-screen bg-[#131314] text-[#E3E3E3] font-sans overflow-hidden">
      
      {/* ----------------------------------------
          LEFT SIDEBAR
          ---------------------------------------- */}
      <aside className="w-64 h-full bg-[#0B0B0C] border-r border-[#1E1E20] flex flex-col justify-between shrink-0 select-none">
        
        {/* Top Section */}
        <div className="flex flex-col p-4 space-y-4">
          
          {/* Logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 cursor-pointer" onClick={startNewThread}>
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 shadow-md shadow-teal-500/5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-white hover:text-gray-200 transition-colors">
                purplexity
              </span>
            </div>
            
            <button className="text-gray-500 hover:text-gray-300 p-1 rounded-md hover:bg-white/5 transition-all">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>

          {/* New Thread Pill */}
          <button
            onClick={startNewThread}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-white bg-[#1A1A1C] border border-[#252528] rounded-full hover:bg-[#252528] transition-all group shadow-sm cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <Plus className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
              <span>New Thread</span>
            </span>
            <span className="px-1.5 py-0.5 text-[9px] text-gray-500 bg-black/40 rounded border border-white/5 font-mono">
              ⌘ K
            </span>
          </button>

          {/* Navigation Options */}
          <nav className="flex flex-col space-y-1">
            <button className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <Monitor className="w-4.5 h-4.5" />
              <span>Computer</span>
            </button>
            <button className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <FolderClosed className="w-4.5 h-4.5" />
              <span>Spaces</span>
            </button>
            <button className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <Sparkles className="w-4.5 h-4.5" />
              <span>Artifacts</span>
            </button>
            <button className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
              <Settings2 className="w-4.5 h-4.5" />
              <span>Customise</span>
            </button>
          </nav>

          {/* System Sub-headers */}
          <div className="pt-2">
            <span className="px-3 text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">
              Connectors
            </span>
            <div className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors flex items-center space-x-2 cursor-pointer">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 animate-pulse" />
              <span>Default Active</span>
            </div>
          </div>
        </div>

        {/* Conversation History List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 border-t border-b border-[#1E1E20] space-y-3 custom-scrollbar">
          <div className="flex items-center space-x-1.5 text-gray-500 font-semibold px-1 text-[11px] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>History</span>
          </div>

          <div className="space-y-1">
            {conversations.length === 0 ? (
              <span className="text-xs text-gray-600 italic px-2 block">
                No recent sessions
              </span>
            ) : (
              conversations.map((convo) => {
                const isActive = convo.id === activeConversationId;
                return (
                  <button
                    key={convo.id}
                    onClick={() => loadConversation(convo.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all truncate block cursor-pointer ${
                      isActive
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {convo.title || "Untitled Search"}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* User profile & Logout footer */}
        <div className="p-4 flex flex-col space-y-3">
          
          <button className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-[#E3E3E3] hover:text-white bg-[#1F1916] border border-[#3E291F] rounded-xl hover:bg-[#2B2019] transition-all cursor-pointer">
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Upgrade Plan</span>
            </span>
          </button>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-md">
                {userInitial}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate">
                  {userDisplayName}
                </span>
                <span className="text-[10px] text-gray-500 truncate">
                  {user?.email}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ----------------------------------------
          MAIN WORKSPACE
          ---------------------------------------- */}
      <main className="flex-1 h-full flex flex-col bg-[#131314] overflow-hidden relative">
        
        {/* Top Header Category Bar */}
        <header className="h-14 border-b border-[#1E1E20] flex items-center justify-between px-6 shrink-0 z-10 bg-[#131314]/90 backdrop-blur-md">
          <div className="flex items-center space-x-5 text-sm font-medium text-gray-400">
            {["all", "finance", "health", "academic", "patents"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`hover:text-white capitalize transition-colors py-4 border-b-2 cursor-pointer ${
                  activeTab === tab ? "text-white border-teal-400" : "border-transparent"
                }`}
              >
                {tab === "all" ? "Discover" : tab}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#1E1E20] border border-[#252528] rounded-full text-xs font-semibold text-gray-400">
              <PlusCircle className="w-3.5 h-3.5 text-teal-400" />
              <span>Scheduled</span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </div>
            
            <div className="w-8 h-8 rounded-full border border-[#252528] bg-[#1E1E20] flex items-center justify-center text-gray-400 cursor-pointer hover:bg-[#252528] hover:text-white transition-all">
              <HelpCircle className="w-4.5 h-4.5" />
            </div>
          </div>
        </header>

        {/* ----------------------------------------
            CONTENT CONTAINER (Fixed Outer Pane)
            ---------------------------------------- */}
        <div className="flex-1 flex flex-col overflow-hidden items-center w-full relative">
          
          {messages.length === 0 ? (
            
            /* ========================================
               HOMEPAGE SEARCH SCREEN
               ======================================== */
            <div className="w-full max-w-2xl px-6 flex-1 flex flex-col items-center justify-center pb-20 mt-10">
              
              <h2 className="text-[44px] font-extrabold text-white tracking-tight mb-8 font-sans select-none">
                purplexity
              </h2>

              <div className="w-full bg-[#1E1E20] border border-[#2A2A2D] rounded-2xl p-4 shadow-xl focus-within:border-[#38383C] focus-within:ring-1 focus-within:ring-white/5 transition-all">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSearchSubmit(query);
                    }
                  }}
                  rows={1}
                  placeholder="Ask anything..."
                  className="w-full bg-transparent text-white border-0 outline-none text-sm placeholder-gray-500 resize-none max-h-48 py-1 focus:ring-0 leading-relaxed"
                />

                {/* Bottom Options inside home search bar */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
                  <div className="flex items-center space-x-2 relative">
                    
                    {/* Focus Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowFocusDropdown(!showFocusDropdown)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#252527] hover:bg-[#2A2A2C] border border-white/5 hover:border-white/10 rounded-full text-xs font-semibold text-gray-300 transition-all cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5 text-teal-400" />
                        <span>Focus: {selectedFocus}</span>
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                      </button>

                      {showFocusDropdown && (
                        <div className="absolute top-full left-0 mt-1.5 w-44 bg-[#252527] border border-white/5 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                          {["All", "Academic", "Writing", "YouTube", "Reddit"].map((f) => (
                            <button
                              key={f}
                              onClick={() => {
                                setSelectedFocus(f);
                                setShowFocusDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Computer Toggle */}
                    <button
                      onClick={() => setIsComputerEnabled(!isComputerEnabled)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isComputerEnabled
                          ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
                          : "bg-[#252527] hover:bg-[#2A2A2C] border-white/5 hover:border-white/10 text-gray-300"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Computer</span>
                    </button>

                    {/* Model Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#252527] hover:bg-[#2A2A2C] border border-white/5 hover:border-white/10 rounded-full text-xs font-semibold text-gray-300 transition-all cursor-pointer"
                      >
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{selectedModel}</span>
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                      </button>

                      {showModelDropdown && (
                        <div className="absolute top-full left-0 mt-1.5 w-52 bg-[#252527] border border-white/5 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                          {["Qwen 2.5 (High)", "Llama 3.3 (Fast)", "Gemini Flash", "Claude 3.5 Sonnet"].map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setSelectedModel(m);
                                setShowModelDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-300 p-2 rounded-full hover:bg-white/5 transition-all">
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleSearchSubmit(query)}
                      disabled={!query.trim() || isSearching}
                      className={`p-2 rounded-full transition-all shrink-0 cursor-pointer ${
                        query.trim()
                          ? "bg-teal-500 hover:bg-teal-400 text-black shadow-lg shadow-teal-500/10 scale-105"
                          : "bg-[#252527] text-gray-600"
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            
            /* ========================================
               ACTIVE CONVERSATION THREAD
               ======================================== */
            <div className="w-full flex-1 flex flex-col overflow-hidden">
              
              {/* Message scroll list - scrolls independently */}
              <div className="flex-1 w-full overflow-y-auto custom-scrollbar px-6 py-8">
                <div className="max-w-3xl mx-auto space-y-8">
                  {messages.map((message, index) => {
                    const isUser = message.role === "User";
                    
                    return (
                      <div key={index} className={`flex flex-col space-y-3 ${isUser ? "pb-2" : "pb-6 border-b border-white/5"}`}>
                        
                        {/* Sender header */}
                        <div className="flex items-center space-x-2">
                          {isUser ? (
                            <>
                              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                                {userInitial}
                              </div>
                              <h3 className="text-sm font-semibold text-white">
                                {message.content}
                              </h3>
                            </>
                          ) : (
                            <>
                              <div className="w-6 h-6 rounded-lg bg-teal-500 text-black font-extrabold flex items-center justify-center text-xs">
                                P
                              </div>
                              <h3 className="text-sm font-bold text-white tracking-wide">
                                purplexity
                              </h3>
                            </>
                          )}
                        </div>

                        {/* Content block */}
                        {!isUser && (
                          <div className="pl-8 space-y-4">
                            
                            {/* 1. Sources (Displays instantly when parsed from stream) */}
                            {message.sources && message.sources.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">
                                  Sources
                                </span>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {message.sources.map((src, idx) => {
                                    const domain = getDomain(src.url);
                                    const iconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
                                    
                                    return (
                                      <a
                                        key={idx}
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 p-2 bg-[#1E1E20] hover:bg-[#252528] border border-white/5 hover:border-white/10 rounded-lg text-xs transition-all text-gray-300 hover:text-white"
                                      >
                                        <span className="w-4.5 h-4.5 rounded bg-black/40 text-[10px] text-teal-400 font-extrabold flex items-center justify-center shrink-0 border border-white/5">
                                          {idx + 1}
                                        </span>
                                        <img
                                          src={iconUrl}
                                          alt=""
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                          }}
                                          className="w-3.5 h-3.5 shrink-0 object-contain"
                                        />
                                        <span className="truncate flex-1 font-medium">
                                          {domain}
                                        </span>
                                        <ExternalLink className="w-3 h-3 text-gray-600 shrink-0" />
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 2. Loading state (shown when query is sent but answer is not yet streaming) */}
                            {isSearching && index === messages.length - 1 && !message.answer && (
                              <div className="flex items-center space-x-2 py-4">
                                <div className="relative w-5 h-5">
                                  <div className="absolute inset-0 rounded-full border-2 border-teal-500/20" />
                                  <div className="absolute inset-0 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
                                </div>
                                <span className="text-xs text-teal-400 font-semibold animate-pulse">
                                  {searchPhase || "Synthesizing response..."}
                                </span>
                              </div>
                            )}

                            {/* 3. Streamed Answer Content */}
                            {message.answer && (
                              <div className="space-y-3">
                                <div className="text-gray-300 prose prose-invert max-w-none">
                                  <Markdown text={message.answer} />
                                  
                                  {isSearching && index === messages.length - 1 && (
                                    <span className="inline-block w-1.5 h-4 ml-1 bg-teal-400 animate-pulse align-middle animate-[pulse_1s_infinite]" />
                                  )}
                                </div>
                                
                                {!isSearching && (
                                  <div className="flex items-center space-x-2 pt-2 border-t border-white/5">
                                    <CopyAnswerButton text={message.answer} />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 4. Follow-up Clickable Questions */}
                            {message.followUps && message.followUps.length > 0 && !isSearching && (
                              <div className="pt-4 space-y-2">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">
                                  Related
                                </span>
                                <div className="flex flex-col space-y-1.5">
                                  {message.followUps.map((q, qIdx) => (
                                    <button
                                      key={qIdx}
                                      onClick={() => handleSearchSubmit(q)}
                                      className="w-full text-left px-3.5 py-2.5 bg-transparent hover:bg-white/5 border border-white/5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white flex items-center justify-between transition-all group cursor-pointer"
                                    >
                                      <span>{q}</span>
                                      <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:text-teal-400 group-hover:scale-110 transition-all shrink-0 ml-3" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>
              </div>

              {/* Fixed Bottom Input Pane (Does NOT scroll) */}
              <div className="w-full shrink-0 border-t border-[#1E1E20] bg-[#131314] py-4">
                <div className="max-w-3xl mx-auto px-6">
                  <div className="w-full bg-[#1E1E20] border border-[#2A2A2D] rounded-xl p-3 shadow-lg flex items-center focus-within:border-[#38383C] transition-all">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && query.trim()) {
                          handleSearchSubmit(query);
                        }
                      }}
                      disabled={isSearching}
                      placeholder="Ask a follow-up..."
                      className="flex-1 bg-transparent text-white border-0 outline-none text-xs placeholder-gray-500 py-1 focus:ring-0"
                    />

                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      <button className="text-gray-500 hover:text-gray-300 p-1.5 rounded-full hover:bg-white/5 transition-all">
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                      
                      <button
                        onClick={() => handleSearchSubmit(query)}
                        disabled={!query.trim() || isSearching}
                        className={`p-1.5 rounded-full transition-all cursor-pointer ${
                          query.trim() && !isSearching
                            ? "bg-teal-500 hover:bg-teal-400 text-black shadow-md"
                            : "bg-[#252527] text-gray-600"
                        }`}
                      >
                        {isSearching ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
