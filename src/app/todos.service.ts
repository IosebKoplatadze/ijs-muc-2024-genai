import { effect, Injectable, signal } from '@angular/core';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

const LOCAL_STORAGE_KEY = 'todos';

@Injectable({
  providedIn: 'root',
})
export class TodosService {
  public readonly todos = signal<Array<Todo>>([]);

  constructor() {
    this.recoverTodos();
    effect(() => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.todos()));
    });
  }

  addTodo(title: string): void {
    this.todos.update((todos) => {
      return todos.concat({
        id: todos.length + 1,
        title,
        completed: false,
      });
    });
  }

  toggleCompleted(id: number, completed?: boolean): void {
    this.todos.update((todos) =>
      todos.map((todo) => {
        if (todo.id === id) {
          todo.completed = completed ?? !todo.completed;
        }
        return todo;
      })
    );
  }

  removeTodo(id: number): void {
    this.todos.update((todos) => todos.filter((todo) => todo.id !== id));
  }

  private recoverTodos(): void {
    const todos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (todos) {
      this.todos.set(JSON.parse(todos));
    }
  }
}
