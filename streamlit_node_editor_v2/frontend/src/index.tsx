import {
  FrontendRenderer,
  FrontendRendererArgs,
} from "@streamlit/component-v2-lib";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";

import NodeEditorComponent, {
  NodeEditorComponentDataShape,
  NodeEditorComponentStateShape,
} from "./NodeEditorComponent";

export type PortTypeInfo = {
  color: string;
  label: string;
};

export type ParamDef = {
  key: string;
  label: string;
  type: "select" | "textarea" | "int" | "float" | "string";
  default?: string | number;
  options?: string[];
};

export type PortDef = {
  name: string;
  type: string;
  maxConnections?: number;
};

export type NodeDef = {
  category: string;
  color: string;
  headerColor: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  x?: number;
  y?: number;
};

export type NodeData = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  params: Record<string, string | number>;
  collapsed: boolean;
};

export type Connection = {
  id: string;
  fromNode: string;
  fromPort: number;
  toNode: string;
  toPort: number;
};

export type WiringState = {
  fromNode: string;
  fromPort: number;
  fromSide: "input" | "output";
  fromType: string;
};

export type StreamlitArgs = {
  node_defs: Record<string, NodeDef> | null;
  height: number;
  initial_nodes: Array<{ id: string; type: string; x?: number; y?: number; params?: Record<string, string | number> }>;
  initial_connections: Connection[];
  key: string | null;
  background_color: string;
  show_border: boolean;
};

export type GraphNodeProps = {
  node: NodeData;
  nodeDefs: Record<string, NodeDef>;
  selected: boolean;
  wiring: WiringState | null;
  onSelect: (id: string, additive?: boolean) => void;
  onDragStart: (e: React.MouseEvent<SVGGElement>, id: string) => void;
  onPortMouseDown: (
    e: React.MouseEvent<SVGCircleElement>,
    nodeId: string,
    side: "input" | "output",
    portIndex: number,
    portType: string,
  ) => void;
  onPortMouseUp: (
    e: React.MouseEvent<SVGCircleElement>,
    nodeId: string,
    side: "input" | "output",
    portIndex: number,
    portType: string,
  ) => void;
  onParamChange: (nodeId: string, key: string, value: string | number) => void;
  connections: Connection[];
};

export type PortTypes = Record<string, PortTypeInfo>;

