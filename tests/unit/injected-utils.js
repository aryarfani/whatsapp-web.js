'use strict';

const { expect } = require('chai');

const { LoadUtils } = require('../../src/util/Injected/Utils');

describe('Injected chat model utilities', function () {
    afterEach(function () {
        delete global.window;
    });

    it('skips last-message lookup when the serialized key is missing', async function () {
        let messageLookupCount = 0;
        global.window = {
            require(moduleName) {
                if (moduleName === 'WAWebCollections') {
                    return {
                        Msg: {
                            get() {
                                messageLookupCount += 1;
                                throw new Error(
                                    'Msg.get must not receive an absent key',
                                );
                            },
                            getMessagesById() {
                                throw new Error(
                                    'Msg.getMessagesById must not receive an absent key',
                                );
                            },
                        },
                    };
                }
                throw new Error(`Unexpected WhatsApp module: ${moduleName}`);
            },
        };
        LoadUtils();

        const model = await window.WWebJS.getChatModel({
            id: { _serialized: '0@c.us' },
            formattedTitle: 'Pseudo chat',
            lastReceivedKey: {},
            serialize() {
                return { msgs: [{}] };
            },
        });

        expect(model.lastMessage).to.equal(null);
        expect(messageLookupCount).to.equal(0);
    });
});
