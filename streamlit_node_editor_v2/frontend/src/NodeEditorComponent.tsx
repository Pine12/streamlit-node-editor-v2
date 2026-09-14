import { FrontendRendererArgs } from "@streamlit/component-v2-lib";
import { FC, ReactElement, useRef, useCallback, useState, useEffect } from "react";
import type {
  NodeData,
  NodeDef,
  Connection,
  GraphNodeProps,
  WiringState,
  PortTypeInfo,
  PortDef,
  ParamDef,
  PortTypes,
  StreamlitArgs
} from "./index";

import { NODE_DEFS } from "./index";

export type NodeEditorComponentStateShape = {
  nodes: NodeData[];
  connections: Connection[];
  node_selected: NodeData;
  connection_selected: Connection;
  connection_added: Connection;
  connection_deleted: Connection;
};

export type NodeEditorComponentDataShape = {
  name: string;
  height: number;
  background_color: string;
  show_border: boolean;
  node_defs: Record<string, NodeDef> | null;
  initial_nodes: Array<{ id: string; type: string; x?: number; y?: number; params?: Record<string, string | number> }> | null;
  initial_connections: Connection[] | null;
};

export type NodeEditorComponentProps = Pick<
  FrontendRendererArgs<NodeEditorComponentStateShape, NodeEditorComponentDataShape>,
  "setStateValue" | "setTriggerValue"
> &
  NodeEditorComponentDataShape;

let PORT_TYPES: PortTypes = {};
let _id = 1;
const uid = (): string => `node_${_id++}`;

function makeNode(
  type: string,
  x: number,
  y: number,
  paramValues: Record<string, string | number> = {},
  nodeDefs: Record<string, NodeDef>,
): NodeData {
  const def = nodeDefs[type] || { params: [] };
  const defaultParams = Object.fromEntries(
    (def.params || []).map((p) => [p.key, p.default ?? (p.type === "select" ? p.options?.[0] ?? "" : "")]),
  );
  return {
    id: uid(),
    type,
    x,
    y,
    width: 240,
    params: { ...defaultParams, ...(paramValues || {}) },
    collapsed: false,
  };
}

function portHeight(index: number): number { return 44 + index * 28; }

function nodeHeight(node: NodeData, nodeDefs: Record<string, NodeDef>): number {
  const def = nodeDefs[node.type];
  if (node.collapsed) return 36;
  const portRows = Math.max(def.inputs.length, def.outputs.length);
  const paramH = def.params.reduce((sum, p) => sum + (p.type === "textarea" ? 60 : 34), 0);
  return 44 + portRows * 28 + paramH + 16;
}

function getPortPos(node: NodeData, side: "input" | "output", index: number): { x: number; y: number } {
  const y = node.y + portHeight(index);
  const x = side === "output" ? node.x + node.width + 1 : node.x - 1;
  return { x, y };
}

function typesCompatible(a: string, b: string): boolean {
  if (a === "ANY" || b === "ANY") return true;
  return a === b;
}

function inputMaxConnections(nodeType: string, portIndex: number, nodeDefs: Record<string, NodeDef>): number {
  const port = (nodeDefs[nodeType]?.inputs || [])[portIndex];
  return port?.maxConnections ?? 1;
}

function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.6 + 60;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

