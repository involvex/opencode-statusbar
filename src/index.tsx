import type {Plugin, PluginInput} from '@opencode-ai/plugin'
import {mkdir, writeFile, readFile} from 'fs/promises'
import {createSignal, onCleanup, Show} from 'solid-js'
import {tool} from '@opencode-ai/plugin'
import {createRoot} from 'solid-js'

interface TuiApi {
	slots: {
		register(options: {
			order?: number
			slots: Record<string, (ctx: TuiSlotContext) => unknown>
		}): () => void
	}
	lifecycle: {
		onDispose(callback: () => void): void
	}
}

interface TuiSlotContext {
	theme: {
		current: 'dark' | 'light' | 'system'
	}
}
import {dirname, join} from 'path'
import os from 'os'

const STATUS_DIRNAME = 'opencode-statusbar'
const STATUS_FILENAME = 'status.json'
const STATUS_DIR_MODE = 0o700
const STATUS_FILE_MODE = 0o600
const POLL_INTERVAL_MS = 2000

interface StatusInfo {
	git: {
		branch: string
		remote: string | null
		remoteBranch: string | null
		isDirty: boolean
		ahead: number
		behind: number
	}
	system: {
		cpuPercent: number
		ramUsedPercent: number
		ramUsedGB: number
		ramTotalGB: number
	}
	session: {
		tokenUsed: number
		contextUsed: number
		contextLimit: number
	}
}

interface StatusState {
	status: StatusInfo
	updatedAt: string
}

function sanitizeInstanceName(input: string): string {
	return input.replace(/[^A-Za-z0-9._-]/g, '_')
}

function resolveDefaultInstanceName(): string {
	const fromEnv = process.env.OPENCODE_STATUSBAR_INSTANCE
	if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
		const safe = sanitizeInstanceName(fromEnv)
		if (safe.length > 0) return safe
	}
	return `pid-${process.pid}`
}

function resolveStatePath(): string {
	const fromEnv = process.env.OPENCODE_STATUSBAR_STATE
	if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
		return fromEnv
	}
	const runtimeDir = process.env.XDG_RUNTIME_DIR ?? os.tmpdir()
	const instance = resolveDefaultInstanceName()
	return join(runtimeDir, STATUS_DIRNAME, instance, STATUS_FILENAME)
}

async function saveState(statePath: string, state: StatusState): Promise<void> {
	await mkdir(dirname(statePath), {recursive: true, mode: STATUS_DIR_MODE})
	await writeFile(statePath, JSON.stringify(state, null, 2), {
		encoding: 'utf8',
		mode: STATUS_FILE_MODE,
	})
}

