export class JsonLineParser {
    buffer = "";
    push(chunk) {
        this.buffer += chunk;
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";
        const messages = [];
        for (const line of lines) {
            if (line.trim().length > 0) {
                messages.push(JSON.parse(line));
            }
        }
        return messages;
    }
}