function GraphNode({
  node,
  nodeDefs,
  selected,
  wiring,
  onSelect,
  onDragStart,
  onPortMouseDown,
  onPortMouseUp,
  onParamChange,
  connections,
}: GraphNodeProps): React.ReactElement {
  const def = nodeDefs[node.type];
  const h = nodeHeight(node, nodeDefs);

  const connectedInputs = new Set(connections.filter((c) => c.toNode === node.id).map((c) => c.toPort));
  const connectedOutputs = new Set(connections.filter((c) => c.fromNode === node.id).map((c) => c.fromPort));

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragStart(e, node.id);
        onSelect(node.id);
      }}
    >
      <rect x={3} y={3} width={node.width} height={h} rx={8} fill="rgba(0,0,0,0.45)" />

      <rect
        width={node.width}
        height={h}
        rx={8}
        fill={node.collapsed ? def.headerColor + "22" : "#13131f"}
        stroke={selected ? "white" : "rgba(255,255,255,0.12)"}
        strokeWidth={selected ? 1.5 : 1}
      />

      <rect width={node.width} height={32} rx={8} ry={8} fill={def.headerColor} opacity={0.9} />
      <rect y={24} width={node.width} height={12} fill={def.headerColor} opacity={0.9} />

      <text
        x={10}
        y={21}
        fontFamily="'Fira Code', monospace"
        fontSize={12}
        fontWeight={600}
        fill="rgba(0,0,0,0.85)"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {node.type}
      </text>

      <text
        x={node.width - 16}
        y={21}
        fontFamily="monospace"
        fontSize={12}
        fill="rgba(0,0,0,0.6)"
        style={{ cursor: "pointer", userSelect: "none" }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        {node.collapsed ? "+" : "−"}
      </text>

      {!node.collapsed && (
        <>
          {def.inputs.map((port, i) => {
            const relY = 44 + i * 28;
            const c = PORT_TYPES[port.type]?.color ?? "#71717a";
            const isConn = connectedInputs.has(i);
            return (
              <g key={`in-${i}`}>
                <circle
                  cx={-1}
                  cy={relY}
                  r={14}
                  fill="transparent"
                  style={{ cursor: "crosshair" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onPortMouseDown(e, node.id, "input", i, port.type);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    onPortMouseUp(e, node.id, "input", i, port.type);
                  }}
                />
                <circle
                  cx={-1}
                  cy={relY}
                  r={5.5}
                  fill={isConn ? c : "#13131f"}
                  stroke={c}
                  strokeWidth={2}
                  style={{ pointerEvents: "none" }}
                />
                <text
                  x={14}
                  y={relY + 4}
                  fontFamily="'Fira Code', monospace"
                  fontSize={10}
                  fill={c}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {port.name}
                </text>
              </g>
            );
          })}

          {def.outputs.map((port, i) => {
            const relY = 44 + i * 28;
            const c = PORT_TYPES[port.type]?.color ?? "#71717a";
            const isConn = connectedOutputs.has(i);
            return (
              <g key={`out-${i}`}>
                <circle
                  cx={node.width + 1}
                  cy={relY}
                  r={14}
                  fill="transparent"
                  style={{ cursor: "crosshair" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onPortMouseDown(e, node.id, "output", i, port.type);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    onPortMouseUp(e, node.id, "output", i, port.type);
                  }}
                />
                <circle
                  cx={node.width + 1}
                  cy={relY}
                  r={5.5}
                  fill={isConn ? c : "#13131f"}
                  stroke={c}
                  strokeWidth={2}
                  style={{ pointerEvents: "none" }}
                />
                <text
                  x={node.width - 14}
                  y={relY + 4}
                  fontFamily="'Fira Code', monospace"
                  fontSize={10}
                  fill={c}
                  textAnchor="end"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {port.name}
                </text>
              </g>
            );
          })}

          {def.params.map((param, i, arr) => {
            const baseY =
              44 +
              Math.max(def.inputs.length, def.outputs.length) * 28 +
              arr.slice(0, i).reduce((s, p) => s + (p.type === "textarea" ? 60 : 34), 0) +
              8;
            const fHeight = param.type === "textarea" ? 56 : 30;
            return (
              <foreignObject key={param.key} x={8} y={baseY} width={node.width - 16} height={fHeight} style={{ pointerEvents: "all" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <label
                    style={{
                      fontFamily: "'Fira Code', monospace",
                      fontSize: 9,
                      color: "#64748b",
                      minWidth: 52,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {param.label}
                  </label>
                  {param.type === "select" ? (
                    <select
                      value={node.params[param.key] ?? ""}
                      onChange={(e) => onParamChange(node.id, param.key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        background: "#0f0f1a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        color: "#e2e8f0",
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 10,
                        padding: "2px 4px",
                        outline: "none",
                      }}
                    >
                      {(param.options || []).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : param.type === "textarea" ? (
                    <textarea
                      rows={2}
                      value={node.params[param.key] ?? ""}
                      onChange={(e) => onParamChange(node.id, param.key, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        background: "#0f0f1a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        color: "#e2e8f0",
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 10,
                        padding: "2px 4px",
                        outline: "none",
                        resize: "none",
                      }}
                    />
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
                      <input
                        type={param.type === "float" || param.type === "int" ? "number" : "text"}
                        value={node.params[param.key] ?? ""}
                        step={param.type === "float" ? 0.1 : 1}
                        onChange={(e) => onParamChange(node.id, param.key, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: "#0f0f1a",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: param.type === "float" || param.type === "int" ? "4px 0 0 4px" : 4,
                          color: "#e2e8f0",
                          fontFamily: "'Fira Code', monospace",
                          fontSize: 10,
                          padding: "2px 4px",
                          outline: "none",
                          MozAppearance: "textfield",
                        }}
                      />
                      {(param.type === "float" || param.type === "int") && (
                        <div style={{ display: "flex", flexDirection: "column", width: 14 }}>
                          {[1, -1].map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const cur = parseFloat(String(node.params[param.key])) || 0;
                                const step = param.type === "float" ? 0.1 : 1;
                                const next =
                                  param.type === "float"
                                    ? Math.round((cur + dir * step) * 10) / 10
                                    : cur + dir * step;
                                onParamChange(node.id, param.key, next);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                flex: 1,
                                background: "#1a1a2e",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderLeft: "none",
                                borderBottom: dir === 1 ? "none" : undefined,
                                color: "#64748b",
                                cursor: "pointer",
                                fontSize: 7,
                                lineHeight: 1,
                                padding: 0,
                              }}
                            >
                              {dir === 1 ? "▲" : "▼"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </foreignObject>
            );
          })}
        </>
      )}
    </g>
  );
}

function generateColor(index: number, total: number): string {
  const hue = Math.round((index / Math.max(total, 1)) * 360);
  return `hsl(${hue}, 70%, 60%)`;
}

function isLightColor(color: string): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.fillStyle = color || "#080810";
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return (0.299 * red + 0.587 * green + 0.114 * blue) > 160;
}

/**
 * A template for creating Streamlit components with React
 *
 * This component demonstrates the essential structure and patterns for
 * creating interactive Streamlit components, including:
 * - Accessing data sent from Python
 * - Managing component state with React hooks
 * - Communicating back to Streamlit via setStateValue()
 * - Using the Streamlit CSS Custom Properties for styling
 *
 * @param props.name - Name passed from the Python side to display in the component
 * @param props.setStateValue - Function to send state updates back to Streamlit
 * @returns The rendered component
 * 
 */

const NodeEditorComponent: FC<NodeEditorComponentProps> = ({
  name,
  node_defs,
  height,
  background_color,
  show_border,
  initial_nodes,
  initial_connections,
  setStateValue,
  setTriggerValue,
}): ReactElement => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [wiring, setWiring] = useState<WiringState | null>(null);
  const [wirePos, setWirePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; svgX: number; svgY: number } | null>(null);
  const [palette, setPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const dragNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const commitTimeoutRef = useRef<number | null>(null);

  const [streamlitArgs, setStreamlitArgs] = useState<StreamlitArgs>({
    node_defs: null,
    height: 700,
    initial_nodes: [],
    initial_connections: [],
    key: null,
    background_color: "#080810",
    show_border: false,
  });

  const [nodeDefs, setNodeDefs] = useState<Record<string, NodeDef>>({});
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [portTypes, setPortTypes] = useState<Record<string, PortTypeInfo>>({});

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const newArgs: StreamlitArgs = {
      node_defs: node_defs || {},
      height: height ?? 700,
      initial_nodes: initial_nodes || [],
      initial_connections: initial_connections || [],
      key: null,
      background_color: background_color || "#080810",
      show_border: Boolean(show_border),
    };

    setStreamlitArgs(newArgs);

      const incomingDefs = newArgs.node_defs && Object.keys(newArgs.node_defs).length > 0 ? newArgs.node_defs : NODE_DEFS;
      setNodeDefs(incomingDefs);

      const allPortTypes = new Set<string>();
      Object.values(incomingDefs).forEach((def: NodeDef) => {
        (def.inputs || []).forEach((i: PortDef) => allPortTypes.add(i.type));
        (def.outputs || []).forEach((o: PortDef) => allPortTypes.add(o.type));
      });
      const typeArray = [...allPortTypes];
      const portTypeMap = Object.fromEntries(
        typeArray.map((type, index) => [type, { color: generateColor(index, typeArray.length), label: type }]),
      ) as Record<string, PortTypeInfo>;
      PORT_TYPES = portTypeMap;
      setPortTypes(portTypeMap);

      if (!readyRef.current) {
        if (newArgs.initial_nodes?.length) {
          setNodes(
            newArgs.initial_nodes.map((n) => ({
              ...makeNode(n.type, n.x ?? 0, n.y ?? 0, n.params || {}, incomingDefs),
              id: n.id,
            })),
          );
        } else {
          let xPos = -140;
          let yPos = -40;
          setNodes(
            Object.entries(incomingDefs).map(([name, def]) => {
              xPos += 150;
              yPos += 50;
              return makeNode(name, def.x || xPos, def.y || yPos, {}, incomingDefs);
            }),
          );
        }

        if (newArgs.initial_connections?.length) {
          setConnections(newArgs.initial_connections);
        }

        readyRef.current = true;
      }
      
  }, [background_color, height, initial_connections, initial_nodes, node_defs, show_border]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (commitTimeoutRef.current) window.clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = window.setTimeout(() => {
      setStateValue(
        "nodes",
        nodes.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, params: n.params })) as NodeEditorComponentStateShape["nodes"],
      );
      setStateValue("connections", connections as NodeEditorComponentStateShape["connections"]);
    }, 150);
    return () => {
      if (commitTimeoutRef.current) window.clearTimeout(commitTimeoutRef.current);
    };
  }, [nodes, connections]);

  const svgPoint = useCallback((e: MouseEvent | React.MouseEvent<SVGSVGElement | SVGGElement | SVGCircleElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    const p = panRef.current;
    const z = zoomRef.current;
    return {
      x: (e.clientX - rect.left - p.x) / z,
      y: (e.clientY - rect.top - p.y) / z,
    };
  }, []);

  const svgRaw = useCallback((e: MouseEvent | React.MouseEvent<SVGSVGElement | SVGGElement | SVGCircleElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent<SVGGElement>, id: string) => {
      if (wiring) return;
      const pt = svgPoint(e);
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      dragNodeRef.current = { id, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
    },
    [nodes, svgPoint, wiring],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && !wiring)) {
        if (e.button !== 2) {
          setIsPanning(true);
          panDragRef.current = { startX: e.clientX - panRef.current.x, startY: e.clientY - panRef.current.y };
        }
        setSelected([]);
      }
    },
    [wiring],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (dragNodeRef.current || panDragRef.current || wiring) e.preventDefault();
      const cx = e.clientX;
      const cy = e.clientY;

      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(() => {
        if (dragNodeRef.current) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const p = panRef.current;
          const z = zoomRef.current;
          const ptx = (cx - rect.left - p.x) / z;
          const pty = (cy - rect.top - p.y) / z;
          const d = dragNodeRef.current;
          setNodes((ns) => ns.map((n) => (n.id === d.id ? { ...n, x: ptx - d.offsetX, y: pty - d.offsetY } : n)));
        }
        if (panDragRef.current) {
          const newPan = { x: cx - panDragRef.current.startX, y: cy - panDragRef.current.startY };
          panRef.current = newPan;
          setPan(newPan);
        }
        if (wiring) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          setWirePos({ x: cx - rect.left, y: cy - rect.top });
        }
      });
    },
    [wiring],
  );

  const handleMouseUp = useCallback(() => {
    dragNodeRef.current = null;
    panDragRef.current = null;
    setIsPanning(false);
    if (wiring) setWiring(null);
  }, [wiring]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.2, Math.min(3, z * delta)));
  }, []);

  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent<SVGCircleElement>, nodeId: string, side: "input" | "output", portIndex: number, portType: string) => {
      e.preventDefault();
      const raw = svgRaw(e);
      setWiring({ fromNode: nodeId, fromPort: portIndex, fromSide: side, fromType: portType });
      setWirePos(raw);
    },
    [svgRaw],
  );

  const handlePortMouseUp = useCallback(
    (e: React.MouseEvent<SVGCircleElement>, nodeId: string, side: "input" | "output", portIndex: number, portType: string) => {
      if (!wiring) return;
      const isOutputToInput = wiring.fromSide === "output" && side === "input";
      const isInputToOutput = wiring.fromSide === "input" && side === "output";
      if (!(isOutputToInput || isInputToOutput)) {
        setWiring(null);
        return;
      }
      if (wiring.fromNode === nodeId) {
        setWiring(null);
        return;
      }
      if (!typesCompatible(wiring.fromType, portType)) {
        setWiring(null);
        return;
      }

      const fromNode = isOutputToInput ? wiring.fromNode : nodeId;
      const fromPort = isOutputToInput ? wiring.fromPort : portIndex;
      const toNode = isOutputToInput ? nodeId : wiring.fromNode;
      const toPort = isOutputToInput ? portIndex : wiring.fromPort;
      const maxConnections = inputMaxConnections(nodes.find((node) => node.id === toNode)?.type || "", toPort, nodeDefs);
      setWiring(null);

      if (maxConnections <= 0) {
        setToast("This input does not accept connections.");
        return;
      }

      const inputConnections = connections.filter((c) => c.toNode === toNode && c.toPort === toPort);
      if (inputConnections.length >= maxConnections) {
        if (maxConnections > 1) {
          setToast(`This input already has the maximum of ${maxConnections} connections.`);
          return;
        }
        const replace = window.confirm("This input already has a connection. Replace it?");
        if (!replace) return;
      }

      const connection: Connection = { id: `w${Date.now()}`, fromNode, fromPort, toNode, toPort };
      inputConnections.forEach((oldConnection) => {
        setTriggerValue("connection_deleted", oldConnection);
        if (selectedConnection?.id === oldConnection.id) setSelectedConnection(null);
      });
      setTriggerValue("connection_added", connection);
      setConnections((cs) => [
        ...cs.filter((c) => maxConnections > 1 || !(c.toNode === toNode && c.toPort === toPort)),
        connection,
      ]);
    },
    [nodes, wiring, connections, nodeDefs, selectedConnection, setTriggerValue],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      const raw = svgRaw(e);
      setContextMenu({ x: e.clientX, y: e.clientY, svgX: raw.x, svgY: raw.y });
    },
    [svgRaw],
  );

  const addNode = useCallback(
    (type: string, rawX: number, rawY: number) => {
      const pt = {
        x: (rawX - pan.x) / zoom,
        y: (rawY - pan.y) / zoom,
      };
      setNodes((ns) => [...ns, makeNode(type, pt.x - 120, pt.y - 18, {}, nodeDefs)]);
      setContextMenu(null);
      setPalette(false);
    },
    [pan, zoom, nodeDefs],
  );

  const handleParamChange = useCallback((nodeId: string, key: string, value: string | number) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n)));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    connections
      .filter((connection) => selected.includes(connection.fromNode) || selected.includes(connection.toNode))
      .forEach((connection) => {
        setTriggerValue("connection_deleted", connection);
        if (selectedConnection?.id === connection.id) setSelectedConnection(null);
      });
    setNodes((ns) => ns.filter((n) => !selected.includes(n.id)));
    setConnections((cs) => cs.filter((c) => !selected.includes(c.fromNode) && !selected.includes(c.toNode)));
    setSelected([]);
  }, [connections, selected, selectedConnection, setTriggerValue]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected.length) {
        handleDeleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, handleDeleteSelected]);

  const handleAutoConnect = useCallback(() => {
    const canReach = (fromId: string, toId: string, conns: Connection[]) => {
      const visited = new Set<string>();
      const stack = [fromId];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur) continue;
        if (cur === toId) return true;
        if (visited.has(cur)) continue;
        visited.add(cur);
        conns.filter((c) => c.fromNode === cur).forEach((c) => stack.push(c.toNode));
      }
      return false;
    };

    const result = [...connections];
    const orderedNodes = [...nodes].sort((a, b) => a.x - b.x);

    orderedNodes.forEach((toNodeObj) => {
      const toDef = nodeDefs[toNodeObj.type];
      if (!toDef) return;

      toDef.inputs.forEach((inputPort, toPort) => {
        const maxConn = inputMaxConnections(toNodeObj.type, toPort, nodeDefs);

        for (;;) {
          const existing = result.filter((c) => c.toNode === toNodeObj.id && c.toPort === toPort);
          if (existing.length >= maxConn) break;

            const fromNodeObj = orderedNodes.find((candidate) => {
              if (candidate.id === toNodeObj.id) return false;
              const fromDef = nodeDefs[candidate.type];
              if (!fromDef) return false;
              return fromDef.outputs.some((outputPort, fromPort) =>
                typesCompatible(outputPort.type, inputPort.type) &&
                !canReach(toNodeObj.id, candidate.id, result) &&
                !existing.some((c) => c.fromNode === candidate.id && c.fromPort === fromPort),
              );
            });
          if (!fromNodeObj) break;

            const fromDef = nodeDefs[fromNodeObj.type];
            const fromPort = fromDef.outputs.findIndex(
              (outputPort, idx) =>
                typesCompatible(outputPort.type, inputPort.type) &&
                !canReach(toNodeObj.id, fromNodeObj.id, result) &&
                !existing.some((c) => c.fromNode === fromNodeObj.id && c.fromPort === idx),
            );
          if (fromPort === -1) break;

          result.push({
            id: `w${Date.now()}_${toNodeObj.id}_${toPort}_${fromNodeObj.id}_${fromPort}`,
            fromNode: fromNodeObj.id,
            fromPort,
            toNode: toNodeObj.id,
            toPort,
          });
        }
      });
    });

    const addedConnections = result.slice(connections.length);
    addedConnections.forEach((connection) => setTriggerValue("connection_added", connection));
    setConnections(result);
  }, [connections, nodes, nodeDefs, setTriggerValue]);

  const handleAutoDisconnect = useCallback(() => {
    connections.forEach((connection) => setTriggerValue("connection_deleted", connection));
    setConnections([]);
    setSelectedConnection(null);
    setWiring(null);
  }, [connections, setTriggerValue]);

  const handleDeleteConnection = useCallback(() => {
    if (!selectedConnection) return;
    setTriggerValue("connection_deleted", selectedConnection);
    setConnections((cs) => cs.filter((connection) => connection.id !== selectedConnection.id));
    setSelectedConnection(null);
  }, [selectedConnection, setTriggerValue]);

  const getWireEndpoints = (conn: Connection) => {
    const fromNode = nodes.find((n) => n.id === conn.fromNode);
    const toNode = nodes.find((n) => n.id === conn.toNode);
    if (!fromNode || !toNode) return null;
    const from = getPortPos(fromNode, "output", conn.fromPort);
    const to = getPortPos(toNode, "input", conn.toPort);
    return { from, to };
  };

  const getWireColor = (conn: Connection): string => {
    const fromNode = nodes.find((n) => n.id === conn.fromNode);
    if (!fromNode) return "#71717a";
    const def = nodeDefs[fromNode.type];
    const port = def.outputs[conn.fromPort];
    return PORT_TYPES[port?.type]?.color ?? "#71717a";
  };

  const filteredDefs = Object.entries(nodeDefs).filter(([name]) =>
    name.toLowerCase().includes(paletteSearch.toLowerCase()),
  );
  const categories = [...new Set(filteredDefs.map(([, d]) => d.category))];
  const lightCanvas = isLightColor(streamlitArgs.background_color);
  const menuColors = lightCanvas
    ? {
        panel: "rgba(255,255,255,0.9)",
        button: "rgba(15,23,42,0.08)",
        buttonActive: "rgba(79,70,229,0.18)",
        text: "#0f172a",
        muted: "#475569",
        border: "rgba(15,23,42,0.18)",
        menu: "rgba(255,255,255,0.98)",
      }
    : {
        panel: "rgba(15,15,26,0.85)",
        button: "rgba(255,255,255,0.05)",
        buttonActive: "rgba(99,102,241,0.3)",
        text: "#e2e8f0",
        muted: "#94a3b8",
        border: "rgba(255,255,255,0.1)",
        menu: "rgba(13,13,25,0.98)",
      };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        select option { background: #0f0f1a; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <div
        style={{
          width: "100%",
          height: `${height ?? 700}px`,
          maxHeight: `${height ?? 700}px`,
          background: streamlitArgs.background_color,
          border: streamlitArgs.show_border ? `1px solid ${menuColors.border}` : "none",
          overflow: "hidden",
          fontFamily: "'Fira Code', monospace",
          position: "relative",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            display: "flex",
            gap: 6,
            zIndex: 100,
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: menuColors.panel,
              border: `1px solid ${menuColors.border}`,
              borderRadius: 8,
              padding: "5px 10px",
              display: "flex",
              gap: 8,
              alignItems: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <button
              onClick={() => {
                setPalette((p) => !p);
                setContextMenu(null);
              }}
              style={{
                background: palette ? menuColors.buttonActive : menuColors.button,
                border: `1px solid ${menuColors.border}`,
                borderRadius: 5,
                color: menuColors.text,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              ADD NODE
            </button>
            <div style={{ width: 1, height: 14, background: menuColors.border }} />
            <button
              onClick={handleDeleteSelected}
              disabled={!selected.length}
              style={{
                background: selected.length ? "rgba(248,113,113,0.15)" : menuColors.button,
                border: `1px solid ${selected.length ? "rgba(248,113,113,0.4)" : menuColors.border}`,
                borderRadius: 5,
                color: selected.length ? "#f87171" : menuColors.muted,
                padding: "3px 10px",
                cursor: selected.length ? "pointer" : "not-allowed",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              DELETE NODE
            </button>
            <div style={{ width: 1, height: 14, background: menuColors.border }} />
            <button
              onClick={handleAutoConnect}
              style={{
                background: menuColors.button,
                border: `1px solid ${menuColors.border}`,
                borderRadius: 5,
                color: menuColors.text,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              AUTO-CONNECT
            </button>
            <div style={{ width: 1, height: 14, background: menuColors.border }} />
            <button
              onClick={handleAutoDisconnect}
              disabled={!connections.length}
              style={{
                background: connections.length ? "rgba(248,113,113,0.15)" : menuColors.button,
                border: `1px solid ${connections.length ? "rgba(248,113,113,0.4)" : menuColors.border}`,
                borderRadius: 5,
                color: connections.length ? "#f87171" : menuColors.muted,
                padding: "3px 10px",
                cursor: connections.length ? "pointer" : "not-allowed",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              AUTO-DISCONNECT
            </button>
            <div style={{ width: 1, height: 14, background: menuColors.border }} />
            <button
              onClick={handleDeleteConnection}
              disabled={!selectedConnection}
              style={{
                background: selectedConnection ? "rgba(248,113,113,0.15)" : menuColors.button,
                border: `1px solid ${selectedConnection ? "rgba(248,113,113,0.4)" : menuColors.border}`,
                borderRadius: 5,
                color: selectedConnection ? "#f87171" : menuColors.muted,
                padding: "3px 10px",
                cursor: selectedConnection ? "pointer" : "not-allowed",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              DELETE CONNECTION
            </button>
            <div style={{ width: 1, height: 14, background: menuColors.border }} />
            <span style={{ fontSize: 10, color: menuColors.muted }}>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                panRef.current = { x: 0, y: 0 };
                zoomRef.current = 1;
              }}
              style={{
                background: "none",
                border: `1px solid ${menuColors.border}`,
                borderRadius: 4,
                color: menuColors.muted,
                padding: "2px 6px",
                cursor: "pointer",
                fontSize: 9,
              }}
            >
              RESET
            </button>
          </div>
        </div>

        {palette && (
          <div
            style={{
              position: "absolute",
              top: 60,
              left: 20,
              width: 220,
              background: menuColors.menu,
              border: `1px solid ${menuColors.border}`,
              borderRadius: 12,
              zIndex: 200,
              overflow: "hidden",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ padding: "10px 12px 8px" }}>
              <input
                autoFocus
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                placeholder="Search nodes…"
                style={{
                  width: "100%",
                  background: menuColors.button,
                  border: `1px solid ${menuColors.border}`,
                  borderRadius: 6,
                  color: menuColors.text,
                  fontFamily: "'Fira Code', monospace",
                  fontSize: 11,
                  padding: "6px 10px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto", paddingBottom: 8 }}>
              {categories.map((cat) => (
                <div key={cat}>
                  <div
                    style={{
                      padding: "4px 12px 2px",
                      fontSize: 9,
                      color: menuColors.muted,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                    }}
                  >
                    {cat}
                  </div>
                  {filteredDefs.filter(([, d]) => d.category === cat).map(([name, def]) => (
                    <div
                      key={name}
                      onClick={() => addNode(name, window.innerWidth / 2, window.innerHeight / 2)}
                      style={{
                        padding: "6px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = menuColors.button;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: def.headerColor,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, color: menuColors.text }}>{name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {toast && (
          <div
            style={{
              position: "absolute",
              top: 60,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(127,29,29,0.95)",
              border: "1px solid rgba(248,113,113,0.4)",
              borderRadius: 8,
              padding: "8px 16px",
              zIndex: 400,
              color: "#fecaca",
              fontSize: 11,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            {toast}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: 100,
            background: menuColors.panel,
            border: `1px solid ${menuColors.border}`,
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            maxWidth: 500,
          }}
        >
          {Object.entries(portTypes).filter(([k]) => k !== "ANY").map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: 9, color: menuColors.muted, letterSpacing: "0.05em" }}>{k}</span>
            </div>
          ))}
        </div>

        {contextMenu && (
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              background: menuColors.menu,
              border: `1px solid ${menuColors.border}`,
              borderRadius: 10,
              zIndex: 300,
              overflow: "hidden",
              minWidth: 200,
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <div style={{ padding: "6px 12px 4px", fontSize: 9, color: menuColors.muted, letterSpacing: "0.15em" }}>
              ADD NODE
            </div>
            {Object.entries(nodeDefs).map(([name, def]) => (
              <div
                key={name}
                onClick={() => addNode(name, contextMenu.svgX, contextMenu.svgY)}
                style={{
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 11,
                  color: menuColors.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = menuColors.button;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: def.headerColor,
                    flexShrink: 0,
                  }}
                />
                {name}
              </div>
            ))}
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ cursor: isPanning ? "grabbing" : wiring ? "crosshair" : "default" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          onClick={() => setContextMenu(null)}
        >
          <defs>
            <pattern
              id="grid"
              width={40 * zoom}
              height={40 * zoom}
              patternUnits="userSpaceOnUse"
              x={pan.x % (40 * zoom)}
              y={pan.y % (40 * zoom)}
            >
              <path d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {connections.map((conn) => {
              const pts = getWireEndpoints(conn);
              if (!pts) return null;
              const color = getWireColor(conn);
              return (
                <path
                  key={conn.id}
                  d={wirePath(pts.from.x, pts.from.y, pts.to.x, pts.to.y)}
                  fill="none"
                  stroke={selectedConnection?.id === conn.id ? (lightCanvas ? "#0f172a" : "#ffffff") : color}
                  strokeWidth={selectedConnection?.id === conn.id ? 4 : 2.5}
                  strokeOpacity={0.85}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTriggerValue("connection_selected", conn);
                    setSelectedConnection(conn);
                  }}
                >
                  <title>Click to select</title>
                </path>
              );
            })}

            {nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                nodeDefs={nodeDefs}
                selected={selected.includes(node.id)}
                wiring={wiring}
                connections={connections}
                onSelect={(id, additive) => {
                  const node = nodes.find((candidate) => candidate.id === id);
                  if (node) setTriggerValue("node_selected", node);
                  setSelected((sel) =>
                    additive
                      ? sel.includes(id)
                        ? sel.filter((s) => s !== id)
                        : [...sel, id]
                      : [id],
                  );
                }}
                onDragStart={handleNodeDragStart}
                onPortMouseDown={handlePortMouseDown}
                onPortMouseUp={handlePortMouseUp}
                onParamChange={handleParamChange}
              />
            ))}
          </g>

          {wiring && (() => {
            const fromNode = nodes.find((n) => n.id === wiring.fromNode);
            if (!fromNode) return null;
            const from = getPortPos(fromNode, wiring.fromSide, wiring.fromPort);
            const fx = from.x * zoom + pan.x;
            const fy = from.y * zoom + pan.y;
            const color = PORT_TYPES[wiring.fromType]?.color ?? "#71717a";
            return (
              <path
                d={wirePath(fx, fy, wirePos.x, wirePos.y)}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeOpacity={0.7}
                strokeDasharray="6 3"
              />
            );
          })()}
        </svg>
      </div>
    </>
  );
}

export default NodeEditorComponent;
