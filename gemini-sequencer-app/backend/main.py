import os
import json
import re
import asyncio
from dotenv import load_dotenv
import google.generativeai as genai
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from collections import deque
import google.api_core.exceptions
from google.ai.generativelanguage_v1beta.types import Tool

load_dotenv()

# Configure the Gemini API
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI()

# Add CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Adjust this to your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Streaming Chat Endpoint ---
def sanitize_history(history: list):
    """Strips frontend-specific fields from the chat history."""
    sanitized_list = []
    if not history:
        return sanitized_list
    for item in history:
        # The Gemini API only expects 'role' and 'parts'.
        # The 'isSystem' flag is for frontend use only, so we filter out those messages.
        if not item.get('isSystem'):
             sanitized_list.append({
                'role': item.get('role'),
                'parts': item.get('parts')
            })
    return sanitized_list


async def get_gemini_stream(message: str, history: list, model: str):
    """
    A generator function that yields chunks of text from the Gemini API
    with a fallback mechanism for rate limiting.
    """
    # --- DIAGNOSTIC LOGGING ---
    print("\n--- NEW STREAM REQUEST ---")
    print(f"Received Message: {json.dumps(message)}")
    print(f"Received History: {json.dumps(history, indent=2)}")
    # --- END DIAGNOSTIC LOGGING ---

    # WORKAROUND: If the last message in the history is identical to the new message,
    # remove it. This handles a persistent frontend issue where the new message is
    # being incorrectly included in the history.
    if (history and 
        history[-1].get('role') == 'user' and 
        history[-1].get('parts') and
        isinstance(history[-1]['parts'], list) and
        len(history[-1]['parts']) > 0 and
        history[-1]['parts'][0] == message):
        
        print("Backend Workaround: Detected and removed duplicated last message from history.")
        history = history[:-1]
        print(f"History after workaround: {json.dumps(history, indent=2)}")

    sanitized_history = sanitize_history(history)
    print(f"History sent to Gemini: {json.dumps(sanitized_history, indent=2)}")
    
    model_list = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
    
    try:
        start_index = model_list.index(model)
    except ValueError:
        start_index = -1

    models_to_try = model_list[start_index:] if start_index != -1 else [model]
    last_error = None

    for current_model in models_to_try:
        try:
            print(f"Attempting to use model: {current_model}")
            # Note: Chat stream currently doesn't support the optional grounding flag from frontend yet.
            # If we wanted to add it, we'd need to pass it in the request.
            # For now, we leave it as default (no grounding) or we can enable it globally if requested.
            # The user request was "add grounding ... to all ai requests" initially, but then "optional checkbox for nodes".
            # Chat stream is not a node, so maybe it should have it too?
            # The user said "optional checkbox for nodes".
            # I will leave chat stream as is (no grounding) unless specified, 
            # OR I can enable it by default if that was the original intent for "all requests" before the "optional" refinement.
            # The "optional" refinement was specifically "for nodes".
            # So "all requests" might still imply chat should have it?
            # Let's stick to the plan which only mentioned nodes for the optional part, but the original request was "all".
            # However, without a checkbox in chat UI, I shouldn't force it if it costs/adds latency.
            # I'll leave it off for chat for now to be safe, or I can add it if I want to be consistent.
            # Let's just fix the error in run_sequence_graph first.
            generative_model = genai.GenerativeModel(current_model)
            chat = generative_model.start_chat(history=sanitized_history)
            response = chat.send_message(message, stream=True)

            for chunk in response:
                if chunk.text:
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            return

        except google.api_core.exceptions.ResourceExhausted as e:
            print(f"Rate limit exceeded for model {current_model}. Trying next model.")
            last_error = e
            yield f"data: {json.dumps({'info': f'Rate limit for {current_model}, falling back...'})}\n\n"
            continue

        except Exception as e:
            print(f"An error occurred with model {current_model}: {e}")
            yield f"data: {json.dumps({'error': f'An error occurred with model {current_model}: {str(e)}'})}\n\n"
            return

    error_message = f"All attempted models are currently rate-limited. Please try again later. Last error: {str(last_error)}"
    yield f"data: {json.dumps({'error': error_message})}\n\n"


@app.post("/api/chat-stream")
async def chat_stream(request: Request):
    """
    Handles stateful, multi-turn chat conversations with streaming.
    """
    body = await request.json()
    message = body.get("message", "")
    history = body.get("history", [])
    model = body.get("model", "gemini-2.5-flash") 

    return StreamingResponse(
        get_gemini_stream(message, history, model),
        media_type="text/event-stream"
    )

