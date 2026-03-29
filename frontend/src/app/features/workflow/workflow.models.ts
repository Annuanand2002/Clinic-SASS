export type WorkflowNodeType = 'start' | 'state' | 'action' | 'decision' | 'end';

export interface AdminWorkflowRow {
  id: number;
  name: string;
  entityType: string;
  isActive: boolean;
  createdAt?: string | null;
}

export interface WorkflowGraphNode {
  id: number;
  workflowId: number;
  nodeType: WorkflowNodeType;
  name: string | null;
  label: string | null;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
}

export interface WorkflowGraphEdge {
  id: number;
  workflowId: number;
  fromNodeId: number | null;
  toNodeId: number | null;
  conditionJson: Record<string, unknown> | null;
}

export interface WorkflowGraphResponse {
  workflow: AdminWorkflowRow;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

export interface WorkflowNextOption {
  edgeId: number;
  toNodeId: number;
  conditionMet: boolean;
  roleAllowed: boolean;
  allowed: boolean;
  targetNode: {
    id: number;
    nodeType: string;
    name: string | null;
    label: string | null;
    config: Record<string, unknown>;
  };
}

export interface WorkflowHistoryEntry {
  id: number;
  entityType: string;
  entityId: number;
  nodeId: number | null;
  nodeName?: string | null;
  nodeLabel?: string | null;
  actionTaken: string | null;
  message: string | null;
  executedBy: number | null;
  createdAt: string | null;
}

export interface EntityWorkflowState {
  entityType: string;
  entityId: number;
  workflow: AdminWorkflowRow | null;
  currentNode: {
    id: number;
    nodeType: string;
    name: string | null;
    label: string | null;
    config: Record<string, unknown>;
  } | null;
  nextOptions: WorkflowNextOption[];
  history: WorkflowHistoryEntry[];
}
