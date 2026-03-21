import http from "node:http";
import connect from "connect";

type MiddlewareSetup = (app: connect.Server) => void;

/**
 * Creates a test HTTP server using Connect — the same middleware
 * framework Vite uses internally. This lets us test our middleware
 * and route handlers with real HTTP requests.
 *
 * Usage:
 *   const server = createTestServer((app) => {
 *     app.use(someMiddleware);
 *     app.use("/path", handler);
 *   });
 *   await server.start();
 *   const res = await fetch(server.url + "/path");
 *   await server.stop();
 */
export function createTestServer(setup: MiddlewareSetup) {
  const app = connect();
  setup(app);

  const server = http.createServer(app);
  let baseUrl: string;

  return {
    async start() {
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address() as { port: number };
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    },
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    get url() {
      return baseUrl;
    },
    /** The Connect app, usable as ViteDevServer.middlewares */
    get middlewares() {
      return app;
    },
  };
}
