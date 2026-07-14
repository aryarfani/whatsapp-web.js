# Invalid Last-Message Key Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `getChats()` from passing an absent serialized last-message key into WhatsApp Web's IndexedDB message store.

**Architecture:** Keep the fix inside the injected `getChatModel()` serializer. Resolve `chat.lastReceivedKey?._serialized` once and only query `Msg` when that value exists, preserving existing behavior for valid chats while returning `lastMessage: null` for malformed pseudo-chats.

**Tech Stack:** CommonJS, Mocha, Chai, Puppeteer page injection.

## Global Constraints

- Do not special-case the observed `0@c.us` identifier.
- Do not swallow unrelated IndexedDB or chat-serialization errors.
- Do not commit or change branch state unless explicitly requested.

---

### Task 1: Guard Missing Serialized Last-Message Keys

**Files:**
- Create: `tests/unit/injected-utils.js`
- Modify: `src/util/Injected/Utils.js:982`

**Interfaces:**
- Consumes: `window.WWebJS.getChatModel(chat, options)` and `chat.lastReceivedKey?._serialized`.
- Produces: a serialized chat model whose `lastMessage` remains `null` when the serialized lookup key is absent.

- [ ] **Step 1: Write the failing regression test**

Create a fake `0@c.us` chat with `lastReceivedKey: {}` and assert that `getChatModel()` returns `lastMessage: null` without calling `WAWebCollections.Msg.get()`.

- [ ] **Step 2: Verify the regression test is red**

Run: `npx mocha tests/unit/injected-utils.js --timeout 5000`

Expected: FAIL because the current implementation calls `Msg.get(undefined)`.

- [ ] **Step 3: Implement the minimal guard**

Store `chat.lastReceivedKey?._serialized` in a local constant and condition the existing message lookup on that value.

- [ ] **Step 4: Verify focused tests and syntax**

Run: `npx mocha tests/unit/injected-utils.js --timeout 5000`

Expected: PASS with one passing test.

Run: `node --check src/util/Injected/Utils.js`

Expected: exit code 0.

- [ ] **Step 5: Validate against the real local session**

Mirror the modified `Utils.js` into the worker-local dependency, start the worker, trigger sales 195 sync, and require the logs to proceed beyond `Starting single-file monthly fetch` without `Sync failed createClientForSync`.

