import {Component, OnInit, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavComponent} from './nav/nav.component';
import {ChatCompletionMessageParam, CreateMLCEngine, MLCEngine} from '@mlc-ai/web-llm';
import {join} from '@angular/compiler-cli';

interface Todo {
  text: string;
  done: boolean;
}

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
  protected readonly todos = signal<Todo[]>([]);
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
    const systemPrompt = `Here's the user's todo list:
      ${this.todos().map(todo => `* ${todo.text} (${todo.done ? 'done' : 'not done'})`).join('\n')}`;
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: value }
    ];
    const reply = await this.engine!.chat.completions.create({ messages });
    this.reply.set(reply.choices[0].message.content ?? '');
  }

  addTodo(text: string) {
    this.todos.update(todos => [...todos, { done: false, text }]);
  }

  toggleTodo(index: number) {
    this.todos.update(todos => todos.map((todo, todoIndex) =>
      todoIndex === index ? { ...todo, done: !todo.done } : todo));
  }
}
