const { expect } = require('chai');

const Message = require('../../src/structures/Message');

describe('Message media download', function () {
    afterEach(function () {
        delete global.window;
    });

    it('downloads media for a modern LID message key from the resolved blob cache', async function () {
        const serializedId =
            'false_240131655135475@lid_ACA773752D55923CD5C46178E1F6CC08';
        const blob = new Blob([Buffer.from('hello')]);
        const waMessage = {
            mediaData: { mediaStage: 'INIT' },
            mediaObject: { filehash: 'file-hash' },
            mimetype: 'image/jpeg',
            filename: 'photo.jpg',
            size: 5,
            downloadMedia: async () => undefined,
        };
        global.window = {
            WWebJS: {
                arrayBufferToBase64Async: async (arrayBuffer) =>
                    Buffer.from(arrayBuffer).toString('base64'),
            },
            require(moduleName) {
                if (moduleName === 'WAWebCollections') {
                    return {
                        Msg: {
                            get(messageId) {
                                expect(messageId).to.equal(serializedId);
                                return waMessage;
                            },
                        },
                    };
                }
                if (moduleName === 'WAWebMediaInMemoryBlobCache') {
                    return {
                        InMemoryMediaBlobCache: {
                            get(filehash) {
                                expect(filehash).to.equal('file-hash');
                                return blob;
                            },
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
        const message = new Message(client, {
            id: {
                fromMe: false,
                remote: '240131655135475@lid',
                id: 'ACA773752D55923CD5C46178E1F6CC08',
                $1: serializedId,
            },
            directPath: '/media.enc',
            type: 'image',
        });

        const media = await message.downloadMedia();

        expect(media.data).to.equal('aGVsbG8=');
        expect(media.mimetype).to.equal('image/jpeg');
        expect(media.filename).to.equal('photo.jpg');
        expect(media.filesize).to.equal(5);
    });
});
