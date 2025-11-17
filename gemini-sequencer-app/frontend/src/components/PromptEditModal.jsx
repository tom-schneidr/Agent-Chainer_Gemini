import React, { useState, useEffect } from 'react';
import './PromptEditModal.css';

function PromptEditModal({ isOpen, onClose, initialPrompt, initialName, onSave, nodeId, connectedInputs = [] }) {
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [name, setName] = useState(initialName || '');
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt || '');
      setName(initialName || '');
    }
  }, [isOpen, initialPrompt, initialName]);

  const handleInsertPlaceholder = (placeholder) => {
    const newPrompt =
      prompt.slice(0, cursorPosition) +
      placeholder +
      prompt.slice(cursorPosition);
    setPrompt(newPrompt);
    setCursorPosition(cursorPosition + placeholder.length);
  };

  const handleTextareaChange = (e) => {
    setPrompt(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaClick = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const handleSave = () => {
    onSave(prompt, name);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Node {nodeId}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="prompt-editor">
            <label>Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter node name..."
              style={{ width: '100%', marginBottom: '12px' }}
            />
            <label>Prompt:</label>
            <textarea
              value={prompt}
              onChange={handleTextareaChange}
              onClick={handleTextareaClick}
              onKeyUp={handleTextareaClick}
              placeholder="Enter your prompt here..."
              rows={12}
              autoFocus
            />
          </div>

          <div className="placeholder-controls">
            <label>Insert Input Placeholder:</label>
            {connectedInputs.length > 0 ? (
              <>
                <div className="placeholder-buttons">
                  {connectedInputs.map((input, index) => (
                    <button
                      key={index}
                      onClick={() => handleInsertPlaceholder(input.placeholder)}
                      className="placeholder-btn"
                      type="button"
                      title={`From: ${input.sourceName}`}
                    >
                      {input.placeholder}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ccc' }}>
                  <strong>Connected Inputs:</strong>
                  <ul>
                    {connectedInputs.map((input, index) => (
                      <li key={index}>
                        {input.placeholder} &larr; {input.sourceName} ({input.sourceHandle})
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="placeholder-help">
                No inputs connected. Connect another node to this node's input to create placeholders.
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-save">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromptEditModal;
