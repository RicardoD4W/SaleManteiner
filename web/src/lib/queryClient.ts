import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // App local: los datos se consideran frescos para siempre y solo se
      // refetchean cuando una mutación invalida la clave (`['buys']`,
      // `['solds']`, `['customers']`). Es el "caching que solo se actualiza
      // al comprar/vender". `gcTime` (5 min por defecto) sigue descartando la
      // caché cuando la página queda sin observadores, así que al volver
      // después de un rato se vuelve a pedir.
      staleTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
