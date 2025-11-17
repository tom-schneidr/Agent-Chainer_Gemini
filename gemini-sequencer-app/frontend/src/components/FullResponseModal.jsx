import React from 'react';
import ReactMarkdown from 'react-markdown'; // Corrected import
import './FullResponseModal.css';

function FullResponseModal({ isOpen, onClose, content, nodeName }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Output for {nodeName || 'Node'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body markdown-body"> {/* Add markdown-body class */}
          <ReactMarkdown>
            {content || 'No output available.'}
          </ReactMarkdown>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default FullResponseModal;
