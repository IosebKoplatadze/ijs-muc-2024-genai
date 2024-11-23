import { effect, inject, Injectable, signal } from '@angular/core';
import { TodosService } from './todos.service';
import { HttpClient } from '@angular/common/http';
import {
  ChatCompletionMessageParam,
  CreateMLCEngine,
  MLCEngine,
} from '@mlc-ai/web-llm';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AiService {
  readonly progress = signal(0);
  readonly ready = signal(false);
  readonly started = signal(false);
  readonly replay = signal('');

  private readonly todosService = inject(TodosService);
  private readonly httpClient = inject(HttpClient);
  private readonly rawReplay = signal('');
  private readonly seed = signal(0);
  private readonly messages = signal<ChatCompletionMessageParam[]>([]);
  private engine?: MLCEngine;
  private readonly systemPrompt = toSignal(
    this.httpClient.get('./system.prompt', { responseType: 'text' })
  );

  constructor() {
    this.init();
    effect(
      async () => {
        this.replay.set('...');
        const rawData = this.rawReplay();
        console.log('🚀 ~ ChatComponent ~ rawData:', rawData);
        if (!this.checkIfIsFunctionCall(rawData)) {
          this.replay.set(rawData);
          return;
        }

        if (this.started()) {
          return;
        }

        const functionCalls = this.parseFunctionCalls(rawData);
        const toolResponse = functionCalls?.map((fc) => {
          const response = this.callFunction(fc.name, fc.parameters);
          return { name: fc.name, response };
        });

        const toolContent = toolResponse
          .map((tr) => JSON.stringify(tr))
          .join('\n');
        console.log('🚀 ~ ChatComponent ~ toolContent:', toolContent);

        this.messages.update((curr) => [
          ...curr,
          { role: 'assistant', content: rawData },
          {
            role: 'tool',
            content: toolContent,
            tool_call_id: '0',
          },
        ]);

        await this.runPrompt();
      },
      { allowSignalWrites: true }
    );
  }

  submit(prompt: string) {
    this.engine!.resetChat();
    this.seed.update((curr) => curr + 1);
    this.messages.set([
      { role: 'system', content: this.systemPrompt() ?? '' },
      { role: 'user', content: prompt },
    ]);

    this.runPrompt();
  }

  reset() {
    if (this.started()) {
      this.started.set(false);
      return;
    }

    this.rawReplay.set('');
  }

  private async init() {
    const model = 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC';
    this.engine = await CreateMLCEngine(model, {
      initProgressCallback: ({ progress }) => {
        this.progress.set(progress);
      },
    });

    this.ready.set(true);
  }

  private async runPrompt() {
    this.rawReplay.set('');
    this.started.set(true);

    const replayStream = await this.engine!.chat.completions.create({
      messages: this.messages(),
      seed: this.seed(),
      stream: true,
    });

    for await (const chunk of replayStream) {
      if (!this.started()) {
        break;
      }
      this.rawReplay.update(
        (curr) => curr + (chunk.choices[0].delta.content ?? '')
      );
    }

    this.started.set(false);
  }

  private callFunction(
    functionName: string,
    parameters: any
  ): boolean | unknown {
    switch (functionName) {
      case 'add_todo':
        this.todosService.addTodo(parameters.title);
        return true;
      case 'remove_todo':
        this.todosService.removeTodo(parameters.ids);
        return true;
      case 'toggle_completed':
        this.todosService.toggleCompleted(parameters.ids, parameters.completed);
        return true;
      case 'get_todo_list':
        const todos = this.todosService.todos();
        return todos;
    }
    return false;
  }

  private parseFunctionCalls(
    rawData: string
  ): Array<{ name: string; parameters: any }> {
    const regex = /<function>(.*)<\/function>/g;
    const match = rawData.matchAll(regex);

    return Array.from(match).map((m) => JSON.parse(m[1]));
  }

  private checkIfIsFunctionCall(rawData: string): boolean {
    return rawData.includes('<function>');
  }
}
