import streamlit as st

out = st.components.v2.component(
    "streamlit-node-editor-v2.st_node_editor",
    js="index-*.js",
    html='<div class="react-root"></div>',
)


# Create a wrapper function for the component. This is an optional
# best practice - we could simply expose the component function returned by
# `declare_component` and call it done. The wrapper allows us to customize
# our component's API: we can pre-process its input args, post-process its
# output value, and add a docstring for users.
def st_node_editor(
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
    ):
    """
    Render a ComfyUI / Unreal Blueprints-style node graph editor.

    Parameters
    ----------
    name : str, optional
        Display name for the node editor. Default is "Node Editor".
    Users can add nodes from a palette, connect typed ports by dragging,
    edit inline parameters, and delete nodes or wires interactively.

    Parameters
    ----------
    node_defs : dict[str, dict], optional
        Registry of available node types. If omitted, the frontend's built-in
        node definitions are used. Each entry::

            "Node Name": {
                "category": str,          # groups nodes in the palette
                "headerColor": str,       # hex color for the node header bar
                "inputs": [               # list of input port definitionsnode_editor.py
                    {
                        "name": str,
                        "type": str,     # type must be a key in port_types
                        "maxConnections": int,  # optional; defaults to 1
                    },
                "outputs": [              # list of output port definitions
                    {"name": str, "type": str},
                ],
                "params": [               # inline editable parameters
                    {
                        "key":      str,
                        "label":    str,
                        "type":     str,          # "int" | "float" | "string" | "select" | "textarea"
                        "default":  any,          # optional default value
                        "options":  list[str],    # required for type="select"
                    }
                ],
            }

    initial_nodes : list[dict], optional
        Pre-placed nodes on load. Each dict::

            {"id": str, "type": str, "x": float, "y": float,
             "params": {key: value}}

    initial_connections : list[dict], optional
        Pre-existing wires. Each dict::

            {"id": str, "fromNode": str, "fromPort": int,
                        "toNode":   str, "toPort":   int}

    height : int
        Canvas height in pixels. Default 700.
    key : str, optional
        Streamlit widget key.
    background_color : str, optional
        CSS color used for the canvas background. Default ``"#080810"``.
    show_border : bool, optional
        Whether to show a border around the canvas. Default ``False``.
    on_node_selected_change : callable, optional
        Called with the selected node.
    on_connection_selected_change : callable, optional
        Called with the selected connection.
    on_connection_added_change : callable, optional
        Called with each newly added connection.
    on_connection_deleted_change : callable, optional
        Called with each deleted connection.

    Returns
    -------
    dict | None
        Current graph state::

            {
                "nodes": [
                    {"id": str, "type": str, "x": float, "y": float,
                     "params": {key: value}},
                    ...
                ],
                "connections": [
                    {"id": str, "fromNode": str, "fromPort": int,
                               "toNode":   str, "toPort":   int},
                    ...
                ],
            }

        Returns None before any interaction.

    Example
    -------
    >>> from streamlit_node_editor import st_node_editor
    >>>
    >>> NODE_DEFS = {
    ...     "Load Data": {
    ...         "category": "Sources",
    ...         "headerColor": "#4ade80",
    ...         "inputs": [],
    ...         "outputs": [{"name": "dataframe", "type": "DATAFRAME"}],
    ...         "params": [{"key": "path", "label": "CSV path", "type": "string"}],
    ...     },
    ...     "Filter Rows": {
    ...         "category": "Transform",
    ...         "headerColor": "#38bdf8",
    ...         "inputs":  [{"name": "dataframe", "type": "DATAFRAME"}],
    ...         "outputs": [{"name": "dataframe", "type": "DATAFRAME"}],
    ...         "params": [{"key": "query", "label": "Query", "type": "string"}],
    ...     },
    ... }
    >>>
    >>> graph = st_node_editor(NODE_DEFS, height=600, key="pipeline")
    >>> if graph:
    ...     st.json(graph)
    """
    component_value = out(
        name=name,
        key=key,
        height=height,
        data={
            "name": name,
            "node_defs": node_defs or {},
            "height": height or 700,
            "background_color": background_color or "#080810",
            "show_border": show_border or False,
            "initial_nodes": initial_nodes or [],
            "initial_connections": initial_connections or [],   
        },
        default={"nodes": initial_nodes or [], "connections": initial_connections or []},
        on_nodes_change=lambda: None,
        on_connections_change=lambda: None,
        on_node_selected_change=on_node_selected_change,
        on_connection_selected_change=on_connection_selected_change,
        on_connection_added_change=on_connection_added_change,
        on_connection_deleted_change=on_connection_deleted_change,
    )

    # We could modify the value returned from the component if we wanted.
    # There's no need to do this in our simple example - but it's an option.
    return component_value