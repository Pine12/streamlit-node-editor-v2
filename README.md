# streamlit-node-editor-v2

A Streamlit Custom Component v2 for building ComfyUI- and Unreal Blueprints-style node graphs. Users can add nodes, edit parameters, connect typed ports, move and select nodes, select and delete connections, pan and zoom the canvas, and serialize the graph back to Python.

## Installation

```sh
uv pip install streamlit-node-editor-v2
```

The package includes the compiled frontend assets. The public Python entry point is `st_node_editor`:

```python
import streamlit as st
from streamlit_node_editor_v2 import st_node_editor

st.title("Pipeline editor")

graph = st_node_editor(key="pipeline")
if graph:
      st.json(graph)
```

## Component API

```python
st_node_editor(
      name="Node Editor",
      node_defs=None,
      height=700,
      background_color="#080810",
      show_border=True,
      initial_nodes=None,
      initial_connections=None,
      key=None,
      on_node_selected_change=None,
      on_connection_selected_change=None,
      on_connection_added_change=None,
      on_connection_deleted_change=None,
)
```

### Arguments

| Argument | Description |
| --- | --- |
| `name` | Name passed to the component. Defaults to `"Node Editor"`. |
| `node_defs` | Dictionary defining the available node types. When omitted or empty, the built-in definitions are used. |
| `height` | Component height in pixels. Defaults to `700`. |
| `background_color` | CSS color for the canvas. Defaults to `"#080810"`. |
| `show_border` | Whether to draw a border around the canvas. |
| `initial_nodes` | Nodes placed when the component first loads. |
| `initial_connections` | Connections restored when the component first loads. |
| `key` | Stable Streamlit key. Required when reading event payloads from `st.session_state`. |
| `on_*_change` | Optional no-argument callbacks for component events. |

The function returns a dict-like component result with `nodes` and `connections`. It is empty or unavailable before the first frontend update.

## Node definition JSON

`node_defs` is a mapping from the displayed node type name to its definition. The following is a complete example:

```json
{
   "Load Data": {
      "category": "Sources",
      "headerColor": "#4ade80",
      "inputs": [],
      "outputs": [
         {"name": "data", "type": "DATAFRAME"}
      ],
      "params": [
         {
            "key": "path",
            "label": "CSV path",
            "type": "string",
            "default": "data/input.csv"
         }
      ]
   },
   "Filter Rows": {
      "category": "Transforms",
      "headerColor": "#38bdf8",
      "inputs": [
         {"name": "data", "type": "DATAFRAME"}
      ],
      "outputs": [
         {"name": "data", "type": "DATAFRAME"}
      ],
      "params": [
         {
            "key": "query",
            "label": "Query",
            "type": "textarea",
            "default": "value > 0"
         }
      ]
   },
   "Choose Model": {
      "category": "Configuration",
      "headerColor": "#c084fc",
      "inputs": [],
      "outputs": [
         {"name": "model", "type": "MODEL"}
      ],
      "params": [
         {
            "key": "model",
            "label": "Model",
            "type": "select",
            "options": ["small", "medium", "large"]
         }
      ]
   }
}
```

### Node definition fields

- `category`: Palette grouping label.
- `headerColor`: CSS color for the node header.
- `inputs`: List of input ports.
- `outputs`: List of output ports.
- `params`: List of inline editable parameters.
- `x` and `y`: Optional initial position for built-in or supplied definitions.

Each port has a `name` and `type`. Input ports may also set `maxConnections`; the default is `1`. Port types connect when their type names match, or when either side is `ANY`.

Each parameter has a `key`, `label`, and one of these types:

- `string`: Single-line text input.
- `textarea`: Multiline text input.
- `int`: Integer input with step controls.
- `float`: Decimal input with step controls.
- `select`: Select box; `options` is required. If `default` is omitted, the first option is used and returned in the graph state.

## Initial graph JSON

Nodes can be supplied using `initial_nodes`:

```json
[
   {
      "id": "load-1",
      "type": "Load Data",
      "x": 80,
      "y": 120,
      "params": {
         "path": "data/input.csv"
      }
   },
   {
      "id": "filter-1",
      "type": "Filter Rows",
      "x": 420,
      "y": 120,
      "params": {
         "query": "value > 0"
      }
   }
]
```

