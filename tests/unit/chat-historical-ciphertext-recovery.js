'use strict';

const { expect } = require('chai');
const Chat = require('../../src/structures/Chat');

describe('Chat historical ciphertext recovery', function () {
    afterEach(function () {
        delete global.window;
    });

    it('requests one native recovery batch when fetchMessages opts in', async function () {
        const ciphertext = {
            id: { _serialized: 'false_group_cipher', fromMe: false },
            type: 'ciphertext',
            isNotification: false,
            t: 1786570000,
            body: '',
            from: '120363@g.us',
            to: '628000@c.us',
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
        expect(recoveryBatch).to.deep.equal([ciphertext]);
        expect(visibleFlag).to.equal(true);
    });
});
