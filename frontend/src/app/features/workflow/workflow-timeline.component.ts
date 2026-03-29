import { Component, Input } from '@angular/core';
import { WorkflowHistoryEntry } from './workflow.models';

@Component({
  selector: 'app-workflow-timeline',
  templateUrl: './workflow-timeline.component.html',
  styleUrls: ['./workflow-timeline.component.css']
})
export class WorkflowTimelineComponent {
  @Input() entries: WorkflowHistoryEntry[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  /** When true, long entries can expand/collapse the note section. */
  @Input() collapsible = false;

  private readonly expandedIds = new Set<number>();

  trackById(_i: number, e: WorkflowHistoryEntry): number {
    return e.id;
  }

  nodeTitle(e: WorkflowHistoryEntry): string {
    const lbl = e.nodeLabel || e.nodeName;
    if (lbl) return lbl;
    if (e.nodeId != null) return `Node #${e.nodeId}`;
    return '—';
  }

  actorLabel(e: WorkflowHistoryEntry): string {
    if (e.executedBy != null) return `User #${e.executedBy}`;
    return 'System';
  }

  entryIcon(e: WorkflowHistoryEntry): string {
    const a = (e.actionTaken || '').toLowerCase();
    if (a.includes('transition') || a.includes('move')) return '→';
    if (a.includes('start') || a.includes('assign')) return '▶';
    if (a.includes('complete') || a.includes('end')) return '■';
    if (a.includes('reject') || a.includes('cancel')) return '✕';
    return '◆';
  }

  hasNote(e: WorkflowHistoryEntry): boolean {
    return !!(e.message && e.message.trim());
  }

  isOpen(e: WorkflowHistoryEntry): boolean {
    return this.expandedIds.has(e.id);
  }

  toggleEntry(e: WorkflowHistoryEntry): void {
    if (!this.collapsible || !this.hasNote(e)) return;
    if (this.expandedIds.has(e.id)) this.expandedIds.delete(e.id);
    else this.expandedIds.add(e.id);
  }

  onCardClick(e: WorkflowHistoryEntry): void {
    this.toggleEntry(e);
  }

  showNoteInline(e: WorkflowHistoryEntry): boolean {
    if (!this.hasNote(e)) return false;
    if (!this.collapsible) return true;
    return this.isOpen(e);
  }
}