Connections can be supplied using `initial_connections`:

```json
[
   {
      "id": "wire-1",
      "fromNode": "load-1",
      "fromPort": 0,
      "toNode": "filter-1",
      "toPort": 0
   }
]
```

Port indexes are zero-based. The referenced node IDs and port indexes must exist.

## Returned graph state

The component result has this shape:

```python
{
      "nodes": [
            {
                  "id": "load-1",
                  "type": "Load Data",
                  "x": 80,
                  "y": 120,
                  "params": {"path": "data/input.csv"},
            },
      ],
      "connections": [
            {
                  "id": "wire-1",
                  "fromNode": "load-1",
                  "fromPort": 0,
                  "toNode": "filter-1",
                  "toPort": 0,
            },
      ],
}
```

## User interactions

- `ADD NODE` opens the node palette. Nodes can also be added from the canvas context menu.
- Drag a node to reposition it.
- Click a node to select it. `DELETE NODE` removes selected nodes and their connections.
- Drag between compatible ports to create a connection.
- Click a connection to select it. The connection is highlighted, and `DELETE CONNECTION` becomes available.
- `AUTO-CONNECT` creates compatible connections while avoiding cycles and connection limits.
- `AUTO-DISCONNECT` removes all connections but keeps the nodes.
- `RESET` restores pan and zoom.
- Mouse wheel zooms the canvas. Middle-button dragging pans it; right-click opens the canvas context menu.
- `Delete` or `Backspace` removes selected nodes.

## Event callbacks

Callbacks are no-argument functions. The event payload is available during the callback in the component's Streamlit session state. The callback names and payload keys are:

| Callback | Payload |
| --- | --- |
| `on_node_selected_change` | Selected node under `st.session_state[key].node_selected` |
| `on_connection_selected_change` | Selected connection under `st.session_state[key].connection_selected` |
| `on_connection_added_change` | New connection under `st.session_state[key].connection_added` |
| `on_connection_deleted_change` | Deleted connection under `st.session_state[key].connection_deleted` |

Example:

```python
import streamlit as st
from streamlit_node_editor_v2 import st_node_editor

COMPONENT_KEY = "pipeline"


def selected_node():
      st.session_state["last_event"] = {
            "name": "node_selected",
            "value": st.session_state[COMPONENT_KEY].node_selected,
      }


def connection_added():
      st.session_state["last_event"] = {
            "name": "connection_added",
            "value": st.session_state[COMPONENT_KEY].connection_added,
      }


graph = st_node_editor(
      key=COMPONENT_KEY,
      on_node_selected_change=selected_node,
      on_connection_added_change=connection_added,
)

if "last_event" in st.session_state:
      st.json(st.session_state["last_event"])
```

The same pattern applies to `on_connection_selected_change` and `on_connection_deleted_change`. Events are triggers for the current rerun; the persistent graph is read from the component result.

## Development setup

Requirements:

- Python 3.10 or newer.
- Node.js 24 or newer.
- `uv` for Python environment and package management.

Install frontend dependencies:

```sh
cd streamlit_node_editor_v2/frontend
npm install
```

Build and typecheck the frontend:

```sh
npm run typecheck
npm run build
```

`npm run build` cleans the frontend build directory, typechecks TypeScript, and writes one hashed `index-*.js` bundle to `frontend/build`.

Install the repository in editable mode from the project root:

```sh
uv pip install -e . --force-reinstall
```

Run the example app:

```sh
streamlit run example.py
```

When frontend source changes, rebuild the frontend and restart or refresh the Streamlit app so it serves the new hashed bundle.

## Packaging

Build the frontend first:

```sh
cd streamlit_node_editor_v2/frontend
npm run build
cd ../..
```

Build the Python distributions from the project root:

```sh
uv build
```

The resulting `dist/` directory contains the wheel and source distribution. The wheel includes `streamlit_node_editor_v2/frontend/build` and the package manifest that registers the v2 component asset directory.

Install and test the wheel locally:

```sh
uv pip install dist/streamlit_node_editor_v2-*.whl --force-reinstall
streamlit run example.py
```

Do not remove the `[[tool.streamlit.component.components]]` entry from the root `pyproject.toml`; Streamlit uses it to resolve the packaged `index-*.js` asset.
