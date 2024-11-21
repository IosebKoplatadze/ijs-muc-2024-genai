import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TodosService } from '../todos.service';

@Component({
  selector: 'app-todos',
  templateUrl: './todos.component.html',
  styleUrls: ['./todos.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodosComponent {
  private readonly todosService = inject(TodosService);

  get todos() {
    return this.todosService.todos;
  }

  onAddTodo(title: string): void {
    this.todosService.addTodo(title);
  }

  onToggleCompleted(id: number): void {
    this.todosService.toggleCompleted(id);
  }

  onRemoveTodo(id: number): void {
    this.todosService.removeTodo(id);
  }
}
