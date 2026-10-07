'use strict';

const assert = require('node:assert/strict');
const Message = require('../../src/structures/Message');

function makeMessage(remote, isStatusV3) {
    return new Message(
        {},
        {
            id: { id: 'ABC', fromMe: false, remote },
            isStatusV3,
        },
    );
}

describe('Message Status detection', function () {
    it('recognizes Status broadcasts with string and nested remote IDs', function () {
        assert.equal(makeMessage('status@broadcast').isStatus, true);
        assert.equal(
            makeMessage({ _serialized: 'status@broadcast' }).isStatus,
            true,
        );
    });

    it('keeps ordinary string and nested contact IDs distinct from Status broadcasts', function () {
        assert.equal(makeMessage('contact@c.us').isStatus, false);
        assert.equal(
            makeMessage({ _serialized: 'contact@lid' }).isStatus,
            false,
        );
    });

    it('preserves the native Status flag', function () {
        assert.equal(makeMessage('contact@c.us', true).isStatus, true);
    });
});
