import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { isInScope, DEFAULT_SETTINGS } from "../src/settings.ts";

describe("settings — isInScope", () => {
	test("empty includedPaths = whole vault", () => {
		assert.equal(isInScope("anything/at/all.md", []), true);
		assert.equal(isInScope("", []), true);
	});
	test("exact match", () => {
		assert.equal(isInScope("raw/wechat", ["raw/wechat"]), true);
	});
	test("descendant of an included path", () => {
		assert.equal(isInScope("raw/wechat/note.md", ["raw/wechat"]), true);
		assert.equal(isInScope("raw/wechat/sub/note.md", ["raw/wechat"]), true);
	});
	test("sibling of an included path is OUT", () => {
		// Prefix match must be path-aware: "raw/wechat-old/x" should NOT match "raw/wechat".
		assert.equal(isInScope("raw/wechat-old/x.md", ["raw/wechat"]), false);
	});
	test("any of multiple scopes matches", () => {
		const scopes = ["raw/wechat", "raw/twitter"];
		assert.equal(isInScope("raw/twitter/x.md", scopes), true);
		assert.equal(isInScope("raw/wechat/x.md", scopes), true);
		assert.equal(isInScope("raw/other/x.md", scopes), false);
	});
});

describe("settings — defaults", () => {
	test("default mode is sibling (backward-compatible)", () => {
		assert.equal(DEFAULT_SETTINGS.archiveMode, "sibling");
	});
	test("default archive dir name is _archive", () => {
		assert.equal(DEFAULT_SETTINGS.archiveDirName, "_archive");
		assert.equal(DEFAULT_SETTINGS.centralArchivePath, "_archive");
	});
	test("default auto-archive is on", () => {
		assert.equal(DEFAULT_SETTINGS.autoArchiveOnModify, true);
	});
});
