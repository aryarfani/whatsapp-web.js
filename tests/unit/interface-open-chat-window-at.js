'use strict';

const { expect } = require('chai');
const InterfaceController = require('../../src/util/InterfaceController');

describe('InterfaceController.openChatWindowAt', function () {
    afterEach(function () {
        delete global.window;
    });

    it('passes the current object-shaped search context input', async function () {
        const messageId = 'false_group_message';
        const message = { id: { remote: '120363@g.us', id: 'message-1' } };
        const chat = { id: '120363@g.us' };
        const expectedContext = { collection: {}, msg: message };
        let receivedSearchInput = null;
        let receivedOpenInput = null;

        global.window = {
            require(moduleName) {
                if (moduleName === 'WAWebCollections') {
                    return {
                        Msg: {
                            get: (id) => (id === messageId ? message : null),
                            getMessagesById: async () => ({ messages: [] }),
                        },
                        Chat: {
                            get: () => chat,
                            find: async () => chat,
                        },
                    };
                }
                if (moduleName === 'WAWebChatMessageSearch') {
                    return {
                        getSearchContext(input) {
                            receivedSearchInput = input;
                            if (!input?.chat || !input?.msgKey) {
                                throw new TypeError(
                                    'Expected { chat, msgKey }',
                                );
                            }
                            return expectedContext;
                        },
                    };
                }
                if (moduleName === 'WAWebCmd') {
                    return {
                        Cmd: {
                            openChatAt(input) {
                                receivedOpenInput = input;
                            },
                        },
                    };
                }
                throw new Error(`Unexpected module: ${moduleName}`);
            },
        };

        const controller = new InterfaceController({
            pupPage: {
                evaluate: async (callback, ...args) => callback(...args),
            },
        });

        await controller.openChatWindowAt(messageId);

        expect(receivedSearchInput).to.deep.equal({
            chat,
            msgKey: message.id,
        });
        expect(receivedOpenInput).to.deep.equal({
            chat,
            msgContext: expectedContext,
        });
    });
});
