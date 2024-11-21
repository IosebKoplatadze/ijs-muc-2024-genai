import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  ChatCompletionMessageParam,
  CreateMLCEngine,
  MLCEngine,
} from '@mlc-ai/web-llm';
import { TodosService } from '../todos.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  imports: [MatProgressBar],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit {
  private readonly todosService = inject(TodosService);

  protected readonly progress = signal(0);
  protected readonly ready = signal(false);
  protected readonly started = signal(false);
  protected readonly replay = signal('');
  private readonly rawReplay = signal('');
  private readonly seed = signal(0);
  private readonly stop = signal(false);
  private readonly messages = signal<ChatCompletionMessageParam[]>([]);
  private engine?: MLCEngine;
  private readonly systemPrompt = `Cutting Knowledge Date: December 2023
Today Date: 23 Jul 2024
# Tool Instructions
- When looking for real time information use relevant functions if available
You have access to the following functions:

{
"type": "function",
"function": {
  "name": "add_todo",
  "description": "add new user todo item",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "title of the todo item",
      },
      "completed": {
        "type": "boolean",
        "description": "boolean if the todo item completed or not",
      },
    },
    "required": ["title"],
    "additionalProperties": false,
  },
  "return": {
      "type": "string",
      "description": "success message",
  }
},
},
{
"type": "function",
"function": {
  "name": "remove_todo",
  "description": "remove the user todo item by id",
  "parameters": {
    "type": "object",
    "properties": {
      "id": {
        "type": "number",
        "description": "id of the todo item to remove",
      },
    },
    "required": ["id"],
    "additionalProperties": false,
  },
  "return": {
      "type": "string",
      "description": "success message",
  }
},
},
{
"type": "function",
"function": {
  "name": "toggle_completed",
  "description": "toggle the user todo item completion by id",
  "parameters": {
    "type": "object",
    "properties": {
      "id": {
        "type": "number",
        "description": "id of the todo item",
      },
      "completed": {
        "type": "boolean",
        "description": "boolean if the todo item completed or not",
      },
    },
    "required": ["id"],
    "additionalProperties": false,
  },
  "return": {
      "type": "string",
      "description": "success message",
  }
},
},
{
"type": "function",
"function": {
  "name": "get_todo_list",
  "description": "get the user todo list",
  "parameters": {
      "type": "None"
  }
  "return": {
      "type": "array",
      "description": "list of todo items",
      "items": {
          "type": "object",
          "properties": {
              "id": {
                  "type": "number",
                  "description": "id of the todo item",
              },
              "title": {
                  "type": "string",
                  "description": "title of the todo item",
              },
              "completed": {
                  "type": "boolean",
                  "description": "boolean if the todo item completed or not",
              },
          },
          "required": ["id", "title", "completed"],
          "additionalProperties": false,
      }
  }
},
},
If a you choose to call a function ONLY reply in the following format:
  <function>{"name": function name, "parameters": dictionary of argument name and its value}</function>
Here is an example,
  <function>{"name": "example_function_name", "parameters": {"example_name": "example_value"}}</function>
Reminder:
- Function calls MUST follow the specified format and use BOTH <function> and </function>
- Required parameters MUST be specified
- Only call one function at a time
- When calling a function, do NOT add any other words, ONLY the function calling
- Put the entire function call reply on one line
- Always add your sources when using search results to answer the user query
You are a helpful Assistant.`;

  constructor() {
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

        const functionCall = this.parseFunctionCall(rawData);
        const toolResponse =
          functionCall &&
          this.callFunction(functionCall.name, functionCall.parameters);

        const toolContent = this.isBoolean(toolResponse)
          ? toolResponse
            ? 'Success'
            : 'Failed'
          : JSON.stringify(toolResponse);

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

  async ngOnInit() {
    const model = 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC';
    this.engine = await CreateMLCEngine(model, {
      initProgressCallback: ({ progress }) => {
        this.progress.set(progress);
      },
    });
    this.ready.set(true);
  }

  onSubmit(prompt: string) {
    this.engine!.resetChat();
    this.seed.update((curr) => curr + 1);
    this.messages.set([
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt },
    ]);

    this.runPrompt();
  }

  onReset() {
    if (this.started()) {
      this.stop.set(true);
      return;
    }

    this.rawReplay.set('');
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
      if (this.stop()) {
        this.stop.set(false);
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
        this.todosService.removeTodo(parameters.id);
        return true;
      case 'toggle_completed':
        this.todosService.toggleCompleted(parameters.id, parameters.completed);
        return true;
      case 'get_todo_list':
        const todos = this.todosService.todos();
        return todos;
    }
    return false;
  }

  private parseFunctionCall(
    rawData: string
  ): { name: string; parameters: any } | null {
    const regex = /<function>(.*)<\/function>/;
    const match = rawData.match(regex);
    if (match) {
      return JSON.parse(match[1]);
    }
    return null;
  }

  private checkIfIsFunctionCall(rawData: string): boolean {
    //check if rowData starts with <function>
    return rawData.startsWith('<function>');
  }

  private isBoolean(value: any): value is boolean {
    return typeof value === 'boolean';
  }
}