const OpencodeStatusbarPlugin: Plugin = async (ctx: PluginInput) => {
	const state = {
		tokenUsed: 0,
		contextUsed: 0,
		contextLimit: 128_000,
	}

	const statePath = resolveStatePath()

	async function getGitStatus(): Promise<StatusInfo['git']> {
		try {
			const branch = await ctx.$`git branch --show-current`
				.text()
				.catch(() => 'unknown')
			const remoteUrl =
				await ctx.$`git remote get-url origin 2>/dev/null || echo ""`
					.text()
					.catch(() => '')
			const trackingBranch =
				await ctx.$`git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo ""`
					.text()
					.catch(() => '')
			const status = await ctx.$`git status --porcelain`.text().catch(() => '')
			const revList =
				await ctx.$`git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0 0"`
					.text()
					.catch(() => '0 0')

			const [ahead, behind] = revList.trim().split(/\s+/).map(Number)

			return {
				branch: branch.trim() || 'unknown',
				remote: remoteUrl.trim() || null,
				remoteBranch: trackingBranch.trim() || null,
				isDirty: status.trim().length > 0,
				ahead: isNaN(ahead) ? 0 : ahead,
				behind: isNaN(behind) ? 0 : behind,
			}
		} catch {
			return {
				branch: 'unknown',
				remote: null,
				remoteBranch: null,
				isDirty: false,
				ahead: 0,
				behind: 0,
			}
		}
	}

	async function getSystemStatus(): Promise<StatusInfo['system']> {
		try {
			if (process.platform === 'win32') {
				const cpuOutput =
					await ctx.$`powershell -Command "(Get-CimInstance Win32_Processor).LoadPercentage"`
						.text()
						.catch(() => '0')
				const ramOutput =
					await ctx.$`powershell -Command "$os = Get-CimInstance Win32_OperatingSystem; [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2), [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)"`
						.text()
						.catch(() => '0 0')

				const [usedGB, totalGB] = ramOutput.trim().split(/\s+/).map(Number)
				const usedPercent =
					totalGB > 0 ? Math.round((usedGB / totalGB) * 100) : 0

				return {
					cpuPercent: parseInt(cpuOutput.trim(), 10) || 0,
					ramUsedPercent: usedPercent || 0,
					ramUsedGB: isNaN(usedGB) ? 0 : usedGB,
					ramTotalGB: isNaN(totalGB) ? 0 : totalGB,
				}
			} else {
				const cpuOutput =
					await ctx.$`top -l 1 -n 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%'`
						.text()
						.catch(() => '0')
				const vmStats =
					await ctx.$`vm_stat | grep "Pages active\\|Pages wired down" | awk '{print $NF}' | tr -d '.'`
						.text()
						.catch(() => '0 0')
				const memTotal = await ctx.$`sysctl -n hw.memsize 2>/dev/null || echo 0`
					.text()
					.catch(() => '0')
				const pagesize = await ctx.$`getconf PAGESIZE 2>/dev/null || echo 4096`
					.text()
					.catch(() => '4096')

				const totalBytes = parseInt(memTotal.trim(), 10) || 0
				const totalGB =
					Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100
				const pageSize = parseInt(pagesize.trim(), 10) || 4096
				const activePages = vmStats
					.trim()
					.split(/\s+/)
					.map(p => parseInt(p, 10) || 0)
				const usedBytes = activePages.reduce(
					(sum, pages) => sum + pages * pageSize,
					0,
				)
				const usedGB = Math.round((usedBytes / 1024 / 1024 / 1024) * 100) / 100
				const usedPercent =
					totalGB > 0 ? Math.round((usedGB / totalGB) * 100) : 0

				return {
					cpuPercent: parseInt(cpuOutput.trim(), 10) || 0,
					ramUsedPercent: usedPercent,
					ramUsedGB: usedGB,
					ramTotalGB: totalGB,
				}
			}
		} catch {
			return {
				cpuPercent: 0,
				ramUsedPercent: 0,
				ramUsedGB: 0,
				ramTotalGB: 0,
			}
		}
	}

	async function getStatus(): Promise<StatusInfo> {
		const [git, system] = await Promise.all([getGitStatus(), getSystemStatus()])

		return {
			git,
			system,
			session: {
				tokenUsed: state.tokenUsed,
				contextUsed: state.contextUsed,
				contextLimit: state.contextLimit,
			},
		}
	}

	async function persistStatus(): Promise<void> {
		try {
			const status = await getStatus()
			await saveState(statePath, {
				status,
				updatedAt: new Date().toISOString(),
			})
		} catch {
			// Silently ignore errors
		}
	}

	async function showStatusNotification(): Promise<void> {
		const status = await getStatus()

		const parts: string[] = []

		parts.push(`Git: ${status.git.branch}${status.git.isDirty ? ' (*)' : ''}`)
		if (status.git.remoteBranch) {
			parts.push(`\u2192 ${status.git.remoteBranch}`)
			if (status.git.ahead > 0 || status.git.behind > 0) {
				parts.push(` (\u2191${status.git.ahead} \u2193${status.git.behind})`)
			}
		}

		parts.push(`| CPU: ${status.system.cpuPercent}%`)
		parts.push(
			`RAM: ${status.system.ramUsedGB}/${status.system.ramTotalGB}GB (${status.system.ramUsedPercent}%)`,
		)

		if (status.session.contextUsed > 0) {
			const contextPercent = Math.round(
				(status.session.contextUsed / status.session.contextLimit) * 100,
			)
			parts.push(`| Context: ${contextPercent}%`)
		}

		const message = parts.join(' ')

		await ctx.client.tui.showToast({
			body: {
				message,
				variant: 'info',
			},
		})
	}

	async function updateSessionMetrics(): Promise<void> {
		state.contextUsed = Math.round(state.tokenUsed * 3.5)
	}

	await persistStatus()
	const persistInterval = setInterval(() => persistStatus(), 5000)

	return {
		event: async ({event}) => {
			if (
				event.type === 'session.created' ||
				event.type === 'session.updated' ||
				event.type === 'session.idle'
			) {
				await updateSessionMetrics()
				await persistStatus()
			}
		},

		tool: {
			status: tool({
				description:
					'Display current statusbar information including git status, system metrics, and session info',
				args: {},
				async execute() {
					const status = await getStatus()

					const gitInfo = [
						`Branch: ${status.git.branch}`,
						status.git.remote
							? `Remote: ${status.git.remote}`
							: 'No remote configured',
						status.git.remoteBranch
							? `Tracking: ${status.git.remoteBranch}`
							: '',
						status.git.isDirty ? 'Status: Modified' : 'Status: Clean',
						status.git.ahead > 0 || status.git.behind > 0
							? `Sync: \u2191${status.git.ahead} \u2193${status.git.behind}`
							: '',
					]
						.filter(Boolean)
						.join('\n  ')

					const sysInfo = [
						`CPU: ${status.system.cpuPercent}%`,
						`RAM: ${status.system.ramUsedGB}GB / ${status.system.ramTotalGB}GB (${status.system.ramUsedPercent}%)`,
					].join('\n  ')

					const sessionInfo = [
						`Tokens: ${status.session.tokenUsed.toLocaleString()}`,
						`Context: ${Math.round((status.session.contextUsed / status.session.contextLimit) * 100)}%`,
					].join('\n  ')

					return `StatusBar Info
==============

Git:
  ${gitInfo}

System:
  ${sysInfo}

Session:
  ${sessionInfo}
`
				},
			}),

			'status.notify': tool({
				description: 'Show statusbar as a toast notification',
				args: {},
				async execute() {
					await showStatusNotification()
					return 'Status notification shown'
				},
			}),

			'status.show': tool({
				description: 'Show statusbar notification with current metrics',
				args: {},
				async execute() {
					const status = await getStatus()

					const parts: string[] = []

					parts.push(
						`Git: ${status.git.branch}${status.git.isDirty ? ' (*)' : ''}`,
					)
					if (status.git.remoteBranch) {
						parts.push(`\u2192 ${status.git.remoteBranch}`)
						if (status.git.ahead > 0 || status.git.behind > 0) {
							parts.push(`\u2191${status.git.ahead} \u2193${status.git.behind}`)
						}
					}

					parts.push(`| CPU: ${status.system.cpuPercent}%`)
					parts.push(
						`RAM: ${status.system.ramUsedGB}GB (${status.system.ramUsedPercent}%)`,
					)

					if (status.session.contextUsed > 0) {
						const pct = Math.round(
							(status.session.contextUsed / status.session.contextLimit) * 100,
						)
						parts.push(`| Ctx: ${pct}%`)
					}

					return parts.join(' ')
				},
			}),
		},

		'tool.execute.after': async input => {
			if (
				input.tool === 'bash' ||
				input.tool === 'read' ||
				input.tool === 'edit'
			) {
				state.tokenUsed += 50
				state.contextUsed = Math.min(
					state.contextUsed + 100,
					state.contextLimit,
				)
			}
		},

		dispose: async () => {
			clearInterval(persistInterval)
		},
	}
}

