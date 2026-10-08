import { Socket, createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { JsonLineParser } from "./line-parser.js";
import { encodeMessage } from "./protocol.js";
export class TestClient {
    parser = new JsonLineParser();
    messages = [];
    socket;
    destroyed = false;
    constructor(socket) {
        this.socket = socket;
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => {
            for (const message of this.parser.push(chunk)) {
                this.messages.push({ ...message, receivedAt: Date.now() });
            }
        });
        socket.on("close", () => { this.destroyed = true; });
        socket.on("error", () => { this.destroyed = true; });
    }
    /**
     * 连接并注册机器标识。默认每个客户端是独立“机器”（随机 ID）；
     * 传相同 machineId 模拟同机双开；传 null 模拟无机器标识的旧客户端。
     */
    static connect(port, machineId) {
        return new Promise((resolve, reject) => {
            const socket = new Socket();
            socket.on("connect", () => {
                if (machineId !== null) {
                    socket.write(encodeMessage({ type: "source", machineId: machineId ?? `test-${randomUUID()}` }));
                }
                resolve(new TestClient(socket));
            });
            socket.once("error", reject);
            socket.connect(port, "127.0.0.1");
        });
    }
    send(message) {
        this.socket.write(encodeMessage(message));
    }
    destroy() {
        if (!this.destroyed) {
            this.socket.destroy();
            this.destroyed = true;
        }
    }
    destroyAsync() {
        return new Promise((resolve) => {
            if (this.destroyed)
                return resolve();
            this.socket.once("close", () => resolve());
            this.socket.once("error", () => resolve());
            this.socket.destroy();
            this.destroyed = true;
        });
    }
}
export async function withTestServer(opts) {
    const server = createServer((socket) => { socket.setEncoding("utf8"); });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (typeof address !== "object" || !address)
        throw new Error("test server address unavailable");
    const client = await TestClient.connect(address.port);
    try {
        return await opts.run(client);
    }
    finally {
        client.destroy();
        await new Promise((resolve) => server.close(() => resolve()));
    }
}
