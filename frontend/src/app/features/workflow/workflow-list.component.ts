import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { WorkflowApiService } from './workflow-api.service';
import { AdminWorkflowRow } from './workflow.models';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-workflow-list',
  templateUrl: './workflow-list.component.html',
  styleUrls: ['./workflow-list.component.css']
})
export class WorkflowListComponent implements OnInit {
  @Output() openBuilder = new EventEmitter<number>();

  rows: AdminWorkflowRow[] = [];
  loading = false;
  filterEntityType = '';

  createOpen = false;
  createName = '';
  createEntityType = 'complaint';
  createSubmitting = false;

  patchSubmittingId: number | null = null;

  helpOpen = false;

  constructor(
    private readonly workflowApi: WorkflowApiService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    const et = this.filterEntityType.trim();
    this.workflowApi.listAdminWorkflows(et || undefined).subscribe({
      next: (list) => {
        this.rows = list;
        this.loading = false;
      },
      error: (err) => {
        this.rows = [];
        this.loading = false;
        this.toast.error(err?.error?.message || 'Could not load workflows');
      }
    });
  }

  openCreate(): void {
    this.createOpen = true;
    this.createName = '';
    this.createEntityType = 'complaint';
  }

  closeCreate(): void {
    this.createOpen = false;
  }

  submitCreate(): void {
    const name = this.createName.trim() || 'New workflow';
    this.createSubmitting = true;
    this.workflowApi
      .createAdminWorkflow({ name, entityType: this.createEntityType })
      .subscribe({
        next: (wf) => {
          this.createSubmitting = false;
          this.createOpen = false;
          this.toast.success('Workflow created');
          this.load();
          this.openBuilder.emit(wf.id);
        },
        error: (err) => {
          this.createSubmitting = false;
          this.toast.error(err?.error?.message || 'Create failed');
        }
      });
  }

  toggleActive(row: AdminWorkflowRow): void {
    this.patchSubmittingId = row.id;
    this.workflowApi.patchAdminWorkflow(row.id, { isActive: !row.isActive }).subscribe({
      next: () => {
        this.patchSubmittingId = null;
        this.toast.success(row.isActive ? 'Workflow deactivated' : 'Workflow activated');
        this.load();
      },
      error: (err) => {
        this.patchSubmittingId = null;
        this.toast.error(err?.error?.message || 'Update failed');
      }
    });
  }

  editInBuilder(id: number): void {
    this.openBuilder.emit(id);
  }
}