export const NODE_DEFS: Record<string, NodeDef> = {
  "Load Checkpoint": {
    category: "Loaders",
    color: "#1e293b",
    headerColor: "#fb923c",
    inputs: [],
    outputs: [
      { name: "MODEL", type: "MODEL" },
      { name: "CLIP", type: "CLIP" },
      { name: "VAE", type: "VAE" },
    ],
    params: [
      {
        key: "ckpt_name",
        label: "Checkpoint",
        type: "select",
        options: ["v1-5-pruned.ckpt", "sd_xl_base.safetensors", "dreamshaper_8.safetensors"],
      },
    ],
  },
  "CLIP Text Encode": {
    category: "Conditioning",
    color: "#1e293b",
    headerColor: "#facc15",
    inputs: [{ name: "clip", type: "CLIP" }],
    outputs: [{ name: "CONDITIONING", type: "LATENT" }],
    params: [{ key: "text", label: "Prompt", type: "textarea" }],
  },
  KSampler: {
    category: "Sampling",
    color: "#1e293b",
    headerColor: "#818cf8",
    inputs: [
      { name: "model", type: "MODEL" },
      { name: "positive", type: "LATENT" },
      { name: "negative", type: "LATENT" },
      { name: "latent_image", type: "LATENT" },
    ],
    outputs: [{ name: "LATENT", type: "LATENT" }],
    params: [
      { key: "seed", label: "Seed", type: "int", default: 42 },
      { key: "steps", label: "Steps", type: "int", default: 20 },
      { key: "cfg", label: "CFG", type: "float", default: 7.0 },
      { key: "sampler", label: "Sampler", type: "select", options: ["euler", "euler_a", "dpm++2m", "ddim"] },
      { key: "scheduler", label: "Scheduler", type: "select", options: ["normal", "karras", "exponential"] },
      { key: "denoise", label: "Denoise", type: "float", default: 1.0 },
    ],
  },
  "Empty Latent Image": {
    category: "Latent",
    color: "#1e293b",
    headerColor: "#c084fc",
    inputs: [],
    outputs: [{ name: "LATENT", type: "LATENT" }],
    params: [
      { key: "width", label: "Width", type: "int", default: 512 },
      { key: "height", label: "Height", type: "int", default: 512 },
      { key: "batch", label: "Batch", type: "int", default: 1 },
    ],
  },
  "VAE Decode": {
    category: "Latent",
    color: "#1e293b",
    headerColor: "#f87171",
    inputs: [{ name: "samples", type: "LATENT" }, { name: "vae", type: "VAE" }],
    outputs: [{ name: "IMAGE", type: "IMAGE" }],
    params: [],
  },
  "Save Image": {
    category: "Output",
    color: "#1e293b",
    headerColor: "#4ade80",
    inputs: [{ name: "images", type: "IMAGE" }],
    outputs: [],
    params: [{ key: "filename_prefix", label: "Filename", type: "string", default: "output" }],
  },
  "Image Scale": {
    category: "Image",
    color: "#1e293b",
    headerColor: "#2dd4bf",
    inputs: [{ name: "image", type: "IMAGE" }],
    outputs: [{ name: "IMAGE", type: "IMAGE" }],
    params: [
      { key: "upscale_method", label: "Method", type: "select", options: ["nearest", "bilinear", "bicubic", "lanczos"] },
      { key: "width", label: "Width", type: "int", default: 1024 },
      { key: "height", label: "Height", type: "int", default: 1024 },
    ],
  },
  Integer: {
    category: "Primitives",
    color: "#1e293b",
    headerColor: "#38bdf8",
    inputs: [],
    outputs: [{ name: "INT", type: "INT" }],
    params: [{ key: "value", label: "Value", type: "int", default: 0 }],
  },
};

// Handle the possibility of multiple instances of the component to keep track
// of the React roots for each component instance.
const reactRoots: WeakMap<FrontendRendererArgs["parentElement"], Root> =
  new WeakMap();

const NodeEditorComponentRoot: FrontendRenderer<
  NodeEditorComponentStateShape,
  NodeEditorComponentDataShape
> = (args) => {
  const { data, parentElement, setStateValue, setTriggerValue  } = args;

  // Get the react-root div from the parentElement that we defined in our
  // `st.components.v2.component` call in Python.
  const rootElement = parentElement.querySelector(".react-root");

  if (!rootElement) {
    throw new Error("Unexpected: React root element not found");
  }

  // Check to see if we already have a React root for this component instance.
  let reactRoot = reactRoots.get(parentElement);
  if (!reactRoot) {
    // If we don't, create a new root for the React application using the React
    // DOM API.
    // @see https://react.dev/reference/react-dom/client/createRoot
    reactRoot = createRoot(rootElement);
    reactRoots.set(parentElement, reactRoot);
  }

  // Here we are accessing the data passed from Streamlit on the Python side.
  const { name, node_defs, height, background_color, show_border, initial_nodes, initial_connections } = data;
  // Render/re-render the React application into the root using the React DOM
  // API.
  reactRoot.render(
    <StrictMode>
      <NodeEditorComponent
        name={name}
        node_defs={node_defs}
        height={height}
        background_color={background_color}
        show_border={show_border}
        initial_nodes={initial_nodes}
        initial_connections={initial_connections}
        setStateValue={setStateValue}
        setTriggerValue={setTriggerValue}
      />
    </StrictMode>,
  );

  // Return a function to cleanup the React application in the Streamlit
  // component lifecycle.
  return () => {
    const reactRoot = reactRoots.get(parentElement);

    if (reactRoot) {
      reactRoot.unmount();
      reactRoots.delete(parentElement);
    }
  };
};

export default NodeEditorComponentRoot;