// ============================================================================
// TUI Component (SolidJS)
// ============================================================================

interface StatusBarProps {
	theme: 'dark' | 'light' | 'system'
}

function StatusBarComponent(props: StatusBarProps) {
	const [status, setStatus] = createSignal<StatusInfo | null>(null)
	const [lastUpdated, setLastUpdated] = createSignal<string>('')

	const statePath = resolveStatePath()

	async function loadStatus() {
		try {
			const raw = await readFile(statePath, 'utf8')
			const parsed = JSON.parse(raw) as StatusState
			setStatus(parsed.status)
			setLastUpdated(new Date(parsed.updatedAt).toLocaleTimeString())
		} catch {
			setStatus(null)
		}
	}

	loadStatus()
	const _intervalId = setInterval(loadStatus, POLL_INTERVAL_MS)
	onCleanup(() => clearInterval(_intervalId))

	const theme = () => (props.theme === 'system' ? 'dark' : props.theme)
	const isDark = () => theme() === 'dark'

	const gitBranch = () => status()?.git.branch ?? '...'
	const isDirty = () => status()?.git.isDirty ?? false
	const cpuPercent = () => status()?.system.cpuPercent ?? 0
	const ramUsed = () => status()?.system.ramUsedGB ?? 0
	const ramTotal = () => status()?.system.ramTotalGB ?? 0
	const ramPercent = () => status()?.system.ramUsedPercent ?? 0

	const gitColor = () => (isDirty() ? '#f59e0b' : '#22c55e')
	const cpuColor = () =>
		cpuPercent() > 80 ? '#ef4444' : cpuPercent() > 50 ? '#f59e0b' : '#22c55e'
	const ramColor = () =>
		ramPercent() > 80 ? '#ef4444' : ramPercent() > 50 ? '#f59e0b' : '#22c55e'

	const bgColor = () => (isDark() ? '#1e1e2e' : '#ffffff')
	const textColor = () => (isDark() ? '#cdd6f4' : '#1e1e2e')
	const mutedColor = () => (isDark() ? '#6c7086' : '#6c7086')
	const borderColor = () => (isDark() ? '#313244' : '#e4e4e7')

	return (
		<div
			style={{
				display: 'flex',
				'align-items': 'center',
				gap: '16px',
				padding: '6px 12px',
				'background-color': bgColor(),
				'border-top': `1px solid ${borderColor()}`,
				'font-size': '12px',
				'font-family':
					'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
				color: textColor(),
				'overflow-x': 'auto',
				'white-space': 'nowrap',
			}}
		>
			<Show
				when={status()}
				fallback={<div style={{color: mutedColor()}}>Loading status...</div>}
			>
				<div style={{display: 'flex', 'align-items': 'center', gap: '4px'}}>
					<span style={{color: mutedColor()}}>git:</span>
					<span style={{color: gitColor(), 'font-weight': '500'}}>
						{gitBranch()}
					</span>
					<Show when={isDirty()}>
						<span style={{color: '#f59e0b'}}>*</span>
					</Show>
				</div>

				<span style={{color: mutedColor()}}>|</span>

				<div style={{display: 'flex', 'align-items': 'center', gap: '4px'}}>
					<span style={{color: mutedColor()}}>cpu:</span>
					<span style={{color: cpuColor(), 'font-weight': '500'}}>
						{cpuPercent()}%
					</span>
				</div>

				<span style={{color: mutedColor()}}>|</span>

				<div style={{display: 'flex', 'align-items': 'center', gap: '4px'}}>
					<span style={{color: mutedColor()}}>ram:</span>
					<span style={{color: ramColor(), 'font-weight': '500'}}>
						{ramUsed().toFixed(1)}/{ramTotal().toFixed(0)}GB
					</span>
					<span style={{color: mutedColor()}}>({ramPercent()}%)</span>
				</div>

				<span style={{color: mutedColor()}}>|</span>

				<div style={{display: 'flex', 'align-items': 'center', gap: '4px'}}>
					<span style={{color: mutedColor(), 'font-size': '10px'}}>
						updated {lastUpdated()}
					</span>
				</div>
			</Show>
		</div>
	)
}

const PLUGIN_ID = 'opencode-statusbar'

function initializeTui(api: TuiApi, disposeRoot: () => void) {
	api.slots.register({
		order: 50,
		slots: {
			home_bottom(ctx: TuiSlotContext) {
				return <StatusBarComponent theme={ctx.theme.current} />
			},
		},
	})

	api.lifecycle.onDispose(disposeRoot)
}

const tui = async (api: TuiApi) => {
	createRoot(disposeRoot => {
		initializeTui(api, disposeRoot)
	})
}

// Named export for OpenCode (Plugin function)
export const server = OpencodeStatusbarPlugin

// Named export for OpenCode (TUI)
export {tui}

// Default export for plugin (PluginModule)
export default {
	id: PLUGIN_ID,
	server: OpencodeStatusbarPlugin,
	tui,
}
