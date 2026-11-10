import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTag,
  deleteTag,
  listTags,
  updateTag,
  type CreateTagInput,
  type TagScope,
  type UpdateTagInput,
} from '../api/tags.js';
import { invalidate } from '../lib/queryClient';
import { toastCreated, toastDeleted, toastUpdated } from '../lib/toast';

export function useTags(scope: TagScope) {
  return useQuery({
    queryKey: ['tags', scope],
    queryFn: () => listTags(scope),
  });
}

export function useCreateTag(scope: TagScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagInput) => createTag(scope, input),
    onSuccess: (_data, input) => {
      toastCreated('tag', input.name);
      invalidate(qc, ['tags', scope], ['buys']);
    },
  });
}

export function useUpdateTag(scope: TagScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTagInput }) =>
      updateTag(scope, id, input),
    onSuccess: (_data, variables) => {
      toastUpdated('tag', variables.input.name);
      invalidate(qc, ['tags', scope], ['buys']);
    },
  });
}

export function useDeleteTag(scope: TagScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTag(scope, id),
    onSuccess: () => {
      toastDeleted('tag');
      invalidate(qc, ['tags', scope], ['buys']);
    },
  });
}
