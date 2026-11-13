import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-Cj5nimMJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/levels-xLlNTmeE.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var pricePattern = /^[0-9]+(\.[0-9]{1,4})?$/;
function cleanPrice(value) {
	const text = String(value ?? "").trim().replace(/[¥$,\s]/g, "");
	if (!text) return "";
	if (!pricePattern.test(text)) throw new Error("价位只填数字");
	return text;
}
function parseLevel(input) {
	if (!input || typeof input !== "object") throw new Error("无效内容");
	const raw = input;
	const name = String(raw.name ?? "").trim();
	if (!name || name.length > 40) throw new Error("请填写名称，40 字以内");
	const ticker = String(raw.ticker ?? "").trim().slice(0, 20);
	const idValue = raw.id;
	const id = idValue == null || idValue === "" ? null : Number(idValue);
	if (id != null && (!Number.isInteger(id) || id <= 0)) throw new Error("无效编号");
	return {
		id,
		name,
		ticker,
		support: cleanPrice(raw.support),
		resistance: cleanPrice(raw.resistance),
		rightSide: cleanPrice(raw.rightSide),
		breakoutClose: cleanPrice(raw.breakoutClose)
	};
}
var listLevels = createServerFn({ method: "GET" }).handler(createSsrRpc("85bcc11f67204b1d3b88ae0700e3234265ba173026e5aec8038948158a0d6818"));
var getAdminStatus = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4fb42c3a2cdc2b98578311b2fb5d95c60f5335e02a2b038b52665c101f66da27"));
var claimAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("ab885fbb84af5fbc63d1e7380b6435634b141468de7169bd958cccacc9276f0f"));
var saveLevel = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(parseLevel).handler(createSsrRpc("003bdb2cbb583b60ed14cad15ee9c761e8e29360c25b122bc7a5e94f8fe9dbfc"));
var deleteLevel = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const id = Number(input?.id);
	if (!Number.isInteger(id) || id <= 0) throw new Error("无效编号");
	return { id };
}).handler(createSsrRpc("1b993b2b26fe3bd6bab8646e2ec85fbf8ad254fef3c7eedd12ad65e6d852425a"));
//#endregion
export { saveLevel as a, listLevels as i, deleteLevel as n, getAdminStatus as r, claimAdmin as t };
