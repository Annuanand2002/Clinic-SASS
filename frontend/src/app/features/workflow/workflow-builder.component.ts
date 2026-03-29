import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { WorkflowApiService } from './workflow-api.service';
import {
  WorkflowGraphEdge,
  WorkflowGraphNode,
  WorkflowNodeType
} from './workflow.models';
import { ToastService } from '../../core/ui/toast.service';

const NODE_W = 158;
const NODE_H = 68;
const SNAP = 20;

type BuilderNode = WorkflowGraphNode;

@Component({
  selector: 'app-workflow-builder',
  templateUrl: './workflow-builder.component.html',
  styleUrls: ['./workflow-builder.component.css']
})
export class WorkflowBuilderComponent implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;
  @ViewChild('fullscreenRoot') fullscreenRootRef?: ElementRef<HTMLElement>;

  @Input() workflowId: number | null = null;
  @Output() closed = new EventEmitter<void>();

  workflowTitle = '';
  nodes: BuilderNode[] = [];
  edges: WorkflowGraphEdge[] = [];
  loading = false;
  saving = false;
  nextTempId = -1;

  selectedNodeId: number | null = null;
  selectedEdgeId: number | null = null;
  linkFromId: number | null = null;

  zoom = 1;
  panX = 48;
  panY = 48;

  private panDrag: null | { x: number; y: number; px: number; py: number } = null;
  private nodeDrag: null | {
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } = null;

  nodeNameEdit = '';
  nodeLabelEdit = '';
  nodeTypeEdit: WorkflowNodeType = 'state';
  nodeConfigJson = '{}';
  edgeConditionJson = '{}';
  edgeLabelEdit = '';

  /** Inspector drawer tab */
  inspectorTab: 'general' | 'config' = 'general';

  hoveredEdgeId: number | null = null;

  viewportW = 800;
  viewportH = 560;

  private viewportObserver: ResizeObserver | null = null;

  helpOpen = false;

  readonly addableTypes: WorkflowNodeType[] = ['state', 'action', 'decision', 'end'];

  constructor(
    private readonly api: WorkflowApiService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    const el = this.viewportRef?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      this.viewportW = el?.clientWidth ?? 800;
      this.viewportH = el?.clientHeight ?? 560;
      return;
    }
    const ro = new ResizeObserver(() => {
      this.viewportW = el.clientWidth;
      this.viewportH = el.clientHeight;
    });
    ro.observe(el);
    this.viewportObserver = ro;
    this.viewportW = el.clientWidth;
    this.viewportH = el.clientHeight;
  }

  ngOnDestroy(): void {
    const root = this.fullscreenRootRef?.nativeElement;
    if (root && this.getFullscreenElement() === root) {
      void this.exitFullscreenDom();
    }
    this.viewportObserver?.disconnect();
    this.viewportObserver = null;
  }

  get isFullscreen(): boolean {
    const root = this.fullscreenRootRef?.nativeElement;
    return !!root && this.getFullscreenElement() === root;
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  onFullscreenChange(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  async toggleFullscreen(): Promise<void> {
    const el = this.fullscreenRootRef?.nativeElement;
    if (!el) return;
    if (this.getFullscreenElement() === el) {
      await this.exitFullscreenDom();
      this.ngZone.run(() => this.cdr.detectChanges());
      return;
    }
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const req = el.requestFullscreen?.bind(el) ?? anyEl.webkitRequestFullscreen?.bind(el);
    if (!req) {
      this.toast.error('Fullscreen is not supported in this browser');
      return;
    }
    try {
      await Promise.resolve(req());
      this.ngZone.run(() => this.cdr.detectChanges());
    } catch {
      this.toast.error('Could not enter fullscreen');
    }
  }

  private getFullscreenElement(): Element | null {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  }

  private async exitFullscreenDom(): Promise<void> {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    try {
      if (document.fullscreenElement) await Promise.resolve(document.exitFullscreen?.());
      else if (doc.webkitExitFullscreen) await Promise.resolve(doc.webkitExitFullscreen());
    } catch {
      /* ignore */
    }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['workflowId']) {
      this.load();
    }
  }

  load(): void {
    const id = this.workflowId;
    if (id == null || id < 1) {
      this.nodes = [];
      this.edges = [];
      return;
    }
    this.loading = true;
    this.api.getWorkflowGraph(id).subscribe({
      next: (g) => {
        this.workflowTitle = g.workflow?.name || `Workflow #${id}`;
        this.nodes = (g.nodes || []).map((n) => ({ ...n }));
        this.edges = (g.edges || []).map((e) => ({ ...e }));
        this.loading = false;
        this.clearSelection();
        this.linkFromId = null;
        const negs = this.nodes.map((n) => n.id).filter((x) => x < 0);
        this.nextTempId = negs.length ? Math.min(...negs) - 1 : -1;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(err?.error?.message || 'Could not load graph');
      }
    });
  }

  get worldTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  get selectedNode(): BuilderNode | null {
    if (this.selectedNodeId == null) return null;
    return this.nodes.find((n) => n.id === this.selectedNodeId) || null;
  }

  get selectedEdge(): WorkflowGraphEdge | null {
    if (this.selectedEdgeId == null) return null;
    return this.edges.find((e) => e.id === this.selectedEdgeId) || null;
  }

  selectNode(n: BuilderNode): void {
    this.selectedEdgeId = null;
    this.selectedNodeId = n.id;
    this.inspectorTab = 'general';
    this.syncDrawerFromNode(n);
  }

  syncDrawerFromNode(n: BuilderNode): void {
    this.nodeNameEdit = n.name || '';
    this.nodeLabelEdit = n.label || '';
    this.nodeTypeEdit = (n.nodeType as WorkflowNodeType) || 'state';
    try {
      this.nodeConfigJson = JSON.stringify(
        n.config && typeof n.config === 'object' ? n.config : {},
        null,
        2
      );
    } catch {
      this.nodeConfigJson = '{}';
    }
  }

  selectEdge(e: WorkflowGraphEdge, ev?: Event): void {
    ev?.stopPropagation();
    this.selectedNodeId = null;
    this.selectedEdgeId = e.id;
    this.inspectorTab = 'general';
    const raw = e.conditionJson && typeof e.conditionJson === 'object' ? e.conditionJson : {};
    const lbl = raw['label'];
    this.edgeLabelEdit = typeof lbl === 'string' ? lbl : '';
    try {
      const copy = { ...raw };
      delete copy['label'];
      this.edgeConditionJson = JSON.stringify(copy, null, 2);
    } catch {
      this.edgeConditionJson = '{}';
    }
  }

  clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
  }

  applyNodeEdits(): void {
    const n = this.selectedNode;
    if (!n) return;
    n.name = this.nodeNameEdit.trim() || null;
    n.label = this.nodeLabelEdit.trim() || null;
    if (n.nodeType !== 'start') {
      n.nodeType = this.nodeTypeEdit;
    }
    try {
      const parsed = JSON.parse(this.nodeConfigJson || '{}');
      n.config = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      this.toast.error('Invalid config JSON');
    }
  }

  applyEdgeEdits(): void {
    const e = this.selectedEdge;
    if (!e) return;
    try {
      const parsed = JSON.parse(this.edgeConditionJson || '{}');
      const base = parsed && typeof parsed === 'object' ? { ...parsed } : {};
      const label = this.edgeLabelEdit.trim();
      if (label) base['label'] = label;
      else delete base['label'];
      e.conditionJson = base;
    } catch {
      this.toast.error('Invalid condition JSON');
    }
  }

  deleteSelectedNode(): void {
    const n = this.selectedNode;
    if (!n || n.nodeType === 'start') return;
    const title = n.label || n.name || `node ${n.id}`;
    if (!globalThis.confirm(`Delete "${title}"? All links to this node will be removed.`)) return;
    this.nodes = this.nodes.filter((x) => x.id !== n.id);
    this.edges = this.edges.filter((e) => e.fromNodeId !== n.id && e.toNodeId !== n.id);
    this.clearSelection();
  }

  deleteSelectedEdge(): void {
    const id = this.selectedEdgeId;
    if (id == null) return;
    if (!globalThis.confirm('Delete this connection?')) return;
    this.edges = this.edges.filter((e) => e.id !== id);
    this.selectedEdgeId = null;
  }

  addNode(t: WorkflowNodeType): void {
    const wid = this.workflowId;
    if (wid == null || wid < 1) return;
    const id = this.nextTempId--;
    const nx = this.snap(120 + -this.panX / this.zoom);
    const ny = this.snap(120 + -this.panY / this.zoom);
    const node: BuilderNode = {
      id,
      workflowId: wid,
      nodeType: t,
      name: t,
      label: t,
      config: {},
      positionX: nx,
      positionY: ny
    };
    this.nodes.push(node);
    this.selectNode(node);
  }

  snap(v: number): number {
    return Math.round(v / SNAP) * SNAP;
  }

  onOutPort(n: BuilderNode, ev: MouseEvent): void {
    ev.stopPropagation();
    this.linkFromId = n.id;
  }

  onInPort(n: BuilderNode, ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.linkFromId == null || this.linkFromId === n.id) return;
    const exists = this.edges.some(
      (e) => e.fromNodeId === this.linkFromId && e.toNodeId === n.id
    );
    if (exists) {
      this.linkFromId = null;
      return;
    }
    const wid = this.workflowId;
    if (wid == null) return;
    const newEdge: WorkflowGraphEdge = {
      id: this.nextTempId--,
      workflowId: wid,
      fromNodeId: this.linkFromId,
      toNodeId: n.id,
      conditionJson: {}
    };
    this.edges.push(newEdge);
    this.linkFromId = null;
  }

  @HostListener('document:pointermove', ['$event'])
  onDocMove(ev: PointerEvent): void {
    if (this.nodeDrag) {
      const n = this.nodes.find((x) => x.id === this.nodeDrag!.id);
      if (!n) return;
      const dx = (ev.clientX - this.nodeDrag.sx) / this.zoom;
      const dy = (ev.clientY - this.nodeDrag.sy) / this.zoom;
      n.positionX = this.snap(this.nodeDrag.ox + dx);
      n.positionY = this.snap(this.nodeDrag.oy + dy);
    } else if (this.panDrag) {
      this.panX = this.panDrag.px + (ev.clientX - this.panDrag.x);
      this.panY = this.panDrag.py + (ev.clientY - this.panDrag.y);
    }
  }

  @HostListener('document:pointerup')
  onDocUp(): void {
    this.nodeDrag = null;
    this.panDrag = null;
  }

  onNodePointerDown(n: BuilderNode, ev: PointerEvent): void {
    if ((ev.target as HTMLElement).closest('.wf-port')) return;
    ev.stopPropagation();
    this.selectNode(n);
    this.nodeDrag = {
      id: n.id,
      sx: ev.clientX,
      sy: ev.clientY,
      ox: n.positionX,
      oy: n.positionY
    };
  }

  onViewportPointerDown(ev: PointerEvent): void {
    const el = ev.target as HTMLElement;
    if (el.closest('.wf-node-wrap')) return;
    if (el.closest('.wf-edge-hit')) return;
    this.panDrag = { x: ev.clientX, y: ev.clientY, px: this.panX, py: this.panY };
    this.clearSelection();
    this.linkFromId = null;
  }

  onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const delta = ev.deltaY > 0 ? -0.09 : 0.09;
    const nz = Math.min(2.2, Math.max(0.35, this.zoom + delta));
    const wx = (mx - this.panX) / this.zoom;
    const wy = (my - this.panY) / this.zoom;
    this.zoom = nz;
    this.panX = mx - wx * nz;
    this.panY = my - wy * nz;
  }

  edgeMarkerEnd(e: WorkflowGraphEdge): string {
    if (this.hoveredEdgeId === e.id || this.selectedEdgeId === e.id) return 'url(#wf-arrow-hover)';
    return 'url(#wf-arrow)';
  }

  edgePath(e: WorkflowGraphEdge): string {
    const from = e.fromNodeId;
    const to = e.toNodeId;
    if (from == null || to == null) return '';
    const a = this.portPos(from, 'out');
    const b = this.portPos(to, 'in');
    if (!a || !b) return '';
    const c1x = a.x + 90;
    const c1y = a.y;
    const c2x = b.x - 90;
    const c2y = b.y;
    return `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`;
  }

  portPos(nodeId: number, which: 'in' | 'out'): { x: number; y: number } | null {
    const n = this.nodes.find((x) => x.id === nodeId);
    if (!n) return null;
    const cy = n.positionY + NODE_H / 2;
    if (which === 'out') return { x: n.positionX + NODE_W, y: cy };
    return { x: n.positionX, y: cy };
  }

  save(): void {
    this.applyNodeEdits();
    this.applyEdgeEdits();
    const wid = this.workflowId;
    if (wid == null) return;
    if (this.nodes.filter((n) => n.nodeType === 'start').length !== 1) {
      this.toast.error('Exactly one start node is required');
      return;
    }
    this.saving = true;
    const payload = {
      nodes: this.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        label: n.label,
        nodeType: n.nodeType,
        config: (n.config || {}) as Record<string, unknown>,
        positionX: n.positionX,
        positionY: n.positionY
      })),
      edges: this.edges.map((e) => ({
        fromNodeId: e.fromNodeId as number,
        toNodeId: e.toNodeId as number,
        conditionJson: e.conditionJson as Record<string, unknown> | null
      }))
    };
    this.api.saveWorkflowGraph(wid, payload).subscribe({
      next: (g) => {
        this.saving = false;
        this.nodes = (g.nodes || []).map((n) => ({ ...n }));
        this.edges = (g.edges || []).map((e) => ({ ...e }));
        const negs = this.nodes.map((n) => n.id).filter((x) => x < 0);
        this.nextTempId = negs.length ? Math.min(...negs) - 1 : -1;
        this.toast.success('Workflow saved');
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Save failed');
      }
    });
  }

  zoomIn(): void {
    this.zoom = Math.min(2.2, this.zoom + 0.12);
  }

  zoomOut(): void {
    this.zoom = Math.max(0.35, this.zoom - 0.12);
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 48;
    this.panY = 48;
  }

  get graphBounds(): { minX: number; maxX: number; minY: number; maxY: number } | null {
    if (!this.nodes.length) return null;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.positionX);
      maxX = Math.max(maxX, n.positionX + NODE_W);
      minY = Math.min(minY, n.positionY);
      maxY = Math.max(maxY, n.positionY + NODE_H);
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, maxX, minY, maxY };
  }

  fitView(): void {
    const b = this.graphBounds;
    const el = this.viewportRef?.nativeElement;
    if (!b || !el) {
      this.resetView();
      return;
    }
    const pad = 72;
    const gw = b.maxX - b.minX + pad * 2;
    const gh = b.maxY - b.minY + pad * 2;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (gw < 1 || gh < 1) return;
    const scale = Math.min(vw / gw, vh / gh, 2.2) * 0.94;
    const nz = Math.max(0.35, Math.min(2.2, scale));
    this.zoom = nz;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    this.panX = vw / 2 - nz * cx;
    this.panY = vh / 2 - nz * cy;
  }

  autoLayout(): void {
    const start = this.nodes.find((n) => n.nodeType === 'start');
    if (!start) {
      this.toast.error('Add a start node before auto-layout');
      return;
    }
    const level = new Map<number, number>();
    level.set(start.id, 0);
    let changed = true;
    let guard = 0;
    while (changed && guard < Math.max(200, this.nodes.length * 3)) {
      guard++;
      changed = false;
      for (const e of this.edges) {
        if (e.fromNodeId == null || e.toNodeId == null) continue;
        const fromL = level.get(e.fromNodeId);
        if (fromL === undefined) continue;
        const need = fromL + 1;
        const cur = level.get(e.toNodeId);
        if (cur === undefined || need > cur) {
          level.set(e.toNodeId, need);
          changed = true;
        }
      }
    }
    let maxL = 0;
    level.forEach((v) => (maxL = Math.max(maxL, v)));
    const orphanCol = maxL + 1;
    for (const n of this.nodes) {
      if (!level.has(n.id)) level.set(n.id, orphanCol);
    }
    const byLevel = new Map<number, BuilderNode[]>();
    let hi = 0;
    level.forEach((lv) => (hi = Math.max(hi, lv)));
    for (let lv = 0; lv <= hi; lv++) byLevel.set(lv, []);
    for (const n of this.nodes) {
      const lv = level.get(n.id) ?? orphanCol;
      byLevel.get(lv)!.push(n);
    }
    const colW = 228;
    const rowH = 104;
    for (let lv = 0; lv <= hi; lv++) {
      const row = (byLevel.get(lv) || []).sort((a, b) =>
        (a.label || a.name || '').localeCompare(b.label || b.name || '')
      );
      row.forEach((n, i) => {
        n.positionX = this.snap(56 + lv * colW);
        n.positionY = this.snap(56 + i * rowH);
      });
    }
    this.toast.success('Layout applied');
    setTimeout(() => this.fitView(), 0);
  }

  minimapViewBox(): string {
    const b = this.graphBounds;
    if (!b) return '0 0 800 600';
    const pad = 96;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    return `${b.minX - pad} ${b.minY - pad} ${w} ${h}`;
  }

  minimapViewportRect(): { x: number; y: number; width: number; height: number } | null {
    const z = this.zoom;
    if (z < 0.001) return null;
    return {
      x: -this.panX / z,
      y: -this.panY / z,
      width: this.viewportW / z,
      height: this.viewportH / z
    };
  }

  onMinimapClick(ev: MouseEvent): void {
    const svg = ev.currentTarget as SVGSVGElement | null;
    if (!svg || !this.graphBounds) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    this.panX = this.viewportW / 2 - this.zoom * local.x;
    this.panY = this.viewportH / 2 - this.zoom * local.y;
  }

  edgeDisplayLabel(e: WorkflowGraphEdge): string {
    const c = e.conditionJson;
    if (c && typeof c === 'object') {
      const lbl = c['label'];
      if (typeof lbl === 'string' && lbl.trim()) return lbl.trim();
    }
    return '';
  }

  private cubicPoint(
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
  ): { x: number; y: number } {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  edgeLabelPoint(e: WorkflowGraphEdge): { x: number; y: number } | null {
    const from = e.fromNodeId;
    const to = e.toNodeId;
    if (from == null || to == null) return null;
    const a = this.portPos(from, 'out');
    const b = this.portPos(to, 'in');
    if (!a || !b) return null;
    const p1 = { x: a.x + 90, y: a.y };
    const p2 = { x: b.x - 90, y: b.y };
    return this.cubicPoint(0.48, a, p1, p2, b);
  }

  setEdgeHover(id: number | null): void {
    this.hoveredEdgeId = id;
  }

  nodeTitleById(id: number | null): string {
    if (id == null) return '—';
    const n = this.nodes.find((x) => x.id === id);
    if (!n) return `#${id}`;
    return n.label || n.name || n.nodeType || `#${id}`;
  }

  trackNode(_i: number, n: BuilderNode): number {
    return n.id;
  }

  trackEdge(_i: number, e: WorkflowGraphEdge): number {
    return e.id;
  }
}
