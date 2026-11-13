import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-Cj5nimMJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/levels-BcLvSj6x.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
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
function toLevel(row) {
	return {
		id: Number(row.id),
		name: row.name,
		ticker: row.ticker,
		support: row.support,
		resistance: row.resistance,
		rightSide: row.right_side,
		breakoutClose: row.breakout_close
	};
}
var listLevels_createServerFn_handler = createServerRpc({
	id: "85bcc11f67204b1d3b88ae0700e3234265ba173026e5aec8038948158a0d6818",
	name: "listLevels",
	filename: "src/lib/levels.ts"
}, (opts) => listLevels.__executeServer(opts));
var listLevels = createServerFn({ method: "GET" }).handler(listLevels_createServerFn_handler, async () => {
	const { getSql } = await import("./db-wn1j_ylP.mjs").then((n) => n.t).then((n) => n.t);
	return (await (await getSql())`
    select id, name, ticker, support, resistance, right_side, breakout_close
    from levels
    order by id desc
  `).map(toLevel);
});
async function requireAdmin(userId) {
	const { getSql } = await import("./db-wn1j_ylP.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	if ((await sql`select user_id from admins where user_id = ${userId}`).length === 0) throw new Error("只有管理员可以修改位置");
	return sql;
}
var getAdminStatus_createServerFn_handler = createServerRpc({
	id: "4fb42c3a2cdc2b98578311b2fb5d95c60f5335e02a2b038b52665c101f66da27",
	name: "getAdminStatus",
	filename: "src/lib/levels.ts"
}, (opts) => getAdminStatus.__executeServer(opts));
var getAdminStatus = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getAdminStatus_createServerFn_handler, async ({ context }) => {
	const { getSql } = await import("./db-wn1j_ylP.mjs").then((n) => n.t).then((n) => n.t);
	const rows = await (await getSql())`select user_id from admins`;
	return {
		isAdmin: rows.some((row) => row.user_id === context.userId),
		adminCount: rows.length
	};
});
var claimAdmin_createServerFn_handler = createServerRpc({
	id: "ab885fbb84af5fbc63d1e7380b6435634b141468de7169bd958cccacc9276f0f",
	name: "claimAdmin",
	filename: "src/lib/levels.ts"
}, (opts) => claimAdmin.__executeServer(opts));
var claimAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(claimAdmin_createServerFn_handler, async ({ context }) => {
	const { getSql } = await import("./db-wn1j_ylP.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const rows = await sql`select user_id from admins`;
	if (rows.length > 0) return {
		isAdmin: rows.some((row) => row.user_id === context.userId),
		claimed: false
	};
	await sql`insert into admins (user_id) values (${context.userId}) on conflict (user_id) do nothing`;
	return {
		isAdmin: true,
		claimed: true
	};
});
var saveLevel_createServerFn_handler = createServerRpc({
	id: "003bdb2cbb583b60ed14cad15ee9c761e8e29360c25b122bc7a5e94f8fe9dbfc",
	name: "saveLevel",
	filename: "src/lib/levels.ts"
}, (opts) => saveLevel.__executeServer(opts));
var saveLevel = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(parseLevel).handler(saveLevel_createServerFn_handler, async ({ data, context }) => {
	const sql = await requireAdmin(context.userId);
	if (data.id == null) {
		const rows = await sql`
        insert into levels (name, ticker, support, resistance, right_side, breakout_close)
        values (${data.name}, ${data.ticker}, ${data.support}, ${data.resistance}, ${data.rightSide}, ${data.breakoutClose})
        returning id
      `;
		return { id: Number(rows[0]?.id) };
	}
	if ((await sql`
      update levels
      set name = ${data.name},
          ticker = ${data.ticker},
          support = ${data.support},
          resistance = ${data.resistance},
          right_side = ${data.rightSide},
          breakout_close = ${data.breakoutClose},
          updated_at = now()
      where id = ${data.id}
      returning id
    `).length === 0) throw new Error("这条位置已经不在了");
	return { id: data.id };
});
var deleteLevel_createServerFn_handler = createServerRpc({
	id: "1b993b2b26fe3bd6bab8646e2ec85fbf8ad254fef3c7eedd12ad65e6d852425a",
	name: "deleteLevel",
	filename: "src/lib/levels.ts"
}, (opts) => deleteLevel.__executeServer(opts));
var deleteLevel = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const id = Number(input?.id);
	if (!Number.isInteger(id) || id <= 0) throw new Error("无效编号");
	return { id };
}).handler(deleteLevel_createServerFn_handler, async ({ data, context }) => {
	await (await requireAdmin(context.userId))`delete from levels where id = ${data.id}`;
	return { ok: true };
});
//#endregion
export { claimAdmin_createServerFn_handler, deleteLevel_createServerFn_handler, getAdminStatus_createServerFn_handler, listLevels_createServerFn_handler, saveLevel_createServerFn_handler };
