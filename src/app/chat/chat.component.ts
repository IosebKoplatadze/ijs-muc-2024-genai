import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AiService } from '../ai.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  imports: [MatProgressBar],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent {
  protected readonly aiService = inject(AiService);

  onSubmit(event: Event, promptEl: HTMLInputElement) {
    event.preventDefault();
    this.aiService.submit(promptEl.value);
    promptEl.value = '';
  }

  onReset(event: Event, promptEl: HTMLInputElement) {
    event.preventDefault();
    this.aiService.reset();
    promptEl.value = '';
  }
}
