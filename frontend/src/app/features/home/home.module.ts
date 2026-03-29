import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './presentation/home.component';
import { WorkflowListComponent } from '../workflow/workflow-list.component';
import { WorkflowBuilderComponent } from '../workflow/workflow-builder.component';
import { WorkflowExecutionPanelComponent } from '../workflow/workflow-execution-panel.component';
import { WorkflowTimelineComponent } from '../workflow/workflow-timeline.component';
import { WorkflowCanvasNodeComponent } from '../workflow/workflow-canvas-node.component';
import { WorkflowHelpModalComponent } from '../workflow/workflow-help-modal.component';

@NgModule({
  declarations: [
    HomeComponent,
    WorkflowListComponent,
    WorkflowBuilderComponent,
    WorkflowExecutionPanelComponent,
    WorkflowTimelineComponent,
    WorkflowCanvasNodeComponent,
    WorkflowHelpModalComponent
  ],
  imports: [CommonModule, FormsModule, HomeRoutingModule]
})
export class HomeModule {}

