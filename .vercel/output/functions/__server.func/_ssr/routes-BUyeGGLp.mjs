import { o as __toESM } from "../_runtime.mjs";
import { Z as require_react, b as Link, w as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as listLevels } from "./levels-xLlNTmeE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BUyeGGLp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function showPrice(raw) {
	if (!raw) return "—";
	const value = Number(raw);
	if (!Number.isFinite(value)) return raw;
	return value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}
function Home() {
	const [rows, setRows] = (0, import_react.useState)(null);
	const [failed, setFailed] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let alive = true;
		listLevels().then((next) => {
			if (alive) setRows(next);
		}).catch(() => {
			if (alive) setFailed(true);
		});
		return () => {
			alive = false;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-6xl px-5 py-14 md:px-6 md:py-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "max-w-3xl text-5xl font-semibold leading-none tracking-tight text-ink md:text-7xl",
				children: "支撑、压力、右侧。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 max-w-xl text-lg leading-relaxed text-muted",
				children: "位置由管理员手动更新。右侧突破之后，收盘价单独亮出来。"
			}),
			rows === null && !failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-12 h-40 rounded-3xl bg-surface" }) : null,
			failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-12 text-bad",
				children: "位置暂时读不出来，刷新再试。"
			}) : null,
			rows && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "card-shadow mt-12 rounded-3xl bg-surface px-6 py-16 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-lg font-medium",
						children: "还没有位置。"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "管理员登录后，在管理页填支撑、压力和右侧。"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/manage",
						className: "mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-surface",
						children: "去管理"
					})
				]
			}) : null,
			rows && rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-12 grid gap-4 md:grid-cols-2",
				children: rows.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "card-shadow rounded-3xl bg-surface p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-2xl font-semibold tracking-tight",
								children: level.name
							}), level.ticker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm text-faint",
								children: level.ticker
							}) : null]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-6 grid grid-cols-3 gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Price, {
									label: "支撑",
									value: level.support
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Price, {
									label: "压力",
									value: level.resistance
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Price, {
									label: "右侧",
									value: level.rightSide
								})
							]
						}),
						level.breakoutClose ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakoutCard, { price: level.breakoutClose }) : null
					]
				}, level.id))
			}) : null
		]
	});
}
function Price({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-bg px-3 py-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-faint",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "mt-2 text-xl font-semibold tabular-nums tracking-tight",
			children: showPrice(value)
		})]
	});
}
function BreakoutCard({ price }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 rounded-2xl bg-good-soft px-4 py-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs font-medium text-good",
			children: "右侧已突破 · 收盘"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-3xl font-semibold tracking-tight text-good tabular-nums",
			children: showPrice(price)
		})]
	});
}
//#endregion
export { Home as component };
