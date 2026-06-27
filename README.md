# opencode-statusbar

OpenCode plugin.

## Installation

Add to your `opencode.json` (global or per-project):

```json
{
	"plugin": ["@involvex/opencode-statusbar@latest"]
}
```

OpenCode will automatically install the plugin on next launch.

## Development

```bash
# Install dependencies
bun install

# Run OpenCode with the plugin loaded from source
bun dev

# Typecheck
bun typecheck
```

### Project Structure

```
opencode-statusbar/
├── src/
│   └── index.ts      # Plugin entry point with all available hooks
├── dev.ts            # Development script (runs OpenCode with plugin)
├── package.json
├── tsconfig.json
└── ...
```

### Plugin Context

Your plugin receives a context object with:

- `client` - OpenCode SDK client for API calls (logging, toasts, etc.)
- `project` - Current project information
- `directory` - Current working directory
- `worktree` - Git worktree path
- `$` - Bun shell for executing commands

### Available Hooks

See `src/index.ts` for all available hooks with descriptions. Key hooks:

| Hook                  | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `event`               | Subscribe to OpenCode events (session.idle, file.edited, etc.) |
| `chat.message`        | Intercept user messages                                        |
| `chat.params`         | Modify LLM parameters (temperature, etc.)                      |
| `tool.execute.before` | Modify tool arguments or block execution                       |
| `tool.execute.after`  | Process tool results                                           |
| `permission.ask`      | Auto-allow/deny permissions                                    |
| `tool`                | Register custom tools                                          |

### Logging

Use `client.app.log()` for structured logging instead of `console.log`:

```typescript
await ctx.client.app.log({
	body: {
		service: 'opencode-statusbar',
		level: 'info', // 'debug' | 'info' | 'warn' | 'error'
		message: 'Something happened',
		extra: {foo: 'bar'},
	},
})
```

### Custom Tools

```typescript
import {tool} from '@opencode-ai/plugin'

export const MyPlugin: Plugin = async ctx => {
	return {
		tool: {
			mytool: tool({
				description: 'What this tool does',
				args: {
					input: tool.schema.string(),
				},
				async execute(args, context) {
					return `Result: ${args.input}`
				},
			}),
		},
	}
}
```

## Publishing

```bash
npm publish
```

After publishing, users can install with:

```json
{
	"plugin": ["@involvex/opencode-statusbar@latest"]
}
```

## Resources

- [Plugin Documentation](https://opencode.ai/docs/plugins/)
- [SDK Reference](https://opencode.ai/docs/sdk/)
- [Community Plugins](https://opencode.ai/docs/ecosystem/#plugins)
- [OpenCode Discord](https://opencode.ai/discord)

## License

MIT
