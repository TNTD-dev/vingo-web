import { defineConfig } from 'orval'

export default defineConfig({
  vingo: {
    input: { target: './contracts/vingo-openapi.yaml' },
    output: {
      mode: 'tags-split',
      target: './src/api/generated/endpoints',
      schemas: './src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mock: true,
      clean: true,
      override: {
        mutator: { path: './src/api/http.ts', name: 'http' },
        query: { useQuery: true, useSuspenseQuery: false },
        // Hàm trả thẳng body; lỗi HTTP ném ApiError trong http.ts.
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
})
