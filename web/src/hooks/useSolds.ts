import { useQuery } from '@tanstack/react-query';
import { soldsApi } from '../api/solds.js';

export function useSolds() {
  return useQuery({
    queryKey: ['solds'],
    queryFn: soldsApi.list,
  });
}
