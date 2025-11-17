import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

const UserInputNode = ({ data, id }) => {
  const { setNodes } = data;
  const onChange = useCallback((evt) => {
    const { name, value } = evt.target;
    if (setNodes) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, [name]: value } }
            : node
        )
      );
    }
  }, [id, setNodes]);

  return (
    <div className="custom-node" style={{ width: 250 }}>
      <div className="custom-node-header">
        <strong>User Input</strong>
      </div>
      <div className="custom-node-content">
        <div className="input-group">
          <label htmlFor={`ticker-${id}`}>Ticker</label>
          <input
            id={`ticker-${id}`}
            name="ticker"
            value={data.ticker || ''}
            onChange={onChange}
            className="nodrag"
          />
        </div>
        <div className="input-group">
          <label htmlFor={`company_name-${id}`}>Company Name</label>
          <input
            id={`company_name-${id}`}
            name="company_name"
            value={data.company_name || ''}
            onChange={onChange}
            className="nodrag"
          />
        </div>
        <div className="input-group">
          <label htmlFor={`time_horizon-${id}`}>Time Horizon</label>
          <input
            id={`time_horizon-${id}`}
            name="time_horizon"
            value={data.time_horizon || ''}
            onChange={onChange}
            className="nodrag"
          />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="ticker"
        style={{ top: '30%', width: 16, height: 16, borderRadius: 8 }}
        title="Ticker"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="company_name"
        style={{ top: '50%', width: 16, height: 16, borderRadius: 8 }}
        title="Company Name"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="time_horizon"
        style={{ top: '70%', width: 16, height: 16, borderRadius: 8 }}
        title="Time Horizon"
      />
    </div>
  );
};

export default memo(UserInputNode);
