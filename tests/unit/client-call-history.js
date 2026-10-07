'use strict';

const assert = require('node:assert/strict');
const Client = require('../../src/Client');

function makeCall(id, timestamp, fromMe = false) {
    return {
        id: {
            remote: { toString: () => 'contact@lid' },
            fromMe,
            toString: () => id,
        },
        t: timestamp,
        serialize: () => ({
            type: 'call_log',
            callOutcome: fromMe ? 'Completed' : 'Missed',
            callDuration: fromMe ? 14 : null,
            isVideoCall: false,
            callParticipants: [{ participant: 'contact@lid', outcome: 1 }],
            callLinkToken: null,
            bytesReceived: 123,
            viewMode: 'CALL_LOG_OFFLINE_RESUME',
        }),
    };
}

function setup(pages, { contact = null, failure = null } = {}) {
    const state = { batches: [], cleaned: false };
    class CallLogs {
        constructor() {
            this.models = new Map();
            this.page = 0;
        }
        async search(options) {
            state.batches.push(options);
            if (failure) throw failure;
            const models = pages[this.page++];
            for (const model of models)
                this.models.set(model.id.toString(), model);
            return { eof: this.page === pages.length };
        }
        getModelsArray() {
            return [...this.models.values()];
        }
        stopListening() {
            state.cleaned = true;
        }
    }
    global.window = {
        require(name) {
            switch (name) {
                case 'WAWebFtsMsgsCallLogCollection':
                    return CallLogs;
                case 'WAWebContactCollection':
                    return { ContactCollection: { get: () => contact } };
                case 'WAWebFrontendContactGetters':
                    return { getDisplayName: (value) => value.name };
                default:
                    throw new Error(`Unexpected module: ${name}`);
            }
        },
    };
    const client = {
        pupPage: {
            evaluate: (callback, maximum) => callback(maximum),
        },
    };
    return { get: Client.prototype.getCallHistory.bind(client), state };
}

describe('Client call history', function () {
    afterEach(function () {
        delete global.window;
    });

    it('reads to EOF, deduplicates native overlaps and preserves call metadata', async function () {
        const a = makeCall('a', 30);
        const b = makeCall('b', 20, true);
        const c = makeCall('c', 10);
        const { get, state } = setup(
            [
                [b, a],
                [b, c],
            ],
            {
                contact: {
                    id: { toString: () => 'contact@lid' },
                    name: 'Contact',
                    phoneNumber: { user: '628123456789' },
                },
            },
        );
        const result = await get({ limit: Infinity });
        assert.deepEqual(
            result.map((call) => call.id),
            ['a', 'b', 'c'],
        );
        assert.equal(result[1].direction, 'outgoing');
        assert.equal(result[1].callDuration, 14);
        assert.equal(result[0].callDuration, null);
        assert.equal(result[0].callParticipants[0].outcome, 1);
        assert.equal(result[0].bytesReceived, 123);
        assert.equal(result[0].rawData.viewMode, 'CALL_LOG_OFFLINE_RESUME');
        assert.equal(result[0].contact.number, '628123456789');
        assert.equal(state.batches.length, 2);
        assert.deepEqual(state.batches[0], {
            count: 50,
            searchTerm: '',
            direction: 'before',
        });
        assert.equal(state.cleaned, true);
    });

    it('caps finite results despite batch overshoot and keeps absent contacts null', async function () {
        const { get, state } = setup([
            [makeCall('a', 20), makeCall('b', 10)],
            [],
        ]);
        const result = await get({ limit: 1 });
        assert.equal(result.length, 1);
        assert.equal(result[0].contact, null);
        assert.equal(state.batches.length, 1);
        assert.equal(state.cleaned, true);
    });

    it('returns an empty array for empty history and cleans up on query failure', async function () {
        const empty = setup([[]]);
        assert.deepEqual(await empty.get(), []);
        assert.equal(empty.state.cleaned, true);
        const failure = new Error('native query failed');
        const failing = setup([], { failure });
        await assert.rejects(failing.get(), (error) => error === failure);
        assert.equal(failing.state.cleaned, true);
    });

    it('rejects invalid limits before evaluating browser code', async function () {
        const { get, state } = setup([]);
        for (const limit of [0, -1, 1.5, NaN, 'all']) {
            await assert.rejects(get({ limit }), RangeError);
        }
        assert.equal(state.batches.length, 0);
    });
});
