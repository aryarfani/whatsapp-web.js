'use strict';

const { expect } = require('chai');
const Chat = require('../../src/structures/Chat');

describe('Chat historical ciphertext recovery', function () {
    afterEach(function () {
        delete global.window;
    });

    it('waits for native recovery and returns the updated message', async function () {
        const typeListeners = new Set();
        const ciphertext = {
            id: { _serialized: 'false_group_cipher', fromMe: false },
            type: 'ciphertext',
            isNotification: false,
            t: 1786570000,
            body: '',
            from: '120363@g.us',
            to: '628000@c.us',
            on(event, listener) {
                if (event === 'change:type') typeListeners.add(listener);
            },
            off(event, listener) {
                if (event === 'change:type') typeListeners.delete(listener);
            },
        };
        const ordinary = {
            id: { _serialized: 'false_group_chat', fromMe: false },
            type: 'chat',
            isNotification: false,
            t: 1786570001,
            body: 'hello',
            from: '120363@g.us',
            to: '628000@c.us',
        };
        let recoveryBatch = null;
        let visibleFlag = null;

        global.window = {
            WWebJS: {
                getChat: async () => ({
                    msgs: { getModelsArray: () => [ciphertext, ordinary] },
                }),
                getMessageModel: (message) => ({ ...message }),
            },
            require(moduleName) {
                if (
                    moduleName ===
                    'WAWebNonMessageDataRequestPlaceholderMessageResendUtils'
                ) {
                    return {
                        handlePlaceholderMsgsSeen(messages, isVisible) {
                            recoveryBatch = messages;
                            visibleFlag = isVisible;
                            setTimeout(() => {
                                ciphertext.type = 'chat';
                                ciphertext.body = 'recovered text';
                                for (const listener of typeListeners) {
                                    listener(ciphertext);
                                }
                            }, 0);
                        },
                    };
                }
                throw new Error(`Unexpected module: ${moduleName}`);
            },
        };

        const client = {
            pupPage: {
                evaluate: async (callback, ...args) => callback(...args),
            },
        };
        const chat = new Chat(client, {
            id: { _serialized: '120363@g.us' },
            formattedTitle: 'Affected group',
            isGroup: true,
        });

        const messages = await chat.fetchMessages({
            limit: 2,
            recoverCiphertext: true,
        });

        expect(messages).to.have.lengthOf(2);
        expect(messages[0].type).to.equal('chat');
        expect(messages[0].body).to.equal('recovered text');
        expect(recoveryBatch).to.deep.equal([ciphertext]);
        expect(visibleFlag).to.equal(true);
    });
});
