const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Starts a streaming chat session with the backend.
 * @param {string} message - The user's message.
 * @param {Array} history - The chat history.
 * @param {string} model - The Gemini model to use.
 * @returns {Promise<ReadableStreamDefaultReader>} - A promise that resolves to the stream reader.
 */
export const startChatStream = async (message, history, model) => {
  const response = await fetch(`${API_BASE_URL}/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history, model }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.body.getReader();
};

/**
 * Executes a sequence graph on the backend.
 * @param {Array} nodes - The nodes of the graph.
 * @param {Array} edges - The edges of the graph.
 * @param {string} model - The Gemini model to use.
 * @returns {Promise<Object>} - A promise that resolves to the outputs of the nodes.
 */
export const runSequenceGraph = async (nodes, edges, model) => {
  const response = await fetch(`${API_BASE_URL}/run-sequence-graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nodes, edges, model }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};