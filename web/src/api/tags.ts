import { apiFetch } from './client.js';

export type TagScope = 'buy' | 'sold';

export interface ApiTag {
  id: number;
  scope: TagScope;
  name: string;
  color: string;
  created_at: string;
}

export interface ApiTagWithCount extends ApiTag {
  buy_count: number;
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

interface TagListResponse {
  data: ApiTagWithCount[];
}

interface TagItemResponse {
  data: ApiTag;
}

export function listTags(scope: TagScope): Promise<ApiTagWithCount[]> {
  return apiFetch<TagListResponse>(`/api/tags/${scope}`).then((r) => r.data);
}

export function createTag(scope: TagScope, input: CreateTagInput): Promise<ApiTag> {
  return apiFetch<TagItemResponse>(`/api/tags/${scope}`, { method: 'POST', body: input }).then(
    (r) => r.data,
  );
}

export function updateTag(scope: TagScope, id: number, input: UpdateTagInput): Promise<ApiTag> {
  return apiFetch<TagItemResponse>(`/api/tags/${scope}/${id}`, {
    method: 'PATCH',
    body: input,
  }).then((r) => r.data);
}

export function deleteTag(scope: TagScope, id: number): Promise<void> {
  return apiFetch<void>(`/api/tags/${scope}/${id}`, { method: 'DELETE' });
}

export const tagsApi = {
  list: listTags,
  create: createTag,
  update: updateTag,
  remove: deleteTag,
};