# --- Sequencer Graph Execution Endpoint ---
@app.post("/api/run-sequence-graph")
async def run_sequence_graph(request: Request):
    """
    Executes a directed graph of prompts using a specified model.
    Supports multiple inputs per node using named placeholders based on source handles.
    """
    body = await request.json()
    nodes = body.get("nodes", [])
    edges = body.get("edges", [])
    model_name = body.get("model", "gemini-2.5-pro") # Default to pro if not provided

    try:
        print(f"Attempting sequence with model: {model_name}")
        
        # We'll instantiate the model inside the loop or just before generation if we need per-node config,
        # but the GenerativeModel object itself doesn't hold state per se for `generate_content`.
        # However, `tools` are configured at initialization.
        # So we might need to instantiate it differently depending on whether tools are needed.
        # For simplicity/performance, we can instantiate two versions or just instantiate on demand.
        # Given the request is per-node, let's instantiate on demand if needed, or just use one if all are same.
        # Actually, `generate_content` supports `tools` override in some SDK versions, but standard way is init.
        # Let's just instantiate inside the loop for custom nodes if we want to be safe, or check if we can pass tools to generate_content.
        # Checking docs (mental check): generate_content usually takes `tools` in some versions, but `configure` is global.
        # The `GenerativeModel` constructor takes `tools`.
        # Let's instantiate a "grounded_model" and a "standard_model" to avoid re-init every time if possible,
        # OR just init per node to be safe and support the per-node flag.
        
        # Better approach: Just init per node execution if it's a custom node.
        # But we want to reuse the model object if possible.
        # Let's keep the default one, and create a grounded one if needed.
        
        default_model = genai.GenerativeModel(model_name)
        
        # Use the Tool object to avoid "Unknown field for FunctionDeclaration" error
        grounding_tool = Tool(google_search=Tool.GoogleSearch())
        grounded_model = genai.GenerativeModel(model_name, tools=[grounding_tool])
        
        node_outputs = {}
        node_map = {n['id']: n for n in nodes}
        in_degree = {node['id']: 0 for node in nodes}
        adj = {node['id']: [] for node in nodes}
        
        for edge in edges:
            in_degree[edge['target']] += 1
            adj[edge['source']].append(edge['target'])
        
        queue = deque([node['id'] for node in nodes if in_degree[node['id']] == 0])
        
        while queue:
            node_id = queue.popleft()
            current_node = node_map[node_id]
            
            # Handle different node types
            if current_node['type'] == 'userInput':
                # For userInput nodes, the "output" is the data entered by the user.
                # We make the entire data object available for connected nodes.
                node_outputs[node_id] = current_node['data']
            
            elif current_node['type'] == 'custom':
                # This is a standard prompt-based node
                incoming_edges = [e for e in edges if e['target'] == node_id]
                
                inputs = {}
                for edge in incoming_edges:
                    source_node = node_map.get(edge['source'])
                    source_output = node_outputs.get(edge['source'])
                    source_handle = edge.get('sourceHandle')

                    if not source_node or source_output is None:
                        continue

                    # If the source is a userInput node, the handle is the key
                    if source_node['type'] == 'userInput':
                        if source_handle and isinstance(source_output, dict):
                            inputs[source_handle] = source_output.get(source_handle, "")
                    
                    # If the source is another custom node, create a unique key
                    elif source_node['type'] == 'custom':
                        # Sanitize the source node's name to create a unique placeholder
                        source_name = source_node['data'].get('name') or f"node_{source_node['id']}"
                        sanitized_name = re.sub(r'[^a-zA-Z0-9_]', '_', source_name)
                        inputs[sanitized_name] = source_output
                
                current_prompt = current_node['data'].get('prompt', '')
                
                # Replace named placeholders like {{ticker}}, {{company_name}}
                full_prompt = current_prompt
                for placeholder, value in inputs.items():
                    full_prompt = full_prompt.replace(f'{{{{{placeholder}}}}}', str(value))

                try:
                    # Check if this node requests grounding
                    use_grounding = current_node['data'].get('googleSearch', False)
                    model_to_use = grounded_model if use_grounding else default_model
                    
                    print(f"Generating for node {node_id} (Grounding: {use_grounding})")
                    response = model_to_use.generate_content(full_prompt)
                    node_outputs[node_id] = response.text
                except google.api_core.exceptions.ResourceExhausted as e:
                    print(f"Rate limit hit on node {node_id} with model {model_name}.")
                    return {"error": f"Rate limit exceeded for model {model_name}. Please try again later. Details: {str(e)}"}
                except Exception as e:
                    print(f"An error occurred during content generation for node {node_id} with model {model_name}: {e}")
                    return {"error": f"An error occurred during content generation with model {model_name}: {str(e)}"}
            
            # Process neighbors
            for neighbor_id in adj[node_id]:
                in_degree[neighbor_id] -= 1
                if in_degree[neighbor_id] == 0:
                    queue.append(neighbor_id)
        
        # Clean up outputs for the frontend
        # For userInput nodes, their output is internal; frontend doesn't need it.
        # For custom nodes, we just send the text.
        final_outputs = {
            nid: out if isinstance(out, str) else "" 
            for nid, out in node_outputs.items()
        }
        return {"outputs": final_outputs, "model_used": model_name}

    except google.api_core.exceptions.NotFound:
        return {"error": f"Model '{model_name}' not found or not accessible. Please check the model name and your API key permissions."}
    except Exception as e:
        print(f"A general error occurred during sequence execution with model {model_name}: {e}")
        return {"error": f"An unexpected error occurred with model {model_name}: {str(e)}"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)