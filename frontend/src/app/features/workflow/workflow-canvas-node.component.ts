import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkflowNodeType } from './workflow.models';

@Component({
  selector: 'app-workflow-canvas-node',
  templateUrl: './workflow-canvas-node.component.html',
  styleUrls: ['./workflow-canvas-node.component.css']
})
export class WorkflowCanvasNodeComponent {
  @Input() nodeType: WorkflowNodeType | string = 'state';
  /** When true, show execution pulse (builder preview / embedded views). */
  @Input() executionActive = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() selected = false;
  @Input() isLinkSource = false;
  @Input() showInPort = true;
  @Input() showOutPort = true;

  @Output() bodyClick = new EventEmitter<MouseEvent>();
  @Output() outPortClick = new EventEmitter<MouseEvent>();
  @Output() inPortClick = new EventEmitter<MouseEvent>();

  onBody(ev: MouseEvent): void {
    ev.stopPropagation();
    this.bodyClick.emit(ev);
  }

  onOut(ev: MouseEvent): void {
    ev.stopPropagation();
    this.outPortClick.emit(ev);
  }

  onIn(ev: MouseEvent): void {
    ev.stopPropagation();
    this.inPortClick.emit(ev);
  }

  get typeIcon(): string {
    const t = this.nodeType;
    switch (t) {
      case 'start':
        return '▶';
      case 'state':
        return '◉';
      case 'action':
        return '⚡';
      case 'decision':
        return '◇';
      case 'end':
        return '■';
      default:
        return '◆';
    }
  }
}
