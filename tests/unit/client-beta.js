'use strict';

const assert = require('node:assert/strict');
const Client = require('../../src/Client');

function setup(initial, failure) {
    const state = { enabled: initial, changes: [], evaluations: 0 };
    global.window = {
        require(name) {
            if (name === 'WAWebUserPrefsGeneral') {
                return {
                    getWhatsAppWebExternalBetaJoinedIdb: () => state.enabled,
                };
            }
            if (name === 'WAWebExternalBetaOptInAction') {
                return {
                    async setOptInBetaAction(enabled) {
                        state.changes.push(enabled);
                        if (failure) throw failure;
                        state.enabled = enabled;
                    },
                };
            }
            throw new Error(`Unexpected module: ${name}`);
        },
    };
    const client = {
        pupPage: {
            evaluate(callback, enabled) {
                state.evaluations++;
                return callback(enabled);
            },
        },
    };
    return {
        get: Client.prototype.isBetaEnabled.bind(client),
        set: Client.prototype.setBetaEnabled.bind(client),
        state,
    };
}

describe('Client beta enrollment', function () {
    afterEach(function () {
        delete global.window;
    });

    it('reads enrollment, changes it both ways, and skips unchanged settings', async function () {
        const { get, set, state } = setup(true);
        assert.equal(await get(), true);
        assert.equal(await set(false), false);
        assert.equal(await get(), false);
        assert.equal(await set(false), false);
        assert.equal(await set(true), true);
        assert.deepEqual(state.changes, [false, true]);
    });

    it('rejects non-booleans before accessing the browser', async function () {
        const { set, state } = setup(false);
        for (const value of [undefined, null, 'false', 0, 1, {}]) {
            await assert.rejects(set(value), TypeError);
        }
        assert.equal(state.evaluations, 0);
    });

    it('propagates a native action failure without reporting success', async function () {
        const failure = new Error('Enrollment sync failed');
        const { get, set } = setup(false, failure);
        await assert.rejects(set(true), failure);
        assert.equal(await get(), false);
    });
});
