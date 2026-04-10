import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '../../lib/api';
import type { Task, CreateTaskInput } from '../../types';

export const TASK_KEYS = {
  all: ['tasks'] as const,
  lists: () => [...TASK_KEYS.all, 'list'] as const,
  list: (status?: string) => [...TASK_KEYS.lists(), { status }] as const,
  details: () => [...TASK_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...TASK_KEYS.details(), id] as const,
  stats: () => [...TASK_KEYS.all, 'stats'] as const,
};

export function useTasks(status?: string) {
  return useQuery({
    queryKey: TASK_KEYS.list(status),
    queryFn: () => taskApi.getAll(status),
    staleTime: 10000,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: TASK_KEYS.detail(id),
    queryFn: () => taskApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskInput) => taskApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.stats() });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTaskInput> }) =>
      taskApi.update(id, data),
    // Optimistic Update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.all });
      const previousTasks = queryClient.getQueryData<Task[]>(TASK_KEYS.lists());

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(TASK_KEYS.lists(), (old) =>
          old?.map((task) => (task.id === id ? { ...task, ...data } : task))
        );
      }
      return { previousTasks };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(TASK_KEYS.lists(), context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.stats() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => taskApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.stats() });
    },
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: TASK_KEYS.stats(),
    queryFn: () => taskApi.getStats(),
  });
}
