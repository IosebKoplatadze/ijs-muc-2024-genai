import {Component, OnInit, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavComponent} from './nav/nav.component';
import {ChatCompletionMessageParam, CreateMLCEngine, MLCEngine} from '@mlc-ai/web-llm';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'genai-app';

  protected readonly progress = signal(0);
  protected readonly ready = signal(false);
  protected readonly reply = signal('');
  protected engine?: MLCEngine;

  async ngOnInit() {
    const model = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
    this.engine = await CreateMLCEngine(model, {
      initProgressCallback: ({ progress }) => {
        this.progress.set(progress);
      }
    });
    this.ready.set(true);
  }

  async runPrompt(value: string) {
    await this.engine!.resetChat();
    this.reply.set('…');
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: value }
    ];
    const reply = await this.engine!.chat.completions.create({ messages });
    this.reply.set(reply.choices[0].message.content ?? '');
  }
}
