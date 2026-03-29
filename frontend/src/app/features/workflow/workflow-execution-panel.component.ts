import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { WorkflowApiService } from './workflow-api.service';
import {
  EntityWorkflowState,
  WorkflowHistoryEntry,
  WorkflowNextOption
} from './workflow.models';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-workflow-execution-panel',
  templateUrl: './workflow-execution-panel.component.html',
  styleUrls: ['./workflow-execution-panel.component.css']
})
export class WorkflowExecutionPanelComponent implements OnChanges {
  @Input() entityType = 'complaint';
  @Input() entityId: number | null = null;
  /** Admin / Super Admin may transition; staff read-only. */
  @Input() canTransition = false;

  loading = false;
  transitioningTo: number | null = null;
  error: string | null = null;
  state: EntityWorkflowState | null = null;
  transitionMessage = '';

  constructor(
    private readonly workflowApi: WorkflowApiService,
    private readonly toast: ToastService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityId'] || changes['entityType']) {
      this.reload();
    }
  }

  reload(): void {
    const id = this.entityId;
    if (id == null || id < 1) {
      this.state = null;
      this.error = null;
      return;
    }
    this.loading = true;
    this.error = null;
    this.workflowApi.getEntityWorkflowState(this.entityType, id, 80).subscribe({
      next: (s) => {
        this.state = s;
        this.loading = false;
      },
      error: (err) => {
        this.state = null;
        this.loading = false;
        this.error = err?.error?.message || 'Could not load workflow state.';
      }
    });
  }

  get historyChronological(): WorkflowHistoryEntry[] {
    const h = this.state?.history || [];
    return [...h].reverse();
  }

  currentBadge(): string {
    const n = this.state?.currentNode;
    if (!n) return 'No workflow';
    return n.label || n.name || n.nodeType || '—';
  }

  transition(opt: WorkflowNextOption): void {
    if (!this.canTransition || !opt.allowed) return;
    const id = this.entityId;
    if (id == null) return;
    const targetName = opt.targetNode.label || opt.targetNode.name || opt.targetNode.nodeType || 'next step';
    if (!globalThis.confirm(`Move this record to "${targetName}"?`)) return;
    this.transitioningTo = opt.toNodeId;
    const msg = this.transitionMessage.trim();
    this.workflowApi
      .transitionEntity(this.entityType, id, {
        toNodeId: opt.toNodeId,
        message: msg || null
      })
      .subscribe({
        next: (res) => {
          this.transitioningTo = null;
          this.transitionMessage = '';
          this.state = {
            entityType: res.entityType,
            entityId: res.entityId,
            workflow: res.workflow,
            currentNode: res.currentNode,
            nextOptions: res.nextOptions,
            history: res.history
          };
          this.toast.success(res.message || 'Workflow updated');
        },
        error: (err) => {
          this.transitioningTo = null;
          this.toast.error(err?.error?.message || 'Transition failed');
        }
      });
  }
}
