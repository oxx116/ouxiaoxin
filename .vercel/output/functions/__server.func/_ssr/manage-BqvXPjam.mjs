import { o as __toESM } from "../_runtime.mjs";
import { Z as require_react, w as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as RedirectToSignIn, r as useCurrentUserState } from "./router-zuBTRWaf.mjs";
import { a as saveLevel, i as listLevels, n as deleteLevel, r as getAdminStatus, t as claimAdmin } from "./levels-xLlNTmeE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/manage-BqvXPjam.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var empty = {
	name: "",
	ticker: "",
	support: "",
	resistance: "",
	rightSide: "",
	breakoutClose: ""
};
function ManagePage() {
	const { user, isPending } = useCurrentUserState();
	const [access, setAccess] = (0, import_react.useState)("loading");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [draft, setDraft] = (0, import_react.useState)(empty);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [message, setMessage] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		let alive = true;
		getAdminStatus().then(async (status) => {
			if (!alive) return;
			setAccess(status.isAdmin ? "admin" : status.adminCount === 0 ? "open" : "locked");
			if (status.isAdmin) setRows(await listLevels());
		}).catch(() => {
			if (alive) setAccess("locked");
		});
		return () => {
			alive = false;
		};
	}, [user]);
	if (isPending || user && access === "loading") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto max-w-3xl px-5 py-16",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 w-40 rounded-full bg-surface" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	async function claim() {
		setBusy(true);
		setMessage("");
		try {
			if (!(await claimAdmin()).isAdmin) {
				setAccess("locked");
				setMessage("管理员已经有人了。");
				return;
			}
			setAccess("admin");
			setRows(await listLevels());
		} catch (cause) {
			setMessage(cause instanceof Error ? cause.message : "没有设成管理员");
		} finally {
			setBusy(false);
		}
	}
	async function save(event) {
		event.preventDefault();
		setBusy(true);
		setMessage("");
		try {
			await saveLevel({ data: editing == null ? draft : {
				...draft,
				id: editing
			} });
			setRows(await listLevels());
			setDraft(empty);
			setEditing(null);
		} catch (cause) {
			setMessage(cause instanceof Error ? cause.message : "没有保存");
		} finally {
			setBusy(false);
		}
	}
	async function remove(id) {
		setBusy(true);
		setMessage("");
		try {
			await deleteLevel({ data: { id } });
			setRows(await listLevels());
			if (editing === id) {
				setEditing(null);
				setDraft(empty);
			}
		} catch (cause) {
			setMessage(cause instanceof Error ? cause.message : "没有删除");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-3xl px-5 py-14 md:py-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-4xl font-semibold tracking-tight md:text-5xl",
				children: "更新位置。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm leading-6 text-muted",
				children: "支撑、压力、右侧都手填。填了突破收盘，首页才会亮出那张提醒卡。"
			}),
			access === "open" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: busy,
				onClick: () => void claim(),
				className: "mt-8 h-12 rounded-full bg-ink px-6 text-sm font-medium text-surface disabled:opacity-60",
				children: "把这个账户设为管理员"
			}) : null,
			access === "locked" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-8 text-sm text-muted",
				children: "这个账户不是管理员，不能改位置。"
			}) : null,
			access === "admin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: save,
				className: "card-shadow mt-8 space-y-3 rounded-3xl bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "名称",
								value: draft.name,
								onChange: (name) => setDraft({
									...draft,
									name
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "代码",
								value: draft.ticker,
								onChange: (ticker) => setDraft({
									...draft,
									ticker
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "支撑位置",
								value: draft.support,
								onChange: (support) => setDraft({
									...draft,
									support
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "压力位置",
								value: draft.resistance,
								onChange: (resistance) => setDraft({
									...draft,
									resistance
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "右侧位置",
								value: draft.rightSide,
								onChange: (rightSide) => setDraft({
									...draft,
									rightSide
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "突破后收盘",
								value: draft.breakoutClose,
								onChange: (breakoutClose) => setDraft({
									...draft,
									breakoutClose
								})
							})
						]
					}),
					message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-bad",
						children: message
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: busy,
							className: "h-11 rounded-full bg-ink px-5 text-sm font-medium text-surface disabled:opacity-60",
							children: editing == null ? "添加" : "保存"
						}), editing != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-11 rounded-full px-4 text-sm text-muted",
							onClick: () => {
								setEditing(null);
								setDraft(empty);
							},
							children: "取消"
						}) : null]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 space-y-3",
				children: rows.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3 rounded-3xl bg-surface px-5 py-4 card-shadow",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: level.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [
							"支撑 ",
							level.support || "—",
							" · 压力 ",
							level.resistance || "—",
							" · 右侧 ",
							level.rightSide || "—",
							level.breakoutClose ? ` · 收盘 ${level.breakoutClose}` : ""
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-10 rounded-full px-3 text-sm text-ink",
							onClick: () => {
								setEditing(level.id);
								setDraft({
									name: level.name,
									ticker: level.ticker,
									support: level.support,
									resistance: level.resistance,
									rightSide: level.rightSide,
									breakoutClose: level.breakoutClose
								});
							},
							children: "编辑"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-10 rounded-full px-3 text-sm text-bad",
							onClick: () => void remove(level.id),
							children: "删除"
						})]
					})]
				}, level.id))
			})] }) : null
		]
	});
}
function Field({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block text-sm text-muted",
		children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			value,
			onChange: (event) => onChange(event.target.value),
			className: "mt-1 h-12 w-full rounded-2xl bg-bg px-4 text-base text-ink outline-none"
		})]
	});
}
//#endregion
export { ManagePage as component };
