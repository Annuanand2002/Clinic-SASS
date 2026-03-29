import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-workflow-help-modal',
  templateUrl: './workflow-help-modal.component.html',
  styleUrls: ['./workflow-help-modal.component.css']
})
export class WorkflowHelpModalComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();

  close(): void {
    this.openChange.emit(false);
  }
}
