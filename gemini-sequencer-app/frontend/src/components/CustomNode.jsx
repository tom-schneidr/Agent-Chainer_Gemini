import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const CustomNode = ({ data, id, onViewOutput }) => {
  return (
    <div className="custom-node">
      {/* Single input handle allowing unlimited incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ top: '50%', width: 16, height: 16, borderRadius: 8 }}
        title="Inputs"
      />

      <div className="custom-node-header">
        <strong>{data.name || `Node ${id}`}</strong>
      </div>

      <div className="custom-node-prompt">
        <div className="prompt-label">Prompt:</div>
        <p>{data.prompt || 'Double-click to edit'}</p>
      </div>

      {data.output && (
        <div className="custom-node-output">
          <strong>Output:</strong>
          <pre>{data.output}</pre>
          <button onClick={() => onViewOutput(data.output, data.name || `Node ${id}`)} className="view-full-output-btn">
            View Full Output
          </button>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ top: '50%', width: 16, height: 16, borderRadius: 8 }}
        title="Output"
      />
    </div>
  );
};

export default memo(CustomNode);