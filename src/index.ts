import {Plugin, PluginInput} from '@opencode-ai/plugin'

/**
 * OpencodeStatusbarPlugin - OpenCode Plugin
 *
 * Documentation: https://opencode.ai/docs/plugins/
 * SDK Reference: https://opencode.ai/docs/sdk/
 * Community Plugins: https://opencode.ai/docs/ecosystem/#plugins
 */
export const OpencodeStatusbarPlugin: Plugin = async (_ctx: PluginInput) => {
	// _ctx provides:
	// - client: OpenCode SDK client for API calls
	// - project: Current project information
	// - directory: Current working directory
	// - worktree: Git worktree path
	// - serverUrl: OpenCode server URL
	// - $: Bun shell for executing commands
	//
	// Rename to `ctx` when you start using it.

	console.log('[opencode-statusbar] plugin initialized')

	return {
		// ============================================================
		// EVENT HOOKS
		// ============================================================

		/**
		 * Subscribe to OpenCode events
		 * Events: session.idle, session.error, file.edited, tool.execute.after, etc.
		 * Full list: https://opencode.ai/docs/plugins/#events
		 *
		 * input: { event: Event }
		 */
		event: async ({event: _event}) => {},

		/**
		 * Called when config is loaded
		 * Use to modify or react to configuration changes
		 *
		 * input: Config
		 */
		config: async _config => {},

		// ============================================================
		// CHAT HOOKS
		// ============================================================

		/**
		 * Called when a new user message is received
		 * Use to modify the message or its parts before processing
		 *
		 * input: { sessionID, agent?, model?, messageID?, variant? }
		 * output: { message: UserMessage, parts: Part[] }
		 */
		'chat.message': async (_input, _output) => {},

		/**
		 * Modify LLM parameters (temperature, topP, topK)
		 *
		 * input: { sessionID, agent, model, provider, message }
		 * output: { temperature, topP, topK, options }
		 */
		'chat.params': async (_input, _output) => {},

		/**
		 * Add custom headers to LLM requests
		 *
		 * input: { sessionID, agent, model, provider, message }
		 * output: { headers: Record<string, string> }
		 */
		'chat.headers': async (_input, _output) => {},

		/**
		 * Transform messages before sending to AI (experimental)
		 * Useful for image compression, content filtering, etc.
		 *
		 * input: {}
		 * output: { messages: { info: Message, parts: Part[] }[] }
		 */
		'experimental.chat.messages.transform': async (_input, _output) => {},

		/**
		 * Transform system prompt (experimental)
		 *
		 * input: { sessionID?, model }
		 * output: { system: string[] }
		 */
		'experimental.chat.system.transform': async (_input, _output) => {},

		// ============================================================
		// TOOL HOOKS
		// ============================================================

		/**
		 * Called before a tool executes
		 * Use to modify arguments or prevent execution (throw error)
		 *
		 * input: { tool, sessionID, callID }
		 * output: { args: any }
		 */
		'tool.execute.before': async (_input, _output) => {},

		/**
		 * Called after a tool executes
		 * Use to modify or log tool results
		 *
		 * input: { tool, sessionID, callID }
		 * output: { title, output, metadata }
		 */
		'tool.execute.after': async (_input, _output) => {},

		// ============================================================
		// COMMAND HOOKS
		// ============================================================

		/**
		 * Called before a slash command executes
		 *
		 * input: { command, sessionID, arguments }
		 * output: { parts: Part[] }
		 */
		'command.execute.before': async (_input, _output) => {},

		// ============================================================
		// PERMISSION HOOKS
		// ============================================================

		/**
		 * Intercept permission requests
		 * Use to auto-allow/deny certain permissions
		 *
		 * input: Permission object
		 * output: { status: 'ask' | 'deny' | 'allow' }
		 */
		'permission.ask': async (_input, _output) => {},

		// ============================================================
		// SHELL HOOKS
		// ============================================================

		/**
		 * Inject environment variables into shell commands
		 *
		 * input: { cwd }
		 * output: { env: Record<string, string> }
		 */
		'shell.env': async (_input, _output) => {},

		// ============================================================
		// SESSION HOOKS
		// ============================================================

		/**
		 * Customize session compaction (experimental)
		 * Add context or replace the compaction prompt entirely
		 *
		 * input: { sessionID }
		 * output: { context: string[], prompt?: string }
		 */
		'experimental.session.compacting': async (_input, _output) => {},

		// ============================================================
		// TEXT HOOKS
		// ============================================================

		/**
		 * Called when text completion is done (experimental)
		 *
		 * input: { sessionID, messageID, partID }
		 * output: { text }
		 */
		'experimental.text.complete': async (_input, _output) => {},

		// ============================================================
		// CUSTOM TOOLS
		// ============================================================

		/**
		 * Register custom tools that the AI can call
		 * Import { tool } from '@opencode-ai/plugin'
		 *
		 * Example:
		 * tool: {
		 *   mytool: tool({
		 *     description: 'Description of what this tool does',
		 *     args: { foo: tool.schema.string() },
		 *     async execute(args, context) {
		 *       return `Result: ${args.foo}`
		 *     },
		 *   }),
		 * },
		 */
		// tool: {},

		// ============================================================
		// AUTH HOOKS (Advanced)
		// ============================================================

		/**
		 * Custom authentication provider
		 * Use to add OAuth or API key authentication for custom providers
		 *
		 * See: https://opencode.ai/docs/plugins/#auth-hooks
		 */
		// auth: {
		//   provider: 'my-provider',
		//   methods: [
		//     {
		//       type: 'api',
		//       label: 'API Key',
		//       authorize: async () => ({ type: 'success', key: 'xxx' }),
		//     },
		//   ],
		// },
	}
}
