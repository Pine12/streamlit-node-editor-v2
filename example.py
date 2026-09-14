import streamlit as st
from streamlit_node_editor_v2 import st_node_editor
import json
# Add some test code to play with the component while it's in development.
# During development, we can run this just as we would any other Streamlit
# app: `$ streamlit run streamlit_node_editor_v2/example.py`
title = "Node Editor V2"
st.set_page_config(page_title=title, layout="wide")
st.title(title)
NODE_DEFS = None
with open("data/etr_config.json", "r") as f:
    NODE_DEFS = json.load(f)["nodes"]

COMPONENT_KEY = "demo_graph"


def record_component_event(event_name, state_name):
    component_state = st.session_state.get(COMPONENT_KEY)
    payload = getattr(component_state, state_name, None) if component_state else None
    st.session_state["last_node_editor_event"] = {
        "event": event_name,
        "payload": payload,
    }


def on_node_selected_change():
    record_component_event("node_selected", "node_selected")


def on_connection_selected_change():
    record_component_event("connection_selected", "connection_selected")


def on_connection_added_change():
    record_component_event("connection_added", "connection_added")


def on_connection_deleted_change():
    record_component_event("connection_deleted", "connection_deleted")


result = st_node_editor(
    "Node Editor V2",
    node_defs=NODE_DEFS,
    initial_nodes=[],
    # height=500,
    key=COMPONENT_KEY,
    background_color="#FFFFFF",
    show_border=True,
    on_node_selected_change=on_node_selected_change,
    on_connection_selected_change=on_connection_selected_change,
    on_connection_added_change=on_connection_added_change,
    on_connection_deleted_change=on_connection_deleted_change,
)

if result:
    st.write(f"Nodes: {len(result.nodes)}")
    st.write(f"Connections: {len(result.connections)}")

if "last_node_editor_event" in st.session_state:
    st.write("Last event:")
    st.json(st.session_state["last_node_editor_event"])
