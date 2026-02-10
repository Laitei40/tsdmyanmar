import { onRequest as __api_news__id__js_onRequest } from "C:\\Users\\laite\\Documents\\TSD\\functions\\api\\news\\[id].js"
import { onRequest as __api_news_index_js_onRequest } from "C:\\Users\\laite\\Documents\\TSD\\functions\\api\\news\\index.js"

export const routes = [
    {
      routePath: "/api/news/:id",
      mountPath: "/api/news",
      method: "",
      middlewares: [],
      modules: [__api_news__id__js_onRequest],
    },
  {
      routePath: "/api/news",
      mountPath: "/api/news",
      method: "",
      middlewares: [],
      modules: [__api_news_index_js_onRequest],
    },
  ]