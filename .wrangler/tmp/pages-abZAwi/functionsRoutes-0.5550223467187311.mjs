import { onRequest as __api_update_js_onRequest } from "C:\\Users\\laite\\Documents\\TSD\\functions\\api\\update.js"
import { onRequest as __api_updates_js_onRequest } from "C:\\Users\\laite\\Documents\\TSD\\functions\\api\\updates.js"

export const routes = [
    {
      routePath: "/api/update",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_update_js_onRequest],
    },
  {
      routePath: "/api/updates",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_updates_js_onRequest],
    },
  ]