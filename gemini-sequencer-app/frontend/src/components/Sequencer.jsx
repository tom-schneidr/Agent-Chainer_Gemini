import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { saveAs } from 'file-saver';

import CustomNode from './CustomNode';
import UserInputNode from './UserInputNode';
import PromptEditModal from './PromptEditModal';
import FullResponseModal from './FullResponseModal'; // Import FullResponseModal
import { runSequenceGraph } from '../lib/api';

const nodeTypes = {
  custom: (props) => <CustomNode {...props} onViewOutput={props.data.onViewOutput} />,
  userInput: UserInputNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'custom',
    position: { x: 100, y: 100 },
    data: { prompt: 'Analyze the provided text and identify the main sentiment.', name: 'Sentiment Analyzer' },
  },
];

let id = 2;
const getId = () => `${id++}`;

function Sequencer() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro'); // New state for selected model

  // State for FullResponseModal
  const [isFullResponseModalOpen, setIsFullResponseModalOpen] = useState(false);
  const [fullResponseContent, setFullResponseContent] = useState('');
  const [fullResponseNodeName, setFullResponseNodeName] = useState('');

  const { fitView, getNodes } = useReactFlow();
  const fileInputRef = useRef(null);


  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        animated: true,
        style: { stroke: '#03dac6', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#03dac6',
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onAddNode = useCallback(() => {
    const newNode = {
      id: getId(),
      type: 'custom',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: { prompt: 'Enter your prompt here...', name: '' },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onAddUserInputNode = useCallback(() => {
    const newNode = {
      id: getId(),
      type: 'userInput',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: { ticker: '', company_name: '', time_horizon: '' },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onRunSequence = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentNodes = getNodes();
      const result = await runSequenceGraph(currentNodes, edges, selectedModel); // Pass selectedModel
      if (result.outputs) {
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: {
              ...n.data,
              output: result.outputs[n.id] || 'No output generated',
            },
          }))
        );
      } else if (result.error) {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to run sequence:', error);
      alert(`Failed to run sequence: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [edges, getNodes, setNodes, selectedModel]); // Add selectedModel to dependencies

  const handleViewOutput = useCallback((outputContent, nodeName) => {
    setFullResponseContent(outputContent);
    setFullResponseNodeName(nodeName);
    setIsFullResponseModalOpen(true);
  }, []);

  const handleCloseFullResponseModal = useCallback(() => {
    setIsFullResponseModalOpen(false);
    setFullResponseContent('');
    setFullResponseNodeName('');
  }, []);

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      if (node.type === 'custom') {
        setEditingNode(node);
        setIsModalOpen(true);
      }
    },
    []
  );

  const handleSavePrompt = useCallback(
    (newPrompt, newName, newGoogleSearch) => {
      if (editingNode) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === editingNode.id
              ? { ...n, data: { ...n.data, prompt: newPrompt, name: newName, googleSearch: newGoogleSearch } }
              : n
          )
        );
      }
    },
    [editingNode, setNodes]
  );

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingNode(null);
  }, []);

  const handleSave = useCallback(() => {
    const currentNodes = getNodes();
    const saveData = {
      nodes: currentNodes.map(n => {
        // eslint-disable-next-line no-unused-vars
        const { setNodes, ...restData } = n.data;
        return { ...n, data: { ...restData, output: undefined } };
      }),
      edges,
    };
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    saveAs(blob, 'sequencer-setup.json');
  }, [edges, getNodes]);

  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedData = JSON.parse(e.target.result);
          if (loadedData.nodes && loadedData.edges) {
            // Find the max id to avoid collisions
            const maxId = loadedData.nodes.reduce((max, node) => Math.max(max, parseInt(node.id, 10)), 0);
            id = maxId + 1;

            setNodes(loadedData.nodes);
            setEdges(loadedData.edges);
          } else {
            alert('Invalid file format.');
          }
        } catch (error) {
          alert('Failed to load file. Make sure it is a valid sequencer setup file.');
          console.error('Failed to parse file:', error);
        }
      };
      reader.readAsText(file);
    }
    // Reset file input to allow loading the same file again
    event.target.value = '';
  }, [setNodes, setEdges]);

  const handleResetView = useCallback(() => {
    fitView();
  }, [fitView]);


  return (
    <div className="sequencer-container">
      <div className="sequencer-controls">
        <button onClick={onAddNode}>Add Gemini Node</button>
        <button onClick={onAddUserInputNode}>Add User Input Node</button>
        <button onClick={onRunSequence} disabled={isLoading} className="secondary">
          {isLoading ? 'Running...' : 'Run Sequence'}
        </button>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleLoad}>Load</button>
        <button onClick={handleResetView}>Reset View</button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept=".json"
        />
        <div className="model-selector">
          <label htmlFor="model-select">Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
          </select>
        </div>
        <div className="sequencer-hint">
          Double-click a Gemini node to edit its name & prompt. Drag outputs to the single input handle; unlimited connections allowed.
        </div>
      </div>
      <div className="react-flow-wrapper">
        <ReactFlow
          nodes={nodes.map(n => ({ ...n, data: { ...n.data, setNodes, onViewOutput: handleViewOutput } }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          minZoom={0.05}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#03dac6', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#03dac6',
            },
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <PromptEditModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialPrompt={editingNode?.data?.prompt || ''}
        initialName={editingNode?.data?.name || ''}
        initialGoogleSearch={editingNode?.data?.googleSearch || false}
        onSave={handleSavePrompt}
        nodeId={editingNode?.id || ''}
        connectedInputs={edges
          .filter(e => e.target === editingNode?.id)
          .map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) return null;

            const sourceName = sourceNode.data?.name || (sourceNode.type === 'userInput' ? 'User Input' : `Node ${sourceNode.id}`);
            let placeholder = `{{${edge.sourceHandle}}}`; // Default
            let displayHandle = edge.sourceHandle;

            if (sourceNode.type === 'custom') {
              // For custom nodes, create a unique placeholder from the node's name
              const sanitizedName = (sourceNode.data.name || `node_${sourceNode.id}`).replace(/[^a-zA-Z0-9_]/g, '_');
              placeholder = `{{${sanitizedName}}}`;
              displayHandle = sanitizedName;
            }

            return {
              placeholder,
              sourceName: sourceName,
              sourceHandle: displayHandle,
            };
          }).filter(Boolean)}
      />

      <FullResponseModal
        isOpen={isFullResponseModalOpen}
        onClose={handleCloseFullResponseModal}
        content={fullResponseContent}
        nodeName={fullResponseNodeName}
      />
    </div>
  );
}


function SequencerWrapper() {
  return (
    <ReactFlowProvider>
      <Sequencer />
    </ReactFlowProvider>
  );
}

export default SequencerWrapper;