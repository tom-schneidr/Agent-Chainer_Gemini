import React, { useState, useEffect, useRef } from 'react';
import { startChatStream } from '../lib/api';

function Chat({ model }) {
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef(null);

  // Auto-scroll to the bottom of the chat history
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    // Defensively capture the history for the API call before any state changes.
    const historyForApi = [...history];

    setIsLoading(true);
    const userMessage = { role: 'user', parts: [message] };
    
    // Add user message and a placeholder for the model's response to the UI.
    setHistory([...history, userMessage, { role: 'model', parts: [''] }]);
    setMessage('');

    try {
      // Pass the explicitly captured previous history to the backend.
      const reader = await startChatStream(message, historyForApi, model);
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let endOfMessageIndex;
        while ((endOfMessageIndex = buffer.indexOf('\n\n')) >= 0) {
          const messageChunk = buffer.substring(0, endOfMessageIndex);
          buffer = buffer.substring(endOfMessageIndex + 2);

          if (messageChunk.startsWith('data:')) {
            try {
              const jsonStr = messageChunk.substring(5);
              if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.text) {
                  setHistory(prevHistory => {
                    const updatedHistory = [...prevHistory];
                    const lastMessage = updatedHistory[updatedHistory.length - 1];
                    if (lastMessage && lastMessage.role === 'model' && !lastMessage.isSystem) {
                      lastMessage.parts[0] += parsed.text;
                    }
                    return updatedHistory;
                  });
                } else if (parsed.info || parsed.error) {
                  const systemMessageText = parsed.info ? `[INFO] ${parsed.info}` : `[ERROR] ${parsed.error}`;
                  // Insert system message before the final (empty) model placeholder
                  setHistory(prevHistory => {
                     const lastMsg = prevHistory[prevHistory.length - 1];
                     if (lastMsg && lastMsg.role === 'model' && lastMsg.parts[0] === '' && !lastMsg.isSystem) {
                         const allButLast = prevHistory.slice(0, -1);
                         return [...allButLast, { role: 'model', parts: [systemMessageText], isSystem: true }, lastMsg];
                     }
                     return [...prevHistory, { role: 'model', parts: [systemMessageText], isSystem: true }];
                  });
                }
              }
            } catch (e) {
              console.error("Failed to parse stream chunk:", e, "Chunk:", messageChunk);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch chat stream:', error);
      setHistory(prev => [...prev, { role: 'model', parts: [`[ERROR] Failed to fetch stream: ${error.message}`], isSystem: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-history" ref={chatHistoryRef}>
        {history.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role} ${msg.isSystem ? 'system' : ''}`}>
            <p>{msg.parts[0]}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export default Chat;