/** 单条消息（一行 JSON）的长度上限：防止客户端发送永不换行的大包把房主进程内存吃爆。 */
export const MAX_LINE_CHARS = 1024 * 1024;
export class LineTooLongError extends Error {
    limit;
    constructor(limit) {
        super(`单条消息超过长度上限（${limit} 字符）`);
        this.limit = limit;
        this.name = "LineTooLongError";
    }
}
export class JsonLineParser {
    maxLineChars;
    buffer = "";
    constructor(maxLineChars = MAX_LINE_CHARS) {
        this.maxLineChars = maxLineChars;
    }
    push(chunk) {
        this.buffer += chunk;
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";
        const messages = [];
        for (const line of lines) {
            if (line.length > this.maxLineChars) {
                throw new LineTooLongError(this.maxLineChars);
            }
            if (line.trim().length > 0) {
                messages.push(JSON.parse(line));
            }
        }
        // 尚未换行的残行同样受限：否则一条永不结束的超长行仍会无限增长。
        if (this.buffer.length > this.maxLineChars) {
            throw new LineTooLongError(this.maxLineChars);
        }
        return messages;
    }
}
