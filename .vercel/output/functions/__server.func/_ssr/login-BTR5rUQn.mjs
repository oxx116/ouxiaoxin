import { o as __toESM } from "../_runtime.mjs";
import { S as useNavigate, Z as require_react, w as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-IWHfIGH2.mjs";
import { t as GROK_PROVIDERS } from "./server-BP4xIaWT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-BTR5rUQn.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LoginPage() {
	const navigate = useNavigate();
	const [mode, setMode] = (0, import_react.useState)("up");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	async function submit(event) {
		event.preventDefault();
		setError("");
		setPending(true);
		try {
			const result = mode === "up" ? await authClient.signUp.email({
				email,
				password,
				name: "管理员"
			}) : await authClient.signIn.email({
				email,
				password
			});
			if (result.error) {
				setError(result.error.message || "登录没有成功");
				setPending(false);
				return;
			}
			await navigate({ to: "/manage" });
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "登录没有成功");
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-4xl font-semibold tracking-tight",
				children: "管理员。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm leading-6 text-muted",
				children: "第一个完成注册并点「设为管理员」的账户拥有编辑权，之后别人不能再抢。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: submit,
				className: "card-shadow mt-8 space-y-3 rounded-3xl bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm text-muted",
						children: ["邮箱", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "email",
							required: true,
							autoComplete: "username",
							value: email,
							onChange: (event) => setEmail(event.target.value),
							className: "mt-1 h-12 w-full rounded-2xl bg-bg px-4 text-base text-ink outline-none"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm text-muted",
						children: ["密码", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "password",
							required: true,
							minLength: 8,
							autoComplete: mode === "up" ? "new-password" : "current-password",
							value: password,
							onChange: (event) => setPassword(event.target.value),
							className: "mt-1 h-12 w-full rounded-2xl bg-bg px-4 text-base text-ink outline-none"
						})]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-bad",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: pending,
						className: "h-12 w-full rounded-full bg-ink text-sm font-medium text-surface disabled:opacity-60",
						children: pending ? "请稍等" : mode === "up" ? "注册管理员" : "登录"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 w-full text-sm text-muted",
						onClick: () => {
							setMode(mode === "up" ? "in" : "up");
							setError("");
						},
						children: mode === "up" ? "已有账户，去登录" : "还没有账户，去注册"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 space-y-2",
				children: GROK_PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => void signIn(provider.providerId, { callbackURL: "/manage" }),
					className: "h-12 w-full rounded-full bg-surface text-sm text-ink card-shadow",
					children: [
						"用 ",
						provider.label,
						" 继续"
					]
				}, provider.providerId))
			})
		]
	});
}
//#endregion
export { LoginPage as component };
